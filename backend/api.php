<?php
// Configurações de cabeçalho para API
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Access-Control-Allow-Headers, Authorization, X-Requested-With');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// ATENÇÃO: É NECESSÁRIO CRIAR O ARQUIVO 'conexao.php' com a conexão PDO!
// Ex.: require_once 'conexao.php'; o arquivo deve expor a variável $pdo (PDO)
require_once 'conexao.php';

$method = $_SERVER['REQUEST_METHOD'];
$input = json_decode(file_get_contents('php://input'), true);
$action = isset($input['action']) ? $input['action'] : null;

// -----------------------
// AUTENTICAÇÃO / SESSÕES
// -----------------------
function generateToken($length = 64) {
    return bin2hex(random_bytes(max(8, (int)$length / 2)));
}

function getBearerToken() {
    $headers = null;
    if (isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $headers = trim($_SERVER["HTTP_AUTHORIZATION"]);
    } elseif (function_exists('apache_request_headers')) {
        $requestHeaders = apache_request_headers();
        if (isset($requestHeaders['Authorization'])) {
            $headers = trim($requestHeaders['Authorization']);
        } elseif (isset($requestHeaders['authorization'])) {
            $headers = trim($requestHeaders['authorization']);
        }
    }
    if (!empty($headers) && preg_match('/Bearer\s(\S+)/', $headers, $matches)) {
        return $matches[1];
    }
    return null;
}

function authenticate($pdo) {
    $token = getBearerToken();
    if (!$token) return null;

    $stmt = $pdo->prepare("SELECT s.token, s.expires_at, u.id AS user_id, u.username, u.role, u.name
                           FROM sessions s
                           JOIN users u ON u.id = s.user_id
                           WHERE s.token = ? LIMIT 1");
    $stmt->execute([$token]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) return null;

    if ($row['expires_at'] && (new DateTime($row['expires_at'])) < new DateTime()) {
        // sessão expirada: remover
        $pdo->prepare("DELETE FROM sessions WHERE token = ?")->execute([$token]);
        return null;
    }

    return [
        'id' => (int)$row['user_id'],
        'username' => $row['username'],
        'role' => $row['role'],
        'name' => $row['name']
    ];
}

function authorize($user, $allowedRoles = []) {
    if (!$user) return false;
    if (empty($allowedRoles)) return true;
    return in_array($user['role'], $allowedRoles);
}

// -----------------------
// TRATAMENTO DE REQUISIÇÕES
// -----------------------
try {
    // Rota pública: login
    if ($method === 'POST' && $action === 'login') {
        handleLogin($pdo, $input['data'] ?? []);
        exit;
    }

    // Para todas as outras rotas é necessário autenticar
    $currentUser = authenticate($pdo);
    if (!$currentUser) {
        http_response_code(401);
        echo json_encode(['status' => 'error', 'message' => 'Autenticação necessária. Faça login.']);
        exit;
    }

    switch ($method) {
        case 'GET':
            // GET público autenticado: lista máquinas e dados
            handleGetMachines($pdo);
            break;

        case 'POST':
            if ($action === 'add_machine') {
                if (!authorize($currentUser, ['admin'])) {
                    throw new Exception('Permissão negada. Somente Admin pode adicionar máquinas.');
                }
                handleAddMachine($pdo, $input['data']);
            } elseif ($action === 'add_history') {
                // qualquer usuário autenticado pode adicionar histórico
                handleAddHistory($pdo, $input['data']);
            } elseif ($action === 'start_maintenance') {
                if (!authorize($currentUser, ['admin', 'lider'])) {
                    throw new Exception('Permissão negada. Somente Admin ou Lider podem iniciar manutenção.');
                }
                handleStartMaintenance($pdo, $input['data']);
            } elseif ($action === 'batch_add_machines') {
                if (!authorize($currentUser, ['admin'])) {
                    throw new Exception('Permissão negada. Somente Admin pode importar em lote.');
                }
                handleBatchAddMachines($pdo, $input['data']);
            } elseif ($action === 'create_user') {
                if (!authorize($currentUser, ['admin'])) {
                    throw new Exception('Permissão negada. Somente Admin pode criar usuários.');
                }
                handleCreateUser($pdo, $input['data']);
            } elseif ($action === 'logout') {
                handleLogout($pdo);
            } else {
                throw new Exception('Ação POST desconhecida.');
            }
            break;

        case 'PUT':
            if ($action === 'update_field') {
                // restrições por campo aplicadas dentro da função
                handleUpdateField($pdo, $currentUser, $input['tag'], $input['field'], $input['value']);
            } elseif ($action === 'add_maint_step') {
                // qualquer usuário autenticado pode adicionar passo
                handleAddMaintStep($pdo, $input['data']);
            } elseif ($action === 'end_maintenance') {
                if (!authorize($currentUser, ['admin', 'lider'])) {
                    throw new Exception('Permissão negada. Somente Admin ou Lider podem finalizar manutenção.');
                }
                handleEndMaintenance($pdo, $input['data']);
            } else {
                throw new Exception('Ação PUT desconhecida.');
            }
            break;

        case 'DELETE':
            if ($action === 'delete_machine') {
                if (!authorize($currentUser, ['admin'])) {
                    throw new Exception('Permissão negada. Somente Admin pode excluir máquinas.');
                }
                handleDeleteMachine($pdo, $input['tag']);
            } else {
                throw new Exception('Ação DELETE desconhecida.');
            }
            break;

        default:
            http_response_code(405);
            echo json_encode(['status' => 'error', 'message' => 'Método HTTP não permitido.']);
            exit;
    }
} catch (PDOException $e) {
    if ($e->getCode() === '42S22') {
         $message = 'Erro no Banco de Dados: Coluna não encontrada (provavelmente "tecnico" ou "custo_total"). Execute o SQL da atualização.';
    } else {
         $message = 'Erro no Banco de Dados: ' . $e->getMessage();
    }
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => $message]);
} catch (Exception $e) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}

// =======================
// FUNÇÕES AUXILIARES / HANDLERS
// =======================

function handleLogin($pdo, $data) {
    if (empty($data['username']) || empty($data['password'])) {
        throw new Exception('Usuário e senha são obrigatórios.');
    }
    $username = $data['username'];
    $password = $data['password'];

    $stmt = $pdo->prepare("SELECT id, username, password_hash, role, name FROM users WHERE username = ? LIMIT 1");
    $stmt->execute([$username]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$user) {
        throw new Exception('Usuário ou senha incorretos.');
    }

    if (!password_verify($password, $user['password_hash'])) {
        throw new Exception('Usuário ou senha incorretos.');
    }

    // Gera token e salva em sessions
    $token = generateToken(64);
    $expiresAt = (new DateTime())->add(new DateInterval('PT8H'))->format('Y-m-d H:i:s');

    $stmt = $pdo->prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)");
    $stmt->execute([$user['id'], $token, $expiresAt]);

    echo json_encode([
        'status' => 'success',
        'message' => 'Autenticado',
        'token' => $token,
        'user' => [
            'id' => (int)$user['id'],
            'username' => $user['username'],
            'role' => $user['role'],
            'name' => $user['name']
        ]
    ]);
    exit;
}

function handleLogout($pdo) {
    $token = getBearerToken();
    if (!$token) {
        echo json_encode(['status' => 'success', 'message' => 'Logout efetuado.']);
        return;
    }
    $stmt = $pdo->prepare("DELETE FROM sessions WHERE token = ?");
    $stmt->execute([$token]);
    echo json_encode(['status' => 'success', 'message' => 'Logout efetuado.']);
    return;
}

function handleCreateUser($pdo, $data) {
    if (empty($data['username']) || empty($data['password']) || empty($data['role'])) {
        throw new Exception('username, password e role são obrigatórios.');
    }
    $username = trim($data['username']);
    $password_hash = password_hash($data['password'], PASSWORD_DEFAULT);
    $role = in_array($data['role'], ['admin', 'lider', 'user']) ? $data['role'] : 'user';
    $name = $data['name'] ?? null;

    $stmt = $pdo->prepare("INSERT INTO users (username, password_hash, role, name) VALUES (?, ?, ?, ?)");
    $stmt->execute([$username, $password_hash, $role, $name]);

    echo json_encode(['status' => 'success', 'message' => 'Usuário criado.']);
    exit;
}

// ------------------------------------------------------------------
// FUNÇÕES DE MANIPULAÇÃO DO DB (maquinas, manutencoes, historico...)
// ------------------------------------------------------------------

function handleGetMachines($pdo) {
    // Busca máquinas
    $stmt = $pdo->query("SELECT id, nome, tag, status, descricao, horas_uso FROM maquinas");
    $machines_db = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Dados agrupados
    $history_data = $pdo->query("SELECT maquina_id, data_hora, descricao FROM historico ORDER BY data_hora DESC")->fetchAll(PDO::FETCH_GROUP);
    $agendamento_data = $pdo->query("SELECT maquina_id, data_agendada, observacoes FROM agendamentos")->fetchAll(PDO::FETCH_GROUP);
    $manutencao_data = $pdo->query("SELECT id, maquina_id, data_servico, tipo_servico, observacoes, tecnico, data_fim, custo_total FROM manutencoes ORDER BY data_servico DESC")->fetchAll(PDO::FETCH_GROUP);
    $passos_data = $pdo->query("SELECT manutencao_id, data_hora, descricao FROM passos_manutencao ORDER BY data_hora ASC")->fetchAll(PDO::FETCH_GROUP);

    $formattedMachines = array_map(function($m) use ($history_data, $agendamento_data, $manutencao_data, $passos_data) {
        $id_maquina_db = $m['id'];

        $history = isset($history_data[$id_maquina_db]) ?
            array_map(function($h) {
                return [
                    'date' => (new DateTime($h['data_hora']))->format('d/m/Y H:i:s'),
                    'text' => $h['descricao']
                ];
            }, $history_data[$id_maquina_db]) :
            [['date' => date('d/m/Y H:i:s'), 'text' => 'Carregado do banco de dados.']];

        $nextMaint = isset($agendamento_data[$id_maquina_db][0]) ?
            [
                'date' => $agendamento_data[$id_maquina_db][0]['data_agendada'],
                'desc' => $agendamento_data[$id_maquina_db][0]['observacoes']
            ] : null;

        $maintenance_history = isset($manutencao_data[$id_maquina_db]) ?
            array_map(function($maint) use ($passos_data) {
                $id_manutencao_db = $maint['id'];
                $steps = isset($passos_data[$id_manutencao_db]) ?
                    array_map(function($p) {
                        return [
                            'date' => (new DateTime($p['data_hora']))->format('d/m/Y H:i:s'),
                            'description' => $p['descricao']
                        ];
                    }, $passos_data[$id_manutencao_db]) : [];

                return [
                    'id' => $id_manutencao_db,
                    'start_date' => $maint['data_servico'],
                    'end_date' => $maint['data_fim'],
                    'type' => $maint['tipo_servico'],
                    'desc' => $maint['observacoes'],
                    'tecnico' => $maint['tecnico'],
                    'cost' => $maint['custo_total'],
                    'steps' => $steps
                ];
            }, $manutencao_data[$id_maquina_db]) : [];

        return [
            'id' => $m['tag'],
            'name' => $m['nome'],
            'capacity' => isset($m['descricao']) ? $m['descricao'] : 'N/A',
            'manufacturer' => null,
            'quantity' => (int)(isset($m['horas_uso']) ? $m['horas_uso'] : 1),
            'status' => $m['status'],
            'maintenance' => $maintenance_history,
            'history' => $history,
            'nextMaint' => $nextMaint
        ];
    }, $machines_db);

    echo json_encode(['status' => 'success', 'machines' => $formattedMachines]);
}

function handleAddMachine($pdo, $data) {
    if (empty($data['id']) || empty($data['name'])) {
        throw new Exception('ID e Nome da máquina são obrigatórios.');
    }
    $stmt = $pdo->prepare("INSERT INTO maquinas (nome, tag, descricao, horas_uso, status) 
                          VALUES (:nome, :tag, :descricao, :horas_uso, :status)");
    $stmt->execute([
        'nome' => $data['name'],
        'tag' => $data['id'],
        'descricao' => isset($data['capacity']) ? $data['capacity'] : null,
        'horas_uso' => isset($data['quantity']) ? $data['quantity'] : 1,
        'status' => isset($data['status']) ? $data['status'] : 'OK'
    ]);
    echo json_encode(['status' => 'success', 'message' => 'Máquina adicionada com sucesso.']);
}

function handleAddHistory($pdo, $data) {
    if (empty($data['tag']) || empty($data['description'])) {
        throw new Exception('Tag da máquina e descrição do histórico são obrigatórios.');
    }
    $stmt = $pdo->prepare("SELECT id FROM maquinas WHERE tag = ?");
    $stmt->execute([$data['tag']]);
    $maquina_id = $stmt->fetchColumn();
    if (!$maquina_id) {
        throw new Exception('Máquina não encontrada para adicionar histórico.');
    }
    $stmt = $pdo->prepare("INSERT INTO historico (maquina_id, descricao) VALUES (?, ?)");
    $stmt->execute([$maquina_id, $data['description']]);
    echo json_encode(['status' => 'success', 'message' => 'Histórico adicionado.']);
}

function handleUpdateField($pdo, $currentUser, $tag, $field, $value) {
    if (empty($tag) || empty($field)) {
        throw new Exception('Tag e campo são obrigatórios para atualização.');
    }

    // Mapeamento campo JS -> DB
    $db_field = $field;
    if ($field === 'name') $db_field = 'nome';
    if ($field === 'capacity') $db_field = 'descricao';
    if ($field === 'quantity') $db_field = 'horas_uso';
    if ($field === 'manufacturer') $db_field = 'descricao';
    if ($field === 'status') $db_field = 'status';

    $allowed_fields = ['nome', 'descricao', 'horas_uso', 'status'];

    // Tratamento especial: nextMaint (agendamento)
    if ($field === 'nextMaint') {
        // Somente Admin e Lider podem agendar
        if (!authorize($currentUser, ['admin', 'lider'])) {
            throw new Exception('Permissão negada para agendamento. Apenas Admin ou Lider.');
        }

        $stmt = $pdo->prepare("SELECT id FROM maquinas WHERE tag = ?");
        $stmt->execute([$tag]);
        $maquina_id = $stmt->fetchColumn();
        if (!$maquina_id) {
            throw new Exception('Máquina não encontrada para agendamento.');
        }

        // Remove agendamentos anteriores
        $pdo->prepare("DELETE FROM agendamentos WHERE maquina_id = ?")->execute([$maquina_id]);

        if ($value && $value !== 'null') {
            $maintData = is_string($value) ? json_decode($value, true) : $value;
            if ($maintData && isset($maintData['date'])) {
                $stmt = $pdo->prepare("INSERT INTO agendamentos (maquina_id, data_agendada, observacoes) VALUES (?, ?, ?)");
                $stmt->execute([$maquina_id, $maintData['date'], $maintData['desc'] ?? null]);
            }
        }

        echo json_encode(['status' => 'success', 'message' => 'Agendamento atualizado.']);
        return;
    }

    if (!in_array($db_field, $allowed_fields)) {
        throw new Exception("Campo '$field' não permitido para atualização.");
    }

    // Restrição: apenas admin/lider podem alterar status
    if ($db_field === 'status' && !authorize($currentUser, ['admin', 'lider'])) {
        throw new Exception('Permissão negada para alterar status. Apenas Admin ou Lider.');
    }

    $sql = "UPDATE maquinas SET $db_field = :value WHERE tag = :tag";
    $stmt = $pdo->prepare($sql);

    // Ajustar tipos: se for NULL, set to null
    $val = $value;
    if ($val === 'null' || $val === null) $val = null;

    $stmt->execute([
        'value' => $val,
        'tag' => $tag
    ]);

    echo json_encode(['status' => 'success', 'message' => 'Campo atualizado.']);
}

function handleDeleteMachine($pdo, $tag) {
    if (empty($tag)) throw new Exception('Tag da máquina é obrigatória para exclusão.');
    $stmt = $pdo->prepare("DELETE FROM maquinas WHERE tag = ?");
    $stmt->execute([$tag]);
    echo json_encode(['status' => 'success', 'message' => 'Máquina deletada.']);
}

function handleStartMaintenance($pdo, $data) {
    if (empty($data['tag']) || empty($data['type'])) {
        throw new Exception('Tag e Tipo da manutenção são obrigatórios.');
    }

    $stmt = $pdo->prepare("SELECT id FROM maquinas WHERE tag = ?");
    $stmt->execute([$data['tag']]);
    $maquina_id = $stmt->fetchColumn();
    if (!$maquina_id) {
        throw new Exception('Máquina não encontrada.');
    }

    $stmt = $pdo->prepare("INSERT INTO manutencoes (maquina_id, data_servico, tipo_servico, observacoes, tecnico) 
                          VALUES (?, ?, ?, ?, ?)");
    $stmt->execute([
        $maquina_id,
        $data['start_date'] ?? date('Y-m-d'),
        $data['type'],
        $data['desc'] ?? null,
        $data['tecnico'] ?? null
    ]);

    $maint_id = $pdo->lastInsertId();
    echo json_encode(['status' => 'success', 'message' => 'Manutenção iniciada.', 'maint_id' => $maint_id]);
}

function handleEndMaintenance($pdo, $data) {
    if (empty($data['tag']) || empty($data['end_date']) || empty($data['maint_id'])) {
        throw new Exception('Dados de finalização incompletos.');
    }

    $stmt = $pdo->prepare("SELECT id FROM maquinas WHERE tag = ?");
    $stmt->execute([$data['tag']]);
    $maquina_id = $stmt->fetchColumn();
    if (!$maquina_id) {
        throw new Exception('Máquina não encontrada.');
    }

    $custo = isset($data['cost']) ? (float)str_replace(',', '.', $data['cost']) : null;
    if ($custo < 0) $custo = null;

    $stmt = $pdo->prepare("UPDATE manutencoes SET data_fim = :end_date, custo_total = :cost 
                          WHERE id = :maint_id AND maquina_id = :maquina_id AND data_fim IS NULL");
    $stmt->execute([
        'end_date' => $data['end_date'],
        'cost' => $custo,
        'maint_id' => $data['maint_id'],
        'maquina_id' => $maquina_id
    ]);

    if ($stmt->rowCount() === 0) {
        throw new Exception('Nenhuma manutenção ativa encontrada com o ID fornecido.');
    }

    echo json_encode(['status' => 'success', 'message' => 'Manutenção finalizada.']);
}

function handleBatchAddMachines($pdo, $machines) {
    if (!is_array($machines) || empty($machines)) {
        throw new Exception('Nenhum dado de máquina válido fornecido.');
    }
    $stmt = $pdo->prepare("INSERT INTO maquinas (nome, tag, descricao, horas_uso, status) 
                          VALUES (:nome, :tag, :descricao, :horas_uso, :status)
                          ON DUPLICATE KEY UPDATE 
                          nome = VALUES(nome), 
                          descricao = VALUES(descricao), 
                          horas_uso = VALUES(horas_uso), 
                          status = VALUES(status)");
    $count = 0;
    $pdo->beginTransaction();
    try {
        foreach ($machines as $data) {
            if (empty($data['id']) || empty($data['name'])) {
                continue;
            }
            $stmt->execute([
                'nome' => $data['name'],
                'tag' => $data['id'],
                'descricao' => isset($data['capacity']) ? $data['capacity'] : null,
                'horas_uso' => isset($data['quantity']) ? (int)$data['quantity'] : 1,
                'status' => isset($data['status']) ? $data['status'] : 'OK'
            ]);
            $count++;
        }
        $pdo->commit();
        echo json_encode(['status' => 'success', 'message' => "$count máquinas importadas/atualizadas com sucesso."]);
    } catch (Exception $e) {
        $pdo->rollBack();
        throw $e;
    }
}

function handleAddMaintStep($pdo, $data) {
    if (empty($data['maint_id']) || empty($data['description'])) {
        throw new Exception('ID da Manutenção e Descrição são obrigatórios.');
    }

    $stmt = $pdo->prepare("INSERT INTO passos_manutencao (manutencao_id, descricao) VALUES (?, ?)");
    $stmt->execute([
        $data['maint_id'],
        $data['description']
    ]);

    $step_id = $pdo->lastInsertId();
    $stmt2 = $pdo->prepare("SELECT data_hora FROM passos_manutencao WHERE id = ?");
    $stmt2->execute([$step_id]);
    $new_step_date = $stmt2->fetchColumn();

    echo json_encode([
        'status' => 'success',
        'message' => 'Passo adicionado.',
        'new_step' => [
            'date' => (new DateTime($new_step_date))->format('d/m/Y H:i:s'),
            'description' => $data['description']
        ]
    ]);
}

?>