// ====== CONFIGURAÇÕES ======
const API_URLS = [
  '/MCSRC/backend/api.php',
  '/MC/backend/api.php',
  '/backend/api.php',
  '../../../backend/api.php'
];

let API_URL = API_URLS[0];
let machines = [];
let currentUser = null;

// ====== INICIALIZAÇÃO ======
document.addEventListener('DOMContentLoaded', async () => {
  // Verificar autenticação
  if (!checkAuth()) {
    window.location.href = '../login/login.html';
    return;
  }

  // Carregar dados do usuário
  loadUserInfo();

  // Aplicar tema salvo
  applyTheme();

  // Setup event listeners
  setupEventListeners();

  // Carregar dados iniciais
  await loadMachines();

  // Atualizar dashboard
  updateDashboard();

  // Inicializar gráficos
  initCharts();
});

// ====== AUTENTICAÇÃO ======
function checkAuth() {
  const token = localStorage.getItem('maintControl_token');
  const session = localStorage.getItem('maintControl_session');
  return token && session === 'true';
}

function loadUserInfo() {
  const userName = localStorage.getItem('maintControl_user') || 'Usuário';
  const userRole = localStorage.getItem('maintControl_role') || 'user';
  const roleMap = {
    'admin': 'Administrador',
    'lider': 'Líder',
    'user': 'Usuário'
  };

  document.getElementById('userName').textContent = userName;
  document.getElementById('userRole').textContent = roleMap[userRole];

  currentUser = {
    name: userName,
    role: userRole
  };

  // Esconder seção de usuários se não for admin
  if (userRole !== 'admin') {
    const usersNav = document.getElementById('usersNav');
    if (usersNav) usersNav.style.display = 'none';
  }
}

// ====== TEMA ======
function applyTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const icon = document.querySelector('#toggleTheme i');
  if (icon) icon.className = savedTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

// ====== EVENT LISTENERS ======
function setupEventListeners() {
  // Theme toggle
  document.getElementById('toggleTheme')?.addEventListener('click', toggleTheme);

  // Sidebar toggle
  document.getElementById('sidebarToggle')?.addEventListener('click', toggleSidebar);
  document.getElementById('mobileMenuToggle')?.addEventListener('click', toggleMobileSidebar);

  // Navigation
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const section = item.dataset.section;
      navigateToSection(section);
    });
  });

  // Logout
  document.getElementById('logoutBtn')?.addEventListener('click', logout);

  // Refresh
  document.getElementById('refreshBtn')?.addEventListener('click', async () => {
    await loadMachines();
    showToast('Dados atualizados!', 'success');
  });

  // Machine actions
  document.getElementById('addMachineBtn')?.addEventListener('click', showAddMachineModal);
  document.getElementById('machineSearch')?.addEventListener('input', filterMachines);
  document.getElementById('statusFilter')?.addEventListener('change', filterMachines);

  // Maintenance actions
  document.getElementById('startMaintenanceBtn')?.addEventListener('click', showStartMaintenanceModal);

  // Schedule actions
  document.getElementById('addScheduleBtn')?.addEventListener('click', showAddScheduleModal);
  document.getElementById('prevMonth')?.addEventListener('click', () => changeMonth(-1));
  document.getElementById('nextMonth')?.addEventListener('click', () => changeMonth(1));

  // Users actions
  document.getElementById('addUserBtn')?.addEventListener('click', showAddUserModal);

  // Modal close
  document.getElementById('modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'modal') closeModal();
  });
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  const icon = document.querySelector('#toggleTheme i');
  if (icon) icon.className = newTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}

function toggleSidebar() {
  document.getElementById('sidebar')?.classList.toggle('collapsed');
}

function toggleMobileSidebar() {
  document.getElementById('sidebar')?.classList.toggle('mobile-open');
}

function navigateToSection(section) {
  // Update nav active state
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });
  document.querySelector(`[data-section="${section}"]`)?.classList.add('active');

  // Hide all sections
  document.querySelectorAll('.content-section').forEach(sec => {
    sec.classList.remove('active');
  });

  // Show selected section
  const sectionMap = {
    'dashboard': 'dashboardSection',
    'machines': 'machinesSection',
    'maintenance': 'maintenanceSection',
    'schedule': 'scheduleSection',
    'history': 'historySection',
    'reports': 'reportsSection',
    'users': 'usersSection'
  };

  const sectionId = sectionMap[section];
  document.getElementById(sectionId)?.classList.add('active');

  // Update page title
  const titles = {
    'dashboard': 'Dashboard',
    'machines': 'Máquinas',
    'maintenance': 'Manutenções',
    'schedule': 'Agendamentos',
    'history': 'Histórico',
    'reports': 'Relatórios',
    'users': 'Usuários'
  };
  document.getElementById('pageTitle').textContent = titles[section];

  // Load section data
  switch(section) {
    case 'dashboard':
      updateDashboard();
      break;
    case 'machines':
      renderMachinesTable();
      break;
    case 'maintenance':
      renderMaintenanceGrid();
      break;
    case 'schedule':
      renderCalendar();
      renderScheduleList();
      break;
    case 'history':
      renderHistory();
      break;
    case 'users':
      loadUsers();
      break;
  }

  // Close mobile menu
  document.getElementById('sidebar')?.classList.remove('mobile-open');
}

async function logout() {
  try {
    const token = localStorage.getItem('maintControl_token');
    await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ action: 'logout' })
    });
  } catch (err) {
    console.error('Erro ao fazer logout:', err);
  }

  // Limpar dados locais
  localStorage.removeItem('maintControl_token');
  localStorage.removeItem('maintControl_session');
  localStorage.removeItem('maintControl_user');
  localStorage.removeItem('maintControl_role');
  localStorage.removeItem('maintControl_username');

  // Redirecionar para login
  window.location.href = '../login/login.html';
}

// ====== API CALLS ======
async function apiCall(endpoint, method = 'GET', data = null) {
  const token = localStorage.getItem('maintControl_token');
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    }
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  // Try each API URL
  for (const url of API_URLS) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 401) {
        // Token expirado
        logout();
        return null;
      }

      const result = await response.json();
      API_URL = url; // Save working URL
      return result;
    } catch (err) {
      continue;
    }
  }

  throw new Error('Não foi possível conectar ao servidor');
}

async function loadMachines() {
  try {
    const response = await apiCall(API_URL);
    if (response && response.status === 'success') {
      machines = response.machines || [];
      return machines;
    }
  } catch (err) {
    console.error('Erro ao carregar máquinas:', err);
    showToast('Erro ao carregar dados', 'error');
  }
  return [];
}

// ====== DASHBOARD ======
function updateDashboard() {
  const totalMachines = machines.length;
  const machinesOk = machines.filter(m => m.status === 'OK').length;
  const machinesMaintenance = machines.filter(m => m.status === 'EM MANUTENÇÃO').length;
  const machinesInoperative = machines.filter(m => m.status === 'INOPERANTE').length;

  document.getElementById('totalMachines').textContent = totalMachines;
  document.getElementById('machinesOk').textContent = machinesOk;
  document.getElementById('machinesMaintenance').textContent = machinesMaintenance;
  document.getElementById('machinesInoperative').textContent = machinesInoperative;

  // Update upcoming maintenance
  renderUpcomingMaintenance();
}

function renderUpcomingMaintenance() {
  const container = document.getElementById('upcomingMaintenance');
  const upcomingMaint = machines
    .filter(m => m.nextMaint && m.nextMaint.date)
    .sort((a, b) => new Date(a.nextMaint.date) - new Date(b.nextMaint.date))
    .slice(0, 5);

  if (upcomingMaint.length === 0) {
    container.innerHTML = '<p class="no-data">Nenhuma manutenção agendada</p>';
    return;
  }

  container.innerHTML = upcomingMaint.map(m => `
    <div class="upcoming-item">
      <div class="upcoming-icon">
        <i class="fa-solid fa-calendar-check"></i>
      </div>
      <div class="upcoming-details">
        <h4>${m.name} (${m.id})</h4>
        <p>${formatDate(m.nextMaint.date)} - ${m.nextMaint.desc || 'Manutenção agendada'}</p>
      </div>
    </div>
  `).join('');
}

// ====== MÁQUINAS ======
function renderMachinesTable() {
  const tbody = document.getElementById('machinesTableBody');
  
  if (machines.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="no-data">Nenhuma máquina cadastrada</td></tr>';
    return;
  }

  tbody.innerHTML = machines.map(m => `
    <tr>
      <td><strong>${m.id}</strong></td>
      <td>${m.name}</td>
      <td>${m.capacity || 'N/A'}</td>
      <td>${m.quantity || 0}h</td>
      <td><span class="status-badge ${getStatusClass(m.status)}">${m.status}</span></td>
      <td>
        <div class="action-btns">
          <button class="icon-btn view" onclick="viewMachine('${m.id}')" title="Ver detalhes">
            <i class="fa-solid fa-eye"></i>
          </button>
          <button class="icon-btn edit" onclick="editMachine('${m.id}')" title="Editar">
            <i class="fa-solid fa-pen"></i>
          </button>
          ${currentUser.role === 'admin' ? `
            <button class="icon-btn delete" onclick="deleteMachine('${m.id}')" title="Excluir">
              <i class="fa-solid fa-trash"></i>
            </button>
          ` : ''}
        </div>
      </td>
    </tr>
  `).join('');
}

function getStatusClass(status) {
  const statusMap = {
    'OK': 'status-ok',
    'EM OPERAÇÃO': 'status-operation',
    'EM MANUTENÇÃO': 'status-maintenance',
    'INOPERANTE': 'status-inoperative',
    'ESPERANDO PEÇAS': 'status-maintenance',
    'HORAS EXCEDENTES': 'status-maintenance'
  };
  return statusMap[status] || 'status-ok';
}

function filterMachines() {
  const searchTerm = document.getElementById('machineSearch')?.value.toLowerCase() || '';
  const statusFilter = document.getElementById('statusFilter')?.value || '';

  const filtered = machines.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm) || 
                         m.id.toLowerCase().includes(searchTerm) ||
                         (m.capacity && m.capacity.toLowerCase().includes(searchTerm));
    const matchesStatus = !statusFilter || m.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Temporarily update machines for rendering
  const originalMachines = [...machines];
  machines = filtered;
  renderMachinesTable();
  machines = originalMachines;
}

async function viewMachine(id) {
  const machine = machines.find(m => m.id === id);
  if (!machine) return;

  const modalContent = `
    <div class="modal-header">
      <h2><i class="fa-solid fa-industry"></i> ${machine.name}</h2>
      <button class="modal-close" onclick="closeModal()">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label class="form-label">TAG:</label>
        <p><strong>${machine.id}</strong></p>
      </div>
      <div class="form-group">
        <label class="form-label">Descrição:</label>
        <p>${machine.capacity || 'N/A'}</p>
      </div>
      <div class="form-group">
        <label class="form-label">Horas de Uso:</label>
        <p>${machine.quantity || 0}h</p>
      </div>
      <div class="form-group">
        <label class="form-label">Status:</label>
        <p><span class="status-badge ${getStatusClass(machine.status)}">${machine.status}</span></p>
      </div>
      ${machine.nextMaint ? `
        <div class="form-group">
          <label class="form-label">Próxima Manutenção:</label>
          <p>${formatDate(machine.nextMaint.date)} - ${machine.nextMaint.desc || ''}</p>
        </div>
      ` : ''}
      <div class="form-group">
        <label class="form-label">Histórico:</label>
        <div class="timeline">
          ${machine.history && machine.history.length > 0 ? machine.history.map(h => `
            <div class="timeline-item">
              <div class="timeline-date">${h.date}</div>
              <div class="timeline-content">${h.text}</div>
            </div>
          `).join('') : '<p class="no-data">Sem histórico</p>'}
        </div>
      </div>
      ${machine.maintenance && machine.maintenance.length > 0 ? `
        <div class="form-group">
          <label class="form-label">Manutenções:</label>
          ${machine.maintenance.map(m => `
            <div class="maintenance-card">
              <h4>${m.type}</h4>
              <p>Início: ${formatDate(m.start_date)}</p>
              ${m.end_date ? `<p>Fim: ${formatDate(m.end_date)}</p>` : ''}
              ${m.tecnico ? `<p>Técnico: ${m.tecnico}</p>` : ''}
              ${m.cost ? `<p>Custo: R$ ${parseFloat(m.cost).toFixed(2)}</p>` : ''}
              ${m.desc ? `<p>${m.desc}</p>` : ''}
            </div>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `;

  showModal(modalContent);
}

function editMachine(id) {
  const machine = machines.find(m => m.id === id);
  if (!machine) return;

  const modalContent = `
    <div class="modal-header">
      <h2><i class="fa-solid fa-pen"></i> Editar Máquina</h2>
      <button class="modal-close" onclick="closeModal()">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="modal-body">
      <form id="editMachineForm">
        <input type="hidden" name="id" value="${machine.id}">
        <div class="form-group">
          <label class="form-label">Nome:</label>
          <input type="text" class="form-input" name="name" value="${machine.name}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Descrição:</label>
          <input type="text" class="form-input" name="capacity" value="${machine.capacity || ''}">
        </div>
        <div class="form-group">
          <label class="form-label">Horas de Uso:</label>
          <input type="number" class="form-input" name="quantity" value="${machine.quantity || 0}">
        </div>
        <div class="form-group">
          <label class="form-label">Status:</label>
          <select class="form-select" name="status" ${['admin', 'lider'].includes(currentUser.role) ? '' : 'disabled'}>
            <option value="OK" ${machine.status === 'OK' ? 'selected' : ''}>OK</option>
            <option value="EM OPERAÇÃO" ${machine.status === 'EM OPERAÇÃO' ? 'selected' : ''}>Em Operação</option>
            <option value="EM MANUTENÇÃO" ${machine.status === 'EM MANUTENÇÃO' ? 'selected' : ''}>Em Manutenção</option>
            <option value="INOPERANTE" ${machine.status === 'INOPERANTE' ? 'selected' : ''}>Inoperante</option>
            <option value="ESPERANDO PEÇAS" ${machine.status === 'ESPERANDO PEÇAS' ? 'selected' : ''}>Esperando Peças</option>
            <option value="HORAS EXCEDENTES" ${machine.status === 'HORAS EXCEDENTES' ? 'selected' : ''}>Horas Excedentes</option>
          </select>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveEditMachine()">Salvar</button>
    </div>
  `;

  showModal(modalContent);
}

async function saveEditMachine() {
  const form = document.getElementById('editMachineForm');
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  try {
    // Atualizar cada campo
    const fields = ['name', 'capacity', 'quantity', 'status'];
    for (const field of fields) {
      await apiCall(API_URL, 'PUT', {
        action: 'update_field',
        tag: data.id,
        field: field,
        value: data[field]
      });
    }

    showToast('Máquina atualizada com sucesso!', 'success');
    closeModal();
    await loadMachines();
    renderMachinesTable();
    updateDashboard();
  } catch (err) {
    console.error('Erro ao atualizar máquina:', err);
    showToast('Erro ao atualizar máquina', 'error');
  }
}

async function deleteMachine(id) {
  if (!confirm(`Tem certeza que deseja excluir a máquina ${id}?`)) return;

  try {
    const response = await apiCall(API_URL, 'DELETE', {
      action: 'delete_machine',
      tag: id
    });

    if (response.status === 'success') {
      showToast('Máquina excluída com sucesso!', 'success');
      await loadMachines();
      renderMachinesTable();
      updateDashboard();
    } else {
      showToast(response.message || 'Erro ao excluir máquina', 'error');
    }
  } catch (err) {
    console.error('Erro ao excluir máquina:', err);
    showToast('Erro ao excluir máquina', 'error');
  }
}

function showAddMachineModal() {
  const modalContent = `
    <div class="modal-header">
      <h2><i class="fa-solid fa-plus"></i> Adicionar Máquina</h2>
      <button class="modal-close" onclick="closeModal()">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="modal-body">
      <form id="addMachineForm">
        <div class="form-group">
          <label class="form-label">TAG (ID Único):</label>
          <input type="text" class="form-input" name="id" required placeholder="Ex: DWM-001">
        </div>
        <div class="form-group">
          <label class="form-label">Nome:</label>
          <input type="text" class="form-input" name="name" required placeholder="Ex: Empilhadeira">
        </div>
        <div class="form-group">
          <label class="form-label">Descrição:</label>
          <input type="text" class="form-input" name="capacity" placeholder="Ex: 900KG">
        </div>
        <div class="form-group">
          <label class="form-label">Horas de Uso:</label>
          <input type="number" class="form-input" name="quantity" value="0">
        </div>
        <div class="form-group">
          <label class="form-label">Status:</label>
          <select class="form-select" name="status">
            <option value="OK">OK</option>
            <option value="EM OPERAÇÃO">Em Operação</option>
            <option value="EM MANUTENÇÃO">Em Manutenção</option>
            <option value="INOPERANTE">Inoperante</option>
          </select>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveAddMachine()">Adicionar</button>
    </div>
  `;

  showModal(modalContent);
}

async function saveAddMachine() {
  const form = document.getElementById('addMachineForm');
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  try {
    const response = await apiCall(API_URL, 'POST', {
      action: 'add_machine',
      data: data
    });

    if (response.status === 'success') {
      showToast('Máquina adicionada com sucesso!', 'success');
      closeModal();
      await loadMachines();
      renderMachinesTable();
      updateDashboard();
    } else {
      showToast(response.message || 'Erro ao adicionar máquina', 'error');
    }
  } catch (err) {
    console.error('Erro ao adicionar máquina:', err);
    showToast('Erro ao adicionar máquina', 'error');
  }
}

// ====== MANUTENÇÕES ======
function renderMaintenanceGrid() {
  const container = document.getElementById('maintenanceGrid');
  const activeMaint = machines.filter(m => 
    m.maintenance && m.maintenance.some(maint => !maint.end_date)
  );

  if (activeMaint.length === 0) {
    container.innerHTML = '<p class="no-data">Nenhuma manutenção em andamento</p>';
    return;
  }

  container.innerHTML = activeMaint.map(m => {
    const maint = m.maintenance.find(maint => !maint.end_date);
    return `
      <div class="maintenance-card">
        <div class="maintenance-header">
          <div>
            <div class="maintenance-title">${m.name} (${m.id})</div>
          </div>
          <span class="maintenance-badge">Em Andamento</span>
        </div>
        <div class="maintenance-info">
          <p><i class="fa-solid fa-wrench"></i> ${maint.type}</p>
          <p><i class="fa-solid fa-calendar"></i> Início: ${formatDate(maint.start_date)}</p>
          ${maint.tecnico ? `<p><i class="fa-solid fa-user"></i> Técnico: ${maint.tecnico}</p>` : ''}
          ${maint.desc ? `<p><i class="fa-solid fa-info-circle"></i> ${maint.desc}</p>` : ''}
        </div>
        <div class="maintenance-actions">
          <button class="btn btn-sm btn-primary" onclick="addMaintenanceStep('${m.id}', ${maint.id})">
            <i class="fa-solid fa-plus"></i> Adicionar Passo
          </button>
          <button class="btn btn-sm btn-success" onclick="endMaintenance('${m.id}', ${maint.id})">
            <i class="fa-solid fa-check"></i> Finalizar
          </button>
        </div>
        ${maint.steps && maint.steps.length > 0 ? `
          <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--border);">
            <strong style="font-size: 12px; color: var(--text-secondary);">Passos:</strong>
            ${maint.steps.map(s => `
              <div style="font-size: 12px; margin-top: 8px;">
                <div style="color: var(--text-secondary);">${s.date}</div>
                <div style="color: var(--text);">${s.description}</div>
              </div>
            `).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function showStartMaintenanceModal() {
  const modalContent = `
    <div class="modal-header">
      <h2><i class="fa-solid fa-play"></i> Iniciar Manutenção</h2>
      <button class="modal-close" onclick="closeModal()">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="modal-body">
      <form id="startMaintenanceForm">
        <div class="form-group">
          <label class="form-label">Máquina:</label>
          <select class="form-select" name="tag" required>
            <option value="">Selecione...</option>
            ${machines.map(m => `<option value="${m.id}">${m.name} (${m.id})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Tipo de Serviço:</label>
          <input type="text" class="form-input" name="type" required placeholder="Ex: Manutenção Preventiva">
        </div>
        <div class="form-group">
          <label class="form-label">Técnico Responsável:</label>
          <input type="text" class="form-input" name="tecnico" placeholder="Nome do técnico">
        </div>
        <div class="form-group">
          <label class="form-label">Data de Início:</label>
          <input type="date" class="form-input" name="start_date" value="${new Date().toISOString().split('T')[0]}">
        </div>
        <div class="form-group">
          <label class="form-label">Observações:</label>
          <textarea class="form-textarea" name="desc" placeholder="Descreva o problema ou serviço a ser realizado"></textarea>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveStartMaintenance()">Iniciar</button>
    </div>
  `;

  showModal(modalContent);
}

async function saveStartMaintenance() {
  const form = document.getElementById('startMaintenanceForm');
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  try {
    const response = await apiCall(API_URL, 'POST', {
      action: 'start_maintenance',
      data: data
    });

    if (response.status === 'success') {
      showToast('Manutenção iniciada com sucesso!', 'success');
      closeModal();
      await loadMachines();
      renderMaintenanceGrid();
      updateDashboard();
    } else {
      showToast(response.message || 'Erro ao iniciar manutenção', 'error');
    }
  } catch (err) {
    console.error('Erro ao iniciar manutenção:', err);
    showToast('Erro ao iniciar manutenção', 'error');
  }
}

function addMaintenanceStep(machineId, maintId) {
  const modalContent = `
    <div class="modal-header">
      <h2><i class="fa-solid fa-plus"></i> Adicionar Passo</h2>
      <button class="modal-close" onclick="closeModal()">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="modal-body">
      <form id="addStepForm">
        <input type="hidden" name="maint_id" value="${maintId}">
        <div class="form-group">
          <label class="form-label">Descrição do Passo:</label>
          <textarea class="form-textarea" name="description" required placeholder="Descreva o que foi realizado"></textarea>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveMaintenanceStep()">Adicionar</button>
    </div>
  `;

  showModal(modalContent);
}

async function saveMaintenanceStep() {
  const form = document.getElementById('addStepForm');
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  try {
    const response = await apiCall(API_URL, 'PUT', {
      action: 'add_maint_step',
      data: data
    });

    if (response.status === 'success') {
      showToast('Passo adicionado com sucesso!', 'success');
      closeModal();
      await loadMachines();
      renderMaintenanceGrid();
    } else {
      showToast(response.message || 'Erro ao adicionar passo', 'error');
    }
  } catch (err) {
    console.error('Erro ao adicionar passo:', err);
    showToast('Erro ao adicionar passo', 'error');
  }
}

function endMaintenance(machineId, maintId) {
  const modalContent = `
    <div class="modal-header">
      <h2><i class="fa-solid fa-check"></i> Finalizar Manutenção</h2>
      <button class="modal-close" onclick="closeModal()">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="modal-body">
      <form id="endMaintenanceForm">
        <input type="hidden" name="tag" value="${machineId}">
        <input type="hidden" name="maint_id" value="${maintId}">
        <div class="form-group">
          <label class="form-label">Data de Término:</label>
          <input type="date" class="form-input" name="end_date" value="${new Date().toISOString().split('T')[0]}" required>
        </div>
        <div class="form-group">
          <label class="form-label">Custo Total (R$):</label>
          <input type="number" class="form-input" name="cost" step="0.01" min="0" placeholder="0.00">
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-success" onclick="saveEndMaintenance()">Finalizar</button>
    </div>
  `;

  showModal(modalContent);
}

async function saveEndMaintenance() {
  const form = document.getElementById('endMaintenanceForm');
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  try {
    const response = await apiCall(API_URL, 'PUT', {
      action: 'end_maintenance',
      data: data
    });

    if (response.status === 'success') {
      showToast('Manutenção finalizada com sucesso!', 'success');
      closeModal();
      await loadMachines();
      renderMaintenanceGrid();
      updateDashboard();
    } else {
      showToast(response.message || 'Erro ao finalizar manutenção', 'error');
    }
  } catch (err) {
    console.error('Erro ao finalizar manutenção:', err);
    showToast('Erro ao finalizar manutenção', 'error');
  }
}

// ====== AGENDAMENTOS ======
let currentDate = new Date();

function renderCalendar() {
  const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  
  document.getElementById('currentMonth').textContent = 
    `${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}`;

  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDay = firstDay.getDay();

  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = '';

  // Headers
  ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].forEach(day => {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day header';
    dayEl.textContent = day;
    grid.appendChild(dayEl);
  });

  // Empty days
  for (let i = 0; i < startDay; i++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    grid.appendChild(dayEl);
  }

  // Days
  const today = new Date();
  for (let day = 1; day <= daysInMonth; day++) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    dayEl.textContent = day;

    const currentDateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    
    // Check if today
    if (day === today.getDate() && 
        currentDate.getMonth() === today.getMonth() && 
        currentDate.getFullYear() === today.getFullYear()) {
      dayEl.classList.add('today');
    }

    // Check if has event
    const hasEvent = machines.some(m => m.nextMaint && m.nextMaint.date === currentDateStr);
    if (hasEvent) {
      dayEl.classList.add('has-event');
    }

    grid.appendChild(dayEl);
  }
}

function changeMonth(delta) {
  currentDate.setMonth(currentDate.getMonth() + delta);
  renderCalendar();
}

function renderScheduleList() {
  const container = document.getElementById('scheduleItems');
  const scheduled = machines
    .filter(m => m.nextMaint && m.nextMaint.date)
    .sort((a, b) => new Date(a.nextMaint.date) - new Date(b.nextMaint.date));

  if (scheduled.length === 0) {
    container.innerHTML = '<p class="no-data">Nenhum agendamento próximo</p>';
    return;
  }

  container.innerHTML = scheduled.map(m => {
    const date = new Date(m.nextMaint.date + 'T00:00:00');
    const day = date.getDate();
    const month = date.toLocaleDateString('pt-BR', { month: 'short' }).toUpperCase();
    
    return `
      <div class="schedule-item">
        <div class="schedule-date">
          <div class="day">${day}</div>
          <div class="month">${month}</div>
        </div>
        <div class="schedule-details">
          <h4>${m.name} (${m.id})</h4>
          <p>${m.nextMaint.desc || 'Manutenção agendada'}</p>
        </div>
      </div>
    `;
  }).join('');
}

function showAddScheduleModal() {
  const modalContent = `
    <div class="modal-header">
      <h2><i class="fa-solid fa-calendar-plus"></i> Novo Agendamento</h2>
      <button class="modal-close" onclick="closeModal()">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="modal-body">
      <form id="addScheduleForm">
        <div class="form-group">
          <label class="form-label">Máquina:</label>
          <select class="form-select" name="tag" required>
            <option value="">Selecione...</option>
            ${machines.map(m => `<option value="${m.id}">${m.name} (${m.id})</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Data:</label>
          <input type="date" class="form-input" name="date" required>
        </div>
        <div class="form-group">
          <label class="form-label">Descrição:</label>
          <textarea class="form-textarea" name="desc" placeholder="Descrição do agendamento"></textarea>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveSchedule()">Agendar</button>
    </div>
  `;

  showModal(modalContent);
}

async function saveSchedule() {
  const form = document.getElementById('addScheduleForm');
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  try {
    const response = await apiCall(API_URL, 'PUT', {
      action: 'update_field',
      tag: data.tag,
      field: 'nextMaint',
      value: JSON.stringify({ date: data.date, desc: data.desc })
    });

    if (response.status === 'success') {
      showToast('Agendamento criado com sucesso!', 'success');
      closeModal();
      await loadMachines();
      renderCalendar();
      renderScheduleList();
      updateDashboard();
    } else {
      showToast(response.message || 'Erro ao criar agendamento', 'error');
    }
  } catch (err) {
    console.error('Erro ao criar agendamento:', err);
    showToast('Erro ao criar agendamento', 'error');
  }
}

// ====== HISTÓRICO ======
function renderHistory() {
  const container = document.getElementById('historyTimeline');
  const filter = document.getElementById('historyMachineFilter');

  // Populate filter
  if (filter && filter.options.length === 1) {
    machines.forEach(m => {
      const option = document.createElement('option');
      option.value = m.id;
      option.textContent = `${m.name} (${m.id})`;
      filter.appendChild(option);
    });
  }

  const selectedMachine = filter?.value;
  let allHistory = [];

  machines.forEach(m => {
    if (!selectedMachine || m.id === selectedMachine) {
      if (m.history) {
        m.history.forEach(h => {
          allHistory.push({
            machine: m,
            date: h.date,
            text: h.text
          });
        });
      }
    }
  });

  // Sort by date (newest first)
  allHistory.sort((a, b) => {
    const dateA = parseHistoryDate(a.date);
    const dateB = parseHistoryDate(b.date);
    return dateB - dateA;
  });

  if (allHistory.length === 0) {
    container.innerHTML = '<p class="no-data">Nenhum histórico encontrado</p>';
    return;
  }

  container.innerHTML = allHistory.map(h => `
    <div class="timeline-item">
      <div class="timeline-date">
        <i class="fa-solid fa-clock"></i> ${h.date}
      </div>
      <div class="timeline-content">
        ${h.text}
        <span class="timeline-machine">${h.machine.name} (${h.machine.id})</span>
      </div>
    </div>
  `).join('');
}

function parseHistoryDate(dateStr) {
  // Parse "DD/MM/YYYY HH:MM:SS" format
  const parts = dateStr.split(' ');
  const dateParts = parts[0].split('/');
  const timeParts = parts[1] ? parts[1].split(':') : [0, 0, 0];
  return new Date(
    parseInt(dateParts[2]),
    parseInt(dateParts[1]) - 1,
    parseInt(dateParts[0]),
    parseInt(timeParts[0]),
    parseInt(timeParts[1]),
    parseInt(timeParts[2])
  );
}

// ====== USUÁRIOS ======
async function loadUsers() {
  // This would require an API endpoint to list users
  // For now, show placeholder
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = `
    <tr>
      <td>admin</td>
      <td>Administrador</td>
      <td><span class="status-badge status-ok">Admin</span></td>
      <td>${new Date().toLocaleDateString('pt-BR')}</td>
      <td>
        <div class="action-btns">
          <button class="icon-btn view" title="Ver detalhes">
            <i class="fa-solid fa-eye"></i>
          </button>
        </div>
      </td>
    </tr>
  `;
}

function showAddUserModal() {
  const modalContent = `
    <div class="modal-header">
      <h2><i class="fa-solid fa-user-plus"></i> Adicionar Usuário</h2>
      <button class="modal-close" onclick="closeModal()">
        <i class="fa-solid fa-xmark"></i>
      </button>
    </div>
    <div class="modal-body">
      <form id="addUserForm">
        <div class="form-group">
          <label class="form-label">Usuário:</label>
          <input type="text" class="form-input" name="username" required>
        </div>
        <div class="form-group">
          <label class="form-label">Nome Completo:</label>
          <input type="text" class="form-input" name="name" required>
        </div>
        <div class="form-group">
          <label class="form-label">Senha:</label>
          <input type="password" class="form-input" name="password" required>
        </div>
        <div class="form-group">
          <label class="form-label">Função:</label>
          <select class="form-select" name="role" required>
            <option value="user">Usuário</option>
            <option value="lider">Líder</option>
            <option value="admin">Administrador</option>
          </select>
        </div>
      </form>
    </div>
    <div class="modal-footer">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" onclick="saveAddUser()">Adicionar</button>
    </div>
  `;

  showModal(modalContent);
}

async function saveAddUser() {
  const form = document.getElementById('addUserForm');
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  try {
    const response = await apiCall(API_URL, 'POST', {
      action: 'create_user',
      data: data
    });

    if (response.status === 'success') {
      showToast('Usuário criado com sucesso!', 'success');
      closeModal();
      loadUsers();
    } else {
      showToast(response.message || 'Erro ao criar usuário', 'error');
    }
  } catch (err) {
    console.error('Erro ao criar usuário:', err);
    showToast('Erro ao criar usuário', 'error');
  }
}

// ====== RELATÓRIOS ======
function generateReport(type) {
  showToast('Funcionalidade de relatórios em desenvolvimento', 'info');
}

// ====== GRÁFICOS ======
let statusChart = null;
let maintenanceChart = null;

function initCharts() {
  initStatusChart();
  initMaintenanceChart();
}

function initStatusChart() {
  const ctx = document.getElementById('statusChart');
  if (!ctx) return;

  const statusCounts = {
    'OK': 0,
    'EM OPERAÇÃO': 0,
    'EM MANUTENÇÃO': 0,
    'INOPERANTE': 0,
    'ESPERANDO PEÇAS': 0,
    'HORAS EXCEDENTES': 0
  };

  machines.forEach(m => {
    if (statusCounts.hasOwnProperty(m.status)) {
      statusCounts[m.status]++;
    }
  });

  if (statusChart) {
    statusChart.destroy();
  }

  statusChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: Object.keys(statusCounts),
      datasets: [{
        data: Object.values(statusCounts),
        backgroundColor: [
          '#10b981',
          '#8b5cf6',
          '#f59e0b',
          '#ef4444',
          '#f59e0b',
          '#f59e0b'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

function initMaintenanceChart() {
  const ctx = document.getElementById('maintenanceChart');
  if (!ctx) return;

  // Mock data for now
  const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun'];
  const data = [5, 8, 6, 10, 7, 9];

  if (maintenanceChart) {
    maintenanceChart.destroy();
  }

  maintenanceChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: months,
      datasets: [{
        label: 'Manutenções',
        data: data,
        backgroundColor: '#3b82f6',
        borderRadius: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 2
          }
        }
      }
    }
  });
}

// ====== MODAL ======
function showModal(content) {
  const modal = document.getElementById('modal');
  const modalContent = document.getElementById('modalContent');
  modalContent.innerHTML = content;
  modal.classList.add('active');
}

function closeModal() {
  const modal = document.getElementById('modal');
  modal.classList.remove('active');
}

// ====== TOAST ======
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? 'circle-check' :
               type === 'error' ? 'circle-exclamation' :
               type === 'warning' ? 'triangle-exclamation' : 'info-circle';
  
  toast.innerHTML = `
    <i class="fa-solid fa-${icon}"></i>
    <span class="toast-message">${message}</span>
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOutRight 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ====== HELPERS ======
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('pt-BR');
}
