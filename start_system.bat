@echo off
echo ===================================================
echo   INICIALIZANDO SISTEMA TOP DE LINHA
echo ===================================================
echo.

REM Verifica se o Python esta instalado
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Python nao encontrado!
    echo Por favor, instale o Python em https://www.python.org/downloads/
    echo e marque a opcao "Add Python to PATH" durante a instalacao.
    pause
    exit /b
)

REM Instala dependencias se necessario (somente na primeira vez ou se falhar)
echo Verificando dependencias...
python -c "import win32print" >nul 2>&1
if %errorlevel% neq 0 (
    echo Instalando blbioteca pywin32 para controle da gaveta...
    pip install pywin32
)

echo Iniciando o sistema...
python launcher.py

pause
