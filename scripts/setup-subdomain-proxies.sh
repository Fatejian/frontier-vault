#!/usr/bin/env bash
#
# frontier-vault 子域名端口分流配置脚本
#
# 作用：为 kb / plan / pmp 三个子域名建立独立的 server 块，在 80/443 上按 Host
#       分流，反向代理到各自的应用端口（8082 / 8081 / 8080）。
#
# 为什么必须这样做：DNS 记录只能映射到 IP，协议里没有端口字段。端口映射是
#       源站 Nginx 的职责，浏览器访问的始终是 https://<子域名>（默认 443）。
#
# 特性：幂等（标记块整体替换，可反复执行）、优先写 conf.d 独立文件、
#       无 include 时内联到 nginx.conf 的 http 块末尾（server 必须嵌在 http 内）、
#       冲突自动跳过、nginx -t 失败自动回滚
#
# 用法：
#   chmod +x setup-subdomain-proxies.sh
#   ./setup-subdomain-proxies.sh --dry-run      # 只看改动
#   ./setup-subdomain-proxies.sh                # 仅配置 80（HTTP）
#   SITE_MODE=https CERT_DIR=/etc/letsencrypt/live/fatejian.icu \
#       ./setup-subdomain-proxies.sh            # 配置 80 跳转 + 443（需先有证书）
#
set -euo pipefail

# ============ 可调参数 ============
NGINX_CONF="${NGINX_CONF:-/etc/nginx/nginx.conf}"
CONF_D="${CONF_D:-/etc/nginx/conf.d}"
SITES_FILE="${SITES_FILE:-$CONF_D/subdomain-proxies.conf}"
ACME_ROOT="${ACME_ROOT:-/var/www/certbot}"      # acme.sh --webroot 的落盘目录
SITE_MODE="${SITE_MODE:-http}"                  # http | https
CERT_DIR="${CERT_DIR:-/etc/letsencrypt/live/fatejian.icu}"
PROXY_TIMEOUT="${PROXY_TIMEOUT:-120s}"
BODY_SIZE="${BODY_SIZE:-50m}"
BACKUP_KEEP="${BACKUP_KEEP:-3}"
# 是否额外监听 IPv6。云主机常常没配 IPv6，此时 listen [::] 会在 reload/restart
# 时绑定失败（socket() [::]:80 failed: Address family not supported），故默认关闭。
ENABLE_IPV6="${ENABLE_IPV6:-0}"
# 诊断响应头 X-Upstream-Port：默认不输出。它能一眼确认请求命中了哪个上游端口，
# 但属于对外暴露内部结构，需要时用 DIAG_HEADER=1 临时开启即可。
DIAG_HEADER="${DIAG_HEADER:-0}"
# ===================================

# 子域名 : 端口 : 上游 SNI : 上游协议
#
# ⚠️ 端口语义：8080 / 8081 / 8082 在源站是`listen XXXX ssl`，即**上游本身是HTTPS**。
#    明文 http:// 请求打到 ssl 端口会被直接断开（502），因此协议必须写 https。
#    SNI 取上游 server_name 中真实存在的值，让上游选对 server 块：
#      8082 的 server_name 是 `_`（通配），用哪个都行；
#      8080 / 8081 的 server_name 是 fatejian.icu，故填 fatejian.icu。
DOMAINS=(
  "kb.fatejian.icu:8082:kb.fatejian.icu:https"
  "plan.fatejian.icu:8081:fatejian.icu:https"
  "pmp.fatejian.icu:8080:fatejian.icu:https"
)

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

MARK="# >>> subdomain-proxies (managed by setup-subdomain-proxies.sh) >>>"
MARK_END="# <<< subdomain-proxies (managed by setup-subdomain-proxies.sh) <<<"

TMPD=""
RED="" GREEN="" YELLOW="" NC=""
if [[ -t 1 ]]; then
  RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; NC=$'\033[0m'
fi

ok()   { printf '  %s✓%s %s\n' "$GREEN" "$NC" "$1"; }
warn() { printf '  %s!%s %s\n' "$YELLOW" "$NC" "$1"; }
err()  { printf '  %s✗%s %s\n' "$RED" "$NC" "$1"; }
step() { printf '\n%s==>%s %s\n' "$GREEN" "$NC" "$1"; }

TMPD="$(mktemp -d)"
cleanup() { [[ -n "$TMPD" && -d "$TMPD" ]] && rm -rf "$TMPD"; }
trap cleanup EXIT

# ---------- 前置检查 ----------
step "前置检查"

if [[ $EUID -ne 0 ]]; then
  err "需要 root 权限，请用 sudo 运行"; exit 1
fi
ok "root 权限"

[[ -f "$NGINX_CONF" ]] || { err "找不到配置文件：$NGINX_CONF"; exit 1; }
ok "配置文件：$NGINX_CONF"

command -v nginx >/dev/null 2>&1 || { err "未找到 nginx 命令"; exit 1; }
ok "nginx：$(nginx -v 2>&1 | sed 's|nginx version: ||')"

if [[ "$SITE_MODE" == "https" ]]; then
  [[ -f "$CERT_DIR/fullchain.pem" && -f "$CERT_DIR/privkey.pem" ]] \
    || { err "SITE_MODE=https 但证书缺失：$CERT_DIR/{fullchain.pem,privkey.pem}
       先在 http 模式下完成分流验证，再用 acme.sh 签发子域名证书，再重跑本脚本。"; exit 1; }
  ok "证书：$CERT_DIR"
fi

# ---------- 探测后端端口是否在监听 ----------
step "探测后端端口"
for entry in "${DOMAINS[@]}"; do
  IFS=':' read -r host port _sni _scheme <<< "$entry"
  if (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null; then
    exec 3<&- 3>&-
    ok "$host → 127.0.0.1:$port 端口已监听"
  else
    warn "$host → 127.0.0.1:$port 未监听（配置可先写，反代会 502）"
  fi
done

# ---------- 生成配置片段 ----------
step "生成配置片段"

# WebSocket 支持所需的 map，用独立变量名避免与已有 map 冲突
cat > "$TMPD/frag.head" <<'TPL'
@@MARK@@
# 子域名端口分流：Host → 本机应用端口。
# DNS 只能指到 IP，端口映射只能在此处完成。
map $http_upgrade $fv_subdomain_upgrade_conn {
    default upgrade;
    ''      close;
}

TPL
sed -i "s|@@MARK@@|$MARK|" "$TMPD/frag.head"

: > "$TMPD/frag.servers"

gen_proxy_body() {
  # $1=端口  $2=上游协议(http|https)  $3=上游 SNI
  cat <<TPL
        proxy_pass ${2}://127.0.0.1:$1;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$fv_subdomain_upgrade_conn;
        proxy_connect_timeout 10s;
        proxy_read_timeout $PROXY_TIMEOUT;
        proxy_send_timeout $PROXY_TIMEOUT;
        proxy_buffering off;
TPL

  if [[ "${2}" == "https" ]]; then
    cat <<TPL
        # 上游是 listen ssl 端口：明文请求会被直接断开，故 proxy_pass 必须是 https://
        proxy_ssl_server_name on;
        proxy_ssl_name ${3};
        # 源站证书签的是域名，与 127.0.0.1 不匹配，校验必然失败，故关闭。
        # 风险可控：流量走本机回环，不经过任何不可信网络。
        proxy_ssl_verify off;
        # 复用 TLS 会话，避免每个请求重新握手（默认即on，显式写出便于理解）
        proxy_ssl_session_reuse on;
TPL
  fi
}

for entry in "${DOMAINS[@]}"; do
  # 兼容两种写法：host:port（旧）与 host:port:sni:scheme（新）
  IFS=':' read -r host port sni scheme <<< "$entry"
  if [[ -z "${sni:-}" ]]; then sni="$host"; fi
  if [[ -z "${scheme:-}" ]]; then scheme="http"; fi

  # ---- 80 server ----
  {
    echo "server {"
    echo "    listen 80;"
    if [[ "$ENABLE_IPV6" == "1" ]]; then echo "    listen [::]:80;"; fi
    echo "    server_name ${host};"
    echo ""
    if [[ "$SITE_MODE" == "https" ]]; then
      echo "    # 已有证书，统一跳转 HTTPS（ACME 验证仍走 80，故放行挑战路径）"
      echo "    location /.well-known/acme-challenge/ {"
      echo "        root ${ACME_ROOT};"
      echo "        default_type \"text/plain\";"
      echo "    }"
      echo "    location / { return 301 https://\$host\$request_uri; }"
    else
      echo "    # acme.sh --webroot 签证书需要这条；不影响反代"
      echo "    location /.well-known/acme-challenge/ {"
      echo "        root ${ACME_ROOT};"
      echo "        default_type \"text/plain\";"
      echo "    }"
      echo ""
      echo "    client_max_body_size ${BODY_SIZE};"
      if [[ "$DIAG_HEADER" == "1" ]]; then
        echo "    # 诊断用：确认请求命中了哪个上游端口，确认无误后可删除此行"
        echo "    add_header X-Upstream-Port \"${port}\" always;"
      fi
      echo ""
      echo "    location / {"
      gen_proxy_body "$port" "$scheme" "$sni"
      echo "    }"
    fi
    echo "}"
    echo ""
  } >> "$TMPD/frag.servers"

  # ---- 443 server（仅 https 模式）----
  if [[ "$SITE_MODE" == "https" ]]; then
    {
      echo "server {"
      echo "    listen 443 ssl;"
      if [[ "$ENABLE_IPV6" == "1" ]]; then echo "    listen [::]:443 ssl;"; fi
      # nginx >= 1.25.1 可另起一行 http2 on; 旧版本用 listen 443 ssl http2;
      echo "    server_name ${host};"
      echo ""
      echo "    ssl_certificate     ${CERT_DIR}/fullchain.pem;"
      echo "    ssl_certificate_key ${CERT_DIR}/privkey.pem;"
      echo "    ssl_protocols TLSv1.2 TLSv1.3;"
      echo "    ssl_session_cache shared:SSL:10m;"
      echo "    ssl_session_timeout 1d;"
      echo ""
      echo "    client_max_body_size ${BODY_SIZE};"
      if [[ "$DIAG_HEADER" == "1" ]]; then
        echo "    # 诊断用，确认无误后可删除"
        echo "    add_header X-Upstream-Port \"${port}\" always;"
      fi
      echo ""
      echo "    location / {"
      gen_proxy_body "$port" "$scheme" "$sni"
      echo "    }"
      echo "}"
      echo ""
    } >> "$TMPD/frag.servers"
  fi
done

cat "$TMPD/frag.head" "$TMPD/frag.servers" > "$TMPD/frag.txt"
echo "$MARK_END" >> "$TMPD/frag.txt"

# 统计 server 块数而不是 grep 'server_name' —— 后者会把 proxy_ssl_server_name
# 一并计入（子串匹配），报出 2 倍的错误数字，误导排查。
FRAG_BLOCKS=$(grep -cE '^[[:space:]]*server[[:space:]]*\{' "$TMPD/frag.txt")

# 写入前自检：nginx 是**按 listen 端口分组**判定 server_name 冲突的——
# 同一端口内出现重复才会被静默忽略（表现为"某个子域名怎么配都不生效"）。
# https 模式下每个子域名有 80 与 443 两个块，属合法配对，不能按全局计数误报。
FRAG_CONFLICT=$(awk '
  /^[[:space:]]*server[[:space:]]*\{/ { port=""; next }
  /^[[:space:]]*listen[[:space:]]/ && port == "" {
    s = $0
    sub(/^[[:space:]]*listen[[:space:]]+/, "", s)
    sub(/;.*$/, "", s)
    split(s, t, /[[:space:]]+/)
    port = t[1]
    sub(/^.*:/, "", port)
    next
  }
  /^[[:space:]]*server_name[[:space:]]/ {
    s = $0
    sub(/^[[:space:]]*server_name[[:space:]]+/, "", s)
    gsub(/;$/, "", s)
    n = split(s, names, /[[:space:]]+/)
    for (i = 1; i <= n; i++) {
      if (names[i] == "") continue
      key = port "|" names[i]
      if (key in seen) { print "    端口 " port " 下 server_name " names[i] " 重复"; dup = 1; continue }
      seen[key] = 1
    }
  }
  END { }
' "$TMPD/frag.txt")

if [[ -n "$FRAG_CONFLICT" ]]; then
  err "片段内存在同一 listen 端口下的重复 server_name，nginx 会静默忽略其中一份："
  printf '%s\n' "$FRAG_CONFLICT"
  err "请先修正第 45-55 行的 DOMAINS 数组"
  exit 1
fi
ok "片段已生成（${FRAG_BLOCKS} 个 server 块，server_name 无冲突）"

# ---------- 选择注入位置 ----------
# 模式 A：nginx.conf 的 http 块已 include conf.d/*.conf → 写独立文件（不动主配置，最安全）
# 模式 B：单文件配置 → 内联插入 http 块末尾
if grep -qF "$CONF_D/*.conf;" "$NGINX_CONF"; then
  MODE=conf_d
  TARGET="$SITES_FILE"
else
  MODE=inline
  TARGET="$NGINX_CONF"
fi

step "注入位置"
if [[ "$MODE" == "conf_d" ]]; then
  ok "检测到 include ${CONF_D}/*.conf; → 写入独立文件 $TARGET"
else
  warn "未检测到 include ${CONF_D}/*.conf; → 内联插入 $NGINX_CONF 的 http 块末尾"
  if grep -qF "$MARK" "$NGINX_CONF"; then
    ok "已存在旧的标记块，将整体替换（幂等）"
  fi
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  step "DRY-RUN：将写入 $TARGET 的内容"
  cat "$TMPD/frag.txt"
  exit 0
fi

# ---------- 备份 ----------
step "备份"
mkdir -p "$(dirname "$TARGET")"
BACKUP="${TARGET}.bak.$(date +%Y%m%d-%H%M%S)"
[[ -f "$TARGET" ]] && cp -a "$TARGET" "$BACKUP" && ok "已备份到 $BACKUP" || ok "目标文件不存在，无需备份（首次执行）"

# ---------- 写入 ----------
if [[ "$MODE" == "conf_d" ]]; then
  cat "$TMPD/frag.txt" > "$TARGET"
  ok "已写入 $TARGET"
else
  # 剥离旧标记块后，把新片段插到 http 块的闭合 } 之前
  awk -v frag="$TMPD/frag.txt" -v mb="$MARK" -v me="$MARK_END" '
    BEGIN { inhttp=0; depth=0; done=0; inblk=0 }
    {
      if ($0 == mb) { inblk=1; next }
      if ($0 == me) { inblk=0; next }
      if (inblk) next

      line=$0
      s=line; o=gsub(/\{/,"",s); s=line; c=gsub(/\}/,"",s)

      if (!inhttp) {
        if (line ~ /^[ \t]*http[ \t]*\{/) inhttp=1
      } else if (!done && depth + o - c <= 0) {
        while ((getline l < frag) > 0) print l
        close(frag); done=1
      }

      print
      if (inhttp) depth += o - c
    }
    END { if (!done) exit 3 }
  ' "$NGINX_CONF" > "$TMPD/nginx.conf.new" \
    || { err "未能定位 http 块，已中止（文件未改动）"; exit 1; }
  mv "$TMPD/nginx.conf.new" "$TARGET"
  ok "已写入 $TARGET"
fi

# ---------- 校验并重载 ----------
step "校验并重载"

if nginx -t 2>&1 | tee "$TMPD/test.log"; then
  ok "nginx -t 通过"
  if nginx -s reload 2>/dev/null || systemctl reload nginx 2>/dev/null; then
    ok "nginx 已重载"
  else
    warn "重载失败，尝试重启"
    if systemctl restart nginx; then
      ok "nginx 已重启"
    else
      err "重启也失败，已自动回滚"
      cp -a "$BACKUP" "$TARGET" 2>/dev/null || true
      exit 1
    fi
  fi
else
  err "nginx -t 失败，正在自动回滚"
  cp -a "$BACKUP" "$TARGET" 2>/dev/null || true
  if nginx -t >/dev/null 2>&1; then
    ok "已回滚到备份：$BACKUP"
  else
    err "回滚后配置仍有问题，请立即手动检查 $TARGET"
  fi
  exit 1
fi

# ---------- 生效验证 ----------
step "生效验证"
sleep 1

for entry in "${DOMAINS[@]}"; do
  IFS=':' read -r host port _sni _scheme <<< "$entry"

  if [[ "$SITE_MODE" == "https" ]]; then
    # 1) https 模式下 80 只做 301 跳转，真正的反代在 443，探 80 一定拿到 3xx。
    # 2) HTTPS 的 server 块由 **SNI** 决定（Host 头不参与选择），必须用 --resolve
    #    把 SNI 设成子域名、连接指向回环；否则三个域名都会落到同一个默认 server 块，
    #    看起来"都通了"其实只测了一个。
    # 3) -k：证书签给域名而非 127.0.0.1，校验必然失败，这里只验连通性。
    CODE=$(curl -sk --max-time 10 --resolve "${host}:443:127.0.0.1" \
      -o /dev/null -w '%{http_code}' "https://${host}/" 2>/dev/null || echo "000")
    HIT=$(curl -skI --max-time 10 --resolve "${host}:443:127.0.0.1" \
      "https://${host}/" 2>/dev/null \
      | grep -i '^x-upstream-port' | tr -d '\r' | awk '{print $2}' || true)
  else
    CODE=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' \
      -H "Host: ${host}" "http://127.0.0.1/" 2>/dev/null || echo "000")
    HIT=$(curl -sI --max-time 10 -H "Host: ${host}" "http://127.0.0.1/" 2>/dev/null \
      | grep -i '^x-upstream-port' | tr -d '\r' | awk '{print $2}' || true)
  fi

  if [[ "$CODE" == "000" ]]; then
    err "$host → $port 无响应（检查应用是否在监听）"
  elif [[ "$CODE" =~ ^5 ]]; then
    err "$host → $port 返回 $CODE（反代未通，看 error.log）"
  elif [[ "$CODE" =~ ^3 ]]; then
    warn "$host → $port 返回 $CODE（跳转而非内容，确认 SITE_MODE 是否已生效）"
  else
    ok "$host → $port 返回 $CODE${HIT:+（响应头确认命中 $HIT）}"
  fi
done

# ---------- 清理旧备份 ----------
step "清理旧备份"
mapfile -t OLD < <(ls -1t "${TARGET}".bak.* 2>/dev/null | tail -n +$((BACKUP_KEEP + 1)))
if [[ ${#OLD[@]} -gt 0 ]]; then
  rm -f "${OLD[@]}"
  ok "已清理 ${#OLD[@]} 个旧备份"
else
  ok "无需清理"
fi

printf '\n%s完成%s  目标文件：%s\n' "$GREEN" "$NC" "$TARGET"

if [[ "$SITE_MODE" == "http" ]]; then
cat <<'NEXT'
下一步：签发证书并开启 443
────────────────────────────────────────────────────────────
1. 先从外部确认 HTTP 分流已通（DNS 已指向源站）：
     curl -I http://kb.fatejian.icu

2. 签一张包含三个子域名的证书。
   注意：Let's Encrypt 的 HTTP-01 验证**签不了泛域名**，必须列全三个子域名，
   签成一张 SAN 证书（也正好对应脚本的单一 CERT_DIR 设计）：
     mkdir -p /var/www/certbot
     curl https://get.acme.sh | sh -s email=you@example.com
     /root/.acme.sh/acme.sh --issue --server letsencrypt \
       -d kb.fatejian.icu -d plan.fatejian.icu -d pmp.fatejian.icu \
       --webroot /var/www/certbot
     /root/.acme.sh/acme.sh --install-cert -d kb.fatejian.icu \
       --key-file       /etc/letsencrypt/live/kb.fatejian.icu/privkey.pem \
       --fullchain-file /etc/letsencrypt/live/kb.fatejian.icu/fullchain.pem \
       --reloadcmd      "nginx -s reload"
   ⚠️ --install-cert 不会自动创建目录，会报
     "touch: cannot touch ...: No such file or directory"。
     目录名由签发时的第一个 -d 决定，必须先建好：
     mkdir -p /etc/letsencrypt/live/kb.fatejian.icu
   证书目录名由签发时的**第一个** -d 决定，先确认实际目录名：
     ls /etc/letsencrypt/live/
   若确实想要泛域名，只能走 DNS-01（Cloudflare API Token + dns_cf 插件），
   并且还要把 apex 也纳入管理，收益不大。

3. 加装自动续期：
     crontab -e
     0 3 * * * "/root/.acme.sh/acme.sh" --cron --home /root/.acme.sh >> /var/log/acme-cron.log 2>&1

4. 开启 443 与 HTTP→HTTPS 跳转（CERT_DIR 换成第 2 步确认到的目录）：
     SITE_MODE=https CERT_DIR=/etc/letsencrypt/live/kb.fatejian.icu \
       ./setup-subdomain-proxies.sh

5. 收紧暴露面 ——顺序不能颠倒，先验证再收紧：
     a. 先做完第 4 步，并从外部确认 https:// 三个子域名都能打开
     b. 再把 8080/8081/8082 的 listen 改成 127.0.0.1（反代走回环，不受影响）
     c. 最后删掉安全组里 8080-8082 的入方向规则
   这三个端口绑在 0.0.0.0 且各自带 SSL 证书，也就是可以
   https://<源站IP>:8082 直接打开完整站点，绕过 Cloudflare 与主入口。
   反过来先收紧会导致子域名直接不可用。
NEXT
else
  printf '\n验证：curl -sI https://kb.fatejian.icu | head -5\n'
fi