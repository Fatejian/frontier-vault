# 文章格式合规审计脚本 (audit-articles.ps1)
# 基于 article-style v1.1.1 规范，审计全部文章的格式合规性
# 用法: pwsh audit-articles.ps1
# 输出: 按文章 × 检查项矩阵，标注 PASS/FAIL + 证据

$ErrorActionPreference = "Stop"

# ============================================================
# 常量定义
# ============================================================

# 审计根目录
$DOCS_DIR = "c:\project\Personal_Projects\frontier-vault\docs"

# 排除的文件模式（非文章文件）
$EXCLUDE_PATTERN = "\\index\.md$|\\\.vitepress"

# 预编译正则（模块级常量，避免重复构造）
$FM_REGEX       = "(?s)^---\r?\n(.*?)\r?\n---"
$MERMAID_REGEX  = "(?s)````mermaid\r?\n(.*?)````"
$TITLE_REGEX    = "^title:"
$OUTLINE_REGEX  = "^outline:"
$CJK_REGEX      = "[\u4e00-\u9fff]"
$COMMA_REGEX    = ","
$FONT_SIZE_REGEX= "fontSize.*13"

# ============================================================
# 审计函数
# ============================================================

<#
.SYNOPSIS
  审计单篇文章的格式合规性
.DESCRIPTION
  检查 5 大类检查项：title 引号、outline deep、Mermaid fontSize、中文残留
  实践清单已改为可选（v1.1.1），不再审计
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

    # --- 提取 frontmatter（修复 Windows \r\n 换行符问题）---
    $fmMatch = [regex]::Match($content, $FM_REGEX)
    $fm      = $fmMatch.Groups[1].Value

    # --- 1. title 引号检查 ---
    # 规则：title 含冒号（中文：或英文:）必须用双引号包裹
    # 单引号包裹也不合规（v1.1.0 要求双引号）
    $titleLine         = ($fm -split "`r?`n" | Where-Object { $_ -match $TITLE_REGEX }) -join ""
    $titleVal          = $titleLine -replace "^title:\s*", ""
    $titleValStripped  = $titleVal -replace "^['""]", "" -replace "['""]$", ""
    $titleHasColon     = $titleValStripped -match "[:：]"
    $titleHasDouble    = $titleVal -match '^"'
    $titleHasSingle    = $titleVal -match "^'"

    if ($titleHasColon -and -not $titleHasDouble) {
        $titleIssue = if ($titleHasSingle) { "title:FAIL(单引号应改双引号)" } else { "title:FAIL(无引号)" }
    } else {
        $titleIssue = $null
    }

    # --- 2. outline=deep 检查 ---
    $outlineLine = ($fm -split "`r?`n" | Where-Object { $_ -match $OUTLINE_REGEX }) -join ""
    $outlineVal  = ($outlineLine -replace "^outline:\s*", "").Trim()
    $outlineIssue = if ($outlineVal -ne "deep") { "outline非deep(实际=$outlineVal)" } else { $null }

    # --- 3. Mermaid fontSize 检查 ---
    # 规则：每个 Mermaid 代码块的 themeVariables 必须包含 fontSize: 13px
    $mermaidBlocks = [regex]::Matches($content, $MERMAID_REGEX)
    $mermaidCount  = $mermaidBlocks.Count
    $noFontSize    = 0
    foreach ($mb in $mermaidBlocks) {
        if (-not ($mb.Groups[1].Value -match $FONT_SIZE_REGEX)) { $noFontSize++ }
    }
    $fontSizeIssue = if ($noFontSize -gt 0 -and $mermaidCount -gt 0) {
        "缺fontSize($noFontSize/$mermaidCount)"
    } else { $null }

    # --- 4. 英文文章中文残留检查 ---
    $isEN = $name -match "^en\\"
    $cjk  = 0
    if ($isEN) {
        $cjk = ([regex]::Matches($content, $CJK_REGEX)).Count
    }
    $cjkIssue = if ($cjk -gt 0) { "中文残留($cjk)" } else { $null }

    # --- 5. 英文 Mermaid 裸逗号检查（仅描述性文字，排除代码语法）---
    # 注意：双引号内的代码语法逗号（如 {type, payload}）是安全的，不报为问题
    # 仅当逗号出现在描述性文字中（非代码语法）才报为问题
    # 此检查需要人工辅助判断，脚本仅标记所有含逗号的节点标签供人工确认
    $bareCommaIssue = $null
    if ($isEN -and $mermaidCount -gt 0) {
        $bareCommaCount = 0
        foreach ($mb in $mermaidBlocks) {
            $code = $mb.Groups[1].Value
            $nodeLabels = [regex]::Matches($code, '\["([^"]*)"\]')
            foreach ($label in $nodeLabels) {
                $text = $label.Groups[1].Value
                if ($text -match $COMMA_REGEX) {
                    # 排除代码语法中的逗号：{xxx, yyy} 或 (xxx, yyy) 或函数参数
                    # 仅标记描述性文字中的逗号
                    if (-not ($text -match "[{(].*,.*[})]")) {
                        $bareCommaCount++
                    }
                }
            }
        }
        if ($bareCommaCount -gt 0) {
            $bareCommaIssue = "描述性裸逗号($bareCommaCount)"
        }
    }

    # --- 汇总问题 ---
    $issues = @($titleIssue, $outlineIssue, $fontSizeIssue, $cjkIssue, $bareCommaIssue | Where-Object { $_ })

    return [PSCustomObject]@{
        Article = $name
        Issues  = if ($issues.Count -eq 0) { "PASS" } else { $issues -join "; " }
        Count   = $issues.Count
    }
}

# ============================================================
# 主流程
# ============================================================

Write-Host "=== 文章格式合规审计 (article-style v1.1.1) ===" -ForegroundColor Cyan
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
