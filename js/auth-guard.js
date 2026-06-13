import { auth } from "/js/firebase-config.js";
import { onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

// ocultar UI mientras valida
document.body.style.display = "none";

let initialized = false;

onAuthStateChanged(auth, (user) => {
  if (!initialized) {
    initialized = true;

    if (user) {
      console.log("? Sesión restaurada:", user.email);

      // mostrar dashboard
      document.body.style.display = "block";
    } else {
      console.log("? Sin sesión");

      window.location.replace("/index.html");
    }
  }
});