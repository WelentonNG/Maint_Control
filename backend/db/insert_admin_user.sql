-- ========================================
-- INSERIR USUÁRIO ADMIN PADRÃO
-- ========================================
-- Senha padrão: password
-- IMPORTANTE: Troque essa senha após primeiro login!

USE maintcontrol_db;

-- Remove usuário admin se existir
DELETE FROM users WHERE username = 'admin';

-- Insere novo admin com senha: password
-- Hash gerado com PASSWORD_DEFAULT (bcrypt)
INSERT INTO users (username, password_hash, role, name) 
VALUES ('admin', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin', 'Administrador');

-- Insere usuário de teste (username: lider, password: password)
INSERT INTO users (username, password_hash, role, name) 
VALUES ('lider', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'lider', 'Líder de Equipe');

-- Insere usuário comum (username: user, password: password)
INSERT INTO users (username, password_hash, role, name) 
VALUES ('user', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user', 'Usuário Comum');

-- Verifica inserção
SELECT id, username, role, name, created_at FROM users;
