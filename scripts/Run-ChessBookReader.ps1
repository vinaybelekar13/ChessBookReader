$ErrorActionPreference = "Stop"

$root = "D:\chess\BookChess\ChessBookReader"
$backend = Join-Path $root "backend"
$python = Join-Path $backend ".venv-ocr\Scripts\python.exe"
$logs = Join-Path $root "local-logs"
$apiUrl = "http://127.0.0.1:8765"
$webUrl = "http://127.0.0.1:5173"

New-Item -ItemType Directory -Path $logs -Force | Out-Null
$env:VITE_API_BASE_URL = $apiUrl

$backendProcess = $null
$frontendProcess = $null
$startedBackend = $false
$startedFrontend = $false

function Get-PortListener([int]$port) {
    return @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
}

function Test-ApiReady {
    try {
        $health = Invoke-RestMethod "$apiUrl/health" -TimeoutSec 3
        return ($health.status -eq "ok")
    } catch {
        return $false
    }
}

function Test-WebReady {
    try {
        $response = Invoke-WebRequest "$webUrl/" -TimeoutSec 3 -UseBasicParsing
        return ($response.StatusCode -eq 200)
    } catch {
        return $false
    }
}

function Stop-Tree([System.Diagnostics.Process]$process) {
    if ($null -ne $process) {
        try {
            if (-not $process.HasExited) {
                & taskkill.exe /PID $process.Id /T /F 2>$null | Out-Null
            }
        } catch {}
    }
}

try {
    Write-Host ""
    Write-Host "Starting ChessBookReader locally..." -ForegroundColor Cyan

    $backendOut = Join-Path $logs "backend-out.log"
    $backendErr = Join-Path $logs "backend-error.log"
    $frontendOut = Join-Path $logs "frontend-out.log"
    $frontendErr = Join-Path $logs "frontend-error.log"

    # Reuse the OCR backend if it is already healthy. Never stop an existing listener.
    if (Test-ApiReady) {
        Write-Host "OCR backend is already healthy on port 8765; reusing it." -ForegroundColor Green
    } else {
        $apiListeners = Get-PortListener 8765
        if ($apiListeners.Count -gt 0) {
            $pids = ($apiListeners | Select-Object -ExpandProperty OwningProcess -Unique) -join ", "
            throw "Port 8765 is occupied by PID(s) $pids, but the OCR health check failed. No existing process was stopped. Check $backendErr."
        }
        if (-not (Test-Path $python)) {
            throw "Backend Python was not found: $python"
        }

        $backendProcess = Start-Process -FilePath $python `
            -ArgumentList @("-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8765", "--reload", "--reload-dir", "app") `
            -WorkingDirectory $backend -PassThru -WindowStyle Hidden `
            -RedirectStandardOutput $backendOut -RedirectStandardError $backendErr
        $startedBackend = $true
        Write-Host "Started OCR backend (PID $($backendProcess.Id))." -ForegroundColor Cyan
    }

    # Reuse Vite if it responds. Otherwise start it only if port 5173 is free.
    if (Test-WebReady) {
        Write-Host "Frontend is already responding on port 5173; reusing it." -ForegroundColor Green
    } else {
        $webListeners = Get-PortListener 5173
        if ($webListeners.Count -gt 0) {
            $pids = ($webListeners | Select-Object -ExpandProperty OwningProcess -Unique) -join ", "
            throw "Port 5173 is occupied by PID(s) $pids, but the frontend did not return HTTP 200. No existing process was stopped. Check $frontendErr."
        }

        $frontendProcess = Start-Process -FilePath "$env:ComSpec" `
            -ArgumentList @("/d", "/s", "/c", "npm run dev -- --host 127.0.0.1 --port 5173 --strictPort") `
            -WorkingDirectory $root -PassThru -WindowStyle Hidden `
            -RedirectStandardOutput $frontendOut -RedirectStandardError $frontendErr
        $startedFrontend = $true
        Write-Host "Started frontend (launcher PID $($frontendProcess.Id))." -ForegroundColor Cyan
    }

    $deadline = (Get-Date).AddSeconds(90)
    while ((Get-Date) -lt $deadline) {
        if ($startedBackend -and $backendProcess.HasExited) {
            throw "Backend exited during startup. Inspect $backendErr"
        }
        if ($startedFrontend -and $frontendProcess.HasExited) {
            # npm/cmd may hand off to node and exit; rely on the HTTP check below.
            if (-not (Test-WebReady)) {
                throw "Frontend launcher exited and the website is not responding. Inspect $frontendErr"
            }
        }
        if ((Test-ApiReady) -and (Test-WebReady)) { break }
        Start-Sleep -Milliseconds 500
    }

    if (-not (Test-ApiReady)) { throw "OCR backend did not become healthy within 90 seconds. Inspect $backendErr" }
    if (-not (Test-WebReady)) { throw "Frontend did not return HTTP 200 within 90 seconds. Inspect $frontendErr" }

    Write-Host ""
    Write-Host "ChessBookReader is running!" -ForegroundColor Green
    Write-Host "Website:  $webUrl"
    Write-Host "Local API: $apiUrl"
    Write-Host "API docs:  $apiUrl/docs"
    Write-Host ""
    Write-Host "Services started by this launcher will be stopped when you press ENTER."
    Write-Host "Services that were already running will be left alone."
    Start-Process $webUrl
    [void](Read-Host "Press ENTER to exit")

} catch {
    Write-Host ""
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "Logs are in: $logs"
    [void](Read-Host "Press ENTER to exit")
} finally {
    Write-Host "Stopping only services started by this launcher..." -ForegroundColor Yellow
    if ($startedFrontend) { Stop-Tree $frontendProcess }
    if ($startedBackend) { Stop-Tree $backendProcess }
    Write-Host "Launcher shutdown finished."
}
