# Configuração de Envio de E-mail

Para que o sistema possa enviar o PDF de inscrição automaticamente para o e-mail do inscrito, é necessário configurar as seguintes variáveis de ambiente no arquivo `.env` do diretório `backend` ou diretamente no ambiente de produção (como no Render):

| Variável | Descrição | Exemplo de Valor |
| :--- | :--- | :--- |
| `EMAIL_USER` | O endereço de e-mail que será usado para enviar as mensagens (e-mail de origem). | `seu-email@gmail.com` |
| `EMAIL_PASS` | A senha de aplicativo (App Password) gerada para o e-mail de origem. **Não use a senha principal da sua conta.** | `abcd1234efgh5678` |

**Nota sobre o Gmail:**

Se você estiver usando o Gmail, é altamente recomendável usar uma **Senha de Aplicativo** (App Password) em vez da sua senha principal, devido às políticas de segurança do Google.

1.  Vá para as configurações de segurança da sua Conta Google.
2.  Ative a **Verificação em Duas Etapas**.
3.  Em "Como fazer login no Google", procure por **Senhas de app**.
4.  Crie uma nova senha de app e use o código gerado como valor para `EMAIL_PASS`.

Sem essas variáveis configuradas, o sistema continuará a gerar o PDF, mas o envio de e-mail será desabilitado e um erro será registrado no console.
