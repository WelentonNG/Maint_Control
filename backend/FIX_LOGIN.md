# 🔧 Solução para Erro 400 - Login

## Problema Identificado
O erro `400 Bad Request` no login ocorre porque **não há usuários cadastrados** no banco de dados.

## ✅ Solução Rápida (Opção 1 - Recomendada)

1. Acesse o diagnóstico no navegador:
   ```
   http://localhost/MCSRC/backend/debug.php
   ```

2. Clique no botão **"Criar usuário admin agora"**

3. Use as credenciais:
   - **Username:** `admin`
   - **Password:** `password`

⚠️ **IMPORTANTE:** Troque essa senha após o primeiro login!

## 📝 Solução Manual (Opção 2)

Execute este SQL no phpMyAdmin:

```sql
USE maintcontrol_db;

-- Remove admin se existir
DELETE FROM users WHERE username = 'admin';

-- Cria usuário admin (senha: password)
INSERT INTO users (username, password_hash, role, name) VALUES
('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'Administrador');

-- Verifica
SELECT * FROM users;
```

## 🎯 Como Funciona Agora

### Melhorias Implementadas:

1. **Debug.php aprimorado:**
   - Interface visual moderna
   - Diagnóstico completo do sistema
   - Criação automática de usuário admin
   - Gerador de hash para senhas
   - Testes de autenticação

2. **API com melhor tratamento de erros:**
   - Mensagens específicas para cada tipo de erro
   - HTTP status codes corretos
   - Dicas de solução quando falha
   - Validação de entrada aprimorada

3. **SQL de instalação:**
   - Arquivo `insert_admin_user.sql` criado
   - Inclui 3 usuários de exemplo (admin, lider, user)
   - Todos com senha padrão: `password`

## 🧪 Testar a API

No Console do navegador (F12):

```javascript
fetch('/MCSRC/backend/api.php', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    action: 'login',
    data: { username: 'admin', password: 'password' }
  })
})
.then(r => r.json())
.then(d => console.log(d));
```

## 📊 Estrutura de Usuários

| Username | Password  | Role   | Descrição        |
|----------|-----------|--------|------------------|
| admin    | password  | admin  | Administrador    |
| lider    | password  | lider  | Líder de Equipe  |
| user     | password  | user   | Usuário Comum    |

## 🔒 Segurança

- Todas as senhas são armazenadas com hash bcrypt (PASSWORD_DEFAULT)
- Tokens de sessão têm validade de 8 horas
- Senhas padrão devem ser alteradas após primeiro acesso

## 📂 Arquivos Criados/Modificados

- ✅ `backend/db/insert_admin_user.sql` - SQL para criar usuários
- ✅ `backend/debug.php` - Ferramenta de diagnóstico aprimorada
- ✅ `backend/api.php` - Melhor tratamento de erros no login
- ✅ `backend/FIX_LOGIN.md` - Este arquivo

## 🎬 Próximos Passos

1. Acesse http://localhost/MCSRC/backend/debug.php
2. Crie o usuário admin
3. Acesse http://localhost/MCSRC/public/pages/login/login.html
4. Faça login com: admin / password
5. **TROQUE A SENHA!**
