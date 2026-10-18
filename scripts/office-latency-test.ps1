<#
.SYNOPSIS
    测量各入口在当前网络下的真实访问质量，判断「直连源站」是否够用。

.DESCRIPTION
    2026-10-18 摘除 Cloudflare 代理后，国内访问由 0.9~2.0s 降到 0.2s 左右；
    但办公室（香港 VPN 出口）此前依赖 CDN 边缘缓存绕开「香港→北京」那段 4~5% 丢包链路。
    本脚本用于在办公室环境下验证直连是否已经够用，还是必须接 CDN。

    判读标准：
      p95 < 600ms 且最大 < 2000ms 且无失败 → 直连够用，不需要 CDN
      p95 < 1500ms 且最大 < 5000ms        → 勉强可用，建议接国内 CDN
      其余                                 → 必须走 CDN

    背景与决策见 project-docs/PERFORMANCE-OPTIMIZATION.md 第〇节。

.PARAMETER Origin
    源站 IP，用于丢包测试。留空则取「四个站点实际连到的 IP」的众数，
    不依赖 DNS 解析结果（DNS 缓存可能仍指向 CDN，会把人误导到错误的判断）。

.PARAMETER Rounds
    每个站点的采样次数，默认 10。

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\scripts\office-latency-test.ps1

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File .\scripts\office-latency-test.ps1 -Rounds 20
#>
[CmdletBinding()]
param(
    [string]$Origin = '',
    [int]$Rounds = 10
)

$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference    = 'SilentlyContinue'

$Sites = @(
    @{ Name = 'fatejian.icu';      Url = 'https://fatejian.icu/' },
    @{ Name = 'kb.fatejian.icu';   Url = 'https://kb.fatejian.icu/' },
    @{ Name = 'plan.fatejian.icu'; Url = 'https://plan.fatejian.icu/' },
    @{ Name = 'pmp.fatejian.icu';  Url = 'https://pmp.fatejian.icu/' }
)

function Write-Section([string]$Text) {
    Write-Host ''
    Write-Host $Text -ForegroundColor Cyan
}

# ---------------------------------------------------------------- 1. 出口 IP
Write-Section '=== 1. 当前出口 IP（确认所处网络）==='
# 必须走 curl --noproxy：本机若装了系统级代理，Invoke-RestMethod 会跟着代理走，
# 查到的出口 IP 是代理节点的，不是真实出口，会把网络环境判断带偏。
$egress = $null
$raw = & curl.exe -s --noproxy '*' -m 10 'https://ipinfo.io/json' 2>$null
if ($LASTEXITCODE -eq 0 -and $raw) { $egress = $raw | ConvertFrom-Json }
if ($egress) {
    Write-Host ("  出口 IP : {0}" -f $egress.ip)
    Write-Host ("  归属    : {0} / {1}" -f $egress.city, $egress.org)
    if ($egress.city -match 'Hong|香港') {
        Write-Host '  判断    : 香港出口 —— 符合办公室 VPN 场景' -ForegroundColor Green
    } else {
        Write-Host '  判断    : 非香港出口 —— 若在办公室请先连上 VPN，否则结果不代表办公场景' -ForegroundColor Yellow
    }
} else {
    Write-Host '  查询失败（可能被网络策略拦截），不影响后续测试' -ForegroundColor DarkGray
}

# ---------------------------------------------------------------- 2. TTFB
Write-Section ("=== 2. 各站点 TTFB（每站 {0} 次）===" -f $Rounds)

$summary = @()
foreach ($site in $Sites) {
    $times  = New-Object System.Collections.ArrayList
    $fail   = 0
    $remote = ''

    for ($i = 1; $i -le $Rounds; $i++) {
        # 用 %{remote_ip} 取实际建连地址，而不是 Resolve-DnsName 的结果。
        # 两者会不一致：Resolve-DnsName 查的是 DNS 服务器的新答案，
        # 而 curl 走 getaddrinfo / 系统 DNS 缓存，可能仍指向 CDN 的旧地址。
        # 测出来的延迟属于「实际连到的那个地址」，只有 remote_ip 说得清。
        $raw = & curl.exe -s --noproxy '*' -o NUL -m 30 `
               -w '%{http_code} %{time_starttransfer} %{remote_ip}' $site.Url 2>$null
        if ($LASTEXITCODE -eq 0 -and $raw) {
            $parts = "$raw".Trim() -split '\s+'
            if ($parts.Count -ge 3) {
                if (-not $remote) { $remote = $parts[2] }
                if ($parts[0] -eq '200') { [void]$times.Add([double]$parts[1]) } else { $fail++ }
            } else {
                $fail++
            }
        } else {
            $fail++
        }
    }

    $p50 = $null; $p95 = $null; $mx = $null
    if ($times.Count -gt 0) {
        $sorted = $times | Sort-Object
        $i50 = [int][math]::Floor($sorted.Count * 0.5)
        $i95 = [math]::Min($sorted.Count - 1, [int][math]::Floor($sorted.Count * 0.95))
        $p50 = [math]::Round($sorted[$i50] * 1000)
        $p95 = [math]::Round($sorted[$i95] * 1000)
        $mx  = [math]::Round((($sorted | Measure-Object -Maximum).Maximum) * 1000)
    }

    $summary += [pscustomobject]@{
        Site = $site.Name; Remote = $remote
        P50 = $p50; P95 = $p95; Max = $mx; Fail = $fail
    }
}

# ---------------------------------------------------------------- 3. 判定源站
Write-Section '=== 3. 判定源站地址 ==='
# 取「实际连到的 IP」里出现次数最多的那个当源站。
# 不走 DNS：解析结果会因缓存而在 CDN 与源站之间来回跳，不能作为判据。
$originIp = $Origin
$originSrc = '（由 -Origin 指定）'
if (-not $originIp) {
    $originIp = ($summary | Where-Object { $_.Remote } |
                 Group-Object -Property Remote |
                 Sort-Object -Property Count -Descending |
                 Select-Object -First 1).Name
    $originSrc = '（取实际连到 IP 的众数）'
}
if (-not $originIp) {
    Write-Host '  无法判定源站（所有请求都失败）' -ForegroundColor Red
    return
}
Write-Host ("  源站地址: {0} {1}" -f $originIp, $originSrc)

$valid   = @()
$skipped = @()
foreach ($r in $summary) {
    if ($r.Remote -eq $originIp) { $valid += $r } else { $skipped += $r }
}

Write-Host ''
Write-Host ('  {0,-20} {1,9} {2,9} {3,9} {4,6}  {5}' -f '站点', 'p50', 'p95', 'max', '失败', '实际连到')
foreach ($r in $summary) {
    $mark = $r.Remote
    if ($r.Remote -ne $originIp) { $mark = "$($r.Remote)  <- 不是源站" }
    if ($null -ne $r.P95) {
        Write-Host ('  {0,-20} {1,7} ms {2,7} ms {3,7} ms {4,6}  {5}' -f $r.Site, $r.P50, $r.P95, $r.Max, $r.Fail, $mark)
    } else {
        Write-Host ('  {0,-20} {1,9} {2,9} {3,9} {4,6}  {5}' -f $r.Site, '-', '-', '-', $r.Fail, $mark) -ForegroundColor Red
    }
}
if ($skipped.Count -gt 0) {
    Write-Host ("  ! {0} 个站点实际未连到源站（多半是 DNS 缓存未过期），不计入结论" -f $skipped.Count) -ForegroundColor Yellow
    Write-Host '    先执行 ipconfig /flushdns 再重跑，或等缓存自然过期' -ForegroundColor DarkGray
}

# ---------------------------------------------------------------- 4. 丢包
Write-Section '=== 4. 到源站的丢包与延迟 ==='
$ping = Test-Connection -ComputerName $originIp -Count 20 -ErrorAction SilentlyContinue
$ok = @($ping).Count
if ($ok -gt 0) {
    $loss = [math]::Round((20 - $ok) / 20 * 100, 1)
    $avg  = [math]::Round((($ping | Measure-Object -Property ResponseTime -Average).Average), 1)
    $max  = ($ping | Measure-Object -Property ResponseTime -Maximum).Maximum
    Write-Host ("  丢包率  : {0}%（20 包）" -f $loss)
    Write-Host ("  平均延迟: {0} ms，最大 {1} ms" -f $avg, $max)
    if ($loss -ge 2) {
        Write-Host '  ! 丢包 >= 2%，TCP 会触发重传退避，这正是 CDN 边缘缓存要规避的问题' -ForegroundColor Yellow
    }
} else {
    Write-Host '  ICMP 被阻断，跳过（不影响 HTTP 测试）' -ForegroundColor DarkGray
}

# ---------------------------------------------------------------- 5. 结论
Write-Section '=== 5. 结论 ==='
if ($valid.Count -eq 0) {
    Write-Host '  没有可用的直连数据，无法给出结论。' -ForegroundColor Red
    Write-Host ''
    return
}

$worstP95  = ($valid | Measure-Object -Property P95 -Maximum).Maximum
$worstMax  = ($valid | Measure-Object -Property Max -Maximum).Maximum
$totalFail = ($valid | Measure-Object -Property Fail -Sum).Sum

if ($worstP95 -lt 600 -and $worstMax -lt 2000 -and $totalFail -eq 0) {
    Write-Host ("  p95 最差 {0} ms，最大 {1} ms —— 直连够用，不需要 CDN。" -f $worstP95, $worstMax) -ForegroundColor Green
    Write-Host '  保持当前配置。'
} elseif ($worstP95 -lt 1500 -and $worstMax -lt 5000) {
    Write-Host ("  p95 最差 {0} ms，最大 {1} ms —— 勉强可用，但有明显顿挫。" -f $worstP95, $worstMax) -ForegroundColor Yellow
    Write-Host '  建议接国内 CDN（域名已有 ICP 备案），优于恢复 Cloudflare 代理。'
} else {
    Write-Host ("  p95 最差 {0} ms，最大 {1} ms —— 体验不可接受。" -f $worstP95, $worstMax) -ForegroundColor Red
    Write-Host '  必须走 CDN。优先级：国内 CDN（有备案）> 恢复 Cloudflare 代理。'
}

Write-Host ''
Write-Host '（把以上输出附到 project-docs/PERFORMANCE-OPTIMIZATION.md 第〇节的实测表里）' -ForegroundColor DarkGray
Write-Host ''
