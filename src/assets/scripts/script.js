document.addEventListener('DOMContentLoaded', () => {

    // ======== CONFIG / AUTENTICAÇÃO ========
    const API_URL = '/MCSRC/backend/api.php';
    const STATUS = ["OK", "EM OPERAÇÃO", "EM MANUTENÇÃO", "INOPERANTE", "ESPERANDO PEÇAS", "HORAS EXCEDENTES"];

    // Ler token/role do localStorage
    const getToken = () => localStorage.getItem('maintControl_token');
    const getRole = () => localStorage.getItem('maintControl_role') || 'user';
    const getSessionFlag = () => localStorage.getItem('maintControl_session') === 'true';
    const getUserName = () => localStorage.getItem('maintControl_user') || '';

    // Redireciona para login se não autenticado
    if (!getSessionFlag() || !getToken()) {
        window.location.href = '../public/pages/login/login.html';
        return;
    }

    // ======== ESTADO GLOBAL ========
    let state = {
        machines: [],
        search: '',
        filter: 'all',
        sortBy: 'id',
        sortDir: 'asc',
        page: 1,
        pageSize: 8,
        editingIndex: null
    };

    // ======== UTILITÁRIOS ========
    const notify = (text, type = 'info') => {
        const toasts = document.getElementById('toasts');
        if (!toasts) return;
        const d = document.createElement('div');
        d.className = `toast ${type}`;
        d.textContent = text;
        toasts.appendChild(d);
        setTimeout(() => d.remove(), 3500);
    };

    const escapeHtml = (str) => {
        if (str === null || str === undefined) return '';
        return String(str).replace(/[&<>"']/g, (match) => {
            const escape = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
            return escape[match];
        });
    };

    // ======== DOM ELEMENTS ========
    const DOMElements = {
        tbody: document.querySelector('#machinesTable tbody'),
        tableOverlay: document.getElementById('table-overlay'),
        searchEl: document.getElementById('search'),
        filterEl: document.getElementById('filterStatus'),
        totalCount: document.getElementById('totalCount'),
        metricTotal: document.getElementById('metricTotalDisplay'),
        metricOp: document.getElementById('metricOpDisplay'),
        metricMaint: document.getElementById('metricMaintDisplay'),
        metricInop: document.getElementById('metricInopDisplay'),
        metricNextMaint: document.getElementById('metricNextMaintDisplay'),
        metricQtyTotal: document.getElementById('metricQtyTotalDisplay'),
        metricActiveMaint: document.getElementById('metricActiveMaintDisplay'),
        metricDoneMaint: document.getElementById('metricDoneMaintDisplay'),
        pager: document.getElementById('pager'),
        showingRange: document.getElementById('showingRange'),
        backdrop: document.getElementById('modalBackdrop'),
        modalTitle: document.getElementById('modalTitle'),
        modalAlert: document.getElementById('modalAlert'),
        mId: document.getElementById('mId'),
        mName: document.getElementById('mName'),
        mCap: document.getElementById('mCap'),
        mFab: document.getElementById('mFab'),
        mQtd: document.getElementById('mQtd'),
        mStatus: document.getElementById('mStatus'),
        historyList: document.getElementById('historyList'),
        tabMaintenance: document.getElementById('tabMaintenance'),
        tabSchedule: document.getElementById('tabSchedule'),
        machineForm: document.getElementById('machineForm'),
        // user display (must exist in index.html)
        currentUserEl: document.getElementById('currentUser'),
        currentRoleEl: document.getElementById('currentRole')
    };

    // ======== AUTENTICAÇÃO / REQUISIÇÕES ========
    const sendApiRequest = async (url, method, data = null) => {
        const token = getToken();
        const options = { method, headers: { 'Content-Type': 'application/json' } };
        if (token) options.headers['Authorization'] = 'Bearer ' + token;
        if (data) options.body = JSON.stringify(data);

        try {
            const response = await fetch(url, options);

            if (response.status === 401) {
                // Sessão inválida/expirada
                notify('Sessão expirada. Redirecionando para login...', 'error');
                localStorage.removeItem('maintControl_session');
                localStorage.removeItem('maintControl_user');
                localStorage.removeItem('maintControl_role');
                localStorage.removeItem('maintControl_token');
                setTimeout(() => window.location.href = '../public/pages/login/login.html', 1000);
                throw new Error('Não autenticado');
            }

            const jsonResponse = await response.json().catch(() => ({ status: 'error', message: 'Resposta inválida do servidor.' }));

            if (!response.ok || jsonResponse.status === 'error') {
                const errorMsg = jsonResponse.message || 'Erro de rede desconhecido.';
                notify(`Falha na operação: ${errorMsg}`, 'error');
                throw new Error(errorMsg);
            }
            return jsonResponse;
        } catch (e) {
            if (e.message && e.message.startsWith("Failed to fetch")) {
                notify("Falha de conexão com o servidor. Verifique o API_URL.", 'error');
            }
            throw e;
        }
    };

    // ======== LOGOUT ========
    const logoutSystem = async () => {
        try {
            await sendApiRequest(API_URL, 'POST', { action: 'logout' });
        } catch (e) {
            // ignore
        }
        localStorage.removeItem('maintControl_session');
        localStorage.removeItem('maintControl_user');
        localStorage.removeItem('maintControl_role');
        localStorage.removeItem('maintControl_token');
        updateUserDisplay();
        window.location.href = '../public/pages/login/login.html';
    };

    // ======== USER DISPLAY ========
    function updateUserDisplay() {
        const user = getUserName();
        const role = getRole();
        if (DOMElements.currentUserEl) DOMElements.currentUserEl.textContent = user || '—';
        if (DOMElements.currentRoleEl) DOMElements.currentRoleEl.textContent = role ? role.toUpperCase() : '—';
    }

    // ======== MODAL DE CONFIRMAÇÃO ========
    const confirmModal = {
        backdrop: document.getElementById('confirmModalBackdrop'),
        title: document.getElementById('confirmTitle'),
        message: document.getElementById('confirmMessage'),
        btnOk: document.getElementById('confirmBtnOk'),
        btnCancel: document.getElementById('confirmBtnCancel'),
        icon: document.getElementById('confirmIcon'),
        onConfirm: null
    };

    const showConfirm = (title, message, onConfirm, type = 'danger') => {
        if (!confirmModal.backdrop) return;
        confirmModal.title.textContent = title;
        confirmModal.message.textContent = message;
        confirmModal.onConfirm = onConfirm;
        confirmModal.icon.className = 'icon';
        confirmModal.btnOk.className = 'btn';
        if (type === 'danger') {
            confirmModal.icon.classList.add('danger');
            confirmModal.icon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
            confirmModal.btnOk.classList.add('btn-confirm');
            confirmModal.btnOk.textContent = 'Sim, Excluir';
        } else {
            confirmModal.icon.classList.add('warning');
            confirmModal.icon.innerHTML = '<i class="fa-solid fa-question-circle"></i>';
            confirmModal.btnOk.classList.add('btn');
            confirmModal.btnOk.textContent = 'Sim';
        }
        confirmModal.backdrop.classList.add('show');
    };

    const hideConfirm = () => {
        if (!confirmModal.backdrop) return;
        confirmModal.backdrop.classList.remove('show');
        confirmModal.onConfirm = null;
    };

    if (confirmModal.btnOk) confirmModal.btnOk.addEventListener('click', () => { if (confirmModal.onConfirm) confirmModal.onConfirm(); hideConfirm(); });
    if (confirmModal.btnCancel) confirmModal.btnCancel.addEventListener('click', hideConfirm);
    if (confirmModal.backdrop) confirmModal.backdrop.addEventListener('click', (e) => { if (e.target === confirmModal.backdrop) hideConfirm(); });

    // ======== CARREGAR / SALVAR DADOS ========
    const loadState = async () => {
        if (DOMElements.tableOverlay) {
            DOMElements.tableOverlay.innerHTML = '<div class="loader-spinner"></div><p>Carregando dados...</p>';
            DOMElements.tableOverlay.classList.remove('hidden');
        }
        try {
            const data = await sendApiRequest(API_URL, 'GET');
            if (data.status === 'success' && Array.isArray(data.machines)) {
                state.machines = data.machines.map(m => {
                    m.maintenance = m.maintenance || [];
                    m.maintenance = m.maintenance.map(maint => {
                        maint.steps = maint.steps || [];
                        maint.id = maint.id || Date.now();
                        maint.tecnico = maint.tecnico || 'N/A';
                        maint.cost = maint.cost || null;
                        return maint;
                    });
                    m.history = m.history || [];
                    m.nextMaint = m.nextMaint || null;
                    m.quantity = Number(m.quantity) || 0;
                    return m;
                });
            } else {
                notify(`Erro ao carregar dados: ${data.message || 'Formato de dados inválido.'}`, 'error');
                state.machines = [];
            }
        } catch (e) {
            console.error("Falha ao carregar dados do banco de dados", e);
            state.machines = [];
        } finally {
            if (DOMElements.tableOverlay) DOMElements.tableOverlay.classList.add('hidden');
        }
    };

    const updateMachineField = async (machine, field, value) => {
        const apiData = { action: 'update_field', tag: machine.id, field: field, value: value };
        try {
            await sendApiRequest(API_URL, 'PUT', apiData);
            machine[field] = value;
            return true;
        } catch (e) {
            return false;
        }
    };

    const addHistory = async (machine, text) => {
        if (!machine) return;
        const historyEntry = { tag: machine.id, description: text };
        try {
            await sendApiRequest(API_URL, 'POST', { action: 'add_history', data: historyEntry });
            machine.history = machine.history || [];
            machine.history.push({ date: new Date().toLocaleString('pt-BR'), text });
        } catch (e) {
            console.error("Falha ao salvar histórico:", e);
        }
    };

    // ======== ALERTA DE MANUTENÇÃO ========
    const getMaintAlertStatus = (machine) => {
        if (!machine.nextMaint || !machine.nextMaint.date) return null;
        const today = new Date();
        today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
        const todayStr = today.toISOString().slice(0, 10);
        const maintDate = machine.nextMaint.date;
        if (maintDate < todayStr) return { type: 'danger', text: 'MANUTENÇÃO ATRASADA!' };
        if (maintDate === todayStr) return { type: 'warning', text: 'Manutenção agendada para HOJE.' };
        return null;
    };

    // ======== RENDERIZAÇÃO ========
    const populateFilter = () => {
        if (!DOMElements.filterEl) return;
        DOMElements.filterEl.innerHTML = '<option value="all">Todos</option>';
        STATUS.forEach(s => {
            const option = document.createElement('option');
            option.value = s;
            option.textContent = s;
            DOMElements.filterEl.appendChild(option);
        });
    };

    const getProcessedItems = () => {
        return state.machines
            .filter(m => (state.filter === 'all' || m.status === state.filter))
            .filter(m => {
                const q = state.search.trim().toLowerCase();
                if (!q) return true;
                return ['id', 'name', 'manufacturer'].some(field => (m[field] || '').toString().toLowerCase().includes(q));
            })
            .sort((a, b) => {
                if (state.sortBy === 'quantity') {
                    const A = a.quantity || 0;
                    const B = b.quantity || 0;
                    return state.sortDir === 'asc' ? A - B : B - A;
                }
                const A = (a[state.sortBy] || '').toString().toLowerCase();
                const B = (b[state.sortBy] || '').toString().toLowerCase();
                if (A < B) return state.sortDir === 'asc' ? -1 : 1;
                if (A > B) return state.sortDir === 'asc' ? 1 : -1;
                return 0;
            });
    };

    const renderTable = (items) => {
        if (!DOMElements.tbody) return;
        DOMElements.tbody.innerHTML = '';

        if (items.length === 0) {
            if (DOMElements.tableOverlay) {
                const emptyIcon = state.filter !== 'all' || state.search ? 'fa-solid fa-magnifying-glass' : 'fa-solid fa-box-open';
                const emptyTitle = state.filter !== 'all' || state.search ? 'Nenhum Resultado' : 'Nenhuma Máquina';
                const emptyText = state.filter !== 'all' || state.search ? 'Tente ajustar sua busca ou filtros.' : 'Adicione sua primeira máquina no painel ao lado.';
                DOMElements.tableOverlay.innerHTML = `
                    <div class="empty-state">
                        <i class="${emptyIcon}"></i>
                        <h4>${emptyTitle}</h4>
                        <p>${emptyText}</p>
                    </div>
                `;
                DOMElements.tableOverlay.classList.remove('hidden');
            }
            return;
        }

        if (DOMElements.tableOverlay) DOMElements.tableOverlay.classList.add('hidden');

        const currentRole = getRole();

        items.forEach(m => {
            const indexInState = state.machines.findIndex(x => x.id === m.id);
            const tr = document.createElement('tr');
            tr.className = 'row';

            const alertStatus = getMaintAlertStatus(m);
            let alertBadgeHTML = '';
            if (alertStatus) alertBadgeHTML = `<span class="maint-alert-badge ${alertStatus.type}" title="${alertStatus.text}"></span>`;

            const editable = currentRole === 'admin' ? 'contenteditable="true"' : '';
            const statusOptions = STATUS.map(s => `<option value="${s}" ${m.status === s ? 'selected' : ''}>${s}</option>`).join('');
            const deleteButtonHTML = currentRole === 'admin' ? `<button class="btn secondary btn-delete" data-idx="${indexInState}" title="Excluir"><i class="fa-solid fa-trash"></i></button>` : '';

            tr.innerHTML = `
                <td>${escapeHtml(m.id)}</td>
                <td ${editable} data-field="name" data-idx="${indexInState}" class="editable" style="display:flex; align-items:center;">
                    ${alertBadgeHTML}
                    <span>${escapeHtml(m.name)}</span>
                </td>
                <td ${editable} data-field="capacity" data-idx="${indexInState}" class="editable">${escapeHtml(m.capacity || '')}</td>
                <td ${editable} data-field="manufacturer" data-idx="${indexInState}" class="editable">${escapeHtml(m.manufacturer || '')}</td>
                <td ${editable} data-field="quantity" data-idx="${indexInState}" class="editable" title="Horas de Uso. Clique para editar ou use o modal.">
                    ${m.quantity}
                </td>
                <td><select data-idx="${indexInState}" class="statusSel">${statusOptions}</select></td>
                <td class="actions">
                    <button class="btn secondary btn-view" data-idx="${indexInState}" title="Ver Detalhes"><i class="fa-solid fa-eye"></i></button>
                    ${deleteButtonHTML}
                </td>
            `;
            DOMElements.tbody.appendChild(tr);
        });
        addDynamicTableEventListeners();
    };

    const updateMetrics = () => {
        if (!DOMElements.metricTotal) return;
        const total = state.machines.length;
        const qtyTotal = state.machines.reduce((acc, m) => acc + (m.quantity || 0), 0);

        const today = new Date();
        today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
        const todayStr = today.toISOString().slice(0, 10);
        const date30DaysAgo = new Date(new Date().setDate(today.getDate() - 30));
        const date30DaysAgoStr = date30DaysAgo.toISOString().slice(0, 10);
        const next30Days = new Date(new Date().setDate(today.getDate() + 30));
        const next30DaysStr = next30Days.toISOString().slice(0, 10);

        let upcomingMaint = 0;
        let activeMaintCount = 0;
        let completedLast30dCount = 0;

        state.machines.forEach(m => {
            if (m.nextMaint && m.nextMaint.date) {
                const maintDate = m.nextMaint.date;
                if (maintDate >= todayStr && maintDate <= next30DaysStr) upcomingMaint++;
            }
            (m.maintenance || []).forEach(maint => {
                if (!maint.end_date) activeMaintCount++;
                else if (maint.end_date >= date30DaysAgoStr) completedLast30dCount++;
            });
        });

        DOMElements.totalCount.textContent = total;
        DOMElements.metricTotal.textContent = total;
        DOMElements.metricOp.textContent = state.machines.filter(m => m.status === 'EM OPERAÇÃO').length;
        DOMElements.metricMaint.textContent = state.machines.filter(m => m.status === 'EM MANUTENÇÃO').length;
        DOMElements.metricInop.textContent = state.machines.filter(m => m.status === 'INOPERANTE').length;
        DOMElements.metricQtyTotal.textContent = qtyTotal;
        DOMElements.metricNextMaint.textContent = upcomingMaint;
        DOMElements.metricActiveMaint.textContent = activeMaintCount;
        DOMElements.metricDoneMaint.textContent = completedLast30dCount;
    };

    const renderPager = (pages) => {
        if (!DOMElements.pager) return;
        DOMElements.pager.innerHTML = '';
        if (pages <= 1) return;
        for (let p = 1; p <= pages; p++) {
            const btn = document.createElement('button');
            btn.className = `page-btn ${p === state.page ? 'active' : ''}`;
            btn.textContent = p;
            btn.addEventListener('click', () => { state.page = p; render(); });
            DOMElements.pager.appendChild(btn);
        }
    };

    const updateShowingRange = (total, start, pagedLength) => {
        if (!DOMElements.showingRange) return;
        const startNum = total === 0 ? 0 : start + 1;
        const endNum = Math.min(start + pagedLength, total);
        DOMElements.showingRange.innerHTML = `<b>${startNum}-${endNum}</b> de <b>${total}</b>`;
    };

    // ======== RENDER PRINCIPAL ========
    const render = () => {
        const filtered = getProcessedItems();
        const total = filtered.length;
        const totalPages = Math.ceil(total / state.pageSize);
        
        if (state.page > totalPages && totalPages > 0) state.page = totalPages;
        if (state.page < 1) state.page = 1;

        const start = (state.page - 1) * state.pageSize;
        const paged = filtered.slice(start, start + state.pageSize);

        renderTable(paged);
        renderPager(totalPages);
        updateShowingRange(total, start, paged.length);
        updateMetrics();
        renderStatusTable();
    };

    // ======== MODAL ========
    const openModal = (index) => {
        state.editingIndex = Number(index);
        const m = state.machines[index];
        if (!m) return;

        if (DOMElements.modalAlert) {
            DOMElements.modalAlert.style.display = 'none';
            DOMElements.modalAlert.className = 'modal-alert';
        }

        const alertStatus = getMaintAlertStatus(m);
        if (alertStatus && DOMElements.modalAlert) {
            DOMElements.modalAlert.textContent = alertStatus.text;
            DOMElements.modalAlert.classList.add(alertStatus.type);
            DOMElements.modalAlert.style.display = 'block';
        }

        if (DOMElements.modalTitle) DOMElements.modalTitle.textContent = `Detalhes — ${m.name}`;
        if (DOMElements.mId) DOMElements.mId.textContent = m.id;
        if (DOMElements.mName) DOMElements.mName.textContent = m.name;
        if (DOMElements.mCap) DOMElements.mCap.textContent = m.capacity || '-';
        if (DOMElements.mFab) DOMElements.mFab.textContent = m.manufacturer || '-';
        if (DOMElements.mQtd) DOMElements.mQtd.textContent = m.quantity || 0;
        if (DOMElements.mStatus) {
            DOMElements.mStatus.textContent = m.status;
            DOMElements.mStatus.className = `pill ${getStatusClass(m.status)}`;
        }

        renderMaintenanceTab();
        renderHistoryTab();
        renderScheduleTab();

        const logHoursForm = document.getElementById('logHoursForm');
        if (logHoursForm) {
            logHoursForm.onsubmit = async (e) => {
                e.preventDefault();
                const hoursInput = document.getElementById('hoursToAdd');
                const reasonInput = document.getElementById('hoursReason');
                const hoursToAdd = Number(hoursInput.value);
                const reason = reasonInput.value.trim();
                if (hoursToAdd <= 0 || !reason) { notify('Informe horas válidas e um motivo.', 'error'); return; }
                const currentHours = m.quantity || 0;
                const newHours = currentHours + hoursToAdd;
                if (await updateMachineField(m, 'quantity', newHours)) {
                    await addHistory(m, `Registrado ${hoursToAdd}h de uso. Motivo: ${reason}. (Total: ${newHours}h)`);
                    notify('Horas registradas com sucesso!', 'success');
                    if (DOMElements.mQtd) DOMElements.mQtd.textContent = newHours;
                    hoursInput.value = 1;
                    reasonInput.value = '';
                    render();
                }
            };
        }

        if (DOMElements.backdrop) DOMElements.backdrop.classList.add('show');
        const viewTab = document.querySelector('.tab[data-tab="view"]');
        if (viewTab) viewTab.click();
    };

    const closeModal = () => {
        if (DOMElements.backdrop) DOMElements.backdrop.classList.remove('show');
        state.editingIndex = null;
    };

    // ======== MANUTENÇÃO ========
    const renderMaintenanceTab = () => {
        const machine = state.machines[state.editingIndex];
        if (!machine || !DOMElements.tabMaintenance) return;
        const allMaintRecords = (machine.maintenance || []).slice().sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
        const activeMaint = allMaintRecords.find(m => !m.end_date);
        const pastMaint = allMaintRecords.filter(m => m.end_date);

        let content = '';
        const currentRole = getRole();

        if (!activeMaint && (currentRole === 'admin' || currentRole === 'lider')) {
            content += `
                <form id="maintFormNew">
                    <h4><i class="fa-solid fa-plus-circle"></i> Iniciar Nova Manutenção</h4>
                    <div class="add-form" style="grid-template-columns: 1fr 1fr; gap: 10px;">
                        <div>
                            <label>Tipo de intervenção</label>
                            <select id="maintType"><option value="Preventiva">Preventiva</option><option value="Corretiva">Corretiva</option></select>
                        </div>
                        <div>
                            <label>Técnico Responsável</label>
                            <input id="maintTecnico" type="text" placeholder="Nome do técnico" required />
                        </div>
                        <div style="grid-column: 1 / -1;">
                            <label>Data de Início</label>
                            <input id="maintStartDate" type="date" value="${new Date().toISOString().slice(0, 10)}" required />
                        </div>
                        <div style="grid-column: 1 / -1;">
                            <label>Descrição do Problema/Serviço</label>
                            <textarea id="maintDesc" rows="2" placeholder="Descreva o que será feito..." required></textarea>
                        </div>
                    </div>
                    <div style="display:flex;gap:8px;margin-top:12px">
                        <button class="btn" type="submit"><i class="fa-solid fa-screwdriver-wrench"></i> Iniciar Manutenção</button>
                    </div>
                </form>
                <div class="separator"></div>
            `;
        } else if (!activeMaint) {
            content += `<p>Você não tem permissão para iniciar uma nova manutenção.</p><div class="separator"></div>`;
        }

        content += `<h4>Histórico de Manutenções (${allMaintRecords.length})</h4>`;
        content += '<div class="accordion-maint">';
        if (activeMaint) content += renderMaintAccordionItem(activeMaint, true);
        if (pastMaint.length > 0) pastMaint.forEach(maint => content += renderMaintAccordionItem(maint, false));
        else if (!activeMaint) content += '<p>Nenhum registro de manutenção encontrado.</p>';
        content += '</div>';
        DOMElements.tabMaintenance.innerHTML = content;
        addMaintenanceEventListeners();
    };

    const renderMaintAccordionItem = (maint, isOpen) => {
        const isActive = !maint.end_date;
        const steps = maint.steps || [];
        const currentRole = getRole();

        let costDisplay = 'N/A';
        if (maint.cost !== null && maint.cost > 0) costDisplay = `R$ ${parseFloat(maint.cost).toFixed(2).replace('.', ',')}`;
        else if (isActive) costDisplay = 'Pendente';

        const endButton = isActive && (currentRole === 'admin' || currentRole === 'lider') ?
            `<button id="endMaint" class="btn" type="button" data-maint-id="${maint.id}"><i class="fa-solid fa-check"></i> Finalizar Manutenção</button>` : '';

        const stepForm = isActive ? `
            <form id="maintFormStep" style="padding: 16px; border-top: 1px solid var(--border-color);">
                <label>Adicionar Etapa/Ação</label>
                <textarea id="stepDesc" rows="2" placeholder="Ex: Troca da Correia A30..." required></textarea>
                <div style="display:flex;gap:8px;margin-top:12px">
                    <button class="btn secondary" type="submit"><i class="fa-solid fa-plus"></i> Registrar Etapa</button>
                    ${endButton}
                </div>
            </form>
        ` : '';

        return `
<details ${isOpen ? 'open' : ''}>
    <summary>
        <div>
            <strong>${maint.type}</strong> (${isActive ? 'Em Andamento' : 'Concluída'})
            <div class="small">${formatDate(maint.start_date)} ${maint.end_date ? ' - ' + formatDate(maint.end_date) : ''}</div>
        </div>
        ${isActive ? '<span class="pill maint" style="padding: 5px 10px; font-size: 10px;">ATIVA</span>' : ''}
    </summary>

    <div class="maint-details-grid">
        <p><strong>Descrição Inicial</strong> ${escapeHtml(maint.desc)}</p>
        <p><strong>Técnico</strong> ${escapeHtml(maint.tecnico)}</p>
        <p><strong>Custo Total</strong> ${costDisplay}</p>
    </div>

    ${stepForm}

    <h5 style="padding: 16px 16px 0; margin:0; border-top: 1px solid var(--border-color);">Etapas Executadas (${steps.length})</h5>
    <ul class="maint-steps-list">
        ${steps.length > 0 ? steps.map(s => `<li><span class="small">${s.date}</span><p>${escapeHtml(s.description)}</p></li>`).join('') : '<li>Nenhuma etapa registrada.</li>'}
    </ul>
</details>
        `;
    };

    const renderScheduleTab = () => {
        const machine = state.machines[state.editingIndex];
        if (!machine) return;
        const display = document.getElementById('nextMaintDisplay');
        const dateInput = document.getElementById('nextMaintDate');
        const descTextarea = document.getElementById('nextMaintDesc');
        const scheduleForm = document.getElementById('scheduleForm');
        const clearBtn = document.getElementById('clearSchedule');
        const startBtn = document.getElementById('startScheduleBtn');

        if (machine.nextMaint && machine.nextMaint.date) {
            if (display) display.innerHTML = `${formatDate(machine.nextMaint.date)} (${escapeHtml(machine.nextMaint.desc)})`;
            if (dateInput) dateInput.value = machine.nextMaint.date;
            if (descTextarea) descTextarea.value = machine.nextMaint.desc;
            if (startBtn) startBtn.style.display = 'inline-flex';
        } else {
            if (display) display.textContent = 'N/A';
            if (dateInput) dateInput.value = '';
            if (descTextarea) descTextarea.value = '';
            if (startBtn) startBtn.style.display = 'none';
        }

        if (scheduleForm) scheduleForm.onsubmit = async (e) => {
            e.preventDefault();
            const date = dateInput.value;
            const desc = descTextarea.value.trim();
            if (!date) { notify('A data de agendamento é obrigatória.', 'error'); return; }
            const newMaint = { date, desc };
            if (await updateMachineField(machine, 'nextMaint', JSON.stringify(newMaint))) {
                machine.nextMaint = newMaint;
                await addHistory(machine, `Próxima manutenção agendada para: ${formatDate(date)}`);
                notify('Agendamento salvo!', 'success');
                renderScheduleTab();
                render();
                openModal(state.editingIndex);
            }
        };

        if (clearBtn) clearBtn.onclick = async () => {
            if (!machine.nextMaint) return;
            if (await updateMachineField(machine, 'nextMaint', null)) {
                machine.nextMaint = null;
                await addHistory(machine, `Agendamento de próxima manutenção cancelado.`);
                notify('Agendamento cancelado.', 'info');
                renderScheduleTab();
                render();
                openModal(state.editingIndex);
            }
        };

        if (startBtn) startBtn.onclick = async () => {
            const i = state.editingIndex;
            const machine = state.machines[i];
            if (!machine.nextMaint) { notify('Nenhum agendamento para iniciar.', 'error'); return; }
            const activeMaint = (machine.maintenance || []).find(m => !m.end_date);
            if (activeMaint) { notify('Já existe uma manutenção ativa. Finalize-a antes de iniciar a agendada.', 'error'); return; }

            showConfirm(
                'Iniciar Manutenção?',
                'Deseja iniciar a manutenção agendada agora? O status da máquina será alterado para "EM MANUTENÇÃO".',
                async () => {
                    const schedule = machine.nextMaint;
                    const newMaintData = {
                        tag: machine.id,
                        type: 'Preventiva',
                        desc: schedule.desc || 'Manutenção Agendada',
                        start_date: new Date().toISOString().slice(0, 10),
                        tecnico: 'Agendado'
                    };

                    try {
                        const apiResponse = await sendApiRequest(API_URL, 'POST', { action: 'start_maintenance', data: newMaintData });
                        const newMaintId = apiResponse.maint_id;
                        machine.maintenance = machine.maintenance || [];
                        machine.maintenance.push({
                            id: newMaintId,
                            type: newMaintData.type,
                            desc: newMaintData.desc,
                            start_date: newMaintData.start_date,
                            tecnico: newMaintData.tecnico,
                            cost: null,
                            end_date: null,
                            steps: []
                        });

                        await addHistory(machine, `Manutenção (Agendada) INICIADA. Motivo: ${newMaintData.desc}`);
                        await updateMachineField(machine, 'nextMaint', null);

                        if (await updateMachineField(machine, 'status', 'EM MANUTENÇÃO')) {
                            notify('Manutenção agendada iniciada com sucesso!', 'success');
                            render();
                            openModal(i);
                            const maintTab = document.querySelector('.tab[data-tab="maintenance"]');
                            if (maintTab) maintTab.click();
                        }
                    } catch (e) {
                        console.error("Falha ao iniciar manutenção agendada:", e);
                        notify('Erro ao iniciar manutenção.', 'error');
                    }
                },
                'warning'
            );
        };
    };

    const renderHistoryTab = () => {
        const machine = state.machines[state.editingIndex];
        if (!DOMElements.historyList) return;
        DOMElements.historyList.innerHTML = (machine.history || []).slice().reverse().map(h =>
            `<li><span class="small">${h.date}</span><p style="margin:2px 0 10px">${escapeHtml(h.text)}</p></li>`
        ).join('') || '<li>Nenhum histórico registrado.</li>';
    };

    const renderStatusTable = () => {
        const tbody = document.getElementById('statusSummaryBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const total = state.machines.length;
        const counts = STATUS.reduce((acc, s) => { acc[s] = 0; return acc; }, {});
        state.machines.forEach(m => { counts[m.status] = (counts[m.status] || 0) + 1; });

        const colorMap = {
            "OK": 'bar-ok', "EM OPERAÇÃO": 'bar-op', "EM MANUTENÇÃO": 'bar-maint',
            "INOPERANTE": 'bar-inop', "ESPERANDO PEÇAS": 'bar-wait', "HORAS EXCEDENTES": 'bar-exc'
        };

        STATUS.forEach(status => {
            const count = counts[status] || 0;
            const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
            const barClass = colorMap[status] || 'bar-ok';
            const tr = document.createElement('tr');
            tr.className = 'row';
            tr.style.cursor = 'pointer';
            tr.onclick = () => {
                state.filter = status;
                if (DOMElements.filterEl) DOMElements.filterEl.value = status;
                state.page = 1;
                render();
            };
            tr.innerHTML = `
                <td><span class="pill ${getStatusClass(status)}" style="font-size: 11px;">${status}</span></td>
                <td style="text-align: center;"><strong>${count}</strong></td>
                <td style="text-align: right;" class="small">${pct}%</td>
                <td style="vertical-align: middle;">
                    <div class="progress-bg">
                        <div class="progress-bar ${barClass}" style="width: ${pct}%"></div>
                    </div>
                </td>
            `;
            tbody.appendChild(tr);
        });
    };

    // ======== AÇÕES (ADICIONAR / EXCLUIR) ========
    const addMachine = async () => {
        const currentRole = getRole();
        if (currentRole !== 'admin') { notify('Somente Admin pode adicionar máquinas.', 'error'); return; }

        const id = document.getElementById('idItem').value.trim();
        const name = document.getElementById('nomeMaquina').value.trim();
        if (!id || !name) { notify('ID e Nome são obrigatórios!', 'error'); return; }
        if (state.machines.some(m => m.id === id)) {
            showConfirm('ID Duplicado', `Já existe uma máquina com ID "${id}". Deseja adicionar mesmo assim? (Pode causar conflitos)`, () => { _executeAddMachine(); }, 'warning');
            return;
        }
        _executeAddMachine();
    };

    const _executeAddMachine = async () => {
        const id = document.getElementById('idItem').value.trim();
        const name = document.getElementById('nomeMaquina').value.trim();
        const newMachine = {
            id, name,
            capacity: document.getElementById('capacidade').value.trim(),
            manufacturer: document.getElementById('fabricante').value.trim(),
            quantity: Number(document.getElementById('quantidade').value) || 0,
            status: 'OK',
            maintenance: [], history: [], nextMaint: null
        };
        try {
            await sendApiRequest(API_URL, 'POST', { action: 'add_machine', data: newMachine });
            newMachine.history = [{ date: new Date().toLocaleString('pt-BR'), text: 'Máquina registrada no sistema.' }];
            state.machines.unshift(newMachine);
            if (DOMElements.machineForm) DOMElements.machineForm.reset();
            const qEl = document.getElementById('quantidade'); if (qEl) qEl.value = 0;
            notify('Máquina adicionada com sucesso!', 'success');
            render();
            await addHistory(newMachine, 'Máquina registrada no sistema.');
        } catch (e) { /* erro tratado em sendApiRequest */ }
    };

    const deleteMachine = async (index) => {
        const machine = state.machines[index];
        if (!machine) return;
        showConfirm('Excluir Máquina?', `Tem certeza que deseja excluir "${machine.name}"? Esta ação é permanente.`, async () => {
            try {
                await sendApiRequest(API_URL, 'DELETE', { action: 'delete_machine', tag: machine.id });
                state.machines.splice(index, 1);
                notify('Máquina removida.', 'info');
                render();
                if (state.editingIndex !== null) closeModal();
            } catch (e) { }
        }, 'danger');
    };

    // ======== EVENT LISTENERS ========
    const addEventListeners = () => {
        if (DOMElements.machineForm) DOMElements.machineForm.addEventListener('submit', e => { e.preventDefault(); addMachine(); });
        const resetBtn = document.getElementById('resetForm');
        if (resetBtn) resetBtn.addEventListener('click', () => { if (DOMElements.machineForm) DOMElements.machineForm.reset(); const qEl = document.getElementById('quantidade'); if (qEl) qEl.value = 0; });

        if (DOMElements.searchEl) DOMElements.searchEl.addEventListener('input', () => { state.search = DOMElements.searchEl.value; state.page = 1; render(); });
        if (DOMElements.filterEl) DOMElements.filterEl.addEventListener('change', () => { state.filter = DOMElements.filterEl.value; state.page = 1; render(); });

        document.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => {
            const key = th.dataset.sort;
            if (state.sortBy === key) state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
            else { state.sortBy = key; state.sortDir = 'asc'; }
            render();
        }));

        const modalClose = document.getElementById('modalClose');
        if (modalClose) modalClose.addEventListener('click', closeModal);
        if (DOMElements.backdrop) DOMElements.backdrop.addEventListener('click', e => { if (e.target === DOMElements.backdrop) closeModal(); });

        const modalDelete = document.getElementById('modalDelete');
        if (modalDelete) modalDelete.addEventListener('click', () => {
            const machine = state.machines[state.editingIndex];
            if (!machine) return;
            showConfirm('Excluir Máquina?', `Tem certeza que deseja excluir "${machine.name}"? Esta ação é permanente.`, () => { deleteMachine(state.editingIndex); }, 'danger');
        });

        document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', e => {
            document.querySelectorAll('.tab').forEach(x => x.classList.remove('active'));
            e.currentTarget.classList.add('active');
            const tabName = e.currentTarget.dataset.tab;
            ['view', 'maintenance', 'history', 'schedule'].forEach(id => {
                const el = document.getElementById(`tab${id.charAt(0).toUpperCase() + id.slice(1)}`);
                if (el) el.style.display = (tabName === id) ? 'block' : 'none';
            });
            if (tabName === 'maintenance') renderMaintenanceTab();
            if (tabName === 'history') renderHistoryTab();
            if (tabName === 'schedule') renderScheduleTab();
        }));

        const btnLogout = document.getElementById('btnLogout');
        if (btnLogout) btnLogout.addEventListener('click', logoutSystem);

        setupExtraFeatures();
    };

    // ======== EVENTOS DINÂMICOS NA TABELA ========
    const addDynamicTableEventListeners = () => {
        document.querySelectorAll('.btn-view').forEach(b => b.addEventListener('click', e => openModal(e.currentTarget.dataset.idx)));
        document.querySelectorAll('.btn-delete').forEach(b => b.addEventListener('click', e => {
            const index = +e.currentTarget.dataset.idx;
            showConfirm('Excluir Máquina?', `Tem certeza que deseja excluir "${state.machines[index].name}"? Esta ação é permanente.`, () => { deleteMachine(index); }, 'danger');
        }));

        document.querySelectorAll('.statusSel').forEach(s => s.addEventListener('change', async e => {
            const index = +e.currentTarget.dataset.idx;
            const machine = state.machines[index];
            const oldStatus = machine.status;
            const newStatus = e.currentTarget.value;
            const success = await updateMachineField(machine, 'status', newStatus);
            if (success) { await addHistory(machine, `Status alterado de "${oldStatus}" para "${newStatus}".`); render(); }
            else e.currentTarget.value = oldStatus;
        }));

        document.querySelectorAll('.editable').forEach(td => {
            td.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); }});
            td.addEventListener('blur', async e => {
                const idx = +e.currentTarget.dataset.idx;
                const machine = state.machines[idx];
                const field = e.currentTarget.dataset.field;
                if (!machine || !field) return;

                if (getRole() !== 'admin') {
                    const span = e.currentTarget.querySelector('span') || e.currentTarget;
                    span.textContent = machine[field];
                    notify('Você não tem permissão para editar este campo.', 'error');
                    return;
                }

                let oldValue = machine[field] || '';
                const targetEl = e.currentTarget.querySelector('span') || e.currentTarget;
                let newValue = targetEl.textContent.trim();

                if (field === 'quantity') {
                    oldValue = Number(oldValue) || 0;
                    newValue = Number(newValue.replace(/[^0-9.]/g, '')) || 0;
                }

                if (oldValue !== newValue) {
                    if (await updateMachineField(machine, field, newValue)) {
                        await addHistory(machine, `Campo "${field}" alterado de "${oldValue}" para "${newValue}".`);
                        notify('Alteração salva!', 'success');
                    } else {
                        targetEl.textContent = oldValue;
                    }
                } else {
                    targetEl.textContent = machine[field];
                }
            });
        });
    };

    // ======== EVENTOS DE MANUTENÇÃO ========
    const addMaintenanceEventListeners = () => {
        document.getElementById('maintFormNew')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const i = state.editingIndex; const machine = state.machines[i];
            const type = document.getElementById('maintType').value;
            const desc = document.getElementById('maintDesc').value.trim();
            const startDate = document.getElementById('maintStartDate').value;
            const tecnico = document.getElementById('maintTecnico').value.trim();
            if (!desc || !tecnico) { notify('Descrição e Técnico são obrigatórios.', 'error'); return; }

            const newMaintData = { tag: machine.id, type, desc, start_date: startDate, tecnico: tecnico };
            try {
                const apiResponse = await sendApiRequest(API_URL, 'POST', { action: 'start_maintenance', data: newMaintData });
                const newMaintId = apiResponse.maint_id;
                machine.maintenance = machine.maintenance || [];
                machine.maintenance.push({ id: newMaintId, type, desc, start_date: startDate, tecnico: tecnico, cost: null, end_date: null, steps: [] });
                await addHistory(machine, `Manutenção (${type}) INICIADA. Técnico: ${tecnico}. Motivo: ${desc}`);
                if (await updateMachineField(machine, 'status', 'EM MANUTENÇÃO')) {
                    notify('Manutenção registrada com sucesso!', 'success');
                    render();
                    openModal(i);
                }
            } catch (e) { /* erro tratado */ }
        });

        document.getElementById('maintFormStep')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const i = state.editingIndex; const machine = state.machines[i];
            const stepDescEl = document.getElementById('stepDesc');
            const stepDesc = stepDescEl.value.trim();
            if (!stepDesc) { notify('A descrição da etapa é obrigatória.', 'error'); return; }

            const activeMaint = (machine.maintenance || []).find(x => !x.end_date);
            if (!activeMaint) return;

            try {
                const response = await sendApiRequest(API_URL, 'PUT', { action: 'add_maint_step', data: { tag: machine.id, description: stepDesc, maint_id: activeMaint.id } });
                activeMaint.steps.push(response.new_step);
                await addHistory(machine, `Etapa de Manutenção registrada: ${stepDesc}`);
                notify('Etapa registrada!', 'info');
                stepDescEl.value = '';
                renderMaintenanceTab();
            } catch (e) { /* erro tratado */ }
        });

        document.getElementById('endMaint')?.addEventListener('click', async (e) => {
            const i = state.editingIndex; const machine = state.machines[i];
            const activeMaint = (machine.maintenance || []).find(x => !x.end_date);
            const maintId = e.currentTarget?.dataset?.maintId;
            if (!activeMaint || !maintId) return;

            const endDate = prompt("Informe a data de finalização (AAAA-MM-DD):", new Date().toISOString().slice(0, 10));
            if (!endDate) return;
            const cost = prompt("Informe o Custo Total da Manutenção (ex: 150.99):");
            if (cost === null) return;

            const finishData = { tag: machine.id, end_date: endDate, maint_id: maintId, cost: cost || 0 };
            try {
                await sendApiRequest(API_URL, 'PUT', { action: 'end_maintenance', data: finishData });
                activeMaint.end_date = endDate;
                activeMaint.cost = parseFloat(cost) || 0;
                await addHistory(machine, `Manutenção (${activeMaint.type}) FINALIZADA em ${formatDate(endDate)}. Custo: R$ ${activeMaint.cost.toFixed(2)}. Teve ${activeMaint.steps.length} etapas.`);
                if (await updateMachineField(machine, 'status', 'OK')) {
                    notify('Manutenção finalizada! Status da máquina alterado para "OK".', 'success');
                    render();
                    closeModal();
                }
            } catch (e) { /* erro tratado */ }
        });
    };

    // ======== RECURSOS EXTRAS / IMPORT / EXPORT / TEMA ========
    const setupExtraFeatures = () => {
        const applyTheme = () => {
            const theme = localStorage.getItem('theme') || 'light';
            document.documentElement.setAttribute('data-theme', theme);
        };

        const exportBtn = document.getElementById('exportJson');
        if (exportBtn) exportBtn.addEventListener('click', () => {
            const dataStr = JSON.stringify(state.machines, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `maintcontrol_backup_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            notify('Dados exportados.', 'info');
        });

        const importFile = document.getElementById('importFile');
        document.getElementById('importBtn')?.addEventListener('click', () => importFile?.click());

        importFile?.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async (ev) => {
                try {
                    const importedMachines = JSON.parse(ev.target.result);
                    if (!Array.isArray(importedMachines)) throw new Error("O arquivo não contém um array JSON.");
                    if (!confirm(`Deseja importar e salvar ${importedMachines.length} máquinas no banco de dados? (IDs existentes serão atualizados)`)) return;

                    const machinesToSave = importedMachines.map(m => {
                        m.maintenance = m.maintenance || [];
                        m.history = m.history || [];
                        m.nextMaint = m.nextMaint || null;
                        m.id = m.id || `import_${Date.now()}`;
                        m.name = m.name || 'Sem Nome';
                        m.status = m.status || 'OK';
                        m.quantity = Number(m.quantity) || 0;
                        return m;
                    });

                    if (DOMElements.tableOverlay) { DOMElements.tableOverlay.innerHTML = '<div class="loader-spinner"></div><p>Importando dados...</p>'; DOMElements.tableOverlay.classList.remove('hidden'); }
                    try {
                        const response = await sendApiRequest(API_URL, 'POST', { action: 'batch_add_machines', data: machinesToSave });
                        notify(response.message, 'success');
                        await loadState(); render();
                    } catch (apiError) {
                        if (DOMElements.tableOverlay) DOMElements.tableOverlay.classList.add('hidden');
                    }
                } catch (err) {
                    notify('Arquivo JSON inválido ou corrompido.', 'error');
                }
            };
            reader.readAsText(file);
            e.target.value = '';
        });

        document.getElementById('toggleTheme')?.addEventListener('click', () => {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', newTheme);
            applyTheme();
        });

        const setFilterAndRender = (status) => {
            state.filter = status;
            if (DOMElements.filterEl) DOMElements.filterEl.value = status;
            state.page = 1;
            render();
            document.getElementById('machinesTable')?.scrollIntoView({ behavior: 'smooth' });
        };

        document.getElementById('metricTotal')?.addEventListener('click', () => setFilterAndRender('all'));
        document.getElementById('metricOp')?.addEventListener('click', () => setFilterAndRender('EM OPERAÇÃO'));
        document.getElementById('metricMaint')?.addEventListener('click', () => setFilterAndRender('EM MANUTENÇÃO'));
        document.getElementById('metricInop')?.addEventListener('click', () => setFilterAndRender('INOPERANTE'));
        document.getElementById('metricNextMaint')?.addEventListener('click', () => notify('Filtro por agendamentos futuros ainda em desenvolvimento.', 'info'));

        applyTheme();

        const currentRole = getRole();
        if (currentRole !== 'admin') {
            const addForm = DOMElements.machineForm;
            if (addForm) {
                addForm.querySelectorAll('input, textarea, button, select').forEach(el => {
                    if (el.type !== 'button') el.disabled = true;
                });
                const note = document.createElement('div');
                note.className = 'small';
                note.style.marginTop = '8px';
                note.textContent = 'Você não tem permissão para adicionar máquinas.';
                addForm.parentNode?.insertBefore(note, addForm.nextSibling);
            }
        }
    };

    const getStatusClass = (s) => ({ "OK": 'ok', "EM OPERAÇÃO": 'op', "EM MANUTENÇÃO": 'maint', "INOPERANTE": 'inop', "ESPERANDO PEÇAS": 'wait', "HORAS EXCEDENTES": 'exc' }[s] || 'ok');

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
            const [year, month, day] = dateString.split('-'); return `${day}/${month}/${year}`;
        }
        try {
            if (dateString.includes('T') || dateString.includes(' ')) return new Date(dateString).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            return new Date(dateString).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        } catch (e) { return dateString; }
    };

    // ======== INICIALIZAÇÃO ========
    const init = async () => {
        updateUserDisplay();
        try {
            await loadState();
        } catch (e) {
            console.error('Erro no loadState:', e);
        }
        populateFilter();
        addEventListeners();
        setupExtraFeatures();
        updateUserDisplay();
        render();
    };

    init();
});