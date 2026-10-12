# frontier-vault 加载性能优化执行文档

> **主站**：`www.fatejian.icu`（VitePress 1.6.4，Cloudflare CDN）
> **子应用**：`kb` / `plan` / `pmp`.fatejian.icu（源站直连，Nginx 按 Host 分流）
> 源站：`<ORIGIN_IP>`（阿里云杭州，nginx 1.24.0）
> 诊断完成：2026-10-12 ｜ 架构重构：2026-10-12
> 关联文档：[`SUBDOMAIN-PROXY.md`](./SUBDOMAIN-PROXY.md)（子应用分流完整手册）

---

## 一、当前架构现状

> 本节为 2026-10-12 重构新增。**理解后续所有结论的前提**：主站与子应用走的是两条完全不同的流量路径，性能特征不可混为一谈。

### 四个站点，两条路径

| 站点 | 用途 | 源站端口 | DNS 代理 | 流量路径 | TLS 证书 |
|---|---|---|---|---|---|
| `www.fatejian.icu` | 主站文档 | 80/443 | 🟠 橙云 | 用户 → Cloudflare 边缘 → 源站 | 泛域名 `*.fatejian.icu` |
| `fatejian.icu` | 主站 apex | 80/443 | 🟠 橙云 | 同上 | 同上 |
| `kb.fatejian.icu` | 知识库 | 8082 | ⚪ 灰云 | 用户 → 源站（跨境） | SAN 证书 |
| `plan.fatejian.icu` | 计划工具 | 8081 | ⚪ 灰云 | 同上 | 泛域名证书 |
| `pmp.fatejian.icu` | 管理后台 | 8080 | ⚪ 灰云 | 同上 | 泛域名证书 |

分流由 `scripts/setup-subdomain-proxies.sh` 生成配置（`/etc/nginx/conf.d/subdomain-proxies.conf`）：
用户始终访问 443，Nginx 按 `Host` 匹配 `server_name` 后 `proxy_pass` 到对应本地端口。
**DNS 无法指定端口**，端口映射只能由源站 Nginx 完成——详见 `SUBDOMAIN-PROXY.md`。

### 关键差异：子应用没有 CDN 保护

2026-10-12 客户端实测（同一网络环境）：

| 目标 | DNS | TLS | TTFB | 总耗时 | 页面大小 |
|---|---|---|---|---|---|
| `www.fatejian.icu` | 116ms | 237ms | **311ms** | 315ms | 24 KB |
| `kb.fatejian.icu` | 476ms | 583ms | **621ms** | 688ms | 47 KB |
| `plan.fatejian.icu` | 511ms | 611ms | **653ms** | 653ms | 0.6 KB |
| `pmp.fatejian.icu` | 261ms | 367ms | **412ms** | 412ms | 0.6 KB |

**子应用的 DNS 耗时（476~511ms）与第二节记录的跨境基线（507ms）几乎一致**，说明它们仍在走跨境链路，CDN 对其零收益。

- 主站 TTFB 311ms：相对基线 1192ms 改善 **3.8 倍**，CDN 已生效
- 子应用 TTFB 412~653ms：TTFB 中**建连开销占主导**，服务器实际处理不足 100ms
- `plan` / `pmp` 首屏只有 0.6KB（SPA 骨架），但 JS/CSS 仍需跨境拉取，未命中缓存时耗时会显著放大

> ⚠️ **这不是缺陷，是当时的取舍**：子应用灰云直连意味着源站真实 IP 对外可见，且子应用多为一对一的内部工具，初期不急于接入 CDN。是否纳入 CDN 见第五节。

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

访问者位于香港，服务器在杭州：

| 问题 | 实测 |
|---|---|
| 双向路由绕行 | 香港 → 北京 → 杭州，多绕约 1200 公里 |
| 间歇丢包 | 用户侧 ping 5%，TCP 探测 0~5% |
| 秒级延迟尖峰 | 多个跳的 Wrst 稳定在 7200~7250ms |

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

| 路径 | 源站响应头 | 效果 |
|---|---|---|
| `/assets/*` | `max-age=2592000, immutable` | 30 天零回源（文件名带内容 hash） |
| HTML | `max-age=600, stale-while-revalidate=86400` | 10 分钟零回源，之后先返回旧内容后台静默更新 |

> **更正版**（2026-10-12）：旧版本文档称"脚本默认写入 `max-age=0, stale-while-revalidate=600`，需手动改为 600/86400"，**该描述与实现不符**。
> `scripts/setup-nginx-perf.sh` 的实际默认值即 `HTML_MAXAGE=600`、`REVALIDATE=86400`，执行后无需手动修改。
> 如需确认源站实际返回值：
> ```bash
> curl -sI https://www.fatejian.icu/ | grep -i cache-control
> ```

### 上线效果实测

| 指标 | CDN 前基线 | 当前实测 | 改善 |
|---|---|---|---|
| DNS | 507 ms | **116 ms** | 4.4× |
| TLS 握手 | 798 ms | **237 ms** | 3.4× |
| TTFB | 1192 ms（中位） | **311 ms** | 3.8× |
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

## 五、子应用是否纳入 CDN（待决策）

主站已验证 CDN 收益（TTFB 改善 3.8×）。子应用目前未享受该收益，**是否纳入需要按用途区分，不能一刀切**：

| 子应用 | 性质 | 建议 | 理由 |
|---|---|---|---|
| `kb` | 内容型知识库（含服务端搜索） | **建议纳入** | 内容公开、流量型，CDN 收益最大；搜索接口已独立反代到 `127.0.0.1:8083`，不受影响 |
| `plan` | 计划/规划工具 | 待确认 | 取决于是否面向公开用户 |
| `pmp` | 管理后台 | **建议不纳入** | `admin` 性质，纳入 CDN 会把后台暴露到 Cloudflare 边缘，徒增攻击面 |

**纳入 CDN 的技术前提已满足**（2026-10-12 核验）：

- 443 已监听，Cloudflare 免费版只回源 80/443，不存在端口限制问题
- 源站证书有效，Full (strict) 模式下可直接通过校验（SAN 证书覆盖三个子域名）
- 只需在 Cloudflare 把三条记录从「仅 DNS」改为「已代理」

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

### CN2 权益未生效（建议与阿里云核实）

`tracert` 显示实际走 **AS9808 普通国际出口**（106.38.x / 182.61.x 中国移动网段），而 CN2 是 **AS4809**，该线路费用未产生效果。

> 由于 VPN 链路固定，无法通过"切换到 CN2 路径"利用该权益。
> 但对 CDN 回源链路（Cloudflare 边缘 → 源站）依然有效，回源越少该链路权重越低。

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

### B. 路由分析（双向绕行）

**用户 → 服务器**

```
联想内网 → 电信骨干 → 香港(hkg05) → 电信北京(<ISP_BACKBONE_IP>) → 移动 → 杭州
```

**服务器 → 用户（mtr --tcp）**

```
杭州 → 移动(182.61.x) → 北京(202.97.x) → 香港(hkt.ten0-1-1-1) → Netvigator(用户ISP)
```

理想路径为 香港 → 深圳/广州 → 杭州，实际多绕约 1200 公里。
多个跳的 Wrst 稳定在 7200~7250ms，属真实的周期性长队列。

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

**3. 子应用未纳入 CDN** —— 见第五节，待决策。

**4. 源站 IP 无法隐藏** —— 见第七节，待决策。

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