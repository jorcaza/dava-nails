// 🔥 IMPORTS
import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

//elementos
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const errPw = document.getElementById("err-pw");

//loader
function setLoading(state) {
  if (state) {
    btnLogin.classList.add("loading");
    btnLogin.disabled = true;
  } else {
    btnLogin.classList.remove("loading");
    btnLogin.disabled = false;
  }
}

// 🔹 mostrar error
function showError(msg) {
  errPw.textContent = msg;
  errPw.style.display = "block";
}

// 🔹 ocultar error
function hideError() {
  errPw.style.display = "none";
}

// ✅ LOGIN
function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  hideError();

  if (!email || !password) {
    showError("Completa todos los campos");
    return;
  }

  setLoading(true);

  signInWithEmailAndPassword(auth, email, password)
    .then(() => {
      window.location.replace("/dashboard.html");
    })
    .catch((error) => {
      console.log(error);

      if (error.code === "auth/wrong-password") {
        showError("Contraseña incorrecta");
      } 
      else if (error.code === "auth/user-not-found") {
        showError("Usuario no registrado");
      } 
      else if (error.code === "auth/invalid-email") {
        showError("Correo inválido");
      } 
      else {
        showError("Error al iniciar sesión");
      }

      setLoading(false);
    });
}

// ✅ evento correcto (SIN onclick)
btnLogin.addEventListener("click", login);

// ✅ enter
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});

// ✅ UX
passwordInput.addEventListener("input", hideError);