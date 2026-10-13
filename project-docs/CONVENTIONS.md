# 工程约束与陷阱防范

> 用途：记录本项目**已经踩过**的坑及其正确处理方式，避免重复发生。
> 每条包含：现象 / 根因 / 触发条件 / 正确做法 / 禁止做法 / 检查点。
> 来源：2026-10-12 ~ 10-13 的一次集中修复（子应用上线 + CDN 优化 + 部署排查）。
> 适用范围：修改 `scripts/`、`.github/workflows/`、服务器 Nginx 配置、项目文档时的硬性约束。

---

## 使用方式

| 场景 | 动作 |
|---|---|
| 要改 Nginx / workflow / 部署配置 | 先读「一、部署与 CI」「三、运维与配置」 |
| 要下结论说「X 是 Y」 | 先读「二、验证方法」，确认判据本身可信 |
| 要写文档 | 先读「五、文档规范」 |
| 准备提交代码 | 走文末「提交前自检清单」 |

新增约束沿用既有编号前缀，勿复用已占用编号。

---

## 一、部署与 CI

### D-01 静态站点部署到子路径，构建 base 必须匹配

**现象**：GitHub Pages 页面能打开，但所有 JS/CSS 404，页面白屏。

**根因**：项目站点路径是 `https://<user>.github.io/<repo>/`，而构建默认 `base=/`，
产物 HTML 中资源写为 `/assets/app.*.js`，浏览器会解析到域名根目录 `https://<user>.github.io/assets/...`。

**触发条件**：静态站点部署到**非根路径**，且构建时未指定 `--base`。

**正确做法**（本项目已实施）：

```bash
# 源站（根路径）
npm run docs:build
# Pages（子路径）—— 同一 job 内第二次构建
npm run docs:build -- --base /frontier-vault/
```

两次构建顺序不可颠倒：第二次会覆盖 `docs/.vitepress/dist/`，必须先 rsync 源站再构建 Pages。

**禁止**：

- 用一份产物推两个目标
- 认为「重跑 CI 就能修好」——构建配置不变，重跑只会产出同样的错误路径。**这是构建期问题，不是部署期问题**

**检查点**：部署后验证引用必须带子路径前缀

```bash
curl -s https://fatejian.github.io/frontier-vault/ | grep -oE '(href|src)="[^"]*assets[^"]*"' | head -3
# 期望全部以 /frontier-vault/ 开头
```

---

### D-02 Pages 发布源分支为空会导致部署静默跳过

**现象**：Actions 显示 `Deploy to GitHub Pages: success`，但 `gh-pages` 分支长期不更新，线上 404。

**根因**：`peaceiris/actions-gh-pages` 检测到 Pages 发布源未配置时，**跳过推送但仍返回 success**。
跳过行为不体现在 exit code 上，CI 界面完全看不出异常。

**触发条件**：Settings → Pages 设置为 `Deploy from a branch`，但 Branch 为 `None`。

**正确做法**：Branch 必须显式设为 `gh-pages` / `(root)`，并把「产物侧状态」纳入检查。

**禁止**：

- 凭Actions 绿灯判断部署是否生效
- 把第三方 Action 的 `success` 当作部署成功的充分证据

**检查点**：对比两个分支的最后提交时间

```bash
git ls-remote --heads origin master gh-pages
# 两者时间差过大 → 部署未生效
```

---

### D-03 CI 绿灯不等于目标达成（原则性约束）
**检查点**：每次部署完成后，在交付说明中记录「验证命令 + 实际输出」，而非只写「CI 通过」。

**现象**：CI 全部成功，但线上资源 404、缓存未命中、证书未生效。

**根因**：workflow 只覆盖「构建 + 发布」动作，**不验证线上是否真的可用**；
第三方 Action 还可能以 success 掩盖跳过。

**触发条件**：任何「自动化部署」场景。

**正确做法**：每次部署后至少验证一项**产物侧证据**：

- Pages：curl 状态码 + HTML 中的资源引用路径
- 源站：curl 响应头 Last-Modified 与 CI 运行时间是否吻合
- CDN：cf-cache-status 是否为预期的 HIT / MISS
- 分支：git ls-remote 的 SHA 是否变化

**禁止**：看到 CI 绿色就宣布任务完成。

## 二、验证方法（如何证明一件事）

> 本节全部来自**本次修复中我自己下错过结论**的地方。危害大于配置错误——错误判据会导出错误修复。

### V-01 判定换行符：不要用「读文件 → 管道 → 计数」

**现象**：`git cat-file -p file | grep -c $'\r'` 返回总行数，据此判定「仓库内 .sh 是 CRLF」，
并建议执行 `renormalize`；而实际仓库 blob 一直是纯 LF，`renormalize` 加 `-f` 也毫无变化。

**根因**：管道中间环节（Git for Windows 的输出重定向、WSL 互操作层）会做换行转换，污染原始字节。
统计到的是「被转换后的字节」，不是仓库内容。

**触发条件**：任何试图用管道统计原始字节（CR/LF/编码特征）的判据。

**正确做法**：

```bash
git ls-files --eol <file>                  # i/=索引 blob，w/=工作区，attr/=生效属性
git cat-file blob <ref> | od -c | head     # 看原始字节
```

工作区文件用 PowerShell 的 ReadAllBytes 统计 CR/LF。

**禁止**：

- 用 `... | grep -c $'\r'` 作为换行符判据
- 依据这类结果得出「存在 CRLF 问题」并推动 renormalize

**检查点**：改动含 `.sh` 的文件后确认 `git ls-files --eol` 的 i/ 列为 `lf`。

---

### V-02 正则匹配位数写错
**检查点**：首次使用某个过滤式 grep 时，先用已知存在的值验证其能匹配到目标。

**现象**：用 `grep -E '80[0-2]'` 过滤端口 8080-8082，无任何输出，误以为配置未生效。

**根因**：`80[0-2]` 匹配的是 800/801/802（3 位），不是 8080/8081/8082（4 位）。

**触发条件**：用简写正则表达「808x」这类「前缀 + 范围」组合时。

**正确做法**：`grep -E '808[0-2]'`（补上前缀），或直接列出全部 `grep -E ':(8080|8081|8082)\b'`。

**禁止**：未验证匹配效果就基于 grep 结果下结论。
**任何过滤式 grep 都应先确认它真能匹配到目标**（用已知存在的值反向验证）。

---

### V-03 搜索工具默认跳过隐藏目录
**禁止**：用默认 rg 搜索含隐藏目录的路径后，断言「不存在引用」或「已被清理」。

**检查点**：结论为「无引用」时，换`git grep` 或显式路径复核一次。

**现象**：判断 `enhanceApp.js` 是否被引用，搜索整个 docs/ 返回 0 匹配，得出「文件未被引用」；
而该文件位于 `.vitepress/`（以点开头的隐藏目录），根本未被搜到。

**根因**：ripgrep 默认跳过隐藏文件/目录；`Select-String` 直接读文件不跳过。
两种工具结论相反时，说明至少一方漏检。

**触发条件**：仓库内存在 `.vitepress/`、`.github/`、`.agents/` 等隐藏目录时。

**正确做法**：

- 用 `git grep`（只搜跟踪文件，不受隐藏目录规则影响）
- 或用 PowerShell Select-String 显式指定文件
- 关键文件用绝对路径显式读一次

**禁止**：用默认 rg 搜索含隐藏目录的路径后，断言「不存在引用」。

---

### V-04 计数类 grep 必须加行首锚点
**禁止**：对可能是其他词子串的模式做无锚点计数。

**检查点**：计数结果与预期条数不符时，先用无锚点与有锚点各跑一次对比差额来源。

**现象**：`grep -c 'server_name'` 统计 server 块数，得到真实值的 2 倍——
因为 `proxy_ssl_server_name on;` 也包含子串 `server_name`。

**根因**：`grep -c` 统计匹配行数，子串匹配会连带命中无关行。

**触发条件**：统计类 grep 的模式词是其他标识符的子串。

**正确做法**：

```bash
grep -cE '^[[:space:]]*server_name[[:space:]]'     # 行首锚定
grep -cE '^[[:space:]]*server[[:space:]]*\{'        # 统计配置块更可靠
```

**禁止**：对可能是其他词子串的模式做无锚点计数。

---

## 三、运维与配置

### O-01 修改 listen 地址后必须 restart，reload 无效

**现象**：把 `listen 8080` 改为 `listen 127.0.0.1:8080`，执行 `nginx -t && nginx -s reload` 成功，
但 `ss -tlnp` 中仍是 `0.0.0.0:8080`。

**根因**：平滑重载时旧 worker 仍持有 listening socket，新 bind 同端口报
`bind() to 127.0.0.1:8080 failed (98: Address already in use)`，
nginx 捕获后**自动回退旧配置继续运行**——服务不中断，但改动未生效。

**触发条件**：任何**改变端口或绑定地址**的变更（改 listen 的端口、IP、增删 listen 行）。

**正确做法**：

```bash
grep -i 'still could not bind' /var/log/nginx/error.log   # 确认是否被回退
systemctl restart nginx        # 完全重启，释放旧 socket
ss -tlnp | grep -E ':(8080|8081|8082)\b'   # 验证绑定地址
```

**禁止**：

- 改 listen 后只用 reload
- 看到 `nginx -s reload` 无报错就认为配置已生效

**检查点**：变更后用 ss 核对实际绑定地址，不以命令退出码为准。

---

### O-02 应用站点配置不在 nginx.conf 里
**检查点**：`nginx -t` 通过后，仍须用 `grep -rn 'listen.*808[0-2]' /etc/nginx/` 确认目标文件确实被修改。

**现象**：对 `/etc/nginx/nginx.conf` 执行 sed 替换 `listen 8080 ssl;`，命令成功但无任何效果，
grep 也查不到目标内容。

**根因**：`nginx -T` 会输出**所有被 include 的文件**内容，容易误以为都在主配置里。
本项目实际分布：

| 内容 | 真实路径 |
|---|---|
| 主站静态站 | /etc/nginx/nginx.conf |
| pmp-admin（8080） | /etc/nginx/sites-available/pmp-admin |
| pmp-plan（8081） | /etc/nginx/sites-available/pmp-plan |
| java-learning-kb（8082） | /etc/nginx/conf.d/java-learning-kb.conf |
| 子应用分流 | /etc/nginx/conf.d/subdomain-proxies.conf |

**触发条件**：根据「某配置在某处」的印象直接改文件，未先定位。

**正确做法**：改配置前先定位

```bash
grep -rn 'listen.*808[0-2]' /etc/nginx/
```

**禁止**：对未验证过的文件执行配置变更；假设全部配置都在 nginx.conf。

---

### O-03 IPv6 监听需与 IPv4 绑定地址同步处理

**现象**：`listen 8082 ssl;` 改为 `listen 127.0.0.1:8082 ssl;`，但下一行 `listen [::]:8082 ssl;` 未处理，
IPv6 入口仍对公网开放。

**根因**：同一端口常同时配置 IPv4 与 IPv6 监听，只改其中一行会造成**部分地址仍暴露**，
且 `nginx -t` 不会报错。

**触发条件**：收紧绑定地址时，该端口存在 `[::]` 形式的监听行。

**正确做法**：一并处理

```bash
sed -i -e 's/listen 8082 ssl;/listen 127.0.0.1:8082 ssl;/' \
       -e '/listen.*::.*8082 ssl;/d' /etc/nginx/conf.d/java-learning-kb.conf
grep -n 'listen' /etc/nginx/conf.d/java-learning-kb.conf | grep 8082   # 确认无 :: 残留
```

**禁止**：只替换 IPv4 行而遗漏 `[::]` 行；假设 `nginx -t` 能发现暴露问题。

**检查点**：`ss -tlnp` 中该端口**只出现** `127.0.0.1:<port>`，无 `0.0.0.0` 或 `[::]`。

## 四、外部服务与事实核查

### F-01 环境事实以控制台/API 为准
**检查点**：凡涉及云厂商、地域、实例规格、IP 归属的结论，均须附一次外部核验命令及其输出。，不以文档为准

**现象**：文档写「阿里云杭州」，据此推断服务器是阿里云，并向用户断言「README 里的 Baidu Cloud 是错的」；
实际控制台显示是**百度智能云 BCC · 华东-北京**，错的一方是文档。

**根因**：把仓库内文档的描述当作事实来源，再去「纠正」其他来源——文档本身可能才是错的。

**触发条件**：任何「A 和 B 哪个对」的判断，其中 A 来自仓库文档。

**正确做法**：

```bash
curl -s "http://ip-api.com/json/<IP>?lang=zh-CN"   # 云厂商 / 地域 / ISP / AS
```

或直接看云控制台截图。

**禁止**：

- 以文档描述为事实依据去纠正其他来源
- 未核实就下「某处描述有误」的结论

---

### F-02 第三方服务的状态会漂移
**禁止**：把单次观测到的边缘节点、区域写入文档作为固定事实。

**检查点**：文档中出现colo / 节点名时，确认已注明「Anycast 会漂移，以响应头为准」。，必须以外部观测为准

**现象**：Cloudflare 边缘节点先测得 CF-RAY 后缀 LHR（伦敦），复测为 HKG（香港）。

**根因**：Anycast 会按来源网络动态分配，节点不是固定属性。

**触发条件**：依据单次观测的边缘节点、区域、路由做判断或写入文档。

**正确做法**：用**服务端特征**判断是否经过 CDN，而不是节点名

```bash
nslookup <host> 1.1.1.1        # 解析到 CF 边缘段（104.21 / 172.67 / 2606:4700）
curl -sI https://<host> | grep -iE '^server|cf-ray'   # Server: cloudflare
```

文档中不要写死 colo 值。

---

### F-03 DNS CNAME 不继承目标的代理状态
**检查点**：判断某域名是否走 CDN，以`nslookup` 解析结果 + `Server` 响应头两项为准，不看面板配置。

**现象**：三个子域名均为「CNAME 指向已代理的 apex」，据此认为它们也已走 CDN；
实测解析到源站真实 IP，响应头为 Server: nginx，从未经过 Cloudflare。

**根因**：Cloudflare 的代理状态是**每条 DNS 记录独立的开关**，
CNAME 指向谁不决定该记录自身是否代理；「仅 DNS」的记录直接返回目标记录的解析值。

**正确做法**：判断是否走 CDN 只看两件事——DNS 解析结果 + Server 响应头。

**禁止**：通过 CNAME 指向关系推断代理状态。

**触发条件**：看到「CNAME 指向已代理域名」就认为子域名的代理状态相同。
---

## 五、文档规范

### M-01 历史记录与事故复盘不进根目录 README

**现象**：把「Pages 停更 46 天」的事故记录写进根目录 README 的部署章节。
**触发条件**：在根目录 README 中写入带日期、事故、修复过程、「曾经…现在…」等叙述性内容。

**禁止**：在根目录 README 记录事故经过、修复过程、历史时间线。

**检查点**：提交前搜索 README 中的日期、事故、修复等叙述性段落，确认已下沉到 project-docs。

**根因**：根目录 README 面向全部访问者（含只想读内容的人），事故细节对其零价值；
且历史记录没有终点，会随时间累积成事故日志，最终淹没项目说明。

**正确做法**：

- 根目录 README 只写**现状**与**使用者必须知道的约束**
- 历史记录、事故复盘、故障排查 → 归入 project-docs/
- 本项目归口：project-docs/DEPLOYMENT.md 第六节

| 内容 | 位置 |
|---|---|
| 项目是什么、怎么用、怎么贡献 | 根目录 README |
| 部署架构、故障速查、事故记录 | project-docs/DEPLOYMENT.md |
| CDN 策略、性能实测、证书体系 | project-docs/PERFORMANCE-OPTIMIZATION.md |
| 子应用分流细节 | project-docs/SUBDOMAIN-PROXY.md |

**保留在 README 的例外**：执行者必须知道否则会做错事的约束
（如「两次构建不可省略」——不知情者可能把第二次构建当冗余删掉）。

---

### M-02 文档中的数字必须实测统计

**现象**：README 写「每个语言 20 篇，合计 40 篇」，实际27 篇/语言、54 篇总量；
同一文档的「全站 54 处图表」实际为 79 处。

**根因**：数字在内容扩充前写下，后续未同步。

**触发条件**：任何写入文档的计数（文章数、图表数、文件数、技能数）。

**正确做法**：写之前先统计

```powershell
foreach($m in @('browser','javascript','frameworks','performance','testing','ai','career')){
  "$m " + (Get-ChildItem "docs/$m" -Filter *.md -File).Count }
```

**禁止**：凭印象或沿用旧值写数字。

**检查点**：文档中每个数字都应能复现其统计命令；更新内容后重新统计并同步。
---

### M-03 配置描述必须与实现逐条核对

**现象**：文档称某脚本「默认写入 max-age=0，需手动改为 600」，实际脚本默认值就是 600/86400，
照着文档改反而会改错。

**根因**：文档描述基于对代码的推测而非阅读。

**触发条件**：文档中描述某个脚本、配置项、默认值。

**正确做法**：先读实现，再写描述

```bash
grep -n 'HTML_MAXAGE\|REVALIDATE' scripts/setup-nginx-perf.sh
```

**禁止**：未读代码就描述其行为。

## 六、安全

**检查点**：描述脚本行为前，先执行一次 grep 并把实际输出贴到描述旁边。
### S-01 公开仓库不写入真实 IP、密钥与个人信息
**根因**：提示文案与文档示例常在本地编写时直接粘贴真实值，未意识到仓库为公开仓库。

**现象**：脚本的提示文案中硬编码了源站公网 IP，仓库为公开仓库，一旦提交即等于公布
「绕过 CDN 直连源站」的地址。

**触发条件**：编写脚本提示、文档示例、调试输出时。

**正确做法**：

- 一律使用占位符 `<ORIGIN_IP>`、`<VPN_EGRESS_IP>`、`<ISP_BACKBONE_IP>`
- 内网回环 127.0.0.1、通配 0.0.0.0 可直接写

**禁止**：在任何提交内容中出现真实公网 IP、邮箱、密钥、token。

**检查点**：提交前扫描

```powershell
git diff --cached | Select-String '(\d{1,3}\.){3}\d{1,3}'
# 期望仅 127.0.0.1
git diff --cached | Select-String 'C:\\Users\\|@gmail|password=|secret=|BEGIN PRIVATE KEY'
# 期望无输出
```

---

## 七、脚本开发约束（scripts/）

### SD-01 bash set -e 下不可用 `[[ cond ]] && cmd` 做可选逻辑

**现象**：条件为假时整条命令返回非 0，set -e 直接终止脚本，且报错不指向真实原因。

**正确做法**：一律使用 if

```bash
if [[ "$VAR" == "1" ]]; then echo "..."; fi   # 条件为假时返回 0
[[ "$VAR" == "1" ]] && echo "..."                # 条件为假时终止脚本
```

**根因**：bash 手册中「AND-OR 列表中非末位命令失败不触发 set -e」的规则常被误记为「整个列表失败也不触发」。
实际当整条 `A && B` 的退出状态为非 0 且不在条件上下文中时，脚本会终止。

**触发条件**：脚本头部含 `set -e`，且使用了 `[[ ]] &&` 形式的可选逻辑。

**禁止**：用 `[[ cond ]] && cmd` 做可选逻辑；用同样形式组合 `cleanup` 或 trap 前的判断。

**检查点**：脚本中搜索 `]] &&`，全部改为 if 结构后再执行。
---

### SD-02 临时文件必须用 mktemp -d，并确保 trap 已注册

**现象**：漏写 `TMPD="$(mktemp -d)"`，导致临时文件被写到根目录，且 cleanup 因路径为空而不清理。

**正确做法**：

```bash
TMPD=""
TMPD="$(mktemp -d)"       # 分配与初始化相邻，避免漏写
cleanup() { if [[ -n "$TMPD" && -d "$TMPD" ]]; then rm -rf "$TMPD"; fi; }
trap cleanup EXIT
```

**禁止**：用固定路径当临时目录；用 `[[ ]] &&` 组合 cleanup。

**根因**：变量初始化与实际分配分离，两者之间隔了较远代码，赋值语句被遗漏。

**触发条件**：脚本需要写临时文件，且以 `set -e` 开头。

**检查点**：脚本运行后检查临时目录之外（尤其是根目录）是否有残留文件。
---

### SD-03 诊断类配置默认关闭

**现象**：生成的 nginx 片段默认输出 X-Upstream-Port 诊断头，对外暴露内部端口结构。

**正确做法**：诊断能力做成显式开关，默认关闭（需排查时临时开启）

```bash
DIAG_HEADER="${DIAG_HEADER:-0}"    # 置 1 才输出诊断头
```

端口、域名等可变项集中在配置数组中声明，不散落在生成逻辑里。

---

## 提交前自检清单

```bash
# 1. 敏感信息（期望仅出现 127.0.0.1）
git diff --cached | grep -nE '([0-9]{1,3}\.){3}[0-9]{1,3}'

# 2. 凭证类（期望无输出）
git diff --cached | grep -inE 'C:\\Users\\|@gmail|password=|secret=|token=|BEGIN PRIVATE KEY'

# 3. 换行符（.sh 的 i/ 列应为 lf）
git ls-files --eol scripts/*.sh

# 4. workflow 语法
python -c "import yaml;yaml.safe_load(open('.github/workflows/deploy.yml'));print('ok')"

# 5. shell 语法
bash -n scripts/*.sh && echo ok
```

---

## 约束索引

| 编号 | 约束 | 类别 |
|---|---|---|
| D-01 | 静态站点子路径部署的 base 必须匹配 | 部署 |
| D-02 | Pages 发布源为空会静默跳过 | 部署 |
| D-03 | CI 绿灯不等于目标达成 | 部署 |
| V-01 | 不用管道 grep 判定原始字节 | 验证 |
| V-02 | 正则位数写错 | 验证 |
| V-03 | 搜索工具跳过隐藏目录 | 验证 |
| V-04 | 计数类 grep 必须加行首锚点 | 验证 |
| O-01 | 改 listen 后必须 restart | 运维 |
| O-02 | 应用站点配置不在 nginx.conf | 运维 |
| O-03 | IPv6 监听需同步处理 | 运维 |
| F-01 | 环境事实以控制台/API 为准 | 事实 |
| F-02 | 第三方服务状态会漂移 | 事实 |
| F-03 | CNAME 不继承代理状态 | 事实 |
| M-01 | 历史记录不进根 README | 文档 |
| M-02 | 数字必须实测统计 | 文档 |
| M-03 | 配置描述必须核对实现 | 文档 |
| S-01 | 公开仓库不写真实 IP | 安全 |
| SD-01 | set -e 下不用 [[ ]] && | 脚本 |
| SD-02 | 临时文件用 mktemp -d | 脚本 |
| SD-03 | 诊断配置默认关闭 | 脚本 |
**根因**：为便于开发期排查而默认开启，配置定稿时未回退。

**触发条件**：生成配置片段、响应头或调试字段时。

**禁止**：诊断类响应头默认开启；把端口、域名等可变值散落在生成逻辑中。

**检查点**：定稿后 curl 线上响应头确认无诊断字段；`grep -rn 'add_header.*Port' /etc/nginx/` 无非预期项。