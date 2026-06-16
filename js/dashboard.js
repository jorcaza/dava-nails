// 🔥 IMPORTS FIREBASE
import { auth,db } from "/js/firebase-config.js";
import { signOut } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { getDoc } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


/* ── LOGOUT ── */
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    signOut(auth)
      .then(() => {
        console.log("Sesión cerrada");
        window.location.replace("/index.html");
      })
      .catch((error) => {
        console.error("Error cerrando sesión:", error);
      });
  });
}

/* ── Sidebar toggle (desktop) ── */
const body = document.body;
const toggleBtn = document.getElementById('toggleBtn');
const hamburger = document.getElementById('hamburger');
const overlay = document.getElementById('overlay');

if (toggleBtn) {
  toggleBtn.addEventListener('click', () => {
    body.classList.toggle('collapsed');
  });
}

/* ── Sidebar drawer (mobile) ── */
if (hamburger) {
  hamburger.addEventListener('click', () => {
    body.classList.add('mobile-open');
    overlay.classList.add('visible');
  });
}

if (overlay) {
  overlay.addEventListener('click', closeMobile);
}

function closeMobile() {
  body.classList.remove('mobile-open');
  overlay.classList.remove('visible');
}

/* ── Cerrar sidebar al navegar (mobile) ── */
document.querySelectorAll('.sidebar nav a').forEach(a => {
  a.addEventListener('click', () => {
    if (window.innerWidth <= 640) closeMobile();
  });
});

/* ── INIT ── */
document.addEventListener("DOMContentLoaded", () => {
  const openBtn = document.getElementById("openSidebarBtn");
  const versionEl = document.getElementById("appVersion");

  if (openBtn) {
    openBtn.addEventListener("click", () => {
      body.classList.remove("collapsed");
    });
  }

  // versión
  if (versionEl && window.APP_VERSION) {
    versionEl.textContent = "Versión " + window.APP_VERSION;
  }
});



function crearFila(cita) {
  return `
    <div class="t-row">

      <div class="col" data-label="Cliente">
        <strong>${cita.cliente}</strong><br>
        
      </div>

      <div class="col" data-label="Hora">
        ${cita.hora}
      </div>

      <div class="col" data-label="Servicio">
        ${cita.servicioNombre || "—"}
      </div>

      <div class="col" data-label="Manicurista">
        ${cita.manicuristaNombre || "—"}
      </div>

      <div class="col estado ${cita.estado}" data-label="Estado">
        ${cita.estado}
      </div>
      <div class="col" data-label="Acción">
        <a class="btn-wa"
           href="#"
           onclick="enviarWhatsApp('${cita.cliente}','${cita.hora}','${cita.servicioNombre}','${cita.manicuristaNombre}','${cita.telefono}')"
           target="_blank">
          <i class="fab fa-whatsapp"></i>
        </a>
      </div>

    </div>
  `;
}



async function cargarCitas() {
  



  const snap = await getDocs(collection(db, "citas"));
  const container = document.getElementById("citasContainer");

  container.innerHTML = "";

for (const docu of snap.docs) {

  let cita = docu.data();

  const fecha = cita.fechaHora.toDate();
  cita.hora = fecha.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit"
  });

  // 🔥 SERVICIO
  if (cita.servicio) {
    const servicioSnap = await getDoc(cita.servicio);
    cita.servicioNombre = servicioSnap.data().nombre;
  }

  // 🔥 MANICURISTA
  if (cita.manicurista) {
    const maniSnap = await getDoc(cita.manicurista);
    cita.manicuristaNombre = maniSnap.data().nombre;
  }

  container.innerHTML += crearFila(cita);
}

}

cargarCitas();