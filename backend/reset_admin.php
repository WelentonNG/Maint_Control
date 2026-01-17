<?php
// SCRIPT PARA RESETAR USUÁRIO ADMIN - EXECUTE ESTE ARQUIVO UMA VEZ
require_once 'conexao.php';

try {
    // Remove usuário admin se existir
    $pdo->exec("DELETE FROM users WHERE username = 'admin'");
    
    // Cria novo hash
    $password = 'password';
    $hash = password_hash($password, PASSWORD_DEFAULT);
    
    // Insere novo admin
    $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)");
    $stmt->execute(['admin', $hash, 'admin', 'Administrador']);
    
    // Testa o hash
    $stmt = $pdo->prepare("SELECT password_hash FROM users WHERE username = 'admin'");
    $stmt->execute();
    $user = $stmt->fetch();
    
    $verifica = password_verify($password, $user['password_hash']);
    
    echo "<h1 style='color: green;'>✅ SUCESSO!</h1>";
    echo "<h2>Usuário admin criado com sucesso!</h2>";
    echo "<p><strong>Username:</strong> admin</p>";
    echo "<p><strong>Password:</strong> password</p>";
    echo "<p><strong>Hash verificado:</strong> " . ($verifica ? "✅ OK" : "❌ ERRO") . "</p>";
    echo "<br><hr><br>";
    echo "<h3>Agora você pode fazer login!</h3>";
    echo "<a href='../public/pages/login/login.html' style='display:inline-block; padding:15px 30px; background:#007bff; color:white; text-decoration:none; border-radius:5px; font-size:18px;'>IR PARA LOGIN</a>";
    echo "<br><br>";
    echo "<p style='color: red;'><strong>IMPORTANTE:</strong> Delete este arquivo (reset_admin.php) após usar!</p>";
    
} catch (Exception $e) {
    echo "<h1 style='color: red;'>❌ ERRO!</h1>";
    echo "<p>" . $e->getMessage() . "</p>";
}
?>
