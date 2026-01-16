# 🐳 Docker - Maint_Control

Documentação completa para executar a aplicação **Maint_Control** usando Docker.

## 📋 Índice

- [Pré-requisitos](#pré-requisitos)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Configuração](#configuração)
- [Uso Básico](#uso-básico)
- [Comandos Docker](#comandos-docker)
- [Acesso à Aplicação](#acesso-à-aplicação)
- [Primeira Execução](#primeira-execução)
- [Desenvolvimento Local](#desenvolvimento-local)
- [Troubleshooting](#troubleshooting)

## 🔧 Pré-requisitos

Antes de começar, certifique-se de ter instalado:

- **Docker** (versão 20.10 ou superior)
- **Docker Compose** (versão 1.29 ou superior)

Para verificar as versões instaladas:

```bash
docker --version
docker-compose --version
```

## 📁 Estrutura do Projeto

```
Maint_Control/
├── backend/
│   ├── api.php              # API principal
│   ├── conexao.php          # Configuração de conexão (suporta env vars)
│   └── db/
│       └── Maint_Control.sql # Schema do banco de dados
├── public/                  # Páginas públicas (login, etc)
├── src/                     # Assets (CSS, JS, imagens)
├── Dockerfile               # Configuração do container web
├── docker-compose.yml       # Orquestração dos serviços
├── .dockerignore           # Arquivos ignorados no build
└── DOCKER.md               # Esta documentação
```

## ⚙️ Configuração

### Arquivos de Configuração

#### `Dockerfile`
- Base: `php:8.1-apache`
- Extensões habilitadas: `pdo`, `pdo_mysql`
- Apache mod_rewrite habilitado
- Porta: 80

#### `docker-compose.yml`
Define dois serviços:

1. **web** (Apache + PHP)
   - Container: `maint-control-web`
   - Porta: `8080:80`
   - Variáveis de ambiente configuradas para conexão com DB

2. **db** (MySQL 8.0)
   - Container: `maint-control-db`
   - Porta: `3306:3306`
   - Volume persistente: `mysql_data`
   - Inicialização automática do schema via SQL
   - Healthcheck configurado

> ⚠️ **IMPORTANTE - SEGURANÇA**: As senhas padrão no `docker-compose.yml` são apenas para desenvolvimento local. Para ambientes de produção ou compartilhados:
> 1. **NUNCA** use senhas padrão em produção
> 2. Use arquivos `.env` (não commitados) para armazenar senhas
> 3. Considere usar Docker Secrets para ambientes de produção
> 4. Veja a seção [Segurança](#-segurança) abaixo para mais detalhes

### Variáveis de Ambiente

As seguintes variáveis são configuradas automaticamente no `docker-compose.yml`:

| Variável | Valor Padrão | Descrição |
|----------|--------------|-----------|
| `DB_HOST` | `db` | Hostname do serviço MySQL |
| `DB_NAME` | `maintcontrol_db` | Nome do banco de dados |
| `DB_USER` | `root` | Usuário do banco |
| `DB_PASS` | `rootpassword` | Senha do banco |

> ⚠️ **IMPORTANTE - SEGURANÇA**: 
> - Os valores padrão acima são APENAS para desenvolvimento local
> - Para produção, crie um arquivo `.env` baseado em `.env.example` e altere todas as senhas
> - Adicione `.env` ao `.gitignore` (já está configurado) para nunca commitar senhas
> - O arquivo `.env.example` fornecido mostra a estrutura, mas use suas próprias senhas seguras

#### Usando arquivo .env (Recomendado para Produção)

1. Copie o arquivo de exemplo:
   ```bash
   cp .env.example .env
   ```

2. Edite o `.env` e altere as senhas:
   ```bash
   nano .env  # ou use seu editor favorito
   ```

3. O `docker-compose.yml` já está configurado para usar variáveis de ambiente do shell, então as variáveis do `.env` serão utilizadas automaticamente.

## 🚀 Uso Básico

### Subir os Containers

Execute o seguinte comando na raiz do projeto:

```bash
docker-compose up -d
```

Este comando irá:
1. Construir a imagem Docker da aplicação web (se ainda não existir)
2. Baixar a imagem do MySQL 8.0
3. Criar os containers `maint-control-web` e `maint-control-db`
4. Criar a network `maint-control-network`
5. Inicializar o banco de dados com o schema do arquivo SQL
6. Iniciar os serviços em background (`-d` = detached)

### Primeira Execução

Na primeira vez que executar, aguarde alguns segundos para:
- O MySQL inicializar completamente
- O script SQL criar todas as tabelas
- O healthcheck confirmar que o banco está pronto

Você pode acompanhar o progresso com:

```bash
docker-compose logs -f
```

### Parar os Containers

```bash
docker-compose down
```

### Parar e Remover Volumes (⚠️ Remove Dados!)

```bash
docker-compose down -v
```

> ⚠️ **Cuidado**: Este comando apaga todos os dados do banco de dados!

## 📝 Comandos Docker

### Ver Status dos Containers

```bash
docker-compose ps
```

### Ver Logs em Tempo Real

```bash
# Todos os serviços
docker-compose logs -f

# Apenas o serviço web
docker-compose logs -f web

# Apenas o serviço db
docker-compose logs -f db
```

### Acessar o Container Web (Shell)

```bash
docker exec -it maint-control-web bash
```

### Acessar o MySQL (Cliente)

```bash
# Usar variável de ambiente para evitar expor senha no histórico
MYSQL_PWD=rootpassword docker exec -it maint-control-db mysql -u root maintcontrol_db

# Ou interativamente
docker exec -it maint-control-db bash
# Dentro do container:
# mysql -u root -p
# (Digite a senha quando solicitado)
```

### Reconstruir as Imagens

Se você modificar o `Dockerfile`:

```bash
docker-compose build
docker-compose up -d
```

Ou de uma vez:

```bash
docker-compose up -d --build
```

### Reiniciar um Serviço Específico

```bash
# Reiniciar apenas o serviço web
docker-compose restart web

# Reiniciar apenas o banco de dados
docker-compose restart db
```

## 🌐 Acesso à Aplicação

Após subir os containers:

- **Aplicação Web**: http://localhost:8080
- **MySQL**: `localhost:3306`

### Credenciais Padrão

O banco de dados será inicializado com o schema definido em `backend/db/Maint_Control.sql`.

**Importante**: O arquivo SQL cria as tabelas, mas não cria usuários padrão. Você precisará criar um usuário admin manualmente na primeira vez.

#### Criar Usuário Admin

Você pode criar um usuário usando a própria API da aplicação ou diretamente no banco:

**Opção 1: Via SQL (Recomendado para primeiro usuário)**

> ⚠️ **IMPORTANTE**: Nos exemplos abaixo, `rootpassword` é a senha padrão. Use sua senha real do `.env` ou do `docker-compose.yml`.

```bash
# Acessar o MySQL (usando variável de ambiente para segurança)
# Substitua 'rootpassword' pela sua senha real
MYSQL_PWD=rootpassword docker exec -it maint-control-db mysql -u root maintcontrol_db

# Executar o comando SQL para criar o usuário
# IMPORTANTE: Substitua 'sua_senha_segura' por uma senha forte e única
# A hash abaixo é apenas um exemplo - GERE SUA PRÓPRIA HASH!
```

Para gerar uma hash de senha PHP segura, você pode usar:
```bash
# Gerar hash para sua própria senha
docker exec -it maint-control-web php -r "echo password_hash('sua_senha_aqui', PASSWORD_DEFAULT) . PHP_EOL;"
```

Depois execute no MySQL:
```sql
INSERT INTO users (username, password_hash, role, name) 
VALUES ('admin', 'SUA_HASH_GERADA_AQUI', 'admin', 'Administrador');
```

Exemplo completo:
```bash
# 1. Gerar a hash
HASH=$(docker exec -it maint-control-web php -r "echo password_hash('MinhaS3nhaS3gura!', PASSWORD_DEFAULT);")

# 2. Inserir no banco (substitua rootpassword pela sua senha real)
MYSQL_PWD=rootpassword docker exec -i maint-control-db mysql -u root maintcontrol_db <<EOF
INSERT INTO users (username, password_hash, role, name) 
VALUES ('admin', '$HASH', 'admin', 'Administrador');
EOF
```

**Opção 2: Via API (depois do primeiro usuário admin criado)**

Use a ação `create_user` da API (requer autenticação de admin).

### Estrutura de Portas

| Serviço | Porta Local | Porta Container | URL |
|---------|-------------|-----------------|-----|
| Web (Apache) | 8080 | 80 | http://localhost:8080 |
| MySQL | 3306 | 3306 | localhost:3306 |

## 💻 Desenvolvimento Local

### Com Docker (Recomendado)

O `docker-compose.yml` está configurado com volumes que mapeiam o diretório local para `/var/www/html` no container. Isso significa que:

✅ Alterações nos arquivos PHP, HTML, CSS, JS são refletidas imediatamente
✅ Não é necessário reconstruir a imagem a cada mudança
✅ O ambiente é idêntico para todos os desenvolvedores

### Sem Docker

Se preferir executar localmente sem Docker:

1. Configure um servidor web (Apache/Nginx) com PHP 8.1+
2. Instale MySQL 5.7+ ou 8.0
3. Configure o PHP com extensões `pdo` e `pdo_mysql`
4. O arquivo `backend/conexao.php` já suporta configuração local:
   - Valores padrão: `127.0.0.1`, `root`, senha vazia
   - Será usado quando variáveis de ambiente não estiverem definidas

## 🐛 Troubleshooting

### Container MySQL não inicia

**Problema**: O container `maint-control-db` para logo após iniciar.

**Solução**:
```bash
# Ver logs do MySQL
docker-compose logs db

# Remover volumes e reiniciar
docker-compose down -v
docker-compose up -d
```

### Erro de conexão com banco de dados

**Problema**: A aplicação não conecta ao MySQL.

**Verificações**:
1. Confirme que o container db está rodando:
   ```bash
   docker-compose ps
   ```

2. Verifique o healthcheck do MySQL:
   ```bash
   docker inspect maint-control-db | grep -A 10 Health
   ```

3. Teste a conexão manualmente:
   ```bash
   MYSQL_PWD=rootpassword docker exec -it maint-control-db mysql -u root -e "SELECT 1;"
   ```

### Porta 8080 ou 3306 já em uso

**Problema**: `Error: port is already allocated`

**Solução**: Altere a porta no `docker-compose.yml`:

```yaml
services:
  web:
    ports:
      - "8081:80"  # Trocar 8080 por 8081
  db:
    ports:
      - "3307:3306"  # Trocar 3306 por 3307
```

### Permissões de arquivo

**Problema**: Erros de permissão ao gravar arquivos.

**Solução**: O Dockerfile já configura permissões corretas, mas se necessário:

```bash
docker exec -it maint-control-web chown -R www-data:www-data /var/www/html
docker exec -it maint-control-web chmod -R 755 /var/www/html
```

### Tabelas não foram criadas automaticamente

**Problema**: Ao acessar a aplicação, erro de "tabela não existe".

**Solução**: Executar o SQL manualmente:

```bash
MYSQL_PWD=rootpassword docker exec -i maint-control-db mysql -u root maintcontrol_db < backend/db/Maint_Control.sql
```

### Ver logs completos

```bash
# Logs do Apache (erros PHP)
docker exec -it maint-control-web tail -f /var/log/apache2/error.log

# Logs do MySQL
docker-compose logs db
```

## 📦 Backup e Restauração

### Fazer Backup do Banco de Dados

```bash
MYSQL_PWD=rootpassword docker exec maint-control-db mysqldump -u root maintcontrol_db > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restaurar Backup

```bash
MYSQL_PWD=rootpassword docker exec -i maint-control-db mysql -u root maintcontrol_db < backup_20240101_120000.sql
```

## 🔒 Segurança

### Para Desenvolvimento Local

O arquivo `docker-compose.yml` inclui senhas padrão apenas para facilitar o desenvolvimento local. Isto é aceitável APENAS para ambientes de desenvolvimento em máquinas locais.

### Para Ambientes de Produção ou Compartilhados

⚠️ **NUNCA use as senhas padrão!** Siga estas práticas recomendadas:

#### 1. Use Arquivo .env

Crie um arquivo `.env` (já está no `.gitignore`):

```bash
# Copiar exemplo
cp .env.example .env

# Editar com senhas fortes
nano .env
```

Exemplo de `.env` com senhas seguras:
```env
DB_HOST=db
DB_NAME=maintcontrol_db
DB_USER=root
DB_PASS=SuaSenhaSeguraAqui2024!

MYSQL_ROOT_PASSWORD=SuaSenhaSeguraAqui2024!
MYSQL_DATABASE=maintcontrol_db
```

Depois, referencie no `docker-compose.yml`:
```yaml
services:
  web:
    env_file:
      - .env
  db:
    env_file:
      - .env
```

#### 2. Alterar Senhas Padrão

Se não usar `.env`, edite diretamente o `docker-compose.yml` e substitua `rootpassword` por uma senha forte.

#### 3. Não Expor Porta do MySQL Publicamente

Para produção, remova a exposição da porta 3306:

```yaml
services:
  db:
    # ports:
    #   - "3306:3306"  # Comentar ou remover
```

A aplicação web ainda conseguirá conectar via rede interna Docker.

#### 4. Use HTTPS

Configure um reverse proxy (Nginx, Traefik, Caddy) com certificado SSL/TLS na frente da aplicação.

#### 5. Restrinja Permissões de Arquivo

Certifique-se que arquivos sensíveis não são acessíveis:

```bash
chmod 600 .env  # Apenas o dono pode ler/escrever
```

#### 6. Docker Secrets (Avançado)

Para ambientes de produção com Docker Swarm:

```yaml
secrets:
  db_root_password:
    external: true

services:
  db:
    secrets:
      - db_root_password
    environment:
      MYSQL_ROOT_PASSWORD_FILE: /run/secrets/db_root_password
```

### Checklist de Segurança

Antes de fazer deploy em produção:

- [ ] Alterar todas as senhas padrão
- [ ] Usar `.env` ou Docker Secrets para credenciais
- [ ] Não expor porta MySQL (3306) publicamente
- [ ] Configurar HTTPS/SSL
- [ ] Fazer backup regular do banco de dados
- [ ] Manter imagens Docker atualizadas
- [ ] Usar usuário não-root no container (se possível)
- [ ] Implementar rate limiting e firewall
- [ ] Monitorar logs de acesso e erros

---

## 📚 Referências

- [Documentação Docker](https://docs.docker.com/)
- [Docker Compose](https://docs.docker.com/compose/)
- [PHP Official Docker Images](https://hub.docker.com/_/php)
- [MySQL Official Docker Images](https://hub.docker.com/_/mysql)

## 🤝 Contribuindo

Ao modificar os arquivos Docker:

1. Teste localmente com `docker-compose up --build`
2. Documente mudanças neste arquivo
3. Atualize o `.dockerignore` se necessário

---

**Desenvolvido para Maint_Control** 🛠️
