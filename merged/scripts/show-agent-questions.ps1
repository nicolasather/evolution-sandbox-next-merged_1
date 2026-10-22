# show-agent-questions.ps1
# Pop up the current agent questions / status on screen (Windows).
# Usage (from any directory):
#   powershell -ExecutionPolicy Bypass -File "<this file>"
#
# Reads:  <repo>/merged/AGENT_QUESTIONS.md
# Effect: prints a header to console, then shows the full report in a
#         scrollable, read-only popup window (auto-closes after 10 min or OK).

$ErrorActionPreference = 'Stop'

$here        = Split-Path -Parent $MyInvocation.MyCommand.Path
$mergedDir   = Split-Path -Parent $here
$reportPath  = Join-Path $mergedDir 'AGENT_QUESTIONS.md'

Write-Host ''
Write-Host '================================================================' -ForegroundColor Cyan
Write-Host '  Agent Questions & Status - edtech-platform' -ForegroundColor Cyan
Write-Host '  Loading: AGENT_QUESTIONS.md' -ForegroundColor DarkCyan
Write-Host '================================================================' -ForegroundColor Cyan

if (-not (Test-Path $reportPath)) {
    Write-Host "Report not found: $reportPath" -ForegroundColor Red
    return
}

$content = Get-Content -Raw -Encoding UTF8 $reportPath

# Console echo (first 40 lines) so the info is visible even without the popup.
($content -split "`r?`n") | Select-Object -First 40 | ForEach-Object { Write-Host $_ }
Write-Host '... (full report in popup window)' -ForegroundColor DarkGray

Add-Type -AssemblyName System.Windows.Forms, System.Drawing

$form = New-Object System.Windows.Forms.Form
$form.Text        = 'Agent Questions & Status - edtech-platform'
$form.Size        = New-Object System.Drawing.Size(1100, 780)
$form.StartPosition = 'CenterScreen'
$form.BackColor   = [System.Drawing.Color]::FromArgb(24, 24, 28)
$form.ForeColor   = [System.Drawing.Color]::Gainsboro

$box = New-Object System.Windows.Forms.TextBox
$box.Multiline   = $true
$box.ReadOnly     = $true
$box.ScrollBars   = 'Vertical'
$box.WordWrap     = $false
$box.Dock        = 'Fill'
$box.BackColor    = [System.Drawing.Color]::FromArgb(16, 16, 20)
$box.ForeColor    = [System.Drawing.Color]::FromArgb(220, 230, 240)
$box.Font        = New-Object System.Drawing.Font('Consolas', 10)
$box.Text        = $content

$form.Controls.Add($box)

$close = New-Object System.Windows.Forms.Button
$close.Text      = 'Close'
$close.Size      = New-Object System.Drawing.Size(110, 30)
$close.Location  = New-Object System.Drawing.Point(20, 700)
$close.Add_Click({ $form.Close() })
$form.Controls.Add($close)

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 600000
$timer.Add_Tick({ $timer.Stop(); $form.Close() })
$timer.Start()

[void]$form.ShowDialog()
