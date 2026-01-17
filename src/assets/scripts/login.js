document.addEventListener('DOMContentLoaded', () => {
  // ====== CONFIG ======
  // Ajuste se necessário. Use o caminho absoluto ou relativo correto para seu servidor.
  const API_URLS = [
    '/MCSRC/backend/api.php',
    '/MC/backend/api.php',
    '/backend/api.php',
    '../../../backend/api.php',
    '/MCSRC/backend/api.php' // fallback
  ];

  // Elementos DOM
  const loginForm = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const togglePassword = document.getElementById('togglePassword');
  const loginButton = document.getElementById('loginButton');
  const usernameValidation = document.getElementById('usernameValidation');
  const passwordValidation = document.getElementById('passwordValidation');
  const toggleTheme = document.getElementById('toggleTheme');
  const loginCard = document.getElementById('loginCard');
  const rememberMeCheckbox = document.getElementById('rememberMe');

  // Aplicar tema salvo
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
  if (toggleTheme) {
    const icon = toggleTheme.querySelector('i');
    if (icon) icon.className = savedTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
  }

  // ====== UI Helpers ======
  function setLoading(isLoading) {
    if (!loginButton) return;
    if (isLoading) {
      loginButton.disabled = true;
      loginButton.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Verificando...</span>';
    } else {
      loginButton.disabled = false;
      loginButton.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i><span>Entrar</span>';
    }
  }

  function showError(message) {
    if (passwordValidation) {
      passwordValidation.classList.add('show', 'invalid');
      passwordValidation.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i><span>${message}</span>`;
    }
    if (loginCard) {
      loginCard.classList.add('shake');
      setTimeout(() => loginCard.classList.remove('shake'), 500);
    }
  }

  function clearValidation() {
    if (usernameValidation) { usernameValidation.classList.remove('show','valid','invalid'); usernameValidation.innerHTML = ''; }
    if (passwordValidation) { passwordValidation.classList.remove('show','valid','invalid'); passwordValidation.innerHTML = ''; }
  }

  // Validação visual em tempo real
  if (usernameInput) {
    usernameInput.addEventListener('input', () => {
      validateField(usernameInput, usernameValidation, 'Usuário deve ter pelo menos 3 caracteres');
    });
  }
  if (passwordInput) {
    passwordInput.addEventListener('input', () => {
      validateField(passwordInput, passwordValidation, 'Senha deve ter pelo menos 6 caracteres');
    });
  }

  // Toggle senha
  if (togglePassword && passwordInput) {
    togglePassword.addEventListener('click', () => {
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      togglePassword.innerHTML = type === 'password' ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>';
    });
  }

  // Toggle tema
  if (toggleTheme) {
    toggleTheme.addEventListener('click', () => {
      const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
      const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('theme', newTheme);
      const icon = toggleTheme.querySelector('i');
      if (icon) icon.className = newTheme === 'dark' ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
    });
  }

  // ====== function to try API URLs in order ======
  async function tryFetch(url, options) {
    try {
      const resp = await fetch(url, options);
      return resp;
    } catch (err) {
      // network error -> return null so caller can try next url
      return null;
    }
  }

  // ====== LOGIN (real, via API) ======
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      clearValidation();

      const username = usernameInput.value.trim();
      const password = passwordInput.value.trim();
      const remember = rememberMeCheckbox?.checked === true;

      // Basic client validation
      if (username.length < 3) {
        validateField(usernameInput, usernameValidation, 'Usuário deve ter pelo menos 3 caracteres');
        return;
      }
      if (password.length < 6) {
        validateField(passwordInput, passwordValidation, 'Senha deve ter pelo menos 6 caracteres');
        return;
      }

      setLoading(true);

      const payload = { action: 'login', data: { username, password } };
      const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };

      let response = null;
      let usedUrl = null;

      // tenta URLs conhecidas até uma responder
      for (const url of API_URLS) {
        response = await tryFetch(url, options);
        if (response) { usedUrl = url; break; }
      }

      if (!response) {
        setLoading(false);
        showError('Não foi possível conectar ao servidor API. Verifique o caminho (API_URL).');
        console.error('Nenhuma URL de API respondeu. URLs tentadas:', API_URLS);
        return;
      }

      // Lê resposta JSON (com tratamento)
      let json = null;
      try {
        json = await response.json();
      } catch (err) {
        setLoading(false);
        showError('Resposta inválida do servidor.');
        console.error('Resposta não-JSON da API (URL usada):', usedUrl, response);
        return;
      }

      // Se status HTTP 401 ou body com status:error -> mostra mensagem do servidor
      if (response.status === 401 || (json && json.status === 'error')) {
        setLoading(false);
        const msg = (json && json.message) ? json.message : 'Usuário ou senha incorretos.';
        showError(msg);
        console.warn('Login falhou (API respondeu):', usedUrl, json);
        return;
      }

      // Sucesso
      if (json && json.status === 'success' && json.token) {
        const token = json.token;
        const user = json.user || {};
        localStorage.setItem('maintControl_token', token);
        localStorage.setItem('maintControl_session', 'true');
        localStorage.setItem('maintControl_user', user.name || user.username || username);
        localStorage.setItem('maintControl_role', user.role || 'user');
        localStorage.setItem('maintControl_username', user.username || username);
        localStorage.setItem('maintControl_remember', remember ? 'true' : 'false');

        // navega para app principal
        window.location.href = '../../../public/index.html';
        return;
      }

      // fallback erro
      setLoading(false);
      showError('Erro ao autenticar. Verifique credenciais e servidor.');
      console.error('Resposta inesperada do login:', usedUrl, json);
    });
  }

  // ====== Helper: validação visual ======
  function validateField(input, validationEl, errorMessage) {
    if (!input || !validationEl) return false;
    const value = input.value.trim();
    const minLength = input.type === 'password' ? 6 : 3;
    const isValid = value.length >= minLength;

    if (value.length === 0) {
      validationEl.classList.remove('show', 'valid', 'invalid');
      validationEl.innerHTML = '';
    } else {
      validationEl.classList.add('show');
      if (isValid) {
        validationEl.classList.add('valid');
        validationEl.classList.remove('invalid');
        validationEl.innerHTML = '<i class="fa-solid fa-circle-check"></i><span>Formato válido</span>';
      } else {
        validationEl.classList.add('invalid');
        validationEl.classList.remove('valid');
        validationEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i><span>${errorMessage}</span>`;
      }
    }
    return isValid;
  }
});