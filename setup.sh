#!/bin/bash

# --- 1. Verificação de Pré-requisitos ---
echo "--- 1. Verificando Pré-requisitos (Node.js e Git) ---"
if ! command -v node &> /dev/null
then
    echo "ERRO: Node.js não encontrado. Por favor, instale o Node.js (LTS) primeiro."
    exit 1
fi

if ! command -v git &> /dev/null
then
    echo "ERRO: Git não encontrado. Por favor, instale o Git primeiro."
    exit 1
fi

# --- 2. Instalação de Dependências ---
echo "--- 2. Instalando Dependências do Projeto (npm install) ---"
npm install

# --- 3. Configuração Inicial do Git ---
echo "--- 3. Configuração Inicial do Git ---"

# Verifica se o repositório já foi inicializado
if [ ! -d ".git" ]; then
    echo "Inicializando novo repositório Git..."
    git init
fi

# Adiciona todos os arquivos ao rastreamento
git add .

# Cria o commit inicial (se ainda não houver commits)
if [ -z "$(git log --oneline)" ]; then
    echo "Criando commit inicial..."
    git commit -m "Projeto pronto para deploy no Render (via script de setup)"
else
    echo "Repositório já possui commits. Ignorando commit inicial."
fi

echo "✅ Configuração de ambiente local concluída!"
echo ""
echo "--- PRÓXIMOS PASSOS MANUAIS ---"
echo "1. Crie um repositório no GitHub."
echo "2. Conecte o repositório local ao GitHub (git remote add origin ...)."
echo "3. Envie o código para o GitHub (git push -u origin main)."
echo "4. Siga o DEPLOYMENT_GUIDE.md para configurar o Render."
