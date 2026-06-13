import { auth } from "/firebase-config.js";
import { onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ?? ocultar dashboard mientras valida
document.body.style.display = "none";

onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log("? Usuario activo:", user.email);

    // ? mostrar dashboard
    document.body.style.display = "block";
  } else {
    console.warn("? No autenticado");

    // ? redirigir si no hay sesión
    window.location.replace("/index.html");
  }
});