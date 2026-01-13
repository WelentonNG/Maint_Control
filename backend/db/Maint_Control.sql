-- ========================================
-- BANCO DE DADOS
-- ========================================

CREATE DATABASE IF NOT EXISTS maintcontrol_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE maintcontrol_db;

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;

-- ========================================
-- TABELA: maquinas (BASE)
-- ========================================

CREATE TABLE IF NOT EXISTS maquinas (
  id INT(11) NOT NULL AUTO_INCREMENT,
  nome VARCHAR(100) NOT NULL,
  descricao TEXT DEFAULT NULL,
  tag VARCHAR(50) NOT NULL,
  horas_uso INT(11) DEFAULT 0,
  status ENUM(
    'OK',
    'EM OPERAÇÃO',
    'EM MANUTENÇÃO',
    'INOPERANTE',
    'ESPERANDO PEÇAS',
    'HORAS EXCEDENTES'
  ) DEFAULT 'OK',
  PRIMARY KEY (id),
  UNIQUE KEY tag (tag)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABELA: manutencoes
-- ========================================

CREATE TABLE IF NOT EXISTS manutencoes (
  id INT(11) NOT NULL AUTO_INCREMENT,
  maquina_id INT(11) NOT NULL,
  data_servico DATE NOT NULL,
  tipo_servico VARCHAR(100) NOT NULL,
  custo DECIMAL(10,2) DEFAULT NULL,
  responsavel VARCHAR(100) DEFAULT NULL,
  observacoes TEXT DEFAULT NULL,
  tecnico VARCHAR(255) DEFAULT NULL,
  data_fim DATE DEFAULT NULL,
  custo_total DECIMAL(10,2) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY maquina_id (maquina_id),
  CONSTRAINT manutencoes_ibfk_1
    FOREIGN KEY (maquina_id) REFERENCES maquinas (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABELA: agendamentos
-- ========================================

CREATE TABLE IF NOT EXISTS agendamentos (
  id INT(11) NOT NULL AUTO_INCREMENT,
  maquina_id INT(11) NOT NULL,
  data_agendada DATE NOT NULL,
  observacoes TEXT DEFAULT NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY maquina_id (maquina_id),
  CONSTRAINT agendamentos_ibfk_1
    FOREIGN KEY (maquina_id) REFERENCES maquinas (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABELA: historico
-- ========================================

CREATE TABLE IF NOT EXISTS historico (
  id INT(11) NOT NULL AUTO_INCREMENT,
  maquina_id INT(11) NOT NULL,
  data_hora DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  descricao TEXT NOT NULL,
  tipo VARCHAR(50) DEFAULT NULL,
  PRIMARY KEY (id),
  KEY maquina_id (maquina_id),
  CONSTRAINT historico_ibfk_1
    FOREIGN KEY (maquina_id) REFERENCES maquinas (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABELA: passos_manutencao
-- ========================================

CREATE TABLE IF NOT EXISTS passos_manutencao (
  id INT(11) NOT NULL AUTO_INCREMENT,
  manutencao_id INT(11) NOT NULL,
  data_hora TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  descricao TEXT NOT NULL,
  PRIMARY KEY (id),
  KEY idx_manutencao_id (manutencao_id),
  CONSTRAINT passos_manutencao_ibfk_1
    FOREIGN KEY (manutencao_id) REFERENCES manutencoes (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ========================================
-- NOVAS TABELAS: users (papéis) e sessions (tokens)
-- ========================================

CREATE TABLE IF NOT EXISTS users (
  id INT(11) NOT NULL AUTO_INCREMENT,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','lider','user') NOT NULL DEFAULT 'user',
  name VARCHAR(150) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id INT(11) NOT NULL AUTO_INCREMENT,
  user_id INT(11) NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_user_id (user_id),
  CONSTRAINT sessions_ibfk_1
    FOREIGN KEY (user_id) REFERENCES users (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

COMMIT;