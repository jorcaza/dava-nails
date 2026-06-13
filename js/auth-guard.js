import { auth } from "/js/firebase-config.js";
import { onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

console.log("?? auth guard cargado");

// ? esperar a firebase SIN lógica rara
onAuthStateChanged(auth, (user) => {
  console.log("USER DETECTADO:", user);

  if (user) {
    // ? usuario válido ? no hacer nada
    console.log("? acceso permitido");
  } else {
    // ? sin sesión ? redirigir
    console.log("? redirigiendo a login");
    window.location.replace("/index.html");
  }
});