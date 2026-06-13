/* ── Si ya hay sesión activa, ir directo al dashboard ── */
(function () {
  const s = sessionStorage.getItem('ns_session') || localStorage.getItem('ns_session');
  if (s) window.location.href = '/dashboard.html';
})();

/* ── Mostrar logo en móvil ── */
if (window.innerWidth <= 860) {
  const ml = document.getElementById('mobileLogo');
  if (ml) ml.style.display = 'flex';
}


/* ── SPINNER logo en móvil ── */
const btnText = document.querySelector(".btn-text");
const btnSpinner = document.querySelector(".btn-spinner");

function setLoading(state) {
  if (state) {
    btnLogin.classList.add("loading");
    btnLogin.disabled = true;
  } else {
    btnLogin.classList.remove("loading");
    btnLogin.disabled = false;
  }
}



//IMPORTS FIREBASE
import { auth } from "/firebase-config.js";
import { signInWithEmailAndPassword } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/* ── ELEMENTOS ── */
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const errPw = document.getElementById("err-pw");
const togglePassword = document.getElementById("togglePassword");
const pwIcon = document.getElementById("pwIcon");

/* ── LOGIN ── */
function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  hideError();

  if (!email || !password) {
    showError("Completa todos los campos");
    return;
  }

  // ✅ ACTIVAR LOADER
  setLoading(true);

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      sessionStorage.setItem('ns_session', 'active');

      window.location.replace("/dashboard.html");
    })
    .catch((error) => {
      console.log(error);

      if (error.code === "auth/wrong-password") {
        showError("Contraseña incorrecta");
      } else if (error.code === "auth/user-not-found") {
        showError("Usuario no registrado");
      } else if (error.code === "auth/invalid-email") {
        showError("Correo inválido");
      } else {
        showError("Error al iniciar sesión");
      }

      // ❌ DESACTIVAR LOADER AL FALLAR
      setLoading(false);
    });
}

/* ── MOSTRAR ERROR ── */
function showError(msg) {
  errPw.textContent = msg;
  errPw.style.display = "block";
  passwordInput.classList.add("error");
}

/* ── OCULTAR ERROR ── */
function hideError() {
  errPw.style.display = "none";
  passwordInput.classList.remove("error");
}

/* ── BOTÓN LOGIN ── */
btnLogin.addEventListener("click", login);

/* ── ENTER PARA LOGIN ── */
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});

/* ── UX PRO: ocultar error al escribir ── */
passwordInput.addEventListener("input", hideError);

/* ── TOGGLE PASSWORD (ojo) ── */
togglePassword.addEventListener("click", () => {
  const isHidden = passwordInput.type === "password";

  passwordInput.type = isHidden ? "text" : "password";

  // cambiar icono FontAwesome
  pwIcon.className = isHidden ? "fa fa-eye-slash" : "fa fa-eye";
});