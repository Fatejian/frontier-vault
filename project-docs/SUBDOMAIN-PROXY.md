# 子域名端口分流执行文档

> 站点：`kb.fatejian.icu` / `plan.fatejian.icu` / `pmp.fatejian.icu`（源站 `<ORIGIN_IP>`，百度智能云 BCC 华东-北京）
> 编制：2026-10-12
> 执行脚本：`scripts/setup-subdomain-proxies.sh`
> 关联文档：`PERFORMANCE-OPTIMIZATION.md`（同一台服务器）、`CONTRIBUTING-i18n.md`
> 状态：**已于 2026-10-12 完成上线**，80 跳转 443，三个子域名均返回 200；
> 8080/8081/8082 已从 `0.0.0.0` 收紧至 `127.0.0.1`，公网直连验证不可达
> 说明：文中 `<ORIGIN_IP>` 需替换为源站公网 IP

---

## 一、结论：DNS 做不到端口映射

DNS 记录只能把域名映射到 **IP**，协议里没有端口字段。所谓"把域名指向某个端口"在 DNS 层面不存在。

`https://kb.fatejian.icu:8082` 这种写法浏览器虽能接受，但那是把端口甩给用户手工输入，且只有该用户的浏览器知道端口——不是我们要的效果。

**端口映射是源站 Nginx 的职责**：用户永远访问默认端口（80/443），Nginx 收到请求后看 `Host` 头，判定是哪个子域名，再转发到对应端口。

```
浏览器 → https://kb.fatejian.icu:443
        ↓ DNS 解析到源站 IP
     Nginx（按 Host 匹配 server_name）
        ↓ proxy_pass 127.0.0.1:8082
     kb 应用
```

目标映射：

| 子域名 | 应用端口 |
|---|---|
| `kb.fatejian.icu` | 8082 |
| `plan.fatejian.icu` | 8081 |
| `pmp.fatejian.icu` | 8080 |

---

## 二、环境现状（2026-10-12 实测）

| 项 | 状态 |
|---|---|
| `fatejian.icu` | Cloudflare **橙云代理**，解析到 Cloudflare 边缘节点（AS13335） |
| `kb/plan/pmp.fatejian.icu` | **灰云直连源站**，解析到源站公网 IP，Cloudflare 不参与 |
| Nginx | 主配置 `/etc/nginx/nginx.conf`（不含下列应用站点）+ `conf.d/` + `sites-available/` 多文件结构 |
| 80/443 | 已被 `fatejian.icu` 静态站占用 |
| 8080 | 跑着 pmp-admin，且其 `server_name` **也是 `fatejian.icu`** |

三个应用端口的实际配置（`nginx -T` 实测，2026-10-12）：

| 端口 | 站点 | **配置文件** | `listen` | `server_name` | 内容来源 |
|---|---|---|---|---|---|
| 8080 | pmp-admin | `/etc/nginx/sites-available/pmp-admin` | `8080 ssl` | `fatejian.icu www.fatejian.icu` | `root /var/www/pmp-admin/dist`，`/api/` → `127.0.0.1:3000` |
| 8081 | pmp-plan | `/etc/nginx/sites-available/pmp-plan` | `8081 ssl` | `fatejian.icu www.fatejian.icu` | `root /var/www/pmp-plan/dist`，`/api/` → `127.0.0.1:3000` |
| 8082 | java-learning-kb | `/etc/nginx/conf.d/java-learning-kb.conf` | `8082 ssl` + `[::]:8082 ssl` | `_`（通配） | `root /var/www/java-learning-kb`，`/api/` → `127.0.0.1:8083`（搜索服务） |

> ⚠️ **这三个端口的 server 块都不在 `/etc/nginx/nginx.conf` 里。** 收紧暴露面时若对主配置跑 `sed`，会静默无匹配——配置看似改了，`ss` 里却仍是 `0.0.0.0`。先定位再动手：
>
> ```bash
> grep -rn 'listen.*808[0-2]' /etc/nginx/
> ```

由此得出三条关键结论：

1. **三个端口都是 HTTPS（`listen XXXX ssl`）。** 反代必须用 `proxy_pass https://`，明文 `http://` 请求会被 SSL 端口直接断开。
2. **无代理环路。** 三处的 `/api/` 都指向更上游的 `3000` / `8083`，没有任何路径回到 80 端口。
3. **无需改动现有 server 块。** 8080/8081 虽与主站同名，但各自是该端口上**唯一**的 server 块，会作为默认 server 接住 `Host: pmp.fatejian.icu`；8082 的 `server_name _` 更是通配。

**因此 DNS 三条记录保持现状即可，无需改动。** 端口问题全部在 Nginx 侧解决。

### 证书体系

服务器上共两张证书，**都已正确绑定 `--install-cert` 安装路径，续期全自动**（2026-10-12 核验）：

| 证书 | 覆盖范围 | 安装路径 | 验证方式 | 用在哪 |
|---|---|---|---|---|
| 泛域名 | `*.fatejian.icu` + apex | `/etc/nginx/ssl/fatejian.icu.pem` | DNS-01（Cloudflare token） | 8080 / 8081 / 8082 三个应用端口 |
| SAN | kb / plan / pmp | `/etc/letsencrypt/live/kb.fatejian.icu/` | HTTP-01（webroot） | 443 的三个子域名 |

**为什么 443 用 SAN 而不用现成的泛域名证书**：泛域名依赖 DNS-01，需要 Cloudflare API token 持续有效；SAN 走 HTTP-01，不依赖任何外部凭证。子域名是访问入口，用依赖更少的证书更稳。

核验续期是否会落到 nginx 实际使用的路径：

```bash
grep -E 'Le_RealFullChainPath|Le_RealKeyPath' /root/.acme.sh/fatejian.icu_ecc/fatejian.icu.conf
```

**若查不到这两个变量，说明证书是手工 `cp` 过去的，acme.sh 根本不知道 nginx 用哪个路径——续期成功后文件永不更新，到期当天全站报证书错误而 `--list` 显示一切正常。** 补绑（幂等，可重复执行）：

```bash
/root/.acme.sh/acme.sh --install-cert -d fatejian.icu \
  --key-file       /etc/nginx/ssl/fatejian.icu.key \
  --fullchain-file /etc/nginx/ssl/fatejian.icu.pem \
  --reloadcmd      "nginx -s reload"
```

这个坑很隐蔽，值得记住：`--install-cert` 的作用不是"复制一次文件"，而是"**告诉 acme.sh 每次续期后要把结果写到哪**"，只做前者不做后者等于没做。

---

## 三、决策：手动执行，不进 CI

两类操作性质不同，不应放进同一条流水线：

| | `deploy.yml`（现有） | `setup-subdomain-proxies.sh` |
|---|---|---|
| 改什么 | `/var/www/frontier-vault/` 的静态产物 | `/etc/nginx/nginx.conf`（**全站入口**） |
| 频率 | 每次 push | 一次性 / 偶尔 |
| 失败影响 | 文档站没更新 | 主站 + `www` 一起挂 |
| 需要本机环境 | 否 | **是**：root、nginx、端口探测、证书路径 |

不挂 CI 的硬理由：

1. **CI 探测结果全是假的。** 脚本会检测 `127.0.0.1:8082` 是否监听以给警告。GitHub runner 上这些端口永远没监听，只会刷出误报警告，而真正该看的信号（源站应用起没起）恰好丢失。
2. **证书不能这么签。** 签发有 Let's Encrypt 速率限制（失败超限锁 7 天），是有配额的有状态外部交互。
3. **爆炸半径不对等。** 现在 rsync 失败顶多文档站旧一点；nginx reload 失败是整站不可用。CI 里没有"另开一个终端保住 SSH 会话"这个逃生通道——而这正是本文档反复强调的纪律。
4. **触发时机没对齐。** 脚本要求后端应用已在 8080-8082 上跑起来才有效，而"推送文档 commit"与"应用上线"是两条独立时间线。

> 现有 `deploy.yml` 的 rsync 只同步 `docs/.vitepress/dist/`，仓库里的 `scripts/*.sh` **不会自动传到服务器**，即使想自动化也需新增 SSH 步骤。而 `secrets.SERVER_SSH_KEY` + `remote_user: root` 意味着 CI 已有 root SSH 能力——技术上做得到，但这恰恰是需要慎重的理由。

---

## 四、执行手册

> **两条铁律**
>
> 1. 全程**保持两个 SSH 窗口**——一个执行，一个保命。nginx 起不来时你还能连上去。
> 2. 脚本在 `nginx -t` 失败时会**自动回滚**；但若"校验通过、reload 成功、站点却打不开"，需靠第二个窗口手动回滚。

### 阶段 0 · 准备

**本地**：百度智能云控制台（BCC）确认安全组入方向放行 `80`、`443`、`22`。

**服务器** —— 确认本机有无全局 IPv6（决定 `ENABLE_IPV6`）：

```bash
ip -6 addr show scope global | grep inet6 || echo "本机无全局 IPv6 → 保持 ENABLE_IPV6=0"
```

### 阶段 1 · 确认三个应用真的在监听

```bash
ss -tlnp | grep -E ':(8080|8081|8082)\b'
```

**期望三行 `LISTEN`，只有齐全才继续**，否则反代必然 502。

端口与脚本不一致时（如实际是 9000），改脚本第 45-55 行的 `DOMAINS` 数组。该数组每项为 **4 段**：`子域名 : 端口 : 上游SNI : 上游协议`，后两段用于 HTTPS 上游与 SNI：

```bash
sed -i 's/kb\.fatejian\.icu:8082/kb.fatejian.icu:9000/' setup-subdomain-proxies.sh
grep -A5 '^DOMAINS=' setup-subdomain-proxies.sh   # 回读确认改对了
```

四段的含义：

| 段 | 说明 |
|---|---|
| 子域名 | 写入 `server_name` |
| 端口 | 上游端口 |
| 上游 SNI | 传给上游的 TLS SNI，取上游 `server_name` 中真实存在的值 |
| 上游协议 | `https`（本例三个端口均为 ssl）或 `http` |

省略第 3、4 段时自动回退为「SNI = 子域名、协议 = http」。

### 阶段 2 · 上传并预览（不改动任何文件）

**本地 PowerShell**：

```powershell
scp c:\project\Personal_Projects\frontier-vault\scripts\setup-subdomain-proxies.sh root@<ORIGIN_IP>:/root/
```

**服务器**：

```bash
cd /root
chmod +x setup-subdomain-proxies.sh
./setup-subdomain-proxies.sh --dry-run
```

核对输出三件事：

- 三个 `server_name` 分别为 kb / plan / pmp
- `proxy_pass` 端口分别为 8082 / 8081 / 8080
- 提示的注入方式（写独立文件，还是内联进 `nginx.conf`）

### 阶段 3 · 执行并验证 HTTP 分流

```bash
./setup-subdomain-proxies.sh
```

流程：备份 → 注入 → `nginx -t` → reload → 自动 curl 验证。期望结尾：

```
✓ kb.fatejian.icu → 8082 返回 200（响应头确认命中 8082）
✓ plan.fatejian.icu → 8081 返回 200（响应头确认命中 8081）
✓ pmp.fatejian.icu → 8080 返回 200（响应头确认命中 8080）
```

**服务器内复验**（看 `X-Upstream-Port` 确认命中哪个后端）：

```bash
curl -sI -H "Host: kb.fatejian.icu"   http://127.0.0.1/ | head -5
curl -sI -H "Host: plan.fatejian.icu" http://127.0.0.1/ | head -5
curl -sI -H "Host: pmp.fatejian.icu"  http://127.0.0.1/ | head -5
```

**本地 PowerShell**（走完整网络路径）：

```powershell
curl -I http://kb.fatejian.icu
```

### 阶段 4 · 上线 HTTPS

**4.1 签一张包含三个子域名的证书**

HTTP-01 验证**签不了泛域名** `*.fatejian.icu`，只能签三个具体子域名。签成一张 SAN 证书，正好匹配脚本的单一 `CERT_DIR` 设计：

```bash
mkdir -p /var/www/certbot     # 脚本里的 acme-challenge location 指向这里
/root/.acme.sh/acme.sh --issue --server letsencrypt \
  -d kb.fatejian.icu -d plan.fatejian.icu -d pmp.fatejian.icu \
  --webroot /var/www/certbot
```

若未安装 acme.sh：

```bash
curl https://get.acme.sh | sh -s email=you@example.com
```

安装证书（`-d` 必须与签发时的**第一个**域名一致，目录名由它决定；**`--install-cert` 不会自动创建目录，必须先 `mkdir -p`**，否则报 `touch: cannot touch ... No such file or directory`）：

```bash
mkdir -p /etc/letsencrypt/live/kb.fatejian.icu     # 必须先建，安装时才会 touch
/root/.acme.sh/acme.sh --install-cert -d kb.fatejian.icu \
  --key-file       /etc/letsencrypt/live/kb.fatejian.icu/privkey.pem \
  --fullchain-file /etc/letsencrypt/live/kb.fatejian.icu/fullchain.pem \
  --reloadcmd      "nginx -s reload"

ls -l /etc/letsencrypt/live/kb.fatejian.icu/    # 确认两个 pem 都在
```

> 若确实需要泛域名，只能走 DNS-01（Cloudflare API Token + `dns_cf` 插件），并确保额外加上 apex `fatejian.icu`。

**4.2 开启 443 与 HTTP→HTTPS 跳转**

```bash
SITE_MODE=https CERT_DIR=/etc/letsencrypt/live/kb.fatejian.icu ./setup-subdomain-proxies.sh
```

**4.3 验证并配置自动续期**

```powershell
# 本地
curl -I https://kb.fatejian.icu
```

```bash
# 服务器上加续期
crontab -e
# 粘贴这一行后保存：
0 3 * * * "/root/.acme.sh/acme.sh" --cron --home /root/.acme.sh >> /var/log/acme-cron.log 2>&1
```

### 阶段 5 · 收尾加固（不可跳过）

**1. 别让应用端口暴露在公网。** 这三个端口绑在 `0.0.0.0` 且**自带SSL 证书**（8080/8081 用 `fatejian.icu.pem`，8082 用 `kb-tls.inc`），也就是说 `https://<ORIGIN_IP>:8081` 现在就是**能直接打开的完整站点**，绕过 Nginx 主入口、无CDN、无任何限流。这是当前最大的攻击面。

```bash
ss -tlnp | grep -E ':(8080|8081|8082)\b'    # 看是绑 0.0.0.0 还是 127.0.0.1
```

- 应用侧改成只监听 `127.0.0.1`
- 8080 那台的 nginx 改为 `listen 127.0.0.1:8080;`——比直接删掉更好：反代仍能用，同时消除公网暴露
- 百度智能云安全组（BCC）删除 8080-8082 入方向规则

**2. IPv6**：仅当阶段 0 检测出本机有全局 IPv6 时，才加 `ENABLE_IPV6=1` 重跑脚本。没配 IPv6 却开启会让 nginx **reload/restart 直接失败**。

**3. 可选**：确认无误后删掉三处诊断头（每块一行，搜 `X-Upstream-Port`）。

---

## 五、回滚

脚本在 `nginx -t` 失败时会自动回滚并退出。已生效但想撤回：

```bash
ls -1t /etc/nginx/nginx.conf.bak.* | head -3      # 挑一个时间戳
cp /etc/nginx/nginx.conf.bak.20261012-154500 /etc/nginx/nginx.conf
nginx -t && nginx -s reload
```

备份默认保留最近 3 份（`BACKUP_KEEP` 可调）。

---

## 六、故障速查

| 现象 | 原因 | 处理 |
|---|---|---|
| `502 Bad Gateway` | 后端没起 / 端口写错 | 回阶段 1 用 `ss` 核对端口 |
| **502 且上游是 `ssl` 端口** | 用了 `proxy_pass http://` 访问 HTTPS 上游，明文请求被直接断开 | 确认 `DOMAINS` 第 4 段为 `https`（本例三个端口都必须是） |
| 返回 200 但内容是主站 | `server_name` 未匹配 | `grep -n 'server_name' /etc/nginx/nginx.conf` 核对 |
| `pmp` 页面样式丢失 | 历史上出现过静态产物缺失（`PERFORMANCE-OPTIMIZATION.md` 记录 `vp-icons.css` 曾不存在）。**2026-10-12 端到端实测已恢复，三个站点 HTML 引用的资源全部 200**。若再次出现，先单独探测该文件 | `curl -I http://pmp.fatejian.icu/vp-icons.css` |
| `Address family not supported` | 无 IPv6 却开了 `listen [::]` | 以 `ENABLE_IPV6=0` 重跑脚本 |
| 证书签发失败 | `/.well-known/acme-challenge/` 未放行 | 脚本已内置该 location；确认 `SITE_MODE=http` 已先生效 |
| `nginx -t` 报 duplicate | 手工配置与脚本标记块冲突 | 删除重复的 server 块，或全部删掉后只跑脚本 |
| 改了 `listen` 地址后 reload 无效，`ss` 仍显示旧地址 | **nginx 平滑重载时旧 worker 仍持有 listening socket**，新 bind 同端口报 `Address already in use`，nginx 会自动回退旧配置继续运行（服务不中断，但改动没生效） | 查 `error.log` 是否有 `[emerg] still could not bind()`；确认后 `systemctl restart nginx` 完全重启释放 socket |

---

## 七、pmp 专项说明

反代到 8080 **能跑通**——8080 上只有 pmp-admin 那一个 server 块，会作为该端口的默认 server 接住 `Host: pmp.fatejian.icu` 的请求。8081（pmp-plan）同理。

但既然这三个端口本身已经是功能完整的站点（静态 `root` + `/api/` 反代 + gzip + 缓存），更优解是让 80/443 **直接托管**，省掉一次 TLS 握手。代价是站点配置会分散在两处，以后改站点要改两遍。

以 pmp 为例，完整配置如下（注意 `/api/` 不能漏，否则前端拿不到数据）：

```nginx
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name pmp.fatejian.icu;

    ssl_certificate     /etc/nginx/ssl/fatejian.icu.pem;
    ssl_certificate_key /etc/nginx/ssl/fatejian.icu.key;
    ssl_protocols       TLSv1.2 TLSv1.3;

    root /var/www/pmp-admin/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
    gzip_min_length 1024;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;   # SPA 路由必需
    }
}
```

**建议先用反代方案跑通**（不动现有配置，风险低），确认三个子域名都正常后再决定是否切换到直托管。

---

## 八、脚本参数速查

| 参数 | 默认值 | 说明 |
|---|---|---|
| `NGINX_CONF` | `/etc/nginx/nginx.conf` | 主配置文件 |
| `CONF_D` | `/etc/nginx/conf.d` | 有 include 时写入此目录 |
| `SITES_FILE` | `$CONF_D/subdomain-proxies.conf` | 独立站点文件路径 |
| `ACME_ROOT` | `/var/www/certbot` | acme.sh webroot 落盘目录 |
| `SITE_MODE` | `http` | `http`（仅 80）/ `https`（80 跳转 + 443） |
| `CERT_DIR` | `/etc/letsencrypt/live/fatejian.icu` | 证书目录，需含两个 pem |
| `PROXY_TIMEOUT` | `120s` | 读写超时 |
| `BODY_SIZE` | `50m` | 上传体积上限 |
| `BACKUP_KEEP` | `3` | 保留备份份数 |
| `ENABLE_IPV6` | `0` | 置 1 才额外 `listen [::]` |
| `DIAG_HEADER` | `0` | 置 1 才输出 `X-Upstream-Port` 诊断响应头（排查时用） |

调用示例：

```bash
./setup-subdomain-proxies.sh --dry-run     # 预览
./setup-subdomain-proxies.sh               # 仅配80
SITE_MODE=https CERT_DIR=/etc/letsencrypt/live/kb.fatejian.icu ./setup-subdomain-proxies.sh

DIAG_HEADER=1 ./setup-subdomain-proxies.sh # 临时开启 X-Upstream-Port 诊断头
```

> `X-Upstream-Port` 诊断头**默认不输出**（`DIAG_HEADER=0`）。它能一眼确认请求命中了哪个上游端口，但属于对外暴露内部结构。https 模式下只有 443 块会输出（80 块是 301 跳转，不反代），因此最多 3 行。

脚本特性：幂等（标记块整体替换，可反复执行）、自动备份、`nginx -t` 失败自动回滚、优先写 conf.d 独立文件。

---

## 九、脚本设计决策（供后续维护参考）

以下是编写过程中实测确认过的约束，改脚本前务必了解，否则会重新踩坑：

| 决策 | 原因 |
|---|---|
| **`proxy_pass` 用 `https://` 而非 `http://`** | 8080/8081/8082 均为 `listen XXXX ssl`。明文请求打到 SSL 端口，nginx 会因等不到 TLS ClientHello 而直接断开连接，表现为 502。这是本方案最容易踩的坑 |
| **`proxy_ssl_verify off`** | 源站证书签的是域名，与 `127.0.0.1` 不匹配，开启校验必然全部失败。流量走本机回环、不经过不可信网络，关闭校验风险可控 |
| **SNI 按上游 `server_name` 取值** | 8080/8081 的 `server_name` 是 `fatejian.icu`，故填它；8082 是 `server_name _`（通配），填任何值都能命中 |
| `proxy_ssl_session_reuse on` | 上游是 HTTPS，每个请求重握手有明显开销。会话复用后握手只在首次发生 |
| 内联注入必须插到 `http` 块**闭合 `}` 之前** | `server` 块嵌在 `http` 内，直接追加到文件末尾会让 nginx 报 `server directive is not allowed here`。脚本用 awk 跟踪花括号深度定位，并已验证注释、嵌套块中含 `{` `}` 时不干扰层级 |
| 默认不写 `listen [::]` | 云主机常未配 IPv6，此时 `listen [::]` 会在 reload/restart 时绑定失败（`socket() [::]:80 failed: Address family not supported`）。`nginx -t` 不检查端口绑定，只有真正 reload 才暴露 |
| `map` 变量用独立名 `$fv_subdomain_upgrade_conn` | 避免与既有 `map $http_upgrade $connection_upgrade` 重复定义导致 `duplicate map` 报错 |
| 注入用标记注释包裹，重复执行先剥离旧块 | 若只做"追加"，每跑一次就多一份 server 块，最终 `duplicate server` 报错 |
| 保留 `X-Upstream-Port` 诊断头 | `curl -I` 一次就能确认请求命中了哪个后端端口，排查反代错配很省事。确认无误后可删 |
| HTTPS 模式把 80 跳转与 443 分成两个 server 块 | 单块混写 `listen 80` + `listen 443 ssl` 会让 80 也要求握手证书 |
| `set -e` 下不能用 `[[ cond ]] && cmd` 做可选逻辑 | 条件为假时整条命令返回非 0，`set -e` 会直接终止脚本。脚本中该类写法一律改为 `if` |

---

## 十、建议的后续动作

| 事项 | 优先级 | 说明 |
|---|---|---|
| 把最终 nginx 配置纳入版本管理（`deploy/nginx/subdomain-proxies.conf`） | 中 | 配置即代码，走 PR 评审，但不自动生效 |
| 清理 8080 上已下线的 pmp-admin 残留 | 中 | `PERFORMANCE-OPTIMIZATION.md` 已建议关闭其 `listen`；本文建议改为 `listen 127.0.0.1:8080` |
| 排查每 3 小时一次的流量尖峰 | 中 | 该文档记录至今未归因，`systemctl list-timers --all` 可查 |
| 确认 8080-8082 的公网暴露已关闭 | 高 | 见阶段 5 |

---

## 十一、变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-12 | 初版：确立 DNS 不做端口映射、Nginx 按 Host 分流方案；编写 `setup-subdomain-proxies.sh` |
| 2026-10-12 | 依据 `nginx -T` 实测修正：上游 8080/8081/8082 均为 `listen XXXX ssl`，反代改用 `https://` + SNI + `proxy_ssl_verify off`；确认无代理环路、无需改动现有 server 块（23 项验证通过） |
| 2026-10-12 | HTTP 分流上线并端到端验证：三个子域名均 200，资源引用全部 200。修正文档中"pmp 静态产物缺失"的过时记录 |
| 2026-10-12 | HTTPS 上线：SAN 证书（ECC，有效期至 2027-01-10），80→443 跳转，三个子域名端到端 200。修复三处脚本缺陷：https 验证需按 SNI 而非 Host 选择 server 块；`--install-cert` 需先建目录；冲突检测须按 listen 端口分组（80/443 同名是合法的） |
| 2026-10-12 | 暴露面收紧：8080/8081/8082 由 `0.0.0.0` 改为 `127.0.0.1`，公网直连实测不可达；删除 8082 的 `[::]` 监听。踩坑记录见故障速查表 |