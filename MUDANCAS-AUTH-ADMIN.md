# 🔐 Mudanças Implementadas - Autenticação Admin

## 📅 Data da Implementação
**Data:** 09 de Dezembro de 2025

## 🎯 Objetivo
Adicionar autenticação com senha para proteger o acesso ao painel administrativo (`/admin`).

---

## 📝 Resumo das Mudanças

### 1️⃣ Backend (`backend/server.js`)

**Nova Rota Adicionada:**
```javascript
POST /api/auth/admin
```

**Funcionalidade:**
- Recebe senha via POST request
- Busca senha configurada no banco de dados (tabela `config`)
- Senha padrão: `"admin.dac.ufsc"` (caso não esteja configurada no banco)
- Retorna `{ success: true }` se a senha estiver correta
- Retorna `{ success: false, message: "Senha incorreta." }` se estiver errada

**Localização:** Linhas 467-498

---

### 2️⃣ Frontend (`src/components/Admin.jsx`)

#### **Novos Estados Adicionados:**
```javascript
const [adminPassword, setAdminPassword] = useState('');
const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(!!sessionStorage.getItem('adminAuth'));
```

**Localização:** Linhas 79-81

---

#### **Novas Funções Adicionadas:**

**1. `handleAdminLogin()` - Função de Login**
- Valida se a senha foi preenchida
- Envia requisição POST para `/api/auth/admin`
- Se bem-sucedido: salva flag no `sessionStorage` e atualiza estado
- Se falhar: exibe mensagem de erro

**Localização:** Linhas 374-398

**2. `handleAdminLogout()` - Função de Logout**
- Remove flag de autenticação do `sessionStorage`
- Atualiza estado e recarrega a página

**Localização:** Linhas 400-405

---

#### **Nova Tela de Login Adicionada:**

**Renderização Condicional:**
```javascript
if (!viewOnly && !isAdminAuthenticated) {
  // Renderiza tela de login para admin
}
```

**Características:**
- Campo de senha com foco automático
- Suporte para tecla Enter
- Design consistente com a tela de login dos avaliadores
- Ícone de Settings no cabeçalho

**Localização:** Linhas 510-541

---

#### **Botão de Logout no Header:**

**Adicionado para modo admin:**
- Exibe "✅ Sessão Administrativa Ativa"
- Botão "Sair" para fazer logout
- Estilo verde para diferenciar do modo avaliador (azul)

**Localização:** Linhas 592-603

---

## 🔒 Segurança

### **Armazenamento:**
- **Admin:** Usa `sessionStorage` (expira ao fechar o navegador)
- **Avaliador:** Usa `localStorage` (persiste entre sessões)

### **Senha Padrão:**
```
admin.dac.ufsc
```

### **Como Alterar a Senha:**

A senha pode ser alterada diretamente no banco de dados:

```sql
UPDATE config 
SET config_json = jsonb_set(
  config_json::jsonb, 
  '{adminPassword}', 
  '"nova_senha_aqui"'
)
WHERE id = 1;
```

Ou via interface administrativa (futura implementação).

---

## 🧪 Como Testar

### **1. Teste Local:**

```bash
# Inicie o servidor
npm run dev

# Acesse no navegador
http://localhost:5173/admin
```

**Resultado Esperado:**
- Deve aparecer uma tela de login pedindo senha
- Digite: `admin.dac.ufsc`
- Deve entrar no painel administrativo

### **2. Teste em Produção (Render):**

```
https://seu-site.render.com/admin
```

**Resultado Esperado:**
- Tela de login aparece
- Após digitar a senha correta, acessa o painel
- Ao fechar o navegador, a sessão expira (precisa logar novamente)

---

## 🔄 Como Reverter (Rollback)

Se algo der errado, você pode reverter facilmente:

### **Opção 1: Script Automático**
```bash
cd /home/ubuntu/agendamento.site
./rollback-auth-admin.sh
git add .
git commit -m "Revert: Autenticação admin"
git push
```

### **Opção 2: Manual via Git**
```bash
cd /home/ubuntu/agendamento.site
git checkout backend/server.js.backup_antes_auth_admin
git checkout src/components/Admin.jsx.backup_antes_auth_admin
git add .
git commit -m "Revert: Autenticação admin"
git push
```

### **Opção 3: Restaurar Backups Manualmente**
```bash
cp backend/server.js.backup_antes_auth_admin backend/server.js
cp src/components/Admin.jsx.backup_antes_auth_admin src/components/Admin.jsx
```

---

## 📦 Arquivos Modificados

| Arquivo | Linhas Modificadas | Tipo de Mudança |
|---------|-------------------|-----------------|
| `backend/server.js` | 467-498 | Nova rota `/api/auth/admin` |
| `src/components/Admin.jsx` | 79-81 | Novos estados |
| `src/components/Admin.jsx` | 374-405 | Novas funções de login/logout |
| `src/components/Admin.jsx` | 510-541 | Nova tela de login |
| `src/components/Admin.jsx` | 592-603 | Botão de logout no header |

---

## 📦 Arquivos de Backup Criados

- `backend/server.js.backup_antes_auth_admin`
- `src/components/Admin.jsx.backup_antes_auth_admin`

**⚠️ NÃO DELETE ESTES ARQUIVOS!** Eles são necessários para o rollback.

---

## ✅ Checklist de Verificação

Antes de fazer push, verifique:

- [x] Build do frontend compila sem erros
- [x] Sintaxe do backend está correta
- [x] Backups foram criados
- [x] Script de rollback está funcional
- [x] Documentação está completa

---

## 🚀 Próximos Passos

1. **Fazer commit e push das mudanças**
2. **Testar em produção no Render**
3. **Verificar se a senha funciona**
4. **Considerar adicionar interface para alterar senha via painel admin**

---

## 📞 Suporte

Se encontrar algum problema:

1. Execute o script de rollback
2. Verifique os logs do servidor
3. Consulte esta documentação
4. Entre em contato com o desenvolvedor

---

**Desenvolvido por:** Manus AI Agent  
**Data:** 09/12/2025  
**Versão:** 1.0
