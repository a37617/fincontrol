@echo off
title FinControl - Sistema Financeiro
echo.
echo  ==============================
echo    FinControl - Iniciando...
echo  ==============================
echo.

:: Kill any previous node processes to free ports
taskkill /f /im node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

:: Start backend
start "" /B "C:\Program Files\nodejs\node.exe" "C:\Users\Betina\OneDrive\Apps\fincontrol\server\index.js"
echo  [OK] Backend iniciado

:: Start frontend (must run from client dir so Vite finds config)
cd /d "C:\Users\Betina\OneDrive\Apps\fincontrol\client"
start "" /B "C:\Program Files\nodejs\node.exe" "node_modules\vite\bin\vite.js" --port 5173
echo  [OK] Frontend iniciado

:: Wait for Vite to compile and start
echo.
echo  Aguardando servidor...
timeout /t 8 /nobreak >nul

:: Open browser
start http://localhost:5173
echo.
echo  [OK] Navegador aberto!
echo.
echo  ==============================
echo    Sistema rodando!
echo    NAO feche esta janela.
echo  ==============================
echo.
echo  Pressione qualquer tecla para ENCERRAR o sistema...
pause >nul
taskkill /f /im node.exe >nul 2>&1
echo  Sistema encerrado.
