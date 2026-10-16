@echo off
rem Soft - Res : double-cliquer pour lancer. Le premier lancement installe tout (quelques minutes).
cd /d "%~dp0"
chcp 65001 >nul

if not exist ".env" copy ".env.example" ".env" >nul

if not exist "soft_res\static\index.html" (
  echo Construction de l'interface, premier lancement...
  pushd frontend
  call npm ci || goto :erreur
  call npm run build || goto :erreur
  popd
)

uv run soft-res %*
if errorlevel 1 goto :erreur
exit /b 0

:erreur
echo.
echo Une erreur est survenue. Copiez le texte ci-dessus et envoyez-le a Claude.
pause
exit /b 1
