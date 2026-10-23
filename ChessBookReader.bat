@echo off
setlocal
cd /d "D:\chess\BookChess\ChessBookReader"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\scripts\Run-ChessBookReader.ps1"
endlocal
