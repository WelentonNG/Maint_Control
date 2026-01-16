# 🔧 MaintControl - Sistema de Controle de Manutenção

<div align="center">

![Status](https://img.shields.io/badge/status-ativo-success.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![PHP](https://img.shields.io/badge/PHP-7.4+-777BB4? logo=php&logoColor=white)
![MySQL](https://img.shields.io/badge/MySQL-8.0-4479A1?logo=mysql&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6+-F7DF1E?logo=javascript&logoColor=black)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)

Sistema completo para gestão e controle de manutenção de máquinas e equipamentos.

[Características](#-características) •
[Tecnologias](#-tecnologias) •
[Instalação](#-instalação) •
[Uso](#-uso) •
[Docker](#-docker) •
[Contribuir](#-contribuindo)

</div>

---

## 📋 Sobre o Projeto

**MaintControl** é uma aplicação web full-stack desenvolvida para facilitar o gerenciamento de manutenções de máquinas industriais. O sistema oferece uma interface intuitiva para registro, acompanhamento e histórico de manutenções, com autenticação de usuários e diferentes níveis de permissão.

### ✨ Características

- 🔐 **Autenticação e Autorização**: Sistema completo de login com tokens e controle de sessões
- 📊 **Dashboard Completo**: Visualização de métricas e status das máquinas em tempo real
- 🛠️ **Gestão de Manutenções**: Registro detalhado de manutenções preventivas e corretivas
- 📅 **Agendamentos**: Sistema de agendamento de manutenções futuras
- 📈 **Histórico**:  Rastreamento completo de todas as alterações e manutenções
- 👥 **Controle de Acesso**: Diferentes níveis de permissão (admin, técnico, usuário)
- 🌓 **Tema Claro/Escuro**: Interface adaptável com alternância de temas
- ���� **Design Responsivo**: Interface otimizada para desktop e mobile
- 💾 **Importação/Exportação**: Backup e restauração de dados em JSON
- 🐳 **Docker Ready**: Containerização completa para deploy simplificado

## 🚀 Tecnologias

### Backend
- **PHP 7.4+** - Linguagem principal do backend
- **MySQL 8.0** - Banco de dados relacional
- **PDO** - Camada de abstração de banco de dados
- **JWT-like Token Auth** - Sistema de autenticação baseado em tokens

### Frontend
- **HTML5** - Estrutura semântica
- **CSS3** - Estilização moderna com variáveis CSS
- **JavaScript (ES6+)** - Lógica do cliente
- **Font Awesome 6** - Ícones
- **Google Fonts (Inter)** - Tipografia

### DevOps
- **Docker** - Containerização
- **Docker Compose** - Orquestração de containers
- **Apache** - Servidor web
- **phpMyAdmin** - Administração do banco de dados

## 📦 Instalação

### Pré-requisitos

- PHP 7.4 ou superior
- MySQL 8.0 ou superior
- Composer (opcional)
- Docker e Docker Compose (para instalação via Docker)

### Instalação Local

1. **Clone o repositório**
```bash
git clone https://github.com/WelentonNG/Maint_Control.git
cd Maint_Control
```

2. **Configure o banco de dados**
```bash
# Crie o banco de dados
mysql -u root -p < backend/db/Maint_Control.sql
```

3. **Configure as variáveis de ambiente**
```bash
# Copie o arquivo de exemplo
cp . env.example .env

# Edite o arquivo .env com suas configurações
nano .env
```

4. **Configure o servidor web**
```bash
# Apache:  aponte o DocumentRoot para a pasta do projeto
# ou use o servidor embutido do PHP para desenvolvimento: 
php -S localhost:8000 -t public
```

5. **Acesse a aplicação**
```
http://localhost:8000
```

**Credenciais Padrão:**
- Usuário: `admin`
- Senha: `admin123`

> ⚠️ **Importante**: Altere as credenciais padrão em produção!

## 🐳 Docker

### Instalação via Docker

A forma mais rápida de executar o MaintControl é utilizando Docker: 

```bash
# Clone o repositório
git clone https://github.com/WelentonNG/Maint_Control.git
cd Maint_Control

# Copie o arquivo de configuração
cp .env.example .env

# Inicie os containers
docker-compose up -d
```

### Serviços Disponíveis

Após iniciar os containers, os seguintes serviços estarão disponíveis:

| Serviço | URL | Descrição |
|---------|-----|-----------|
| **Aplicação Web** | http://localhost:8080 | Interface principal do MaintControl |
| **phpMyAdmin** | http://localhost:8081 | Administração do banco de dados |
| **MySQL** | localhost:3306 | Banco de dados MySQL |

### Comandos Docker Úteis

```bash
# Iniciar os containers
docker-compose up -d

# Parar os containers
docker-compose down

# Ver logs
docker-compose logs -f

# Reiniciar um serviço específico
docker-compose restart web

# Reconstruir as imagens
docker-compose build --no-cache

# Limpar volumes (⚠️ apaga dados do banco)
docker-compose down -v
```

Para mais informações sobre Docker, consulte o arquivo [DOCKER.md](DOCKER.md).

## 🎯 Uso

### Funcionalidades Principais

#### 1. Gestão de Máquinas
- Cadastro de máquinas com informações detalhadas
- Controle de status (OK, Em Operação, Em Manutenção, Inoperante, etc.)
- Tags únicas para identificação
- Monitoramento de horas de uso

#### 2. Registro de Manutenções
- Registro de manutenções preventivas e corretivas
- Controle de custos por manutenção
- Atribuição de técnicos responsáveis
- Passos detalhados de cada manutenção

#### 3. Agendamentos
- Agendar manutenções futuras
- Visualização de manutenções próximas
- Notificações de manutenções pendentes

#### 4. Relatórios e Métricas
- Total de máquinas por status
- Quantidade de manutenções ativas
- Próximas manutenções agendadas
- Histórico completo de alterações

### Níveis de Acesso

| Papel | Permissões |
|-------|-----------|
| **Admin** | Acesso total ao sistema, gerenciamento de usuários |
| **Técnico** | Registro e edição de manutenções, visualização de dados |
| **Usuário** | Visualização de dados, consulta de relatórios |

## 🗄️ Estrutura do Banco de Dados

```sql
maquinas          # Cadastro de máquinas
├── id
├── nome
├── descricao
├── tag
├── horas_uso
└── status

manutencoes       # Registro de manutenções
├── id
├── maquina_id
├── data_servico
├── tipo_servico
├── custo
├── responsavel
└── observacoes

agendamentos      # Manutenções agendadas
├── id
├── maquina_id
├── data_agendada
└── observacoes

historico         # Log de alterações
├── id
├── maquina_id
├── data_hora
├── descricao
└── tipo

users             # Usuários do sistema
├── id
├── username
├── password_hash
├── name
└── role

sessions          # Sessões ativas
├── token
├── user_id
└── expires_at
```

## 📁 Estrutura do Projeto

```
Maint_Control/
├── backend/
│   ├── api. php           # Endpoints da API REST
│   ├── conexao.php       # Configuração do banco de dados
│   └── db/
│       └── Maint_Control.sql  # Schema do banco
├── public/
│   ├── index.html        # Página principal
│   └── pages/
│       └── login/        # Página de login
├── src/
│   └── assets/
│       ├── scripts/      # JavaScript
│       │   ├── script.js
│       │   ├── login.js
│       │   └── theme.js
│       ├── styles/       # CSS
│       └── Images/       # Imagens e ícones
├── docker-compose.yml    # Configuração Docker
├── Dockerfile           # Imagem Docker
├── .env. example         # Exemplo de variáveis de ambiente
└── README.md           # Este arquivo
```

## 🔒 Segurança

- ✅ Senhas criptografadas com `password_hash()` do PHP
- ✅ Autenticação baseada em tokens
- ✅ Proteção contra SQL Injection (PDO prepared statements)
- ✅ Proteção contra XSS (escape de HTML)
- ✅ Controle de sessões com expiração
- ✅ CORS configurável
- ⚠️ Altere as senhas padrão em produção
- ⚠️ Use HTTPS em ambientes de produção
- ⚠️ Nunca commite o arquivo `.env`

## 🤝 Contribuindo

Contribuições são bem-vindas! Para contribuir:

1. Faça um Fork do projeto
2. Crie uma branch para sua feature (`git checkout -b feature/MinhaFeature`)
3. Commit suas mudanças (`git commit -m 'Adiciona MinhaFeature'`)
4. Push para a branch (`git push origin feature/MinhaFeature`)
5. Abra um Pull Request

## 📝 To-Do

- [ ] Implementar notificações por email
- [ ] Adicionar relatórios em PDF
- [ ] Sistema de anexos para manutenções
- [ ] Gráficos de análise de manutenções
- [ ] API de integração com sistemas externos
- [ ] Aplicativo mobile
- [ ] Sistema de backup automático

## 📄 Licença

Este projeto está sob a licença MIT.  Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 👤 Autor

**WelentonNG**

- GitHub: [@WelentonNG](https://github.com/WelentonNG)

## 📞 Suporte

Se você tiver alguma dúvida ou problema: 

1. Consulte a [documentação do Docker](DOCKER.md)
2. Abra uma [issue](https://github.com/WelentonNG/Maint_Control/issues)
3. Entre em contato através do GitHub

---

<div align="center">

**Desenvolvido com ❤️ por [WelentonNG](https://github.com/WelentonNG)**

⭐ Se este projeto foi útil, considere dar uma estrela! 

</div>