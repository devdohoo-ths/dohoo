#!/bin/bash

echo "========================================"
echo "Instalação de Dependências - DOHOO Backend"
echo "========================================"
echo ""

echo "[1/4] Limpando cache do npm..."
npm cache clean --force

echo ""
echo "[2/4] Removendo node_modules antigos..."
if [ -d "node_modules" ]; then
    rm -rf node_modules
    echo "✅ node_modules removido"
else
    echo "ℹ️  node_modules não encontrado (ok)"
fi

echo ""
echo "[3/4] Removendo package-lock.json antigo..."
if [ -f "package-lock.json" ]; then
    rm -f package-lock.json
    echo "✅ package-lock.json removido"
else
    echo "ℹ️  package-lock.json não encontrado (ok)"
fi

echo ""
echo "[4/4] Instalando dependências..."
npm install

if [ $? -ne 0 ]; then
    echo ""
    echo "❌ Erro na instalação das dependências!"
    echo ""
    echo "Tentando instalação alternativa..."
    npm install --legacy-peer-deps
    
    if [ $? -ne 0 ]; then
        echo ""
        echo "❌ Erro persistente. Verifique:"
        echo "   1. Versão do Node.js (recomendado: v18 ou superior)"
        echo "   2. Conexão com internet"
        echo "   3. Permissões de escrita na pasta"
        exit 1
    fi
fi

echo ""
echo "========================================"
echo "✅ Instalação concluída com sucesso!"
echo "========================================"
echo ""

