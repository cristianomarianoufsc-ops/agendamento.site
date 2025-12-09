#!/bin/bash
# Script de Rollback - Autenticação Admin
# Execute este script para reverter as mudanças de autenticação

echo "🔄 Iniciando rollback das mudanças de autenticação admin..."

# Verifica se os backups existem
if [ ! -f "backend/server.js.backup_antes_auth_admin" ] || [ ! -f "src/components/Admin.jsx.backup_antes_auth_admin" ]; then
    echo "❌ Erro: Arquivos de backup não encontrados!"
    exit 1
fi

# Restaura os arquivos originais
cp backend/server.js.backup_antes_auth_admin backend/server.js
cp src/components/Admin.jsx.backup_antes_auth_admin src/components/Admin.jsx

echo "✅ Arquivos restaurados com sucesso!"
echo ""
echo "Arquivos revertidos:"
echo "  - backend/server.js"
echo "  - src/components/Admin.jsx"
echo ""
echo "Para aplicar as mudanças, execute:"
echo "  git add ."
echo "  git commit -m 'Revert: Autenticação admin'"
echo "  git push"
