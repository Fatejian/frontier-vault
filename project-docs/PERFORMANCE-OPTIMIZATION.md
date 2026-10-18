# frontier-vault 加载性能优化执行文档

> **主站**：`www.fatejian.icu`（VitePress 1.6.4）
> **子应用**：`kb.fatejian.icu` / `plan.fatejian.icu` / `pmp.fatejian.icu`
> 源站：`<ORIGIN_IP>`（百度智能云 BCC，华东-北京，nginx 1.24.0）
> 诊断完成：2026-10-12 ｜ 架构重构：2026-10-12 ｜ CDN 扩面：2026-10-13 ｜ **摘除 CDN 代理：2026-10-18**
> 关联文档：[`SUBDOMAIN-PROXY.md`](./SUBDOMAIN-PROXY.md)（子应用分流完整手册）

---

## 零、现行状态：2026-10-18 摘除 Cloudflare 代理

> 🔴 **本节推翻第三节「CDN 是唯一可行方案」的结论 —— 但推翻的是「唯一」二字，不是它的理由。**
> 第三、五节描述的是 2026-10-12~13 的 CDN 方案，**现已停用**，保留作为历史依据与决策过程记录。

### 0.1 冲突：两个访问地域的需求相反

问题不在配置，在于**访问者分布在两个地理位置上，而 Cloudflare Free 无法按地域分流**。

2026-10-18 实测（同一台机器，`--resolve` 绕开源站做对照，各测 3 次取中位）：

| 场景 | 直连源站 | 走 Cloudflare | 说明 |
|---|---|---|---|
| 国内家宽（上海移动 AS9808） | **0.19–0.28 s** | 0.87–1.96 s | CF 无大陆 PoP，国内流量被导到 LAX / LHR |
| 办公室（香港 VPN 出口） | 1.19 s（见附录 A，未含 2026-10-18 优化） | **0.19 s** | CF 就近 HKG，命中不回源 |

分段耗时（国内家宽）：

| 阶段 | 直连源站 | 走 Cloudflare |
|---|---|---|
| TCP 握手 | 0.05–0.08 s | 0.21–0.26 s |
| TLS 握手 | 0.14–0.23 s | 0.62–0.76 s |
| 首页 TTFB（命中） | 0.19–0.28 s | 0.88 s |
| 首页 TTFB（未命中） | 0.22 s | 1.96 s |

根因是两个 RTT 的差异：

| 探测 | 结果 |
|---|---|
| 源站 → `223.5.5.5`（国内） | 49 ms |
| 源站 → CF anycast（`104.16.0.1`） | **188 ms** |
| `CF-RAY` 实测落点 | `…-LAX`、`…-LHR` |

Cloudflare 在中国大陆没有可用 PoP（除非 Enterprise 的 China Network）。国内用户必须
出境到海外节点再入境回源；而办公室出口本来就在香港，CF 反而就近服务。
**同一个配置，对两个地域的效果正好相反。**

### 0.2 决策：国内优先

访客以中国大陆为主，因此保国内。但办公室场景不能就这么放着，需要重新评估它的真实基线：

**附录 A 的 1.19 s 已经过时。** 那个数字是在「每个请求都重建 TCP+TLS」的状态下测的
（原文自己写了「建连开销 1.6 s 占 TTFB 的 74%」）。39 个请求、每个做一次 798 ms 的 TLS 握手，
在 4~5% 丢包下必然退避到几十秒。

2026-10-18 的源站修复正好全部打在这个点上：

| 修复 | 对办公室场景的作用 |
|---|---|
| 修复 `Connection: close` 缺陷 | 39 次握手 → 1 次（实测 40 请求复用 1 条连接） |
| 补全 `gzip_types` | 字节数降 70%~86%，丢包暴露次数按比例下降 |
| 启用 BBR | 丢包时不再把拥塞窗口砍半 |
| `keepalive_timeout` 65 s → 180 s | 阅读型站点两次点击常超 65 s，连接被回收就要重付一次 800 ms 握手 |

所以办公室现在到底是 300 ms 还是 1.2 s，**必须实测**，不能沿用旧基线。
测量方法见 0.5 节，脚本为 `scripts/office-latency-test.ps1`。

### 0.3 摘除时同步做的三件事（缺一不可）

**① DNS 改为灰云**
`fatejian.icu`、`www`、`kb`、`plan`、`pmp` 五条记录 `proxied: true → false`。
DNS 仍托管在 Cloudflare，只是不再代理。生效 1–5 分钟。

**② 源站补 `limit_conn` 兜底**
摘掉代理后源站直接面对公网，失去了 CF 的连接层吸收：

```nginx
limit_conn_zone $binary_remote_addr zone=perip:10m;
limit_conn perip 50;
limit_conn_status 429;
```

不用 `limit_req` 限速：国内大量用户共用 CGNAT 出口 IP，按请求速率限流会误伤整片用户。

**③ HTML 补显式 `Cache-Control` —— 最容易漏的一条**

此前源站 HTML **完全不发** `Cache-Control`，那个 `max-age=600` 一直是 **Cloudflare 在边缘补的**。
摘掉 CF 后，浏览器会退回启发式缓存（约 `Date - Last-Modified` 的 10%），
一个发布了几天的页面就是十几小时，用户会长时间看到旧页面且完全无感知。

四处 `location /` 各加一行（`kb` / `pmp-admin` / `pmp-plan` / `frontier-vault`）：

```nginx
add_header Cache-Control "public, max-age=300";
```

> ⚠️ 按 O-04 / O-05：`add_header` 是追加不是覆盖，且 location 内一旦出现 `add_header`
> 就不再继承 server 级。落笔前已核对四个配置文件的 server 块**均无** `add_header`，
> 因此不会冲掉任何继承来的头。`/assets/` 的 `immutable` 位于独立 location，不受影响。

> ⚠️ `kb` 的配置由 GitHub Actions 覆盖，**必须同步改仓库**
> `deploy/nginx/java-learning-kb.conf`，否则下次部署会被打回原样。

### 0.4 验收结果（2026-10-18 实测）

| 检查项 | 结果 |
|---|---|
| 五个入口 HTTP 状态 | 200 / 200 / 200 / 200 / 200 |
| 协议协商 | `ALPN protocol: h2`，TLS 1.3 |
| HTTP → HTTPS 跳转 | 301 正常 |
| kb 搜索接口 | 200，12 ms |
| plan / pmp 接口 | 401（与直连后端一致，鉴权正常） |
| 并发压测 200 请求 × 20 并发 | 200/200 成功，均 58 ms，load 0.25 |
| ACME 续期路径（80 端口 webroot） | 可达，acme.sh 不受影响 |
| 源站出向速率 | 约 6 KB/s（出口 10 Mbps） |
| 旧 DNS 缓存仍指向 CF 的客户端 | 实测仍返回 200，**过渡期无报错** |

### 0.5 办公室场景如何实测

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\office-latency-test.ps1
```

脚本要点（都是踩过的坑，不要改）：

- **出口 IP 必须走 `curl --noproxy`**：本机装了系统级代理时，`Invoke-RestMethod` 会跟着代理走，
  查到的出口 IP 是代理节点的，会把网络环境判断带偏。
- **判定源站不能靠 DNS**：`Resolve-DnsName` 查的是 DNS 服务器的新答案，而 curl 走系统缓存，
  两者会不一致。脚本改用 `%{remote_ip}` 取实际建连地址，并以四个站点的众数判定源站。
- 若某站点「实际连到」不是源站，其数据会被排除出结论，并提示 `ipconfig /flushdns` 后重跑。

判读标准：

| p95 最差 | 最大 | 结论 |
|---|---|---|
| < 600 ms | < 2000 ms | 直连够用，不需要 CDN |
| < 1500 ms | < 5000 ms | 勉强可用，建议接国内 CDN |
| 其余 | | 必须走 CDN |

### 0.6 回滚

Cloudflare → DNS → 把五条记录的云点回橙色即可，1–5 分钟生效。

### 0.7 后续方案：国内 CDN（域名已有 ICP 备案）

摘掉 CF 后失去了四项能力：边缘缓存、Brotli（CF 曾把源站 gzip 转码成 br，实测 -12.8%）、
HTTP/3、WAF/DDoS 吸收。

**国内 CDN 是唯一能同时服务两个地域的方案**：国内节点给国内用户，香港/海外节点给办公室用户，
边缘缓存命中即可绕开「香港→北京」那段丢包链路，同时把上面四项能力一并补回。

接入步骤：

1. CDN 控制台添加加速域名，业务类型选**全球加速**（只选国内会导致办公室走不到香港节点）
2. 源站填 `<ORIGIN_IP>:443`，回源协议 HTTPS，回源 Host 跟随
3. 缓存规则：`/assets/*` 30 天；HTML 300 s；`/api/*` 不缓存
4. 开启 Brotli、HTTP/3、Range 回源
5. `pmp.fatejian.icu` 是管理后台，按第五节的判断**建议单独配置为不缓存，或干脆不接 CDN**

> 🔴 **接入 CDN 前必须补 `set_real_ip_from`，否则全站 429。**
> `limit_conn perip` 基于 `$remote_addr`；接入 CDN 后它变成 CDN 节点 IP，
> 几十万用户会被当成一个客户端，50 条连接瞬间打满。
>
> ```nginx
> set_real_ip_from <CDN 回源 IP 段>;
> real_ip_header X-Forwarded-For;
> real_ip_recursive on;
> ```
>
> 现在**不要提前加**：没有 CDN 时加了，等于允许任何人用伪造的 XFF 绕过限流。

---

## 一、当前架构现状


> 本节为 2026-10-12 重构新增，2026-10-13 更新，**2026-10-18 改为灰云直连后重写**。
> 五个入口现在走**同一条路径**，但保留各入口的端口与配置差异说明。

### 五个入口，一条路径

| 站点 | 用途 | 源站端口 | DNS 代理 | HTML 缓存 | 流量路径 |
|---|---|---|---|---|---|
| `www.fatejian.icu` | 主站文档 | 80/443 | ⚪ 灰云 | 源站 300s | 用户 → 源站（直连） |
| `fatejian.icu` | 主站 apex | 80/443 | ⚪ 灰云 | 源站 300s | 同上 |
| `kb.fatejian.icu` | 知识库 | 8082 | ⚪ 灰云 | 源站 300s | 同上 |
| `plan.fatejian.icu` | 计划工具 | 8081 | ⚪ 灰云 | 源站 300s | 同上 |
| `pmp.fatejian.icu` | 管理后台 | 8080 | ⚪ 灰云 | 源站 300s | 同上 |

> 2026-10-18 之前为「主站走 CDN + 三子应用直连」的双路径，原因与实测见第零节。
> 现全部改为灰云直连，HTML 缓存由源站 `add_header Cache-Control "public, max-age=300"` 提供。

分流由 `scripts/setup-subdomain-proxies.sh` 生成配置（`/etc/nginx/conf.d/subdomain-proxies.conf`）：
用户始终访问 443，Nginx 按 `Host` 匹配 `server_name` 后 `proxy_pass` 到对应本地端口。
**DNS 无法指定端口**，端口映射只能由源站 Nginx 完成——详见 `SUBDOMAIN-PROXY.md`。

### 决定性变量是 HTML 有没有被缓存（CDN 时代的结论，仍然成立）

2026-10-13 最终实测（同一网络环境，TTFB 连测 3 次取平均）：


| 入口 | 路径 | TTFB 平均 | 最低 | `cf-cache-status` |
|---|---|---|---|---|
| `www.fatejian.icu` | 橙云 + Cache Rule | **191ms** | 188ms | HIT |
| `fatejian.icu` | 橙云 + Cache Rule | **200ms** | 192ms | HIT |
| `kb.fatejian.icu` | 橙云 + Cache Rule | **226ms** | 196ms | HIT |
| `plan.fatejian.icu` | 灰云直连 | 653ms | — | — |
| `pmp.fatejian.icu` | 灰云直连 | 412ms | — | — |

**同样的橙云配置，HTML 缓存命中与未命中的 TTFB 相差 7 倍**：

| 阶段 | www TTFB | 说明 |
|---|---|---|
| CDN 前基线 | 1192 ms | 跨境直连 |
| 纳入 CDN，未配 Cache Rule | **1411 ms** | Cloudflare 对 HTML 返回 `DYNAMIC`，每次回源，等于白折腾 |
| 纳入 CDN + 配 Cache Rule | **191 ms** | 命中即不回源 |

结论：

1. **纳入 CDN 只是入场券，Cache Rule 才是决定性因素。** 没有它，Cloudflare 按扩展名决定缓存，HTML 一律 `DYNAMIC`。
2. 主站 TTFB 从 1411ms 降至 191ms，**改善 7.4倍**；相对 CDN 前基线（1192ms）改善 **6.2 倍**。
3. `plan` / `pmp` 的 DNS 耗时（261~511ms）与跨境基线（507ms）同量级，CDN 对其零收益，是否纳入见第五节。

> 📌 **Anycast 节点会变**：`kb` 切换代理后首次测得 `CF-RAY: …-LHR`（伦敦），复测为 `…-HKG`（香港）。判断是否走 CDN 应以 `Server: cloudflare` 或 `cf-ray` 响应头为准，不要以固定 colo 假设为准。

---

## 二、诊断结论与决策（主站范围）

> 以下诊断针对**主站**跨境访问慢的问题，结论仍然有效。

### 源站没有任何性能问题

| 层级 | 指标 | 实测 | 判定 |
|---|---|---|---|
| 应用 + 磁盘 | 本机 TTFB | 0.000389s | 正常 |
| 磁盘 IO | vda %util | 0.14~0.60 % | 正常 |
| 磁盘 IO | iowait | 0.00~0.50 % | 正常 |
| CPU | %idle | 81~94 % | 正常 |
| CPU | load average | 0.00 | 正常 |
| 虚拟化 | %steal | 0.00 | 无争抢 |
| 内存 | buff/cache | 1296 MiB | 健康 |

### 慢的原因是访问链路质量差

访问者位于香港，服务器在**北京**（百度智能云 BCC，华东-北京）：

| 问题 | 实测 |
|---|---|
| 路由经香港绕行 | 内地 → 香港 hkg05 → 北京入境，**总延迟仅 50ms**，绕行代价有限（2026-10-13 实测，见附录 B） |
| **间歇丢包（主因）** | 用户侧 ping 5%，TCP 探测 0~5% |
| 秒级延迟尖峰 | 多个跳的 Wrst 稳定在 7200~7250ms |

> 🔴 **2026-10-13 更正与复核完成**：本文档此前多处将源站地域记为「阿里云杭州」，经百度智能云控制台与 IP-API 双重核对，实际为**百度智能云 BCC · 华东-北京**（实例 `instance-zu10wb1b`，AS38365）。
>
> **复核已完成**，实测结果见附录 B：
> - 绕行**确实存在**——路径为 内地 → 香港 hkg05 出境 → 北京入境 → 源站；
> - 但**总延迟仅 50ms**，「多绕约 1200 公里」的距离推断**不成立**；
> - 因此归因需要修正：**主因是 4~5% 丢包引发的 TCP 指数退避，而非地理距离**。
>
> **「CDN 是唯一可行方案」这一结论不受影响**，且理由更明确：消除丢包导致的指数退避，正是 CDN 的价值所在。

### 决定性证据：HAR 等待时间落在 2 的幂上

HAR 中 11 个慢请求的 wait 值（ms）：
1231 / 7975 / 8981 / 16298 / 20942 / 21314 / 22193 / 23410 / 28153

Linux TCP 重传退避序列正是 1→2→4→8→16→32 秒。11 个请求全部落在这 6 个刻度上，不可能是巧合。

即：4~5% 的丢包率，经指数退避放大，把毫秒级请求推到数十秒。

### 约束条件：访问链路不可更改

**VPN `<VPN_EGRESS_IP>` 是办公专用链路，不能调整和切换，只能使用它。**

| 方案 | 可行性 |
|---|---|
| 换 VPN 节点 / 服务商 | 不可行 —— 链路固定 |
| 换源站线路（CN2 等） | 无效 —— 已建立的 TCP 连接路径已固定 |
| 调整本机网络配置 | 不可行 —— 受办公网络管控 |

**结论：CDN 不是"最优选择"，而是"唯一可行方案"。**

### 核心策略：最大化缓存命中率

既然链路无法改变，CDN 的价值就完全取决于**回源频率**。

| 缓存策略 | 跨境回源频率 |
|---|---|
| HTML `max-age=0` | 每次访问都要验证，几乎等于没缓存 |
| HTML `max-age=600` | **10 分钟内零回源** |
| `/assets/*` 30 天 | **30 天内零回源** |

---

## 三、主站 CDN：已上线（2026-10-18 已停用）

> ⚠️ **本节描述的 CDN 方案已于 2026-10-18 停用**，现状见第零节。保留原因：Cache Rule
> 的配置方法、`DYNAMIC` 与 `HIT` 的判据、以及「源站 `max-age` 不会让 CF 缓存 HTML」
> 这条更正，在将来接入任何 CDN 时仍然适用。

> 状态：**2026-10-12 已完成**。原文档此节为"实施步骤"（未执行态），现更新为完成态与实测结果。

### 上线结果

| 项 | 配置 |
|---|---|
| 套餐 | Free |
| 加密模式 | Full (strict) |
| NS | 已指向 Cloudflare |
| DNS 记录 | `@` → A + `www` → CNAME，均**已代理** |
| Rocket Loader / Auto Minify | 已关闭（会破坏 VitePress 产物） |
| Brotli / HTTP/3 | 开启 |

验证是否走 CDN：

```bash
curl -sI https://www.fatejian.icu/ | grep -iE 'cf-ray|cf-cache-status|server'
# server应为 cloudflare，cf-ray 应存在

curl -s https://www.fatejian.icu/cdn-cgi/trace | grep colo
# colo=HKG 为理想；若为 NRT/ICN 说明 Anycast 导去了日本
```

### 缓存策略

| 路径 | 源站响应头 | Cloudflare 是否缓存 |
|---|---|---|
| `/assets/*` | `max-age=2592000, immutable`（kb 为 `max-age=31536000`） | ✅ 按扩展名默认缓存，无需规则 |
| HTML（`www` / apex / `kb`） | `max-age=600` | ✅ 均已配Cache Rule |

> ⚠️ **重要更正（2026-10-13）**：`Cache-Control: max-age=600` **只对浏览器缓存生效，不会让 Cloudflare 缓存 HTML**。
> Cloudflare 默认按**文件扩展名**决定缓存，HTML 一律视为动态内容返回 `cf-cache-status: DYNAMIC`。
> 本项目此前一直误以为"源站已设 600 秒 → 10 分钟零回源"，2026-10-13 实测主站 HTML 连续两次均为 `DYNAMIC`，该结论不成立。
>
> 源站头本身没问题：`scripts/setup-nginx-perf.sh` 的默认值即 `HTML_MAXAGE=600`、`REVALIDATE=86400`
> （旧版本文档称脚本默认写 `max-age=0` 需手动改，与实现不符，已于 2026-10-12 更正）。
> 真正缺失的是 Cloudflare 侧的 Cache Rule。

### 配置 Cache Rule（HTML 缓存）

路径：`Rules → Cache Rules → Create rule`

| 字段 | 值 |
|---|---|
| `Rule name` | `Cache HTML - <hostname>` |
| `Hostname` | `equals` → `<hostname>` |
| `URI Path` | `does not contain` → `/assets/` |
| `Cache eligibility` | `Eligible for cache` |
| `Edge TTL` | `Ignore cache-control header and use this TTL` → `600` seconds |
| `Browser TTL` | `Override origin` → `600` seconds |

> `URI Path` 排除 `/assets/` 是必需的：那些文件靠 hash 文件名做长期缓存（30 天~ 1 年），
> 被这条规则纳入会缩短其 Edge TTL。同时确认 `Cache Deception Armor` 处于关闭状态。

验证：

```bash
curl -sI https://<hostname>/ | grep -i cf-cache-status   # 第一次 MISS
curl -sI https://<hostname>/ | grep -i cf-cache-status   # 第二次 HIT
```

**当前状态**：`www`、`fatejian.icu`、`kb` 三条规则均已配置并验证通过（`cf-cache-status` 均为 `HIT`）。

### 上线效果实测

| 指标 | CDN 前基线 | 当前实测（`www`） | 改善 |
|---|---|---|---|
| DNS | 507 ms | 202 ms | 2.5× |
| TLS 握手 | 798 ms | 263 ms | 3.0× |
| TTFB | 1192 ms（中位） | **191 ms** | **6.2×** |
| 偶发长尾 | 数十秒 | 基本消失 | — |

---

## 四、源站基础优化

### 4.1 主站压缩与缓存头

脚本 `scripts/setup-nginx-perf.sh`，一条命令完成压缩 + 缓存头 + 分项耗时日志。

**为什么在 4% 丢包环境下仍有实效**——减少传输量能按比例减少丢包暴露次数：

| 状态 | 传输量 | 包数 | 预期丢包次数 |
|---|---|---|---|
| 现状（未压缩） | 1350 KB | ~1200 | ~48 次 |
| gzip 后 | ~450 KB | ~400 | ~16 次 |
| brotli 后 | ~357 KB | ~320 | ~13 次 |

**它不能消除卡顿，但能显著降低卡顿概率，同时为 CDN 铺路。**

```bash
scp scripts/setup-nginx-perf.sh root@<ORIGIN_IP>:/root/
cd /root && chmod +x setup-nginx-perf.sh

./setup-nginx-perf.sh --dry-run    # 先看改动
./setup-nginx-perf.sh              # 确认后执行
```

脚本特性：幂等、精确按 root 定位 server 块、冲突自动跳过、`nginx -t` 失败自动回滚。

执行后仍需手动启用日志：

```nginx
# 在 frontier-vault 的 server 块内
access_log /var/log/nginx/perf.log perf;
buffer_size 16k;          # 必须加，否则进程间不刷盘
```

> ⚠️ **该脚本只操作 `/etc/nginx/nginx.conf`**。应用站点配置位于
> `/etc/nginx/sites-available/`（pmp-admin、pmp-plan）与 `/etc/nginx/conf.d/`（java-learning-kb），
> 对主配置跑配置变更不会生效，需先 `grep -rn 'listen.*808[0-2]' /etc/nginx/` 定位。

### 4.2 子应用 HTTPS 与端口分流

见 [`SUBDOMAIN-PROXY.md`](./SUBDOMAIN-PROXY.md)。要点：

- 脚本 `scripts/setup-subdomain-proxies.sh`，支持 `http` / `https` 双模式
- 三个子域名已完成 HTTPS 上线，证书有效期至 2027-01-10，acme.sh 自动续期
- 8080 / 8081 / 8082 已由 `0.0.0.0` 收紧至 `127.0.0.1`，公网直连实测不可达

### 4.3 2026-10-18 内核与 nginx 调优

摘除 CDN 之前先做了一轮源站调优。这一轮的价值不只是「让国内更快」，
它同时把办公室那条 4~5% 丢包链路的代价压了下来（见第零节 0.2）。

**内核层**（`/etc/sysctl.d/99-web-tuning.conf` + `/etc/modules-load.d/99-tcp-bbr.conf`）

| 项 | 原值 | 现值 | 作用 |
|---|---|---|---|
| `tcp_congestion_control` | cubic | **bbr** | 丢包时不再把拥塞窗口砍半 |
| `net.core.default_qdisc` | fq_codel | **fq** | BBR 的配套 pacing 队列 |
| `tcp_fastopen` | 1 | 3 | 短连接省一次握手往返 |
| `tcp_slow_start_after_idle` | 1 | 0 | 空闲连接复用不重置 cwnd |
| `tcp_mtu_probing` | 0 | 1 | 避免 MTU 黑洞卡死 |
| `tcp_max_syn_backlog` | 128 | 16384 | 突发并发不丢 SYN |
| `net.core.rmem_default` / `tcp_rmem` 第二列 | 25 MB | 128 KB | 2 GiB 机器上按 BDP（约 76 KB）取值，避免连接一多就吃光内存 |
| `vm.swappiness` | 60 | 10 | 不把 JVM 冷页积极换出 |

> `net.core.default_qdisc` 只对**新建**的 qdisc 生效，已运行的网卡需手动替换：
> `tc qdisc replace dev eth0 root fq`。mq 多队列网卡上直接替换 root 即可。

**nginx 全局**（`/etc/nginx/nginx.conf`）

| 项 | 原值 | 现值 |
|---|---|---|
| `worker_connections` | 768 | 8192（+ `multi_accept on`、`use epoll`） |
| `gzip_types` | **未配置**（只压 text/html） | 补全 js/css/json/svg/font 等 |
| `gzip_static` | 未开 | on |
| `ssl_protocols` | TLSv1 / 1.1 / 1.2 / 1.3 | 1.2 / 1.3 |
| `ssl_session_cache` | 未配 | `shared:SSL:10m`，`timeout 1d` |
| `ssl_buffer_size` | 默认 16k | 4k（小响应 TTFB 更快出栈） |
| `open_file_cache` | 未开 | `max=10000 inactive=15s valid=30s` |
| `server_tokens` | on | off |
| `keepalive_timeout` | 65 s | 180 s（见第零节 0.2） |

> ⚠️ `gzip_types` 缺省这一条影响最大：实测 `fatejian.icu` 首页 3 个资源原始合计 124 KB，
> 补全后 24 KB（-81%）；`kb` 文章页 201 KB → 28.8 KB（-86%）。
> 出口只有约 10 Mbps，这一项直接决定首屏时间。

**反向代理链路**（`/etc/nginx/conf.d/subdomain-proxies.conf`）

修掉一个一直在拖后腿的缺陷：`map $http_upgrade $conn` 对普通请求回的是 `close`，
等于**每个静态资源都新建一条 TCP+TLS 连接**到内层 nginx。改为空值后配合
`upstream ... keepalive 32`，实测 40 个请求只复用 1 条连接。

同时：`listen 443 ssl` → `ssl http2`（此前靠「同一 443 socket 上任一 server 开了 h2 就整体生效」
的隐式行为兜着，很脆弱）；静态 `location /` 的 `proxy_buffering` 由 off 改回 on
（off 会让内层连接陪慢速客户端走完整个下载）。

---

## 五、子应用 CDN 状态（2026-10-18 已全部停用）

> ⚠️ 2026-10-18 起五个入口全部改为灰云直连，本节「kb 橙云 / plan、pmp 灰云」的划分已失效。
> 保留原因：其中「`pmp` 是管理后台，纳入 CDN 会把后台暴露到边缘」这条判断，
> 在将来接入国内 CDN 时**仍然适用**——`pmp` 建议单独配置为不缓存，或干脆不接。

`kb` 已于 2026-10-13 纳入 CDN 并验证通过；`plan` / `pmp` 仍为灰云直连。
**是否纳入需按用途区分，不能一刀切**：

| 子应用 | 状态 | 性质 | 结论 | 理由 |
|---|---|---|---|---|
| `kb` | ✅ 橙云 + Cache Rule | 内容型知识库 | 已完成 | TTFB 621ms → 约 210ms；搜索接口独立反代到 `127.0.0.1:8083`，不受影响 |
| `plan` | ⚪ 灰云直连 | 计划/规划工具 | 待确认 | 取决于是否面向公开用户 |
| `pmp` | ⚪ 灰云直连 | 管理后台 | **建议不纳入** | `admin` 性质，纳入 CDN 会把后台暴露到 Cloudflare 边缘，徒增攻击面 |

**纳入 CDN 的技术前提已满足**（2026-10-13 由 `kb` 实证）：

- 443 已监听，Cloudflare 免费版只回源 80/443，不存在端口限制问题
- 源站证书有效，Full (strict) 模式下直接通过校验（`kb` 实测 200，无 525）
- Cloudflare 面板将记录从「仅 DNS」切到「已代理」即可，生效约 1 分钟
- **但必须同时配 Cache Rule**，否则 HTML 仍每次回源（见第三节）

**纳入前需评估的副作用**：

- 源站真实 IP 将写入 Cloudflare 面板，但**已不再能完全隐藏**——子应用仍需直连回源
- Cloudflare 会缓存 `plan` / `pmp` 的 HTML 与静态资源，若后台页面含敏感数据，需配置 Cache Rule 绕过
- 需重新核验「源站 IP 加固」方案（见第七节），两者存在冲突

---

## 六、验收清单

```bash
# ① 主站走 CDN
curl -sI https://www.fatejian.icu/ | grep -i cf-ray

# ② 边缘节点位置
curl -s https://www.fatejian.icu/cdn-cgi/trace | grep colo

# ③ 缓存命中（连续两次，第二次应为 HIT）
#    注意：文件名带内容 hash，重新构建后会变化，必须动态获取
ASSET=$(curl -s https://www.fatejian.icu/ | grep -oE '/assets/app\.[A-Za-z0-9_-]+\.js' | head -1)
echo "探测资源: $ASSET"
curl -sI "https://www.fatejian.icu$ASSET" | grep -i cf-cache-status
curl -sI "https://www.fatejian.icu$ASSET" | grep -i cf-cache-status

# ④ HTML 缓存命中（第二次应为 HIT）
curl -sI https://www.fatejian.icu/ | grep -i cache-control

# ⑤ 压缩生效（源站侧）
curl -sI -H 'Accept-Encoding: gzip' https://www.fatejian.icu/ | grep -i content-encoding

# ⑥ 关键指标（基线：DNS=507ms TLS=798ms TTFB=1192ms）
curl -o /dev/null -s -w "DNS=%{time_namelookup}s TLS=%{time_appconnect}s TTFB=%{time_starttransfer}s\n" https://www.fatejian.icu/

# ⑦ 子应用可用性
for h in kb plan pmp; do
  printf "%-6s %s\n" "$h" "$(curl -sI -m 10 https://$h.fatejian.icu | grep -i '^HTTP' | tr -d '\r')"
done

# ⑧ 应用端口不应再公网可达（期望无法连接）
curl -sk -m 8 -o /dev/null -w "%{http_code}\n" https://<ORIGIN_IP>:8081/   # 期望 000
```

> **更正版**：旧版本清单中硬编码了 `assets/app.CwvQTczQ.js`、`assets/style.DSm7fRUq.css`，
> 站点每次重新构建 hash 都会变化，照抄必然 404。现改为动态获取。

---

## 七、后续加固

### ⚠️ 源站 IP 加固与「全部灰云直连」互斥（2026-10-18 更新）

> 🔴 **2026-10-18 起五个入口全部灰云直连，本节原「只放行 Cloudflare IP」方案已彻底不可行。**
> 现在放行 CF 段等于把全站关停。原表格保留，作为「为什么当初没做这件事」的记录。

子应用为灰云直连，**必须能通过源站 IP 访问 80/443**。因此：

| 方案 | 对主站 | 对子应用 |
|---|---|---|
| 安全组只放行 Cloudflare IP 段 | ✅彻底隐藏源站 IP | ❌ **五个入口全部不可访问** |

**结论：在全站灰云的前提下，该加固方案无法执行。** 三条路径互斥：

| 选项 | 做法 | 代价 |
|---|---|---|
| A | 放弃源站 IP 加固 | 源站 IP 持续暴露，爬虫可绕 CDN 直连（**当前状态**） |
| B | 接入国内 CDN 后，安全组只放行该 CDN 的回源段 | 需先完成第零节 0.7 的接入，且要同步维护回源段列表 |
| C | 子应用改用非标准端口 + 独立入口 | 运维复杂度上升，不推荐 |

> 在选项 B 落地前，**不要执行"只放行 CDN IP"**，否则全部入口会立即中断。
> 现状：源站约一半请求是绕过 CDN 直连的扫描器流量（单个 IP 曾在凌晨一次性打 471 条）。

### 缓存命中率监控

既然回源频率决定成败：

```bash
# Cloudflare 控制台 → Analytics → Cache 状态
# 若 MISS 比例偏高，检查 HTML 的 max-age 是否为 600
```

命中率低于 80% 时优先排查 HTML `max-age`。

### 海外出口线路核实（替代原「CN2 权益」条目）

> 🔴 **2026-10-13 重写**：原条目为「CN2 权益未生效，建议与阿里云核实」。该建议基于错误的云厂商判断：
> **CN2（AS4809）是中国电信的精品国际网络产品**，阿里云等公有云厂商会作为增值权益出售；
> 而源站实际运行在**百度智能云 BCC**，走自有 BGP 出口，不存在「CN2 权益」这一购买项，该建议已失效。

原实测记录仍有效，可作为判断出口线路的依据：

`tracert` 显示实际走 **AS9808 普通国际出口**（106.38.x / 182.61.x 中国移动网段），而非 AS4809。

2026-10-13 正向 `tracert` 实测路径（详见附录 B）同样印证：

```
… → 香港 hkg05 [AS3491/NTT] → 中国电信北京 [AS4134] → 中国移动 [AS9808] → 源站[AS38365]
```

全程**未出现 AS4809（CN2）**，与原记录一致。

**建议改为核实百度智能云侧的线路质量**：

| 核实项 | 方式 |
|---|---|
| 当前公网出口线路与带宽 | 百度智能云控制台 → BCC 实例 → 网络信息 |
| 是否存在跨境优化线路 | 工单咨询销售，确认海外访问是否有优化选配 |
| 1 Mbps 带宽是否仍为瓶颈 | 结合附录 A 实测：丢包 4~5% 才是主因，扩容带宽无效 |

> 由于 CDN 回源（Cloudflare 边缘 → 源站）会复用该出口，回源频率越低，这条链路对体验的影响越小。
> 结合第五节结论：**先做缓存优化，线路优化的边际收益有限**。

### 爬虫治理

nginx 日志一天约 1254 条请求，多来自海外云主机爬虫。CDN 上线后大部分命中边缘缓存不再回源；**直连源站的爬虫仍不受保护**，且子应用目前全部走直连，该问题对子应用依然成立。

```nginx
# 确认无误的爬虫段后再启用，444 表示直接关闭连接且不记日志
if ($remote_addr ~ "^54\.77\.193\.|^93\.152\.221\.") {
    return 444;
}
```

### 关闭 `server_tokens`

响应头当前暴露 `Server: nginx/1.24.0 (Ubuntu)`，泄露版本号：

```nginx
server_tokens off;    # 放在 http 块内，全局生效
```

---

## 八、回滚方案

| 操作 | 回滚方式 |
|---|---|
| CDN | 到域名注册商把 NS 改回原nameserver |
| 主站 nginx 改动 | 脚本自动备份为 `nginx.conf.bak.<时间戳>`，cp 覆盖后 `nginx -t && nginx -s reload` |
| 子应用分流 | 备份为 `/etc/nginx/conf.d/subdomain-proxies.conf.bak.<时间戳>` |
| 端口收紧 | `sites-available/pmp-{admin,plan}` 与 `conf.d/java-learning-kb.conf` 均已生成 `.bak.*` |

> **远程改配置务必另开一个终端保持 SSH 连接。**
>
> **改 `listen` 地址后 `reload` 无效**：平滑重载时旧 worker 仍持有 listening socket，
> 新 bind 同端口报 `Address already in use`（`error.log` 出现 `[emerg] still could not bind()`），
> nginx 会自动回退旧配置继续运行——服务不中断但改动不生效。**必须 `systemctl restart nginx`**。

---

## 九、附录

### A. 客户端侧实测（办公 VPN `<VPN_EGRESS_IP>`）

> 该 VPN 为**办公专用链路，不可调整或切换**，以下数据即为最终使用条件下的真实表现。

```
出口 IP   : <VPN_EGRESS_IP>（与服务器日志一致，确认走 VPN）
DNS       : 507 ms（正常约 30ms，慢 17 倍）
TCP 握手  : 304 ms（正常约 100ms）
TLS 握手  : 798 ms（正常约 150ms）
TTFB 中位 : 1192 ms   最小 679ms   最大 2761ms
TTFB > 1s : 8 / 10 次

TCP 握手测试：成功 40/40，但最大耗时 1251 ms
              （正常 100ms，多出的 1.1s 恰为一次 RTO 重传）
ICMP ping   ：5% 丢包，延迟 50~54ms（稳定）
```

> 建连开销 1.6s 占 TTFB 的 74%，服务器实际处理不足 0.6s。
> 只能通过减少回源次数来规避。

### B. 路由分析（2026-10-13 实测复核）

> 🔴 **本节已重写**。原记录基于「源站在杭州」这一错误前提，且「多绕约 1200 公里」的距离推断经实测不成立。
> 下方为 2026-10-13 从**联想办公网络**实测的完整路径，源站归属地经 IP-API 交叉验证为**北京市 · Baidu · AS38365**。

**实测路径（用户 → 服务器，18 跳）**

```
 1   8ms   DLT003.lenovo.com [10.212.134.102]              联想内网
 2   9ms   209-9-207-252.static.as3491.net [209.9.207.252]  AS3491 / NTT
 4   9ms   218.102.21.82                                    中国电信（广东段）
 7  10ms   BE9-957.br06.hkg05.as3491.net [63.218.255.241]  ★ 香港 hkg05 —— 出境
 8  11ms   202.97.122.117                                   ★ 中国电信北京 —— 入境
10  52ms   202.97.54.73                                     北京电信
13  52ms   106.38.196.190                                   中国移动
14  48ms   182.61.255.72                                    中国移动
18  50ms   <ORIGIN_IP>                                      终点 · 总延迟 50ms
```

**源站归属地（IP-API 交叉验证）**

| 项 | 值 |
|---|---|
| 归属 | 中国 · 北京市 · 北京 |
| ISP / Org | Baidu / Beijing Baidu Netcom Science and Technology Co., Ltd. |
| AS | **AS38365**（百度自有 AS） |
| 坐标 | 39.911, 116.395 |

**复核结论**

| 原结论 | 实测判定 |
|---|---|
| 路径经香港出境再入境北京 | ✅ **成立**，与原记录的模式一致 |
| 终点是杭州 | ❌ 错误，实为**北京** |
| 多绕约 1200 公里 | ❌ **不成立**，绕行代价远小于此 |

**绕行的实际代价只有约 40ms**——第 7 跳（香港）时延仅 10ms，第 18 跳（源站）50ms。
即：流量从内地出境香港再入境北京，总延迟约 50ms，**属于正常水平，并非严重绕行**。

> 📌 **这修正了一个此前的归因偏差**：
> 原文把「绕行 1200 公里」与「丢包 4~5%」并列为两大原因。
> 实测显示绕行仅带来数十毫秒增量，而附录 C 的 HAR 数据里，11 个慢请求的等待时间精确落在
> TCP 重传退避序列（1→2→4→8→16→32 秒）上——**真正把 1.2 秒放大到 56 秒的是丢包，不是距离。**
>
> 结论方向不变：**CDN 依然是正确选择**，但理由应表述为「消除丢包导致的指数退避」，
> 而非「消除地理绕行」。

> 注：mtr 为反向探测且目标端口受限，延迟数据仅供参考；本次为正向 `tracert` 实测。
> 但路由绕行已被两个方向的探测共同印证。

### C. HAR 关键数据（主站，CDN 前）

```
请求数 39 / 传输 1.35 MB / onLoad 56.70s
TTFB(wait) 总计 221.9s  占比 86.24%
TTFB > 1s 的请求 : 11/39 个，合计 252.4s（占总耗时 98%）
TTFB <= 1s 的请求: 28 个，合计 4.93s

首页 GET / : status 304, TTFB 56.5s, 响应体 0 字节, _transferSize 95 字节
content-encoding : 39/39 全部为空（未压缩）
```

体积与耗时脱钩对照（证明瓶颈不在文件大小）：

```
   5KB  TTFB= 23410ms   /assets/chunks/map.DwDi8XlU.js
 620KB  TTFB=     0ms   /assets/chunks/mermaid.core.MZuGn6MW.js（缓存命中）
  24KB  TTFB= 56525ms   /（304 空响应）
```

### D. 项目侧已确认无需改动的项

避免后人重复折腾（2026-10-12 复核）：

- **mermaid 已是懒加载** —— `theme/index.js` 中用动态 `import('mermaid')`，且无图表时直接 return。**不要再改**。
- **全站 mermaid 图表共 79 处**（` ```mermaid ` 围栏计数），全部依赖上述懒加载实现。
  > 更正版：旧文档记为 54 处，站点内容扩充后已过时。
- **`vite.config.js` 的 autoSidebar 插件**只含 `configureServer`（dev 文件监听），生产构建无开销。
- **`theme/enhanceApp.js` 是死代码** —— 已被 git 跟踪，但 `theme/index.js` 中无任何 import/require 引用它。
  > 注意区分：`index.js` 第 812 行的 `enhanceApp({ app, router })` 是 **VitePress 生命周期钩子**，
  > 与该文件同名但**毫无关系**，不要因搜索命中而误判为"已被引用"。
  > 若误删 `index.js` 中的正确实现，全站 79 处图表会失效。建议 `git rm`。
- **lean 模式**为 VitePress 默认行为，二次拉取完整版 chunk 是正常设计，不建议盲目改。

### E. 遗留问题

**1. 每 3 小时一次的流量尖峰 —— 已归因（2026-10-18）**

不是系统定时任务。`systemctl list-timers --all` 与 `crontab` / `/etc/cron.d` 中均无对应任务；
实测为**单个扫描器 IP 在凌晨一次性发起 471 条请求**（`/.env`、`/v3/.env` 一类的漏洞探测）。

```bash
# 复现方式：按小时看请求量，再按 IP 聚合尖峰那一小时
awk -F"[:[]" '{print $3}' /var/log/nginx/access.log | sort | uniq -c
grep ":02:" /var/log/nginx/access.log | awk '{print $1}' | sort | uniq -c | sort -rn | head
```

源站已对 `.env` / `.git` / `phpunit` / `phpinfo` 等路径返回 444（不记日志、不回响应），
并加了 `limit_conn perip 50`。该待办可关闭。

**2. pmp-admin 静态产物问题已恢复（2026-10-12 更正）**

旧版本记录：

```
open() "/var/www/pmp-admin/dist/vp-icons.css" failed (2: No such file or directory)
```

并推测"整个站点已下线但配置未清理"。

**该结论不成立。** 端到端复验：三个子域名 HTML 引用的资源全部 200，
`https://pmp.fatejian.icu/vp-icons.css` 返回 200，`plan` / `pmp` 的 `assets/` 资源均正常。
站点运行正常，无需清理配置。

若将来再次出现样式丢失，先单独探测：

```bash
curl -sI https://pmp.fatejian.icu/vp-icons.css
```

**3. `plan` / `pmp` 未纳入 CDN** —— 2026-10-18 起已无意义，五个入口全部灰云直连。

**4. 源站 IP 无法隐藏** —— 见第七节，待决策。

> 已于 2026-10-13 关闭的待办：`www` / apex / `kb` 的 HTML Cache Rule 已配置完毕，
> 三者 `cf-cache-status` 均为 `HIT`，主站 TTFB 由 1411ms 降至 191ms。
>
> 已于 2026-10-18 关闭的待办：流量尖峰归因（见本节第 1 条）。
> 新增待办：**办公室场景需实测**（`scripts/office-latency-test.ps1`），
> 以及**接入国内 CDN**（域名已有 ICP 备案，方案见第零节 0.7）。

---

## 十、变更记录

| 日期 | 变更 |
|---|---|
| 2026-10-12 | 初版：诊断主站跨境访问慢，确立 CDN 为唯一可行方案 |
| 2026-10-12 | **架构重构**：新增第一、五节。当前架构为「主站走 CDN + 三子应用直连」双路径，原文档的单站点假设已不成立；补充子应用实测耗时 |
| 2026-10-12 | CDN 章节更新为已完成态，补上线效果实测（TTFB 1192ms → 311ms） |
| 2026-10-12 | 更正三处事实错误：HTML `max-age` 默认值、mermaid 图表数（54→79）、验收清单中的硬编码 hash 文件名 |
| 2026-10-12 | 更正 pmp-admin「站点已下线」的错误结论，实测资源已恢复 |
| 2026-10-12 | 标注关键冲突：源站 IP 加固与子应用灰云直连互斥，未决策前不可执行 |
| 2026-10-13 | `kb` 纳入 CDN 并配 Cache Rule，TTFB 621ms → 约 210ms（改善 2.7 倍）；第一节重构为「五个入口、三种路径」 |
| 2026-10-13 | **更正关键错误结论**：源站 `max-age=600` 并不会让 Cloudflare 缓存 HTML，实测主站连续两次均 `DYNAMIC`。缓存收益必须靠 Cache Rule，已补入配置步骤 |
| 2026-10-13 | 标注主站 `www` / apex 未配 Cache Rule 为**最高优先级待优化项**（TTFB 仍 1411ms） |
| 2026-10-13 | **该待办已完成**：`www` / apex / `kb` 三条 Cache Rule 全部配置并验证（`cf-cache-status: HIT`），主站 TTFB 1411ms → **191ms**，静态资源 TTL 未受影响 |
| 2026-10-13 | 路由分析经实测复核：绕行确实存在（内地→香港→北京），但**总延迟仅 50ms**，「多绕约 1200 公里」不成立。归因修正为——**主因是 4~5% 丢包导致的 TCP 指数退避，而非地理距离**。CDN 结论方向不变，理由表述已更新 |
| 2026-10-13 | 补充 CN2 条目的实测佐证：路径全程未出现 AS4809，与原记录一致 |
| 2026-10-18 | **源站修复**：修复 `Connection: close` 缺陷（每请求新建 TLS 连接）、补全 `gzip_types`、启用 BBR、`worker_connections` 768→8192、`ssl_buffer_size 4k`、`open_file_cache`、`server_tokens off`、扫描器路径返回 444。fatejian.icu 首页资源 124 KB → 24 KB，kb 文章页 201 KB → 28.8 KB |
| 2026-10-18 | **摘除 Cloudflare 代理**：五条 DNS 记录改灰云。国内 TTFB 0.88~1.96 s → 0.19~0.28 s。新增第零节记录冲突、决策、验收、回滚与后续方案；第一、三、五节按现状标注 |
| 2026-10-18 | 源站补 `limit_conn perip 50`、四处 `location /` 补 `Cache-Control: max-age=300`（原 600 s 由 CF 边缘补，源站从未发过）、`keepalive_timeout` 65 s→180 s |
| 2026-10-18 | 新增 `scripts/office-latency-test.ps1`：办公室环境下判定直连是否够用。归因文档遗留项「每 3 小时流量尖峰」——实为单个扫描器 IP 一次性 471 条请求，非系统定时任务 |