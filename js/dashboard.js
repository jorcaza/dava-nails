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

const fecha = cita.fechaHora.toDate();

cita.fecha = fecha.toLocaleDateString("es-CO", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric"
});



  return `
    <div class="t-row">

      <div class="col" data-label="Cliente">
        <strong>${cita.cliente}</strong>
        <small>${cita.telefono}</small>
      </div>

      <div class="col" data-label="Hora">
        ${cita.fecha} - ${cita.hora}
      </div>

      <div class="col" data-label="Servicio">
        ${cita.servicioNombre || "—"}
      </div>

      <div class="col" data-label="Manicurista">
        ${cita.manicuristaNombre || "—"}
      </div>

<div class="col estado" data-label="Estado">

  <div class="estado-dropdown">

    <div class="estado-selected estado-${cita.estado}" 
         onclick="toggleDropdown(this)">
      ${cita.estado}
      <i class="fa-solid fa-chevron-down"></i>
    </div>

    <div class="estado-options">

      <div onclick="cambiarEstadoDropdown(this, '${cita.id}', 'pendiente')">
        Pendiente
      </div>

      <div onclick="cambiarEstadoDropdown(this, '${cita.id}', 'confirmada')">
        Confirmada
      </div>

      <div onclick="cambiarEstadoDropdown(this, '${cita.id}', 'completada')">
        Completada
      </div>

      <div onclick="cambiarEstadoDropdown(this, '${cita.id}', 'cancelada')">
        Cancelada
      </div>

    </div>
  </div>

</div>

      <div class="col" data-label="Acción">
        <a class="btn-wa"
           href="#"
           onclick="enviarWhatsApp('${cita.cliente}','${cita.hora}','${cita.servicioNombre}','${cita.manicuristaNombre}','${cita.telefono}','${cita.fecha}')"
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

    // ✅ 🔥 AQUÍ VA EL FIX DEL ID
    cita.id = docu.id;

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

//cambiar erstao de citas


import { doc, updateDoc } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

window.cambiarEstadoDropdown = async function(el, id, estado) {

  const dropdown = el.closest(".estado-dropdown");
  const selected = dropdown.querySelector(".estado-selected");

  // ✅ actualizar UI
  selected.textContent = estado;

  selected.className = "estado-selected estado-" + estado;

  // ✅ cerrar dropdown
  dropdown.classList.remove("open");

  // ✅ guardar en Firebase
  await updateDoc(doc(db, "citas", id), {
    estado: estado
  });

  console.log("✅ Estado actualizado:", estado);
}


window.toggleDropdown = function(el) {
  const parent = el.parentElement;
  parent.classList.toggle("open");
}

document.addEventListener("click", function(e) {
  document.querySelectorAll(".estado-dropdown").forEach(drop => {
    if (!drop.contains(e.target)) {
      drop.classList.remove("open");
    }
  });
});