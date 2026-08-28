$path = 'c:/project/Personal_Projects/frontier-vault/docs/en/testing/load-testing-practice.md'
$c = Get-Content -Raw -LiteralPath $path

# The corrupted em-dash is bytes E9 88 A5 3F = U+9E25 + "?"
# Build the old block using the actual bytes
$corruptedDash = [char]0x9E25 + "?"
$oldBlock = "exhausted first.`n`n:::: info In one sentence`nThe essence of load testing is exposing a system's real boundaries under controlled pressure " + $corruptedDash + " boundaries of waiting, blocking, and resource exhaustion.`n::::`n`nThis main thread"

if ($c.Contains($oldBlock)) {
    Write-Host "Found block with corrupted dash"
    $new = $c.Replace($oldBlock, "exhausted first.`n`nThis main thread")
    Set-Content -LiteralPath $path -Value $new -NoNewline -Encoding UTF8
    Write-Host "Replaced. New length: $($new.Length)"
} else {
    Write-Host "Still not found. Trying without the sentence-level match..."
    # Just match the info box itself (4 lines)
    $infoBox = "`n:::: info In one sentence`nThe essence of load testing is exposing a system's real boundaries under controlled pressure " + $corruptedDash + " boundaries of waiting, blocking, and resource exhaustion.`n::::`n"
    # This appears twice; we only want the second occurrence (in Introduction)
    $firstIdx = $c.IndexOf($infoBox)
    if ($firstIdx -ge 0) {
        $secondIdx = $c.IndexOf($infoBox, $firstIdx + 1)
        Write-Host "First info box at: $firstIdx"
        Write-Host "Second info box at: $secondIdx"
        if ($secondIdx -ge 0) {
            # Remove the second occurrence (and one preceding newline)
            $new = $c.Substring(0, $secondIdx) + $c.Substring($secondIdx + $infoBox.Length)
            Set-Content -LiteralPath $path -Value $new -NoNewline -Encoding UTF8
            Write-Host "Removed second info box. New length: $($new.Length)"
        }
    } else {
        Write-Host "Info box not found at all"
    }
}
