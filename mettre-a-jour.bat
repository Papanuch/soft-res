@echo off
rem Récupère la dernière version depuis GitHub et reconstruit l'interface.
cd /d "%~dp0"
chcp 65001 >nul
git pull || goto :erreur
uv sync || goto :erreur
pushd frontend
call npm ci || goto :erreur
call npm run build || goto :erreur
popd
echo Soft - Res est a jour.
pause
exit /b 0
:erreur
echo Une erreur est survenue.
pause
exit /b 1
