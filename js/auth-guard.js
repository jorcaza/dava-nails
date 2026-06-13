
import { auth } from "/js/firebase-config.js";
import { onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

document.body.style.display = "none";

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.body.style.display = "block";
  } else {
    window.location.replace("/index.html");
  }
});
