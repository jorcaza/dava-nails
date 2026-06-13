/* ── Si ya hay sesión activa, ir directo al dashboard ── */
(function () {
  const s = sessionStorage.getItem('ns_session') || localStorage.getItem('ns_session');
  if (s) window.location.href = 'dashboard.html';
})();

/* ── Mostrar logo en móvil ── */
if (window.innerWidth <= 860) {
  const ml = document.getElementById('mobileLogo');
  if (ml) ml.style.display = 'flex';
}

/* ── Toggle mostrar/ocultar contraseña ── */
function togglePw() {
  const inp  = document.getElementById('password');
  const icon = document.getElementById('pwIcon');
  if (inp.type === 'password') {
    inp.type = 'text';
    icon.className = 'fa fa-eye-slash';
  } else {
    inp.type = 'password';
    icon.className = 'fa fa-eye';
  }
}

/* ── Enviar con Enter ── */
function onEnter(e) {
  if (e.key === 'Enter') login();
}

/* ── Limpiar errores al escribir ── */
function clearFieldError(input, errId) {
  input.classList.remove('error');
  document.getElementById(errId).classList.remove('show');
  document.getElementById('alertError').classList.remove('show');
}



/* ── LOGIN ── */
function login() {
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const remember = document.getElementById('remember').checked;

  const btn = document.getElementById('btnLogin');
  const alertEl = document.getElementById('alertError');

  let ok = true;

  if (!email || !/\S+@\S+\.\S+/.test(email)) {
    document.getElementById('email').classList.add('error');
    document.getElementById('err-email').classList.add('show');
    ok = false;
  }

  if (!password) {
    document.getElementById('password').classList.add('error');
    document.getElementById('err-pw').classList.add('show');
    ok = false;
  }

  if (!ok) return;

  btn.classList.add('loading');
  alertEl.classList.remove('show');

  //LOGIN REAL FIREBASE
  auth.signInWithEmailAndPassword(email, password)
    .then((userCredential) => {

      const user = userCredential.user;

      const store = remember ? localStorage : sessionStorage;

      store.setItem('ns_session', JSON.stringify({
        email: user.email,
        name: user.email.split('@')[0],
        uid: user.uid
      }));

      btn.style.background = '#2e7d32';
      btn.innerHTML = `<span class="btn-text"><i class="fa fa-check"></i> Accediendo?</span>`;
      btn.classList.remove('loading');

      setTimeout(() => {
        window.location.href = 'dashboard.html';
      }, 600);

    })
    .catch((error) => {

      btn.classList.remove('loading');

      document.getElementById('alertMsg').textContent =
        'Credenciales incorrectas o usuario no registrado';

      alertEl.classList.add('show');

      document.getElementById('email').classList.add('error');
      document.getElementById('password').classList.add('error');

    });
}
``
