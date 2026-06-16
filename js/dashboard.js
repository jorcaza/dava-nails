// 🔥 IMPORTS FIREBASE
import { auth,db } from "/js/firebase-config.js";
import { signOut } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs,query, orderBy } 
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


cita.hora = fecha.toLocaleTimeString("es-CO", {
  hour: "2-digit",
  minute: "2-digit"
});




  return `
    <div class="t-row" data-id="${cita.id}">

      <div class="col" data-label="Cliente">
        <strong>${cita.cliente} - <small>${cita.telefono}</small></strong>
     
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

            <div class="menu-acciones">

              <button class="btn-menu" onclick="toggleMenu(this)">
                <i class="fa fa-ellipsis-v"></i>
              </button>

                <div class="menu-options">

                  <div class="accion-whatsapp" onclick="accionWhatsApp(this)">
                    <i class="fab fa-whatsapp"></i> WhatsApp
                  </div>

                  <div class="accion-editar" onclick="editarDesdeMenu(this)">
                    <i class="fa fa-pen"></i> Editar
                  </div>

                  <div class="accion-cancelar" onclick="cancelarDesdeMenu(this)">
                    <i class="fa fa-ban"></i> Cancelar
                  </div>

                </div>

            </div>

          </div>

    </div>
<div id="modalEditar" class="modal">

  <div class="modal-content">
    <h3>Reprogramar cita</h3>

    <label>Fecha:</label>
    <input type="date" id="editFecha">

    <label>Hora:</label>
    <input type="time" id="editHora">

    <div class="modal-actions">
      <button onclick="guardarReprogramacion()">Guardar</button>
      <button onclick="cerrarModal()">Cancelar</button>
    </div>
  </div>

</div>
  `;
}



async function cargarCitas() {

  
  const q = query(
    collection(db, "citas"),
    orderBy("fechaHora", "asc") // 🔥 clave
  );

  const snap = await getDocs(q);

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


    // ✅ estados que envían mensaje
    const estadosConMensaje = ["confirmada", "cancelada", "reprogramada"];


    if (estadoAnterior !== nuevoEstado && estadosConMensaje.includes(nuevoEstado)) {
      preguntarEnvioWhatsApp(select, nuevoEstado);
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

  // ✅ CONFIRMADA
  if (tipo === "confirmada") {
    mensaje =
`✅ CONFIRMACIÓN DE CITA DAVANAILS

Hola ${cliente} 👋

Tu cita ha sido CONFIRMADA ✅

📅 ${hora}
💅 ${servicio}

Te esperamos 💖`;
  }

  // ✅ CANCELADA
  if (tipo === "cancelada") {
    mensaje =
`❌ CITA CANCELADA

Hola ${cliente}

Tu cita ha sido cancelada.
Si deseas reprogramar, contáctanos 💅`;
  }

  // ✅ 🔄 REPROGRAMADA
  if (tipo === "reprogramada") {
    mensaje =
`🔄 CITA REPROGRAMADA

Hola ${cliente} 👋

Tu cita ha sido REPROGRAMADA.

📅 Nueva fecha y hora: ${hora}
💅 Servicio: ${servicio}

Por favor confirma si este horario te funciona ✅`;
  }

  const url = `https://wa.me/57${telefono}?text=${encodeURIComponent(mensaje)}`;

  window.open(url, "_blank");
}

function mostrarToast(msg, tipo = "ok") {

  const toast = document.createElement("div");
  toast.textContent = msg;

  toast.className = "toast " + tipo;

  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2000);
}


window.editarCita = async function(id) {

  const nuevaFecha = prompt("Nueva fecha (YYYY-MM-DD):");
  const nuevaHora = prompt("Nueva hora (HH:MM):");

  if (!nuevaFecha || !nuevaHora) return;

  const nuevaFechaHora = new Date(`${nuevaFecha}T${nuevaHora}:00`);

  try {

    await updateDoc(doc(db, "citas", id), {
      fechaHora: nuevaFechaHora,
      estado: "reprogramada"
    });

    enviarWhatsApp(select, "reprogramada");
    mostrarToast("Cita reprogramada 🔄", "ok");

    cargarCitas(); // refrescar tabla

  } catch (error) {
    console.error(error);
    mostrarToast("Error al reprogramar ❌", "error");
  }
}

/*modales*/
let citaActualId = null;

window.abrirModal = function(id) {
  citaActualId = id;
  document.getElementById("modalEditar").style.display = "flex";
}


window.cerrarModal = function() {
  document.getElementById("modalEditar").style.display = "none";
}

//guardar reprogramaci´pn import { doc, updateDoc }


window.guardarReprogramacion = async function() {

  const fecha = document.getElementById("editFecha").value;
  const hora = document.getElementById("editHora").value;

  if (!fecha || !hora) {
    mostrarToast("Completa fecha y hora ❌", "error");
    return;
  }

  const nuevaFechaHora = new Date(`${fecha}T${hora}:00`);

  try {

    await updateDoc(doc(db, "citas", citaActualId), {
      fechaHora: nuevaFechaHora,
      estado: "reprogramada"
    });

    mostrarToast("Cita reprogramada 🔄", "ok");

    cerrarModal();
    cargarCitas();

  } catch (error) {
    console.error(error);
    mostrarToast("Error ❌", "error");
  }
}


/*menú flotante*/
window.toggleMenu = function(btn) {

  const parent = btn.closest(".menu-acciones");
  parent.classList.toggle("open");

}

document.addEventListener("click", function(e) {

  document.querySelectorAll(".menu-acciones").forEach(menu => {
    if (!menu.contains(e.target)) {
      menu.classList.remove("open");
    }
  });

});



window.accionWhatsApp = function(el) {

  const row = el.closest(".t-row");

  const cliente = row.querySelector('[data-label="Cliente"] strong').innerText;
  const telefono = row.querySelector('[data-label="Cliente"] small').innerText;
  const hora = row.querySelector('[data-label="Hora"]').innerText;
  const servicio = row.querySelector('[data-label="Servicio"]').innerText;

  enviarWhatsApp(cliente, hora, servicio, "", telefono, "", "confirmada");
}


window.editarDesdeMenu = function (el) {

  const row = el.closest(".t-row");
  const id = row.dataset.id;

  abrirModal(id); // ya lo tienes ✅
}

window.cancelarDesdeMenu = function(el) {

  const row = el.closest(".t-row");
  const select = row.querySelector("select");

  select.value = "cancelada";

  cambiarEstado(select, row.dataset.id);
}

function preguntarEnvioWhatsApp(select, estado) {

  let mensaje = "";

  if (estado === "confirmada") {
    mensaje = "¿Enviar confirmación por WhatsApp?";
  }

  if (estado === "cancelada") {
    mensaje = "¿Enviar cancelación por WhatsApp?";
  }

  if (estado === "reprogramada") {
    mensaje = "¿Enviar reprogramación por WhatsApp?";
  }

  const confirmar = confirm(mensaje);

  if (confirmar) {
    enviarWhatsApp(
      obtenerCliente(select),
      obtenerHora(select),
      obtenerServicio(select),
      "",
      obtenerTelefono(select),
      "",
      estado
    );
  }
}

function obtenerCliente(select) {
  return select.closest(".t-row")
    .querySelector('[data-label="Cliente"] strong').innerText;
}

function obtenerTelefono(select) {
  return select.closest(".t-row")
    .querySelector('[data-label="Cliente"] small').innerText;
}

function obtenerHora(select) {
  return select.closest(".t-row")
    .querySelector('[data-label="Hora"]').innerText;
}

function obtenerServicio(select) {
  return select.closest(".t-row")
    .querySelector('[data-label="Servicio"]').innerText;
}

//menú flotante
window.toggleMenu = function(btn) {

  const menu = btn.closest(".menu-acciones");
  const dropdown = menu.querySelector(".menu-options");

  // cerrar otros
  document.querySelectorAll(".menu-acciones").forEach(m => {
    if (m !== menu) m.classList.remove("open");
  });

  menu.classList.toggle("open");

  // reset
  dropdown.style.top = "100%";
  dropdown.style.bottom = "auto";

  const rect = dropdown.getBoundingClientRect();

  // 🔴 si no cabe abajo → abrir arriba
  if (rect.bottom > window.innerHeight) {
    dropdown.style.top = "auto";
    dropdown.style.bottom = "100%";
  }
};

