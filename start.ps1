# Task Copilot - Startup Script
# Starts Ollama, backend, and frontend in one go.

$ErrorActionPreference = "Continue"
$Root = $PSScriptRoot

Write-Host ""
Write-Host "=== Task Copilot ===" -ForegroundColor Cyan
Write-Host ""

# --- 1. Check Ollama ---
Write-Host "[1/4] Checking Ollama..." -ForegroundColor Yellow
$ollamaRunning = $false
try {
    $null = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 2
    $ollamaRunning = $true
    Write-Host "  Ollama is already running." -ForegroundColor Green
} catch {
    Write-Host "  Ollama not running. Starting it..." -ForegroundColor Yellow
    Start-Process -FilePath "ollama" -ArgumentList "serve" -WindowStyle Minimized
    Start-Sleep -Seconds 3
    try {
        $null = Invoke-RestMethod -Uri "http://localhost:11434/api/tags" -TimeoutSec 5
        $ollamaRunning = $true
        Write-Host "  Ollama started." -ForegroundColor Green
    } catch {
        Write-Host "  WARNING: Could not start Ollama. Chat parsing won't work." -ForegroundColor Red
        Write-Host "  Install from https://ollama.com if needed." -ForegroundColor Red
    }
}

# --- 2. Install backend deps if needed ---
Write-Host "[2/4] Setting up backend..." -ForegroundColor Yellow
$backendDir = Join-Path $Root "backend"

$hasMotor = python -c "import motor" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "  Installing Python dependencies..." -ForegroundColor Yellow
    pip install -r (Join-Path $backendDir "requirements.txt") --quiet 2>&1 | Out-Null
    Write-Host "  Dependencies installed." -ForegroundColor Green
} else {
    Write-Host "  Python dependencies already installed." -ForegroundColor Green
}

# --- 3. Install frontend deps if needed ---
Write-Host "[3/4] Setting up frontend..." -ForegroundColor Yellow
$frontendDir = Join-Path $Root "frontend"
$nodeModules = Join-Path $frontendDir "node_modules"

if (-not (Test-Path $nodeModules)) {
    Write-Host "  Installing npm packages..." -ForegroundColor Yellow
    Push-Location $frontendDir
    npm install --silent 2>&1 | Out-Null
    Pop-Location
    Write-Host "  Packages installed." -ForegroundColor Green
} else {
    Write-Host "  npm packages already installed." -ForegroundColor Green
}

# --- 4. Start both servers ---
Write-Host "[4/4] Starting servers..." -ForegroundColor Yellow
Write-Host ""

# Backend
$env:SEED_DATA = "true"
$backendJob = Start-Process -FilePath "python" `
    -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000" `
    -WorkingDirectory $backendDir `
    -PassThru -WindowStyle Normal
Write-Host "  Backend starting on http://localhost:8000" -ForegroundColor Green

Start-Sleep -Seconds 2

# Frontend
$frontendJob = Start-Process -FilePath "npm" `
    -ArgumentList "run", "dev" `
    -WorkingDirectory $frontendDir `
    -PassThru -WindowStyle Normal
Write-Host "  Frontend starting on http://localhost:5173" -ForegroundColor Green

Write-Host ""
Write-Host "=== Ready! ===" -ForegroundColor Cyan
Write-Host "Open http://localhost:5173 in your browser." -ForegroundColor White
Write-Host ""
Write-Host "Backend PID: $($backendJob.Id)  |  Frontend PID: $($frontendJob.Id)" -ForegroundColor DarkGray
Write-Host "To stop: close both terminal windows, or run ./stop.ps1" -ForegroundColor DarkGray
Write-Host ""
