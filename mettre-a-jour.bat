@echo off
rem Recupere la derniere version depuis GitHub.
cd /d "%~dp0"
git pull || goto :erreur
uv sync || goto :erreur
echo Soft - Res est a jour.
pause
exit /b 0
:erreur
echo Une erreur est survenue. Copiez le texte ci-dessus et envoyez-le a Claude.
pause
exit /b 1
