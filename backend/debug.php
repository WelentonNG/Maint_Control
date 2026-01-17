<?php
require_once 'conexao.php';
?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Debug - Maint Control</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h2 { color: #333; border-bottom: 3px solid #007bff; padding-bottom: 10px; }
        h3 { color: #555; margin-top: 25px; }
        .success { color: #28a745; font-weight: bold; }
        .error { color: #dc3545; font-weight: bold; }
        .warning { color: #ffc107; font-weight: bold; }
        pre { background: #f8f9fa; padding: 15px; border-radius: 5px; overflow-x: auto; }
        code { background: #e9ecef; padding: 2px 6px; border-radius: 3px; }
        textarea { width: 100%; padding: 10px; font-family: monospace; border: 1px solid #ddd; border-radius: 5px; }
        .btn { display: inline-block; padding: 10px 20px; margin: 5px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; border: none; cursor: pointer; }
        .btn:hover { background: #0056b3; }
        .btn-success { background: #28a745; }
        .btn-success:hover { background: #218838; }
        .info-box { background: #e7f3ff; padding: 15px; border-left: 4px solid #007bff; margin: 15px 0; }
    </style>
</head>
<body>
<div class="container">

<h2>🔍 DIAGNÓSTICO COMPLETO - Maint Control</h2>

<?php
// ===== 1. TESTA CONEXÃO =====
echo "<h3>1. Conexão com banco de dados:</h3>";
if ($pdo) {
    echo "<p class='success'>✅ PDO conectado com sucesso!</p>";
    echo "<p>Host: <code>$DB_HOST</code> | Database: <code>$DB_NAME</code></p>";
} else {
    echo "<p class='error'>❌ PDO não conectado!</p>";
    exit;
}

// ===== 2. LISTA USUÁRIOS =====
echo "<h3>2. Usuários cadastrados:</h3>";
try {
    $stmt = $pdo->query("SELECT id, username, role, name, LEFT(password_hash, 30) as hash_preview, created_at FROM users");
    $users = $stmt->fetchAll();
    
    if (count($users) > 0) {
        echo "<table border='1' cellpadding='10' style='border-collapse: collapse; width: 100%;'>";
        echo "<tr style='background: #007bff; color: white;'><th>ID</th><th>Username</th><th>Role</th><th>Nome</th><th>Hash (preview)</th><th>Criado em</th></tr>";
        foreach ($users as $u) {
            echo "<tr>";
            echo "<td>{$u['id']}</td>";
            echo "<td><strong>{$u['username']}</strong></td>";
            echo "<td>{$u['role']}</td>";
            echo "<td>{$u['name']}</td>";
            echo "<td><code>{$u['hash_preview']}...</code></td>";
            echo "<td>{$u['created_at']}</td>";
            echo "</tr>";
        }
        echo "</table>";
    } else {
        echo "<p class='warning'>⚠️ Nenhum usuário encontrado no banco!</p>";
        echo "<div class='info-box'><strong>Solução:</strong> Execute o SQL abaixo ou clique no botão para criar usuário admin.</div>";
    }
} catch (PDOException $e) {
    echo "<p class='error'>❌ Erro ao listar usuários: " . $e->getMessage() . "</p>";
}

// ===== 3. CRIAR USUÁRIO ADMIN (AÇÃO) =====
if (isset($_GET['action']) && $_GET['action'] === 'create_admin') {
    echo "<h3>3. Criando usuário admin...</h3>";
    try {
        // Remove admin se existir
        $pdo->exec("DELETE FROM users WHERE username = 'admin'");
        
        // Insere novo admin
        $hash = password_hash('password', PASSWORD_DEFAULT);
        $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)");
        $stmt->execute(['admin', $hash, 'admin', 'Administrador']);
        
        echo "<p class='success'>✅ Usuário 'admin' criado com sucesso!</p>";
        echo "<div class='info-box'>";
        echo "<strong>Credenciais:</strong><br>";
        echo "Username: <code>admin</code><br>";
        echo "Password: <code>password</code><br>";
        echo "<em>⚠️ IMPORTANTE: Troque essa senha após o primeiro login!</em>";
        echo "</div>";
        
        // Recarrega a página para atualizar lista
        echo "<script>setTimeout(() => window.location.href = 'debug.php', 2000);</script>";
    } catch (PDOException $e) {
        echo "<p class='error'>❌ Erro ao criar usuário: " . $e->getMessage() . "</p>";
    }
}

// ===== 4. TESTE DE VERIFICAÇÃO DE SENHA =====
echo "<h3>4. Teste de autenticação (admin):</h3>";
$stmt = $pdo->prepare("SELECT password_hash FROM users WHERE username = 'admin' LIMIT 1");
$stmt->execute();
$admin = $stmt->fetch();

if ($admin) {
    echo "<p>Hash armazenado: <code>" . substr($admin['password_hash'], 0, 50) . "...</code></p>";
    $verifica = password_verify('password', $admin['password_hash']);
    if ($verifica) {
        echo "<p class='success'>✅ password_verify('password', hash): <strong>OK</strong></p>";
        echo "<p>O login com 'admin' / 'password' deve funcionar!</p>";
    } else {
        echo "<p class='error'>❌ password_verify('password', hash): <strong>FALHOU</strong></p>";
        echo "<p>O hash não corresponde à senha 'password'. Recrie o usuário.</p>";
    }
} else {
    echo "<p class='error'>❌ Usuário 'admin' não encontrado no banco!</p>";
    echo "<p>Clique no botão abaixo para criar:</p>";
    echo "<a href='debug.php?action=create_admin' class='btn btn-success'>Criar usuário admin agora</a>";
}

// ===== 5. GERA HASH PARA QUALQUER SENHA =====
echo "<h3>5. Gerador de hash para senha:</h3>";
echo "<p>Use este hash para criar usuários manualmente:</p>";
$novo_hash = password_hash('password', PASSWORD_DEFAULT);
echo "<p><strong>Senha 'password':</strong></p>";
echo "<code style='display:block; padding: 10px; background: #f8f9fa;'>$novo_hash</code>";

// ===== 6. SQL PARA EXECUTAR MANUALMENTE =====
echo "<h3>6. SQL para executar no phpMyAdmin (alternativa):</h3>";
echo "<p>Copie e execute este SQL no phpMyAdmin para criar o usuário admin:</p>";
echo "<textarea rows='8'>";
echo "USE maintcontrol_db;\n\n";
echo "-- Remove admin se existir\n";
echo "DELETE FROM users WHERE username = 'admin';\n\n";
echo "-- Cria novo admin (senha: password)\n";
echo "INSERT INTO users (username, password_hash, role, name) VALUES\n";
echo "('admin', '$novo_hash', 'admin', 'Administrador');\n\n";
echo "-- Verifica\n";
echo "SELECT * FROM users;";
echo "</textarea>";

// ===== 7. TESTE DE API =====
echo "<h3>7. Teste da API de login:</h3>";
echo "<div class='info-box'>";
echo "<p>Para testar o login via JavaScript Console:</p>";
echo "<pre style='background: #2d2d2d; color: #f8f8f2; padding: 15px;'>";
echo "fetch('/MCSRC/backend/api.php', {\n";
echo "  method: 'POST',\n";
echo "  headers: {'Content-Type': 'application/json'},\n";
echo "  body: JSON.stringify({\n";
echo "    action: 'login',\n";
echo "    data: { username: 'admin', password: 'password' }\n";
echo "  })\n";
echo "})\n";
echo ".then(r => r.json())\n";
echo ".then(d => console.log(d));";
echo "</pre>";
echo "</div>";

// ===== 8. AÇÕES RÁPIDAS =====
echo "<h3>8. Ações rápidas:</h3>";
echo "<a href='debug.php' class='btn'>Atualizar página</a>";
if (count($users) === 0 || !$admin) {
    echo "<a href='debug.php?action=create_admin' class='btn btn-success'>Criar usuário admin</a>";
}
echo "<a href='../public/pages/login/login.html' class='btn' style='background: #6c757d;'>Ir para tela de login</a>";

?>

</div>
</body>
</html>