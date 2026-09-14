# Keeps the worker alive across crashes/restarts. Registered as a Windows
# Scheduled Task (see setup-worker-task.ps1) so it survives a Claude Code
# session ending — a plain background process from that session does not.
$ErrorActionPreference = "Continue"
Set-Location "C:\Users\nic\Documents\buscando-milhao"
$logDir = "C:\Users\nic\Documents\buscando-milhao\logs"
New-Item -ItemType Directory -Force -Path $logDir | Out-Null

while ($true) {
    $timestamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
    $logFile = Join-Path $logDir "worker-$timestamp.log"
    & "C:\Users\nic\AppData\Roaming\npm\pnpm.cmd" run worker *>> $logFile
    Add-Content -Path $logFile -Value "`n[run-worker-forever] worker saiu, reiniciando em 10s..."
    Start-Sleep -Seconds 10
}
