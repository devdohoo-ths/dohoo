@echo off
echo ========================================
echo Instalacao de Dependencias - DOHOO Backend
echo ========================================
echo.

echo [1/4] Limpando cache do npm...
call npm cache clean --force
if %errorlevel% neq 0 (
    echo ⚠️  Aviso: Erro ao limpar cache (continuando...)
)

echo.
echo [2/4] Removendo node_modules antigos...
if exist node_modules (
    rmdir /s /q node_modules
    echo ✅ node_modules removido
) else (
    echo ℹ️  node_modules nao encontrado (ok)
)

echo.
echo [3/4] Removendo package-lock.json antigo...
if exist package-lock.json (
    del /f /q package-lock.json
    echo ✅ package-lock.json removido
) else (
    echo ℹ️  package-lock.json nao encontrado (ok)
)

echo.
echo [4/4] Instalando dependencias...
call npm install
if %errorlevel% neq 0 (
    echo.
    echo ❌ Erro na instalacao das dependencias!
    echo.
    echo Tentando instalacao alternativa...
    call npm install --legacy-peer-deps
    if %errorlevel% neq 0 (
        echo.
        echo ❌ Erro persistente. Verifique:
        echo    1. Versao do Node.js (recomendado: v18 ou superior)
        echo    2. Conexao com internet
        echo    3. Permissoes de escrita na pasta
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo ✅ Instalacao concluida com sucesso!
echo ========================================
echo.
pause

