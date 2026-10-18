# 部署架构与运维手册

> 适用范围：`frontier-vault` 主站及其同机子应用
> 最后更新：2026-10-18
> 关联文档：[`PERFORMANCE-OPTIMIZATION.md`](./PERFORMANCE-OPTIMIZATION.md)（访问路径与缓存策略）、[`SUBDOMAIN-PROXY.md`](./SUBDOMAIN-PROXY.md)（子应用分流）

---

## 一、部署拓扑

| 入口 | 承载内容 | 源站目录 | 出口 | 配置文件 |
|---|---|---|---|---|
| `www.fatejian.icu` | 主站文档 | `/var/www/frontier-vault/` | 源站直连 | `nginx.conf` |
| `fatejian.icu` | 主站 apex | 同上 | 源站直连 | `nginx.conf` |
| `fatejian.github.io/frontier-vault/` | 主站镜像 | 同上 | GitHub Pages 直连 | `gh-pages` 分支 |
| `kb.fatejian.icu` | java-learning-kb | `/var/www/java-learning-kb` | 源站直连 | `conf.d/java-learning-kb.conf` |
| `plan.fatejian.icu` | pmp-plan | `/var/www/pmp-plan/dist` | 源站直连 | `sites-available/pmp-plan` |
| `pmp.fatejian.icu` | pmp-admin | `/var/www/pmp-admin/dist` | 源站直连 | `sites-available/pmp-admin` |

> **2026-10-18 起五个入口全部为灰云直连**，不再经过 Cloudflare 代理。
> 原因（国内与办公室两个地域的需求相反）与实测见 `PERFORMANCE-OPTIMIZATION.md` 第零节。
> DNS 仍托管在 Cloudflare，只是记录不再代理；改回橙云即可回滚。

> 源站为百度智能云 BCC（华东-北京），nginx 1.24.0。
> 应用端口 8080 / 8081 / 8082 均只监听 `127.0.0.1`，公网不可直连。
> **应用站点配置不在 `nginx.conf` 里**，改配置前先定位：
> ```bash
> grep -rn 'listen.*808[0-2]' /etc/nginx/
> ```

---

## 二、双路部署：为什么必须构建两次

push 到 `master` 后，`.github/workflows/deploy.yml` 依次执行：

| 步骤 | 命令 | 产物去向 |
|---|---|---|
| Build for origin | `npm run docs:build`（`base=/`） | — |
| Deploy to Baidu Cloud Server | rsync `--delete` | `/var/www/frontier-vault/` |
| Build for GitHub Pages | `npm run docs:build -- --base /frontier-vault/` | — |
| Deploy to GitHub Pages | `peaceiris/actions-gh-pages` | `gh-pages` 分支 |

**两次构建不是重复劳动**，因为两路的站点根路径不同：

| 部署目标 | 站点根路径 | 产物中的资源引用 |
|---|---|---|
| 源站 | `https://www.fatejian.icu/` | `/assets/app.*.js` |
| Pages | `https://fatejian.github.io/frontier-vault/` | `/frontier-vault/assets/app.*.js` |

若 Pages 沿用 `base=/` 的产物，浏览器会把 `/assets/app.*.js` 解析到
`https://fatejian.github.io/assets/...`（域名根目录），**全部 JS/CSS 404，页面空白**；
反之若源站用了 `/frontier-vault/` 前缀，源站同样 404。

**顺序不可颠倒**：第二次构建会覆盖 `docs/.vitepress/dist/`，必须先 rsync 源站再构建 Pages。
`npm ci` 与 Node 缓存只需执行一次，两个构建共用 `node_modules`。

---

## 三、GitHub Pages 配置要求

Settings → Pages：

| 项 | 值 | 说明 |
|---|---|---|
| Source | `Deploy from a branch` | 用分支发布，配合 `actions-gh-pages` |
| Branch | `gh-pages` / `(root)` | **不可留空**，留空会导致部署静默跳过 |
| Enforce HTTPS | 开启 | — |

验证：

```bash
curl -sI https://fatejian.github.io/frontier-vault/ | grep -iE '^HTTP|^location'
# 期望 200

curl -s https://fatejian.github.io/frontier-vault/ | grep -oE '(href|src)="[^"]*assets[^"]*"' | head -3
# 期望全部以 /frontier-vault/ 开头
```

> ⚠️ GitHub 另有一个内置 workflow `pages build and deployment`，会在 `gh-pages` 分支更新后
> 自动发布。它与本仓库的 `actions-gh-pages` 是**两套独立流程**，排查时注意区分。

---

## 四、源站 Nginx 配置

主站静态资源由 `scripts/setup-nginx-perf.sh` 管理（压缩 + 缓存头 + 分项耗时日志），
子应用分流由 `scripts/setup-subdomain-proxies.sh` 管理（Host → 端口映射 + TLS）。
两者均幂等、支持 `--dry-run`、`nginx -t` 失败自动回滚。

> ⚠️ **改 `listen` 地址后 `reload` 无效**：平滑重载时旧 worker 仍持有 listening socket，
> 新 bind 同端口报 `Address already in use`（`error.log` 出现 `[emerg] still could not bind()`），
> nginx 会自动回退旧配置继续运行——服务不中断但改动不生效。
> **必须 `systemctl restart nginx`**。

---

## 五、故障速查

| 现象 | 根因 | 处理 |
|---|---|---|
| Pages 404，CI 全绿 | Pages 发布源分支为空 | 见第三节，Branch 改回 `gh-pages` / `(root)` |
| Pages 页面空白，控制台大量资源 404 | 用 `base=/` 的产物发到了子路径 | 见第二节，配置两次构建 |
| `gh-pages` 分支长期不更新但 CI success | 同上，或 Pages 配置异常 | `git ls-remote --heads origin gh-pages` 对比时间戳 |
| `cf-cache-status` 始终 `DYNAMIC` | 未配置 Cache Rule | 见 `PERFORMANCE-OPTIMIZATION.md` 第三节 |
| 应用返回 502 | 反代上游未监听 | `ss -tlnp \| grep -E ':(8080\|8081\|8082)\b'` |
| nginx 改配置后无变化 | reload 不支持改监听地址 | `systemctl restart nginx` |

---

## 六、历史事故记录

> 本节记录已修复的部署故障，供后续排查同类问题时对照。**日常使用无需阅读。**

### 6.1 Pages 停更（2026-08-28 ~ 2026-10-13，46 天）

**现象**：CI 每次运行都显示 `Deploy to GitHub Pages: success`，但 `gh-pages` 分支停在
`9d02230`（2026-08-28），`https://fatejian.github.io/frontier-vault/` 返回 404。

**根因**：Pages 设置中发布源分支为空（`Branch: None`）。
`peaceiris/actions-gh-pages` 检测到发布源未正确配置时，**会跳过推送但仍报告 success**——
这使故障在 CI 界面上完全不可见。

**影响**：该期间实际只有 rsync 一路在部署，源站正常，Pages 镜像缺失。

**发现方式**：对比 `gh-pages` 与 `master` 的最后提交时间，两者相差 46 天。

**修复**：Branch 改回 `gh-pages` / `(root)`。

**教训**：

1. `success` 不等于「部署生效」，必须核对**产物侧**证据（分支 SHA、线上响应）
2. 第三方 Action 的跳过行为不体现在 exit code 上，必须配合外部验证
3. 判断 Pages 是否发布，应以 `curl` 实际响应为准，不以 Actions 状态为准

### 6.2 Pages 资源全404（2026-10-13）

**现象**：Pages 恢复 200 后页面能打开，但所有 JS/CSS 404，控制台约 10 条资源错误。

**根因**：两个问题叠加——
1. 6.1 的分支配置问题使 Pages 重新发布了 gh-pages 中 2026-08-28 的旧产物，该产物以 `base=/` 构建
2. 仓库原本只有一次构建（`base=/`），无法产出适配子路径的产物

**为什么重新跑 CI 不能解决**：构建配置未变，重跑只会产出一份同样使用 `base=/` 的产物，
资源路径依旧是 `/assets/...`，404 原样重现。**这是构建期问题，不是部署期问题。**

**修复**：workflow 拆为两次构建，Pages 用 `--base /frontier-vault/`。

**验证**：`gh-pages` 分支 SHA 更新为 `c6bbc23`；线上资源引用全部带 `/frontier-vault/` 前缀，
6 个资源全部 200；源站资源仍走根路径，未受影响。

**教训**：

1. 部署到**子路径**的静态站点，`base` 必须与实际路径一致
2. 同一份产物无法同时服务根路径站点与子路径站点

---

## 七、关联文档

| 文档 | 覆盖内容 |
|---|---|
| [`PERFORMANCE-OPTIMIZATION.md`](./PERFORMANCE-OPTIMIZATION.md) | CDN 接入、Cache Rule、路由与丢包实测、证书体系 |
| [`SUBDOMAIN-PROXY.md`](./SUBDOMAIN-PROXY.md) | 子应用端口分流、TLS 配置、暴露面收紧 |
| [`CONTRIBUTING-i18n.md`](./CONTRIBUTING-i18n.md) | 译者协作规范 |