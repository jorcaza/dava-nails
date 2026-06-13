// 🔹 elementos
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const btnLogin = document.getElementById("btnLogin");
const errPw = document.getElementById("err-pw");

// 🔹 función loader
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
  passwordInput.classList.add("error");
}

// 🔹 ocultar error
function hideError() {
  errPw.style.display = "none";
  passwordInput.classList.remove("error");
}

// ✅ FUNCIÓN LOGIN MEJORADA
function login() {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  // limpiar errores
  hideError();

  // validación
  if (!email || !password) {
    showError("Completa todos los campos");
    return;
  }

  // activar loader
  setLoading(true);

  // LOGIN FIREBASE
  signInWithEmailAndPassword(auth, email, password)
    .then((userCredential) => {
      const user = userCredential.user;
      console.log("Usuario logueado:", user);

      // ✅ redirección correcta
      window.location.replace("/dashboard.html");
    })
    .catch((error) => {
      console.log(error);

      // ✅ mensajes específicos
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

      // quitar loader si falla
      setLoading(false);
    });
}

// ✅ evento botón
btnLogin.addEventListener("click", login);

// ✅ ENTER para login
passwordInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") login();
});

// ✅ UX PRO: ocultar error al escribir
passwordInput.addEventListener("input", hideError);