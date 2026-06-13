import { auth } from "./firebase-config.js";
import { signOut } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/* ── Cerrar sesión ── */


const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    signOut(auth)
      .then(() => {
        window.location.replace("/index.html");
      });
  });
}



function logout() {
  auth.signOut().then(() => {
    sessionStorage.removeItem('ns_session');
    localStorage.removeItem('ns_session');
    window.location.href = 'index.html';
  });
}


/* ── Sidebar toggle (desktop) ── */
const body = document.body;
const toggleBtn = document.getElementById('toggleBtn');
const hamburger = document.getElementById('hamburger');
const overlay = document.getElementById('overlay');

toggleBtn.addEventListener('click', () => {
  body.classList.toggle('collapsed');
});

/* ── Sidebar drawer (mobile) ── */
hamburger.addEventListener('click', () => {
  body.classList.add('mobile-open');
  overlay.classList.add('visible');
});

overlay.addEventListener('click', closeMobile);

function closeMobile() {
  body.classList.remove('mobile-open');
  overlay.classList.remove('visible');
}

document.querySelectorAll('.sidebar nav a').forEach(a => {
  a.addEventListener('click', () => {
    if (window.innerWidth <= 640) closeMobile();
  });
});

/*── VERSION ──*/
document.addEventListener("DOMContentLoaded", () => {
  const sidebar = document.getElementById("sidebar");
  const toggleBtn = document.getElementById("toggleBtn");
  const openBtn = document.getElementById("openSidebarBtn");
  const versionEl = document.getElementById("appVersion");

  // 🔥 SIDEBAR CONTROL
  function setSidebar(state) {
    document.body.classList.toggle("collapsed", state);
  }

  toggleBtn.addEventListener("click", () => {
    setSidebar(true);
  });

  openBtn.addEventListener("click", () => {
    setSidebar(false);
  });

  // 🔥 VERSION (IMPORTANTE)
  if (versionEl && window.APP_VERSION) {
    versionEl.textContent = "Versión " + window.APP_VERSION;
  }
});