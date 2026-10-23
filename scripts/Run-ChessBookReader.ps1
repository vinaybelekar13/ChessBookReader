$ErrorActionPreference = "Stop"

$root = "D:\chess\BookChess\ChessBookReader"
$backend = Join-Path $root "backend"
$python = Join-Path $backend ".venv-ocr\Scripts\python.exe"
$logs = Join-Path $root "local-logs"

New-Item -ItemType Directory -Path $logs -Force | Out-Null
$env:VITE_API_BASE_URL = "http://127.0.0.1:8765"

$backendProcess = $null
$frontendProcess = $null

function Stop-Tree([System.Diagnostics.Process]$process) {
    if ($null -ne $process) {
        try {
            & taskkill.exe /PID $process.Id /T /F 2>$null | Out-Null
        } catch {}
    }
}

try {
    Write-Host ""
    Write-Host "Starting ChessBookReader locally..." -ForegroundColor Cyan

    # Don't interfere with an unrelated process using either port.
    foreach ($port in @(5173, 8765)) {
        $listener = Get-NetTCPConnection -LocalPort $port -State Listen `
            -ErrorAction SilentlyContinue
        if ($listener) {
            throw "Port $port is already in use. No existing process was stopped."
        }
    }

    $backendOut = Join-Path $logs "backend-out.log"
    $backendErr = Join-Path $logs "backend-error.log"
    $frontendOut = Join-Path $logs "frontend-out.log"
    $frontendErr = Join-Path $logs "frontend-error.log"

    # Run Python directly, with its working directory set to backend.
    $backendProcess = Start-Process -FilePath $python `
        -ArgumentList @("-m", "uvicorn", "app.main:app",
            "--host", "127.0.0.1", "--port", "8765", "--reload", "--reload-dir", "app") `
        -WorkingDirectory $backend -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr

    # Use cmd.exe so the existing npm script is resolved normally.
    $frontendProcess = Start-Process -FilePath "$env:ComSpec" `
        -ArgumentList @("/d", "/s", "/c",
            "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort") `
        -WorkingDirectory $root -PassThru -WindowStyle Hidden `
        -RedirectStandardOutput $frontendOut -RedirectStandardError $frontendErr `
       

    $apiReady = $false
    $webReady = $false
    $deadline = (Get-Date).AddSeconds(90)

    while ((Get-Date) -lt $deadline) {
        if ($backendProcess.HasExited) {
            throw "Backend exited. Inspect local-logs\backend-error.log"
        }
        if ($frontendProcess.HasExited) {
            throw "Frontend exited. Inspect local-logs\frontend-error.log"
        }

        try {
            $health = Invoke-RestMethod "http://127.0.0.1:8765/health" `
                -TimeoutSec 2
            if ($health.status -eq "ok") { $apiReady = $true }
        } catch {}

        try {
            $response = Invoke-WebRequest "http://127.0.0.1:5173/" `
                -TimeoutSec 2 -UseBasicParsing
            if ($response.StatusCode -eq 200) { $webReady = $true }
        } catch {}

        if ($apiReady -and $webReady) { break }
        Start-Sleep -Milliseconds 500
    }

    if (-not $apiReady -or -not $webReady) {
        throw "Services did not become ready within 90 seconds. Inspect local-logs."
    }

    Write-Host ""
    Write-Host "ChessBookReader is running!" -ForegroundColor Green
    Write-Host "Website: http://127.0.0.1:5173"
    Write-Host "Local API: http://127.0.0.1:8765"
    Write-Host "API docs: http://127.0.0.1:8765/docs"
    Write-Host ""
    Write-Host "Keep this window open while using the app."
    Write-Host "Press ENTER here to stop the services and exit."
    Start-Process "http://127.0.0.1:5173"

    [void](Read-Host)

} catch {
    Write-Host ""
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "Logs, if created, are in: $logs"
    Write-Host "Press ENTER to close."
    [void](Read-Host)
} finally {
    Write-Host "Stopping ChessBookReader services..." -ForegroundColor Yellow
    Stop-Tree $frontendProcess
    Stop-Tree $backendProcess
    Write-Host "Launcher shutdown finished."
}

