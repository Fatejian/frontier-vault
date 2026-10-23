# 文章格式合规审计脚本 (audit-articles.ps1)
# 基于 article-style v3.2.0 规范，审计全部文章的格式合规性
# 用法: pwsh audit-articles.ps1
# 输出: 按文章 × 检查项矩阵，标注 PASS/FAIL + 证据

$ErrorActionPreference = "Stop"

# ============================================================
# 常量定义
# ============================================================

# 审计根目录
$DOCS_DIR = (Resolve-Path (Join-Path $PSScriptRoot '..\docs')).Path

# 排除的文件模式（非文章文件）
$EXCLUDE_PATTERN = "\\index\.md$|\\\.vitepress"

# 预编译正则（模块级常量，避免重复构造）
$FM_REGEX           = "(?s)^---\r?\n(.*?)\r?\n---"
$MERMAID_REGEX      = '(?s)```mermaid[ \t]*\r?\n(.*?)```'
$TITLE_REGEX        = "^title:"
$OUTLINE_REGEX      = "^outline:"
$CJK_REGEX          = "[\u4e00-\u9fff]"
$COMMA_REGEX        = ","
$INIT_REGEX         = '%%\s*\{init:'
$FOUR_COLON_REGEX   = '(?m)^:{4,}'
$META_ZH_REGEX      = '(?m)^>\s*(副标题|目标读者|阅读时间)\s*[：:]'
$META_EN_REGEX      = '(?im)^>\s*(Subtitle|Target readers?|Target audience|Reading time)\s*[:：]'
$CONCLUSION_ZH      = '^##\s+结语'
$CONCLUSION_EN      = '^##\s+Conclusion'

# 允许的 Mermaid classDef 色值（fill 或 stroke）
$ALLOWED_MERMAID_COLORS = @(
    '#EEF6FF', '#3B82F6',  # wait
    '#FFF7E6', '#F59E0B',  # block
    '#ECFDF3', '#22C55E',  # work
    '#F5E8FF', '#A855F7',  # metric
    '#172033'              # core (fill and stroke)
)

# ============================================================
# 审计函数
# ============================================================

<#
.SYNOPSIS
  审计单篇文章的格式合规性
.DESCRIPTION
  按 article-style v3.2.0 检查：
  frontmatter 字段顺序 / title 单行与引号 / tags 英文 / outline deep /
  四冒号容器 / 开篇元信息块 / 结语 / Mermaid 无 init 与五色 classDef /
  英文中文残留 / 英文 Mermaid 描述性裸逗号
.PARAMETER FilePath
  文章文件的绝对路径
.PARAMETER BaseDir
  文档根目录（用于生成相对路径）
.OUTPUTS
  [PSCustomObject] 包含 Article、Issues、Count 属性
#>
function Invoke-ArticleAudit {
    param(
        [string]$FilePath,
        [string]$BaseDir
    )

    $content = Get-Content $FilePath -Raw -Encoding UTF8
    $name    = $FilePath -replace [regex]::Escape($BaseDir + "\"), ""
    $isEN    = $name -match "^en\\"

    # 统一按 CRLF/LF/孤立 CR 切分，避免 Windows 混合行尾干扰
    $lines = $content -split "\r\n|\n|\r"

    # --- 提取 frontmatter ---
    $fmMatch = [regex]::Match($content, $FM_REGEX)
    $fm      = $fmMatch.Groups[1].Value
    $fmLines = if ($fm) { $fm -split "\r\n|\n|\r" } else { @() }

    $issues = [System.Collections.Generic.List[string]]::new()

    # --- 1. frontmatter 字段顺序 ---
    $expectedFields = @("title", "description", "category", "tags", "readingTime", "outline")
    $actualFields   = @($fmLines | ForEach-Object {
        $m = [regex]::Match($_, "^([A-Za-z][A-Za-z0-9]*):")
        if ($m.Success) { $m.Groups[1].Value }
    })
    if (($actualFields -join ",") -ne ($expectedFields -join ",")) {
        $issues.Add("frontmatter字段顺序/缺失(实际=$($actualFields -join '/'))")
    }

    # --- 2. title 单行 + 冒号双引号 ---
    $titleIndex = -1
    for ($i = 0; $i -lt $fmLines.Count; $i++) {
        if ($fmLines[$i] -match $TITLE_REGEX) { $titleIndex = $i; break }
    }
    if ($titleIndex -lt 0) {
        $issues.Add("缺title")
    } else {
        $titleVal  = ($fmLines[$titleIndex] -replace "^title:\s*", "").Trim()
        $nextLine  = if ($titleIndex + 1 -lt $fmLines.Count) { $fmLines[$titleIndex + 1].Trim() } else { "" }
        $crossLine = $false

        # title 以引号开头却没有在本行收尾
        if ($titleVal -match '^["'']' -and $titleVal -notmatch '["'']$') { $crossLine = $true }
        # 下一行是孤立引号（如 " 或 :"），说明标题被换行拆断
        if ($nextLine -match '^[:;]?["'']{1,2}$') { $crossLine = $true }

        $titleStripped  = $titleVal -replace '^["'']', '' -replace '["'']$', ''
        $titleHasColon  = $titleStripped -match "[:：]"
        $titleHasDouble = $titleVal -match '^"'

        if ($crossLine) {
            $issues.Add("title跨行(须单行)")
        } elseif ($titleHasColon -and -not $titleHasDouble) {
            $msg = if ($titleVal -match "^'") { "title单引号(应双引号)" } else { "title含冒号未加双引号" }
            $issues.Add($msg)
        }
    }

    # --- 3. tags 全英文 ---
    $badTags = @()
    foreach ($line in $fmLines) {
        if ($line -match "^\s+-\s+(.+)$") {
            $tag = $Matches[1].Trim().Trim('"', "'")
            if ($tag -match $CJK_REGEX -or $tag -match "[^\x20-\x7E]") { $badTags += $tag }
        }
    }
    if ($badTags.Count -gt 0) {
        $issues.Add("tags非英文($($badTags -join ','))")
    }

    # --- 4. outline=deep ---
    $outlineLine  = $fmLines | Where-Object { $_ -match $OUTLINE_REGEX } | Select-Object -First 1
    $outlineVal   = if ($outlineLine) { ($outlineLine -replace "^outline:\s*", "").Trim() } else { "" }
    if ($outlineVal -ne "deep") {
        $issues.Add("outline非deep(实际=$outlineVal)")
    }

    # --- 5. 四冒号容器 ---
    $fourColonCount = ([regex]::Matches($content, $FOUR_COLON_REGEX)).Count
    if ($fourColonCount -gt 0) {
        $issues.Add("四冒号容器($fourColonCount)")
    }

    # --- 6. 开篇不得出现与 frontmatter 重复的元信息块 ---
    $openingEnd = -1
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match '^##\s+') { $openingEnd = $i; break }
    }
    $opening = if ($openingEnd -gt 0) {
        ($lines[0..($openingEnd - 1)]) -join "`n"
    } elseif ($openingEnd -eq 0) {
        ""
    } else {
        $content
    }
    $metaMatches = @()
    $metaMatches += [regex]::Matches($opening, $META_ZH_REGEX)
    $metaMatches += [regex]::Matches($opening, $META_EN_REGEX)
    if ($metaMatches.Count -gt 0) {
        $issues.Add("开篇元信息块重复($($metaMatches.Count)行)")
    }

    # --- 7. 结语 ---
    $conclusionRegex = if ($isEN) { $CONCLUSION_EN } else { $CONCLUSION_ZH }
    if (-not [regex]::IsMatch($content, "(?m)$conclusionRegex")) {
        $issues.Add($(if ($isEN) { "缺Conclusion" } else { "缺结语" }))
    }

    # --- 8. Mermaid 不得残留 per-diagram init，classDef 五色 ---
    $mermaidBlocks   = [regex]::Matches($content, $MERMAID_REGEX)
    $mermaidCount    = $mermaidBlocks.Count
    $initCount       = 0
    $badColors       = @()

    foreach ($mb in $mermaidBlocks) {
        $code      = $mb.Groups[1].Value
        $codeLines = $code -split "\r\n|\n|\r"

        if ([regex]::IsMatch($code, $INIT_REGEX)) { $initCount++ }

        foreach ($line in $codeLines) {
            if ($line -notmatch "^\s*classDef\s+") { continue }
            foreach ($cm in [regex]::Matches($line, "(?:fill|stroke)\s*:\s*(#[0-9A-Fa-f]{6})")) {
                $hex = $cm.Groups[1].Value.ToUpper()
                if ($ALLOWED_MERMAID_COLORS -notcontains $hex) { $badColors += $hex }
            }
        }
    }

    if ($initCount -gt 0) { $issues.Add("Mermaid残留init($initCount/$mermaidCount)") }
    if ($badColors.Count -gt 0) {
        $uniq = $badColors | Sort-Object -Unique
        $issues.Add("Mermaid非五色($($uniq -join ','))")
    }

    # --- 9. 英文文章中文残留 ---
    if ($isEN) {
        $cjk = ([regex]::Matches($content, $CJK_REGEX)).Count
        if ($cjk -gt 0) { $issues.Add("中文残留($cjk)") }
    }

    # --- 10. 英文 Mermaid 描述性裸逗号（保留原有代码语法排除逻辑）---
    if ($isEN -and $mermaidCount -gt 0) {
        $bareCommaCount = 0
        foreach ($mb in $mermaidBlocks) {
            $code       = $mb.Groups[1].Value
            $nodeLabels = [regex]::Matches($code, '\["([^"]*)"\]')
            foreach ($label in $nodeLabels) {
                $text = $label.Groups[1].Value
                if ($text -match $COMMA_REGEX) {
                    # 排除代码语法中的逗号：{xxx, yyy} 或 (xxx, yyy) 或函数参数
                    # 仅标记描述性文字中的逗号
                    if (-not ($text -match "[{(].*,.*[})]")) { $bareCommaCount++ }
                }
            }
        }
        if ($bareCommaCount -gt 0) {
            $issues.Add("描述性裸逗号($bareCommaCount)")
        }
    }

    return [PSCustomObject]@{
        Article = $name
        Issues  = if ($issues.Count -eq 0) { "PASS" } else { $issues -join "; " }
        Count   = $issues.Count
    }
}

# ============================================================
# 主流程
# ============================================================

Write-Host "=== 文章格式合规审计 (article-style v3.2.0) ===" -ForegroundColor Cyan
Write-Host ""

$articles = Get-ChildItem $DOCS_DIR -Recurse -Filter "*.md" |
    Where-Object { $_.FullName -notmatch $EXCLUDE_PATTERN }

$report = @()
foreach ($f in $articles) {
    $result = Invoke-ArticleAudit -FilePath $f.FullName -BaseDir $DOCS_DIR
    $report += $result
}

$pass = ($report | Where-Object { $_.Count -eq 0 }).Count
$fail = ($report | Where-Object { $_.Count -gt 0 }).Count
Write-Host "审计结果：PASS=$pass 篇 / FAIL=$fail 篇" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Yellow" })
Write-Host ""

if ($fail -gt 0) {
    Write-Host "仍需修复的文章：" -ForegroundColor Yellow
    $report | Where-Object { $_.Count -gt 0 } | Sort-Object Count -Descending | Format-Table -AutoSize -Wrap
} else {
    Write-Host "全部 $($report.Count) 篇文章完全合规！" -ForegroundColor Green
}

# 输出 CSV 报告（可选）
$csvPath = Join-Path $DOCS_DIR ".vitepress\audit-report.csv"
$report | Export-Csv -Path $csvPath -NoTypeInformation -Encoding UTF8
Write-Host ""
Write-Host "CSV 报告已生成: $csvPath" -ForegroundColor Cyan
