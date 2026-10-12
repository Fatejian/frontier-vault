# frontier-vault 加载性能优化执行文档

> 站点：www.fatejian.icu（源站 <ORIGIN_IP>，VitePress 1.6.4，阿里云杭州）
> 诊断完成：2026-10-12
> 核心决策：接入 Cloudflare CDN，源站无需扩容。

---

## 一、结论与决策

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

这直接否决了所有"换线路"类方案：

| 方案 | 可行性 |
|---|---|
| 换 VPN 节点 / 服务商 | 不可行 —— 链路固定 |
| 换源站线路（CN2 等） | 无效 —— 已建立的 TCP 连接路径已固定 |
| 调整本机网络配置 | 不可行 —— 受办公网络管控 |

**结论：CDN 不是"最优选择"，而是"唯一可行方案"。**

### 决策矩阵

| 方案 | 可行性 | 效果 |
|---|---|---|
| **Cloudflare CDN** | 可行 | **用户就近接入香港边缘节点，不跨境** |
| gzip / brotli | 可行 | 按比例减少丢包暴露 + 提高缓存命中率 |
| 升级带宽 1→5 Mbps | 可行但无效 | 丢包与带宽无关 |
| 换 VPN 线路 | 不可行 | — |

### 因此核心策略：最大化缓存命中率

既然链路无法改变，CDN 的价值就完全取决于**回源频率**。回源越少，跨境传输越少，丢包的影响就被稀释得越彻底。

| 缓存策略 | 跨境回源频率 |
|---|---|
| HTML `max-age=0` | 每次访问都要验证，几乎等于没缓存 |
| HTML `max-age=600` | **10 分钟内零回源** |
| `/assets/*` 30 天 | **30 天内零回源** |

> 这也是第三节（源站压缩）格外重要的原因：资源越小，CDN 首次回源越快，且未命中时的传输耗时越短。

## 二、核心任务：接入 Cloudflare CDN

### 为什么 CDN 能解决全部问题

痛点全在"香港 → 杭州"这段跨境链路上。CDN 让香港访问者直接命中香港边缘节点，根本不跨境：

| 现有问题 | CDN 后的表现 |
|---|---|
| DNS 解析 507 ms（跨境查询） | 解析到 Anycast 边缘 IP，通常 <50 ms |
| TLS 握手 798 ms（2 个跨境 RTT） | 就近接入，约 1 个 RTT |
| 传输期 4% 丢包 → 秒级重传 | 静态资源命中边缘缓存，不产生跨境传输 |
| HTTP/2 队头阻塞 | 可启用 HTTP/3（QUIC），每流独立重传 |
| 1 Mbps 带宽上限 | 流量由边缘下发，源站只服务缓存未命中请求 |

### 前置条件

- [ ] 源站开启压缩并配置缓存头（CDN 依赖这些头决定缓存行为，见第三节）
- [ ] 域名 NS 可修改（当前指向阿里云）
- [ ] 源站 SSL 证书有效（acme.sh 自动续期中）

### 实施步骤

**1. 添加站点**

Cloudflare → 添加站点 `fatejian.icu` → 选 Free 套餐。

**2. 配置 DNS**

Cloudflare 会自动扫描现有记录，逐项确认：

| 类型 | 名称 | 内容 | 代理状态 |
|---|---|---|---|
| A | @ | <ORIGIN_IP> | 已代理 |
| CNAME | www | fatejian.icu | 已代理 |

> 免费版也支持 CNAME 平铺，www 可直接指向根域。

**3. SSL/TLS 设置**

- 加密模式：**Full (strict)** —— 推荐，源站证书由 acme.sh 维护，有效
- 开启 **Always Use HTTPS**

> 不建议用 Flexible（CF 到源站走 HTTP），有重定向循环风险且不安全。

**4. 关闭会破坏站点的功能**

在 速度 → 优化设置 中：

| 功能 | 状态 | 原因 |
|---|---|---|
| Rocket Loader | 关闭 | 会重写脚本加载方式，破坏 VitePress 的模块化 JS |
| Auto Minify | 关闭 | 构建时已压缩，二次处理可能破坏产物 |
| Brotli | 开启 | 默认已开 |
| HTTP/3 (QUIC) | 开启 | 4% 丢包环境下可消除队头阻塞 |

**5. 切换 NS**

到域名注册商处，把 NS 改成 Cloudflare 分配的两条 nameserver。

生效时间：通常 30 分钟 ~ 24 小时。建议低峰操作。

### 缓存策略（关键：决定回源频率）

由于链路不可更改，**缓存命中率就是生命线**。已由源站的 Cache-Control 头控制：

| 路径 | 源站响应头 | 效果 |
|---|---|---|
| /assets/* | max-age=2592000, immutable | 30 天零回源。文件名带 hash，内容变了文件名就变，可安全长期缓存 |
| HTML | **max-age=600**, stale-while-revalidate=86400 | **10 分钟零回源**；10 分钟后先返回旧内容、后台静默更新 |

> **注意**：脚本默认写入的是 `max-age=0, stale-while-revalidate=600`，这在 CDN 下几乎等于不缓存（每次都需验证）。
> 请在执行脚本后手动改为 `max-age=600, stale-while-revalidate=86400`，以获得 10 分钟的零回源窗口。
>
> 代价：内容更新后最多延迟 10 分钟生效。对文档站可接受。

### 上线后验证

```bash
# ① 确认已走 Cloudflare
curl -sI https://www.fatejian.icu/ | grep -iE 'cf-ray|server|cf-cache-status'

# ② 【重要】查看实际接入的边缘节点
curl -s https://www.fatejian.icu/cdn-cgi/trace
#   应出现 colo=HKG（香港）。若显示 NRT/ICN 等日本节点，
#   说明 Anycast 路由把你导去了日本，可接受但需实测对比

# ③ 缓存命中（连续两次，第二次应为 HIT）
curl -sI https://www.fatejian.icu/assets/app.CwvQTczQ.js | grep -i cf-cache-status
curl -sI https://www.fatejian.icu/assets/app.CwvQTczQ.js | grep -i cf-cache-status

# ④ HTML 缓存命中（第二次应为 HIT）
curl -sI https://www.fatejian.icu/ | grep -i cf-cache-status

# ⑤ 关键指标
curl -o /dev/null -s -w "DNS=%{time_namelookup}s TLS=%{time_appconnect}s TTFB=%{time_starttransfer}s\n" https://www.fatejian.icu/

# ⑥ 浏览器侧：DevTools → Network → Protocol 列应显示 h3
```

**达标标准**

| 指标 | CDN 前 | CDN 后（目标） |
|---|---|---|
| DNS | 507 ms | < 50 ms |
| TLS 握手 | 798 ms | < 150 ms |
| TTFB | 1192 ms（中位） | < 300 ms |
| 偶发长尾 | 数十秒 | 基本消失 |
| 缓存命中 | — | `cf-cache-status: HIT` |

### 取舍与注意事项

| 项 | 说明 |
|---|---|
| NS 迁移有延迟 | 生效期间可能短暂不可访问 |
| 回源仍走公网 | 缓存未命中时仍回源，但 1 Mbps 足够（流量已大幅下降） |
| 源站 IP 已公开 | <ORIGIN_IP> 在历史 DNS 中泄露，见第五节加固建议 |
| 免费版限制 | 单文件 512 MB 上限；本项目最大文件 620 KB，无压力 |

## 三、源站基础优化（CDN 的前置）

脚本 `scripts/setup-nginx-perf.sh`，一条命令完成压缩 + 缓存头 + 分项耗时日志。

### 为什么在 4% 丢包环境下仍有实效

减少传输量能按比例减少丢包暴露次数：

| 状态 | 传输量 | 包数 | 预期丢包次数 |
|---|---|---|---|
| 现状（未压缩） | 1350 KB | ~1200 | ~48 次 |
| gzip 后 | ~450 KB | ~400 | ~16 次 |
| brotli 后 | ~357 KB | ~320 | ~13 次 |

其中 mermaid.core.js 620 KB → 约 170 KB，少传约 380 个包 ≈ 少经历 15 次重传机会。

**它不能消除卡顿，但能显著降低卡顿概率，同时为 CDN 铺路。**

### 执行

```bash
scp scripts/setup-nginx-perf.sh root@<ORIGIN_IP>:/root/
cd /root && chmod +x setup-nginx-perf.sh

./setup-nginx-perf.sh --dry-run    # 先看改动
./setup-nginx-perf.sh              # 确认后执行
```

脚本特性：幂等、精确按 root 定位 server 块（避免误改 8080 端口的 pmp-admin）、冲突自动跳过、nginx -t 失败自动回滚。已测 20/20 通过。

执行后仍需手动启用日志：

```nginx
# 在 frontier-vault 的 server 块内
access_log /var/log/nginx/perf.log perf;
buffer_size 16k;          # 必须加，否则进程间不刷盘
```

---

## 四、验收清单

```bash
# ① CDN 生效
curl -sI https://www.fatejian.icu/ | grep -i cf-ray

# ② 边缘节点位置（重要）
curl -s https://www.fatejian.icu/cdn-cgi/trace | grep colo

# ③ 缓存命中（连续两次，第二次应为 HIT）
curl -sI https://www.fatejian.icu/assets/app.CwvQTczQ.js | grep -i cf-cache-status
curl -sI https://www.fatejian.icu/assets/app.CwvQTczQ.js | grep -i cf-cache-status

# ④ HTML 缓存命中（第二次应为 HIT）
curl -sI https://www.fatejian.icu/ | grep -i cf-cache-status

# ⑤ 压缩生效（源站侧）
curl -sI -H 'Accept-Encoding: gzip' https://www.fatejian.icu/assets/style.DSm7fRUq.css \
  | grep -i content-encoding

# ⑥ 关键指标（对比基线：DNS=507ms TLS=798ms TTFB=1192ms）
curl -o /dev/null -s -w "DNS=%{time_namelookup}s TLS=%{time_appconnect}s TTFB=%{time_starttransfer}s\n" https://www.fatejian.icu/

# ⑦ 阿里云监控：出带宽尖峰应明显变平
```

**全部通过才算完成。**

---

## 五、后续加固

> ⚠️ 本节不再是"备选方案"。由于 VPN 链路固定不可更改，**CDN 是唯一方案，没有 Plan B**。
> 以下为 CDN 上线后的加固项。

### 源站 IP 加固（优先级提升）

`<ORIGIN_IP>` 已在历史 DNS 记录中公开。爬虫和攻击者可**绕过 CDN 直接打到源站**，
既消耗 1 Mbps 带宽，也完全不受 CDN 缓存保护。

**做法**：阿里云安全组只允许 Cloudflare IP 段访问 80/443。

> **风险**：配置后若 Cloudflare 故障，网站将完全不可访问（无直连回退）。
> 鉴于访问链路本就不可调整、不存在 Plan B，此方案的容错代价比通常更高。
> 建议 CDN 稳定运行 2 周后再做，且务必先记录完整现有安全组规则以便回滚。

Cloudflare 官方 IP 段：https://www.cloudflare.com/ips/

### 缓存命中率监控（重要）

既然回源频率决定成败，建议定期检查：

```bash
# Cloudflare 控制台 → Analytics → Cache 状态
# 若 MISS 比例偏高，说明缓存策略需调整
```

命中率低于 80% 时，优先检查 HTML 的 `max-age` 是否已改为 600。

### CN2 权益未生效（建议与阿里云核实）

`tracert` 显示实际走 **AS9808 普通国际出口**（106.38.x / 182.61.x 中国移动网段），而 CN2 是 **AS4809**。两者是完全不同的网络，该线路费用未产生效果。

> **注意**：由于 VPN 链路固定，无法通过"切换到 CN2 路径"来利用该权益。
> 但仍建议与阿里云核实 —— 该权益对 CDN 回源链路（Cloudflare 边缘 → 源站）依然有效。
> CDN 命中率越高，回源越少，这条链路的权重就越低。

### 爬虫治理（优先级提升）

nginx 日志一天约 1254 条请求，来源多为海外云主机的爬虫（AWS、Vultr、GCP 等）。

CDN 上线后大部分爬虫会命中边缘缓存、不再回源。但**直接用源站 IP 请求的爬虫不受 CDN 保护**，
因此在完成上面的"源站 IP 加固"后，这部分流量会被自然拦截。

若需主动限流，可参考：

```nginx
# 确认无误的爬虫段后再启用，444 表示直接关闭连接且不记日志
if ($remote_addr ~ "^54\.77\.193\.|^93\.152\.221\.") {
    return 444;
}
```

---

## 六、回滚方案

| 操作 | 回滚方式 |
|---|---|
| CDN | 到域名注册商把 NS 改回原 nameserver |
| nginx 改动 | 脚本会自动备份为 nginx.conf.bak.<时间戳>，用 cp 覆盖后 nginx -t && nginx -s reload |

> 远程服务器改配置时，务必另开一个终端保持 SSH 连接。一条分号错误可能导致服务无法重启。

## 七、附录

### A. 客户端侧实测（办公 VPN <VPN_EGRESS_IP>）

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
>
> 因为链路不可更改，**只能通过减少回源次数来规避**（见第一节"最大化缓存命中率"）。

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

### C. HAR 关键数据

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

避免后人重复折腾：

- **mermaid 已是懒加载** —— theme/index.js 中用动态 import('mermaid')，且无图表时直接 return。不要再改。
- **vite.config.js 的 autoSidebar 插件**只含 configureServer（dev 文件监听），生产构建无开销。
- **死代码**：theme/enhanceApp.js 未被 theme/index.js 引用，不参与构建。它是功能更差的 mermaid 重复实现，**若误删 index.js 中的正确实现，全站 54 处图表会失效**。建议 git rm。
- **lean 模式**为 VitePress 默认行为，二次拉取完整版 chunk 是正常设计。关闭与否需实测对比，不建议盲目改。

### E. 遗留问题（不影响本次交付）

error.log 中持续出现：

```
open() "/var/www/pmp-admin/dist/vp-icons.css" failed (2: No such file or directory)
client: <CLIENT_IP>, host: "<ORIGIN_IP>:8080"
```

pmp-admin 站点（8080 端口）的 server_name fatejian.icu 同样匹配外部请求，且其静态文件已不存在 —— 可能整个站点已下线但配置未清理。

**建议**：确认是否还需要。若不需要，关闭其 listen 8080，消除噪音并减少攻击面。

另有**每 3 小时一次的流量尖峰**仍未归因（crontab 与 /etc/cron.d 中未找到对应任务），可执行 `systemctl list-timers --all` 排查。CDN 上线后该问题影响会显著降低。