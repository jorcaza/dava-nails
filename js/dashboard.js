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

        <select class="estado-select estado-${cita.estado}" data-estado-anterior="${cita.estado}"
          onchange="cambiarEstado(this, '${cita.id}')">

          <option value="pendiente" ${cita.estado === "pendiente" ? "selected" : ""}>
            Pendiente
          </option>

          <option value="confirmada" ${cita.estado === "confirmada" ? "selected" : ""}>
            Confirmada
          </option>

          <option value="completada" ${cita.estado === "completada" ? "selected" : ""}>
            Completada
          </option>

          <option value="cancelada" ${cita.estado === "cancelada" ? "selected" : ""}>
            Cancelada
          </option>

        </select>

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


import { doc, updateDoc, serverTimestamp }
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

window.cambiarEstado = async function(select, id) {

  const nuevoEstado = select.value;
  const estadoAnterior = select.dataset.estadoAnterior;

  try {

    await updateDoc(doc(db, "citas", id), {
      estado: nuevoEstado
    });

    // ✅ actualizar color
    select.className = "estado-select estado-" + nuevoEstado;

    // ✅ REGLAS DE ENVÍO 🔥

    if (estadoAnterior !== nuevoEstado) {

      // ✅ SOLO SI PASA A CONFIRMADA
      if (nuevoEstado === "confirmada") {
        enviarWhatsApp(select, "confirmada";
      }

      // ✅ (opcional) SI SE CANCELA
      if (nuevoEstado === "cancelada") {
        enviarWhatsApp(select, "cancelada");
      }
    }
    // ✅ actualizar estado anterior
    select.dataset.estadoAnterior = nuevoEstado;


    
    
    // ✅ 🔥 MOSTRAR TOAST
    mostrarToast("Guardado ✅", "ok");

  } catch (error) {
    console.error("❌ Error:", error);
    mostrarToast("Error al guardar ❌", "error");
  }
};


function enviarWhatsApp(select, tipo) {

  const row = select.closest(".t-row");

  const cliente = row.querySelector('[data-label="Cliente"] strong').innerText;
  const telefono = row.querySelector('[data-label="Cliente"] small').innerText;
  const hora = row.querySelector('[data-label="Hora"]').innerText;
  const servicio = row.querySelector('[data-label="Servicio"]').innerText;

  let mensaje = "";

  // ✅ LÓGICA DINÁMICA
  if (tipo === "confirmada") {

    mensaje =
`✅ CONFIRMACIÓN DE CITA DAVANAILS

Hola ${cliente} 👋

Tu cita ha sido CONFIRMADA ✅

📅 ${hora}
💅 ${servicio}

Te esperamos 💖`;

  }

  if (tipo === "cancelada") {

    mensaje =
`❌ CITA CANCELADA

Hola ${cliente}

Tu cita ha sido cancelada.
Si deseas reprogramar, contáctanos 💅`;

  }

  if (tipo === "recordatorio") {

    mensaje =
`⏰ RECORDATORIO DE CITA

Hola ${cliente} 👋

Te recordamos tu cita:

📅 ${hora}
💅 ${servicio}

¡Te esperamos! 💖`;

  }

}

function mostrarToast(msg, tipo = "ok") {

  const toast = document.createElement("div");
  toast.textContent = msg;

  toast.className = "toast " + tipo;

  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2000);
}