$ErrorActionPreference = 'Continue'
Set-Location $PSScriptRoot
$port = 3001
Write-Host "Stopping anything on port $port ..."
$lines = netstat -ano | Select-String ":$port.*LISTENING"
foreach ($line in $lines) {
  $pid = ($line.ToString().Trim() -split '\s+')[-1]
  if ($pid -match '^\d+$') {
    Write-Host "Stopping PID $pid"
    taskkill /PID $pid /F | Out-Null
  }
}
Start-Sleep -Seconds 2
Write-Host "Building admin UI (npm run build) ..."
npm run build
if ($LASTEXITCODE -ne 0) {
  Write-Host "Build FAILED. Fix errors above, then re-run this script."
  pause
  exit 1
}
$env:PORT = "$port"
Write-Host "Starting server on http://127.0.0.1:$port/admin-dashboard ..."
node server.js
