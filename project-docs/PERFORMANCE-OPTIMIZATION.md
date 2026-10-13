# frontier-vault 加载性能优化执行文档

> **主站**：`www.fatejian.icu`（VitePress 1.6.4，Cloudflare CDN + Cache Rule）
> **子应用**：`kb.fatejian.icu`（已纳入 CDN）/ `plan`、`pmp.fatejian.icu`（源站直连）
> 源站：`<ORIGIN_IP>`（百度智能云 BCC，华东-北京，nginx 1.24.0）
> 诊断完成：2026-10-12 ｜ 架构重构：2026-10-12 ｜ CDN 扩面：2026-10-13
> 关联文档：[`SUBDOMAIN-PROXY.md`](./SUBDOMAIN-PROXY.md)（子应用分流完整手册）

---

## 一、当前架构现状

> 本节为 2026-10-12 重构新增，2026-10-13 更新。**理解后续所有结论的前提**：五个入口走三种不同的流量路径，性能特征不可混为一谈。

### 五个入口，三种路径

| 站点 | 用途 | 源站端口 | DNS 代理 | HTML 缓存 | 流量路径 |
|---|---|---|---|---|---|
| `www.fatejian.icu` | 主站文档 | 80/443 | 🟠 橙云 | ✅ 已配（600s） | Cloudflare 边缘（**命中不回源**） |
| `fatejian.icu` | 主站 apex | 80/443 | 🟠 橙云 | ✅ 已配（600s） | 同上 |
| `kb.fatejian.icu` | 知识库 | 8082 | 🟠 橙云 | ✅ 已配（600s） | 同上 |
| `plan.fatejian.icu` | 计划工具 | 8081 | ⚪ 灰云 | — | 用户 → 源站（**跨境**） |
| `pmp.fatejian.icu` | 管理后台 | 8080 | ⚪ 灰云 | — | 同上 |

分流由 `scripts/setup-subdomain-proxies.sh` 生成配置（`/etc/nginx/conf.d/subdomain-proxies.conf`）：
用户始终访问 443，Nginx 按 `Host` 匹配 `server_name` 后 `proxy_pass` 到对应本地端口。
**DNS 无法指定端口**，端口映射只能由源站 Nginx 完成——详见 `SUBDOMAIN-PROXY.md`。

### 决定性变量是 HTML 有没有被 CDN 缓存

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
| 双向路由绕行 | ⚠️ 见下方更正——原记录的「多绕约 1200 公里」建立在「服务器在杭州」这一**错误前提**上，地域更正为北京后该结论**待复核** |
| 间歇丢包 | 用户侧 ping 5%，TCP 探测 0~5% |
| 秒级延迟尖峰 | 多个跳的 Wrst 稳定在 7200~7250ms |

> 🔴 **2026-10-13 更正**：本文档此前多处将源站地域记为「阿里云杭州」，经百度智能云控制台核对，实际为**百度智能云 BCC · 华东-北京**（实例 `instance-zu10wb1b`）。
>
> 该错误不影响第二节的**丢包与延迟实测数据**（ping 5%、TCP 重传、HAR 等待时间落在 2 的幂上），这些是直接测得的；
> 但**影响「多绕约 1200 公里」这一距离判断**——香港到北京本应有较直接线路，绕行是否存在、绕多少，需重新测量。
>
> 复核命令（服务器上执行，`<HK_CLIENT_IP>` 为香港用户侧 IP）：
> ```bash
> traceroute -n -w 1 <HK_CLIENT_IP>
> mtr -r -c 20 <HK_CLIENT_IP>
> ```
>
> **待复核期间，「CDN 是唯一可行方案」这一结论不受影响**——它的依据是丢包率与 TCP 重传退避（4~5% 丢包把毫秒请求推到数十秒），而非地理距离。

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

## 三、主站 CDN：已上线

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

---

## 五、子应用 CDN 状态

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

### ⚠️ 源站 IP 加固与子应用直连存在冲突（优先决策）

子应用为灰云直连，**必须能通过源站 IP 访问 80/443**。因此：

| 方案 | 对主站 | 对子应用 |
|---|---|---|
| 安全组只放行 Cloudflare IP 段 | ✅彻底隐藏源站 IP | ❌ **三个子域名全部不可访问** |

**结论：在子应用保持灰云的前提下，该加固方案无法执行。** 三条路径互斥：

| 选项 | 做法 | 代价 |
|---|---|---|
| A |放弃源站 IP 加固 | 源站 IP 持续暴露，爬虫可绕 CDN 直连（当前状态） |
| B | 子应用全部纳入 CDN 后再做加固 | 需先完成第五节决策，且后台类应用暴露面增大 |
| C | 子应用改用非标准端口 + 独立入口 | 运维复杂度上升，不推荐 |

> 在选项 B 落地前，**不要执行"只放行 Cloudflare IP"**，否则子域名会立即全面中断。

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

**建议改为核实百度智能云侧的线路质量**：

| 核实项 | 方式 |
|---|---|
| 当前公网出口线路与带宽 | 百度智能云控制台 → BCC 实例 → 网络信息 |
| 是否存在跨境优化线路 | 工单咨询销售，确认海外访问是否有优化选配 |
| 1 Mbps 带宽是否仍为瓶颈 | 结合第〇节实测：丢包 4~5% 才是主因，扩容带宽无效 |

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

### B. 路由分析（⚠️ 结论待复核）

> 🔴 **2026-10-13 更正**：以下为**原始探测记录**，按当时理解记录终点为「杭州」。
> 经百度智能云控制台核对，源站实际位于**北京**（华东-北京），因此：
> - 记录中的「杭州」应读作「北京」；
> - 但这样一来「香港 → 北京 →（移动）→ 北京」的绕行模型**不成立**，
>   「理想路径为香港 → 深圳/广州 → 杭州」这一参照也已失去意义；
> - **「多绕约 1200 公里」这一结论不成立，需重新测量。**
>
> 原始数据保留如下，仅供复核时对照。复核命令见第二节。

**用户 → 服务器（原始记录，终点记为杭州，实为北京）**

```
联想内网 → 电信骨干 → 香港(hkg05) → 电信北京(<ISP_BACKBONE_IP>) → 移动 → 杭州[实为北京]
```

**服务器 → 用户（mtr --tcp，原始记录）**

```
杭州[实为北京] → 移动(182.61.x) → 北京(202.97.x) → 香港(hkt.ten0-1-1-1) → Netvigator(用户ISP)
```

**可保留的结论**：

- 多个跳的 Wrst 稳定在 7200~7250ms，属真实的周期性长队列（与地域无关）
- 出口为 AS9808 普通国际线路（106.38.x / 182.61.x 中国移动网段），非 AS4809

**已失效的结论**：

- ~~理想路径为香港 → 深圳/广州 → 杭州~~
- ~~实际多绕约 1200 公里~~

> 注：mtr 为反向探测且目标端口受限，其延迟数据仅供参考。
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

**1. 每 3 小时一次的流量尖峰仍未归因**

`crontab` 与 `/etc/cron.d` 中未找到对应任务，可执行 `systemctl list-timers --all` 排查。
CDN 上线后对主站影响显著降低，但**子应用走直连，该尖峰仍会全额影响三个子域名**。

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

**3. `plan` / `pmp` 未纳入 CDN** —— 见第五节，待决策。

**4. 源站 IP 无法隐藏** —— 见第七节，待决策。

> 已于 2026-10-13 关闭的待办：`www` / apex / `kb` 的 HTML Cache Rule 已配置完毕，
> 三者 `cf-cache-status` 均为 `HIT`，主站 TTFB 由 1411ms 降至 191ms。

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