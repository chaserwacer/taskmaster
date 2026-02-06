# Task Copilot - Stop Script
# Stops the backend and frontend servers.

Write-Host "Stopping Task Copilot servers..." -ForegroundColor Yellow

# Kill uvicorn / python on port 8000
$backendPids = (Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique
foreach ($procId in $backendPids) {
    if ($procId -and $procId -ne 0) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Write-Host "  Stopped backend process (PID $procId)" -ForegroundColor Green
    }
}

# Kill node/vite on port 5173
$frontendPids = (Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue).OwningProcess | Sort-Object -Unique
foreach ($procId in $frontendPids) {
    if ($procId -and $procId -ne 0) {
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
        Write-Host "  Stopped frontend process (PID $procId)" -ForegroundColor Green
    }
}

Write-Host "Done." -ForegroundColor Cyan
