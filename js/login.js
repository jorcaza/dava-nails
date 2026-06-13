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

// IMPORTACIONES
import { auth } from "./firebase-config.js";
import { 
  signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// FUNCIÓN LOGIN
function login() {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  // VALIDACIÓN BÁSICA
  if (!email || !password) {
    alert("Por favor completa todos los campos");
    return;
  }

  // LOGIN CON FIREBASE
  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;

      console.log("Usuario logueado:", user);

      // Redireccionar (opcional)
      window.location.href = "home.html";
    })
    .catch((error) => {
      console.error("Error:", error.message);

      alert("Error: " + error.message);
    });
}

// HACER LA FUNCIÓN GLOBAL (IMPORTANTE para HTML onclick)
window.login = login;


