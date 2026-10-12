#!/usr/bin/env bash
#
# frontier-vault Nginx 性能优化配置脚本
#
# 作用：为 www.fatejian.icu 注入压缩、缓存头、分项耗时日志
# 特性：幂等（可重复执行）、冲突检测、nginx -t 失败自动回滚
#
# 用法：
#   chmod +x setup-nginx-perf.sh
#   ./setup-nginx-perf.sh                 # 正常执行
#   ./setup-nginx-perf.sh --dry-run       # 只看改动，不写入
#   NGINX_CONF=/path/to/nginx.conf ./setup-nginx-perf.sh
#
set -euo pipefail

# ============ 可调参数（一般无需修改） ============
NGINX_CONF="${NGINX_CONF:-/etc/nginx/nginx.conf}"
ROOT_PATH="${ROOT_PATH:-/var/www/frontier-vault}"   # 用于定位目标 server 块
HOST_MATCH="${HOST_MATCH:-fatejian.icu}"              # 用于定位目标 server 块
CACHE_DAYS="${CACHE_DAYS:-30}"
REVALIDATE="${REVALIDATE:-86400}"
HTML_MAXAGE="${HTML_MAXAGE:-600}"   # CDN 下的关键值：10 分钟零回源
BACKUP_KEEP="${BACKUP_KEEP:-3}"
# =============================================

DRY_RUN=0
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=1

MARK_HTTP="### BEGIN perf-http (managed by perf.sh) ###"
MARK_HTTP_END="### END perf-http (managed by perf.sh) ###"
MARK_CACHE="### BEGIN perf-cache (managed by perf.sh) ###"
MARK_CACHE_END="### END perf-cache (managed by perf.sh) ###"

TMPD=""
RED="" GREEN="" YELLOW="" NC=""
if [[ -t 1 ]]; then
    RED=$'\033[31m'; GREEN=$'\033[32m'; YELLOW=$'\033[33m'; NC=$'\033[0m'
fi

ok()   { printf '  %s✓%s %s\n' "$GREEN" "$NC" "$1"; }
warn() { printf '  %s!%s %s\n' "$YELLOW" "$NC" "$1"; }
err()  { printf '  %s✗%s %s\n' "$RED" "$NC" "$1"; }
step() { printf '\n%s==>%s %s\n' "$GREEN" "$NC" "$1"; }

cleanup() { [[ -n "$TMPD" && -d "$TMPD" ]] && rm -rf "$TMPD"; }
trap cleanup EXIT

# ---------- 前置检查 ----------
step "前置检查"

if [[ $EUID -ne 0 ]]; then
err "需要 root 权限，请用 sudo 运行"; exit 1
fi
ok "root 权限"

if [[ ! -f "$NGINX_CONF" ]]; then
    err "找不到配置文件：$NGINX_CONF"; exit 1
fi
ok "配置文件：$NGINX_CONF"

command -v nginx >/dev/null 2>&1 || { err "未找到 nginx 命令"; exit 1; }
ok "nginx：$(nginx -v 2>&1 | sed 's|nginx version: ||')"

if ! grep -qE '^[[:space:]]*http[[:space:]]*\{' "$NGINX_CONF"; then
    err "配置中没有 http 块，无法注入"; exit 1
fi

# 目标 server 块定位：优先按 root 匹配，避免同域名多站（实测 8080 的
# pmp-admin 也带 server_name fatejian.icu）被误判成目标而写错配置。
detect_target() {
    awk -v mode="$1" -v root="$ROOT_PATH" -v host="$HOST_MATCH" '
        BEGIN { found=0 }
        { line=$0
          if (line ~ /^[ \t]*#/) next
          if (line ~ /server[ \t]*\{/) { inS=1; d0=d; t=0 }
          if (inS && !t) {
            if (mode == "root" && index(line, root) > 0) t=1
            if (mode == "host" && line ~ /server_name/ && index(line, host) > 0) t=1
          }
          s=line; o=gsub(/\{/, "", s); s=line; c=gsub(/\}/, "", s)
          if (inS && t && d+o-c <= d0) { found=1; exit }
          d += o-c
          if (inS && d <= d0) inS=0
        }
        END { print (found ? "yes" : "no") }
    ' "$NGINX_CONF"
}

TARGET_FOUND=no
MATCH_MODE=none
if [[ "$(detect_target root)" == "yes" ]]; then
    TARGET_FOUND=yes
    MATCH_MODE=root
elif [[ "$(detect_target host)" == "yes" ]]; then
    TARGET_FOUND=yes
    MATCH_MODE=host
fi

if [[ "$TARGET_FOUND" == "yes" ]]; then
    if [[ "$MATCH_MODE" == "root" ]]; then
        ok "已定位目标 server 块（按 root=$ROOT_PATH）"
    else
        warn "未按 root 匹配到，改用 server_name 含 $HOST_MATCH 匹配"
        echo "      ⚠ 若服务器上有多个同域名站点，请务必用 --dry-run 核对注入位置"
    fi
else
    warn "未找到目标 server 块，将只注入 http 级配置，缓存头需手动添加"
fi

# ---------- 备份 ----------
step "备份"
BACKUP="${NGINX_CONF}.bak.$(date +%Y%m%d-%H%M%S)"
cp -a "$NGINX_CONF" "$BACKUP"
ok "已备份到 $BACKUP"

TMPD="$(mktemp -d)"

# ---------- 生成配置片段 ----------
# 设计要点：每个层级只包裹一对标记，保证重复执行时标记块能整体替换而不累积。
step "生成配置片段"

# ---- http 级：内容先攒进 body，最后统一包裹 ----
HBODY="$TMPD/http.body"; : > "$HBODY"
HAS_BROTLI=0
nginx -V 2>&1 | grep -q -- --with-http_brotli && HAS_BROTLI=1

if grep -qE '^[[:space:]]*gzip[[:space:]]+(on|off)' "$NGINX_CONF"; then
    warn "已存在 gzip 配置，跳过压缩注入。现有的行："
    grep -nE '^[[:space:]]*gzip' "$NGINX_CONF" | sed 's/^/      /'
else
    {
        echo "    # ---- 压缩：HAR 实测 39/39 响应未压缩，文本资源 1274KB ----"
        echo "    gzip on;"
        echo "    gzip_vary on;"
        echo "    gzip_proxied any;          # 源站前接 CDN 时必需"
        echo "    gzip_min_length 1024;"
        echo "    gzip_comp_level 6;"
        echo "    gzip_types"
        echo "        text/plain"
        echo "        text/css"
        echo "        text/javascript"
        echo "        application/javascript"
        echo "        application/json"
        echo "        application/xml"
        echo "        application/rss+xml"
        echo "        image/svg+xml;"
        if [[ $HAS_BROTLI -eq 1 ]]; then
            echo "    # ---- brotli：已检测到 ngx_brotli 模块 ----"
            echo "    brotli on;"
            echo "    brotli_static on;"
            echo "    brotli_comp_level 5;"
            echo "    brotli_types"
            echo "        text/plain"
            echo "        text/css"
            echo "        text/javascript"
            echo "        application/javascript"
            echo "        application/json"
            echo "        application/xml"
            echo "        image/svg+xml;"
        fi
    } >> "$HBODY"
    ok "已生成压缩配置$([[ $HAS_BROTLI -eq 1 ]] && echo '（含 brotli）')"
fi

if grep -qE '^[[:space:]]*log_format[[:space:]]+perf\b' "$NGINX_CONF"; then
    warn "已存在 log_format perf，跳过日志格式注入"
else
    {
        echo "    # ---- 分项耗时：区分服务器慢 vs 传输慢，静态站 urt 为空即纯网络耗时 ----"
        echo "    log_format perf"
        echo "        '\$remote_addr \$status '"
        echo "        'rt=\$request_time '"
        echo "        'urt=\$upstream_response_time '"
        echo "        'bytes=\$body_bytes_sent '"
        echo "        'ua=\"\$http_user_agent\" '"
        echo "        'url=\"\$uri\"';"
    } >> "$HBODY"
    ok "已生成分项耗时日志格式"
fi

FRAG_HTTP="$TMPD/http.txt"
if [[ -s "$HBODY" ]]; then
    { echo "$MARK_HTTP"; cat "$HBODY"; echo "$MARK_HTTP_END"; } > "$FRAG_HTTP"
else
    : > "$FRAG_HTTP"
fi

# ---- server 级 ----
SBODY="$TMPD/server.body"; : > "$SBODY"
FRAG_SERVER="$TMPD/server.txt"; : > "$FRAG_SERVER"

if [[ "$TARGET_FOUND" == "yes" ]]; then
    if grep -qE 'location[^;]*[/]assets' "$NGINX_CONF"; then
        warn "已存在 location /assets，跳过（避免 duplicate location 报错）"
        echo "      请确认它是否已有 immutable 缓存头"
    else
        {
            echo "    # VitePress 产物带内容 hash，可永久缓存"
            echo "    location /assets/ {"
            echo "        expires ${CACHE_DAYS}d;"
            echo "        add_header Cache-Control \"public, immutable\";"
            echo "        try_files \$uri =404;"
            echo "    }"
        } >> "$SBODY"
        ok "已生成 /assets/ 缓存配置"
    fi

    if ! grep -qE 'location[[:space:]]*=[[:space:]]*/favicon\.ico' "$NGINX_CONF"; then
        {
            echo "    # 消除 error.log 噪音（实测每小时刷屏）"
            echo "    location = /favicon.ico {"
            echo "        access_log off;"
            echo "        log_not_found off;"
            echo "        return 204;"
            echo "    }"
        } >> "$SBODY"
    fi

    CH_EXISTS=$(awk -v mode="$MATCH_MODE" -v root="$ROOT_PATH" -v host="$HOST_MATCH" '
        BEGIN { found=0 }
        { line=$0
          if (line ~ /^[ \t]*#/) next
          if (line ~ /server[ \t]*\{/) { inS=1; d0=d; t=0 }
          if (inS && !t) {
            if (mode == "root" && index(line, root) > 0) t=1
            if (mode == "host" && line ~ /server_name/ && index(line, host) > 0) t=1
          }
          if (inS && t && line ~ /add_header[ \t]+[Cc]ache-[Cc]ontrol/) { found=1; exit }
          s=line; o=gsub(/\{/, "", s); s=line; c=gsub(/\}/, "", s)
          d += o-c
          if (inS && d <= d0) inS=0
        }
        END { print (found ? "yes" : "no") }
    ' "$NGINX_CONF")

    if [[ "$CH_EXISTS" == "yes" ]]; then
        warn "目标 server 块已有 add_header Cache-Control，跳过 HTML 缓存头以免重复"
        echo "      建议人工确认：应为 max-age=$HTML_MAXAGE, stale-while-revalidate=$REVALIDATE"
    else
        {
            echo "    # HTML 缓存 ${HTML_MAXAGE}s + SWR：CDN 下可实现零回源，是链路不可改时的关键"
            echo "    location / {"
            echo "        add_header Cache-Control \"public, max-age=$HTML_MAXAGE, stale-while-revalidate=$REVALIDATE\";"
            echo "        try_files \$uri \$uri.html =404;"
            echo "    }"
        } >> "$SBODY"
        ok "已生成 HTML 缓存配置"
    fi
fi

if [[ -s "$SBODY" ]]; then
    { echo "$MARK_CACHE"; cat "$SBODY"; echo "$MARK_CACHE_END"; } > "$FRAG_SERVER"
fi

# ---------- 注入 ----------
step "注入配置"

inject_http() {
    awk -v frag="$FRAG_HTTP" -v mb="$MARK_HTTP" -v me="$MARK_HTTP_END" '
        BEGIN { inb=0; done=0 }
        $0 == mb { inb=1; next }
        $0 == me { inb=0; next }
        inb { next }
        {
            print
            if (!done && $0 ~ /^[ \t]*http[ \t]*\{/) {
                while ((getline l < frag) > 0) print l
                close(frag); done=1
            }
        }
        END { if (!done) exit 3 }
    ' "$1"
}

inject_server() {
    awk -v fs="$FRAG_SERVER" \
          -v mcb="$MARK_CACHE" -v mce="$MARK_CACHE_END" \
          -v mode="$MATCH_MODE" -v root="$ROOT_PATH" -v host="$HOST_MATCH" '
        BEGIN { d=0; inS=0; t=0; ia=0 }
        {
            line=$0
            if (line ~ /^[ \t]*#/) { print line; next }

            if (line == mcb) { inb=1; next }
            if (line == mce) { inb=0; next }
            if (inb) next

            if (!inS && line ~ /server[ \t]*\{/) { inS=1; d0=d; t=0 }

            if (inS && !t) {
                if (mode == "root" && index(line, root) > 0) t=1
                if (mode == "host" && line ~ /server_name/ && index(line, host) > 0) t=1
            }

            s=line; o=gsub(/\{/, "", s); s=line; c=gsub(/\}/, "", s)

            # 只在第一个匹配到的 server 块内注入一次
            if (inS && t && !ia && d+o-c <= d0) {
                while ((getline l < fs) > 0) print l
                close(fs)
                ia=1
            }

            print line
            d += o-c
            if (inS && d <= d0) inS=0
        }
        END { exit (ia ? 0 : 3) }
    ' "$1"
}

OUT="$TMPD/nginx.conf.new"

if ! inject_http "$NGINX_CONF" > "$OUT"; then
    err "注入 http 配置失败：未定位到 http 块"; exit 1
fi
ok "http 级配置已注入"

if [[ -s "$FRAG_SERVER" ]]; then
    if inject_server "$OUT" > "$OUT.tmp"; then
    mv "$OUT.tmp" "$OUT"
        ok "server 级配置已注入"
    else
        warn "server 级注入失败（未定位到目标 server 块），已跳过"
        inject_http "$NGINX_CONF" > "$OUT"
    fi
fi

CHANGED_LINES=$(diff "$NGINX_CONF" "$OUT" | grep -c '^>' || true)
warn "共新增 $CHANGED_LINES 行"

if [[ $DRY_RUN -eq 1 ]]; then
    step "DRY-RUN：以下是将要写入的差异（不修改文件）"
    diff -u "$NGINX_CONF" "$OUT" || true
    exit 0
fi

cp "$OUT" "$NGINX_CONF"
ok "已写入 $NGINX_CONF"

# ---------- 校验并重载 ----------
step "校验并重载"

if nginx -t 2>&1 | tee "$TMPD/test.log"; then
    ok "nginx -t 通过"
    if nginx -s reload 2>/dev/null || systemctl reload nginx 2>/dev/null; then
        ok "nginx 已重载"
    else
        err "重载失败，尝试重启"
        if systemctl restart nginx; then
            ok "nginx 已重启"
        else
            err "重启也失败，已自动回滚"
            cp "$BACKUP" "$NGINX_CONF"
            exit 1
        fi
    fi
else
    err "nginx -t 失败，正在自动回滚"
    cp "$BACKUP" "$NGINX_CONF"
    if nginx -t >/dev/null 2>&1; then
        ok "已回滚到备份：$BACKUP"
    else
        err "回滚后配置仍有问题，请立即手动检查 $NGINX_CONF"
    fi
    exit 1
fi

# ---------- 生效验证 ----------
step "生效验证"

sleep 1

PROBE_URL=$(curl -fsS --max-time 10 "http://127.0.0.1/" 2>/dev/null \
    | grep -oE '/assets/[^"'"'"' ]+\.(css|js)' | head -1 || true)

if [[ -z "$PROBE_URL" ]]; then
    warn "未能自动探测到 /assets/ 资源（可能站点尚未部署），请手工验证："
    echo "      curl -sI -H 'Accept-Encoding: gzip' http://127.0.0.1/assets/<某文件> | grep -i content-encoding"
else
    echo "  探测资源：$PROBE_URL"
    ENC=$(curl -sI -H 'Accept-Encoding: gzip, br' "http://127.0.0.1${PROBE_URL}" | grep -i '^content-encoding' | tr -d '\r' || true)
    if [[ -n "$ENC" ]]; then
        ok "压缩已生效：$ENC"
    else
        err "压缩未生效，请检查响应头"
    fi
    CH=$(curl -sI "http://127.0.0.1${PROBE_URL}" | grep -i '^cache-control' | tr -d '\r' || true)
    [[ -n "$CH" ]] && ok "静态缓存头：$CH" || warn "静态资源无 cache-control"
fi

DOC_H=$(curl -sI "http://127.0.0.1/" | grep -i '^cache-control' | tr -d '\r' || true)
if [[ -n "$DOC_H" ]]; then
    ok "HTML 缓存头：$DOC_H"
else
    warn "HTML 无 cache-control（若脚本跳过了注入，请手工添加）"
fi

if grep -qE '^[[:space:]]*log_format[[:space:]]+perf' "$NGINX_CONF"; then
    ok "log_format perf 已定义（需在 server 块内手动启用 access_log）"
fi

# ---------- 清理旧备份 ----------
step "清理旧备份"
mapfile -t OLD < <(ls -1t "${NGINX_CONF}".bak.* 2>/dev/null | tail -n +$((BACKUP_KEEP + 1)))
if [[ ${#OLD[@]} -gt 0 ]]; then
    rm -f "${OLD[@]}"
    ok "已清理 ${#OLD[@]} 个旧备份"
else
    ok "无需清理"
fi

printf '\n%s完成%s  备份：%s\n\n' "$GREEN" "$NC" "$BACKUP"
cat <<'NEXT'
下一步
────────────────────────────────────────────────────────────
1. 启用分项耗时日志（脚本只定义了格式，需在 server 块内启用）：
     access_log /var/log/nginx/perf.log perf;
     buffer_size 16k;      # 必须加，否则进程间不刷盘

2. 确认 8080 端口的 pmp-admin 站点是否还需要，不需要则关闭其 listen，
     消除 error.log 噪音，也减少攻击面。

3. 接入 Cloudflare CDN —— 这才是本次慢加载的真正解。
   前面的压缩和缓存头是它的前提条件，不是替代品。

4. 排查带宽上限：阿里云控制台 → 监控 → 带宽使用率。
   1.35MB 页面在 1Mbps 下需要 10.8 秒。
NEXT