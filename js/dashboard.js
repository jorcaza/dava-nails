// 🔥 IMPORTS FIREBASE
import { auth,db } from "/js/firebase-config.js";
import { signOut } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs,query, orderBy ,where} 
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


//formulario html

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

          option value="reprogramada" ${cita.estado === "reprogramada" ? "selected" : ""}>
            reprogramada
          </option>

        </select>

      </div>

        <div class="col" data-label="Acción">

          <div class="acciones">

            <!-- WhatsApp -->
            <a class="btn-accion btn-wa" title="Enviar WhatsApp"
              onclick="accionWhatsApp(this)">
              <i class="fab fa-whatsapp"></i>
            </a>

            <!-- Editar -->
            <a class="btn-accion btn-edit" title="Reprogramar cita"
              onclick="editarDesdeMenu(this)">
              <i class="fa-solid fa-clock"></i>
            </a>

            <!-- Cancelar -->
            <a class="btn-accion btn-cancel"
              onclick="cancelarDesdeMenu(this)">
              <i class="fa fa-ban"></i>
            </a>

          </div>

        </div>

    </div>
  <div id="modalEditar" class="modal">

    <div class="modal-content">

      <h3>Reprogramar cita</h3>

      <label>Fecha:</label>
      
      <input type="date" id="editFecha" oninput="onChangeFecha()">

      <label>Hora:</label>
      <select id="editHora" onchange="validarFormulario()">
        <option value="">Selecciona hora</option>
      </select>

      <div class="modal-actions">
        
        <button id="btnGuardar"
                class="btn-primary"
                onclick="guardarReprogramacion(this)"
                disabled>
          Guardar
        </button>

        <button class="btn-secondary"
                onclick="cerrarModal()">
          Cancelar
        </button>

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

  generarHoras(); // 🔥 clave
  document.getElementById("editFecha").value = "";
  document.getElementById("editHora").value = "";

  // 🔒 botón deshabilitado
  const btn = document.getElementById("btnGuardar");
  btn.disabled = true;
  btn.textContent = "Guardar";

  document.getElementById("modalEditar").style.display = "flex";
};


window.cerrarModal = function() {
  document.getElementById("modalEditar").style.display = "none";
}

//guardar reprogramaci´pn import { doc, updateDoc }


window.guardarReprogramacion = async function() {

  const btn = document.getElementById("btnGuardar");

  if (btn.disabled) return;

  btn.disabled = true;
  btn.textContent = "Guardando...";

  const fecha = document.getElementById("editFecha").value;
  const hora = document.getElementById("editHora").value;

  if (!fecha || !hora) {
    mostrarToast("Completa fecha y hora ❌", "error");

    btn.disabled = false;
    btn.textContent = "Guardar";
    return;
  }

  // 🔥 VALIDACIÓN 30 MIN
  if (!esHoraValida(hora)) {
    mostrarToast("Solo se permiten bloques de 30 min ⏰", "error");

    btn.disabled = false;
    btn.textContent = "Guardar";
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

    btn.disabled = false;
    btn.textContent = "Guardar";
  }
};





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

  const dropdown = btn
    .closest(".menu-acciones")
    .querySelector(".menu-options");

  // 🔴 cerrar todos
  document.querySelectorAll(".menu-options").forEach(d => {
    d.style.display = "none";
  });

  // ✅ mostrar primero
  dropdown.style.display = "block";
  dropdown.style.position = "fixed";

  // ✅ posición básica (SIN cálculos complejos)
  const rect = btn.getBoundingClientRect();

  let top = rect.bottom;
  let left = rect.left;

  // ✅ SI NO CABE ABAJO → SUBE
  if (top + 200 > window.innerHeight) {
    top = rect.top - 150;
  }

  // ✅ evita salir de pantalla
  if (left + 160 > window.innerWidth) {
    left = window.innerWidth - 170;
  }

  dropdown.style.top = top + "px";
  dropdown.style.left = left + "px";
};



window.validarFormulario = function() {

  const fecha = document.getElementById("editFecha").value;
  const hora = document.getElementById("editHora").value;
  const btn = document.getElementById("btnGuardar");

  if (fecha && hora) {
    btn.disabled = false; // ✅ activar
  } else {
    btn.disabled = true;  // 🔒 desactivar
  }

};

function esHoraValida(hora) {

  const [h, m] = hora.split(":").map(Number);

  return m === 0 || m === 30;
}

async function generarHoras() {

  const fecha = document.getElementById("editFecha").value;
  const select = document.getElementById("editHora");

  if (!fecha) return;

  const ocupadas = await obtenerHorasOcupadas(fecha);

  select.innerHTML = `<option value="">Selecciona hora</option>`;

  for (let h = 8; h <= 19; h++) {

    for (let m of [0, 30]) {

      const hora = String(h).padStart(2, "0");
      const minuto = String(m).padStart(2, "0");

      const valor = `${hora}:${minuto}`;

      // ✅ si está ocupada → deshabilitar
      const disabled = ocupadas.includes(valor) ? "disabled" : "";

      select.innerHTML += `
        <option value="${valor}" ${disabled}>
          ${valor} ${disabled ? "(ocupado)" : ""}
        </option>
      `;
    }
  }
}

//obtener horas programadas
import { collection, getDocs, query, where }
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

async function obtenerHorasOcupadas(fechaSeleccionada) {

  const fechaInicio = new Date(fechaSeleccionada + "T00:00:00");
  const fechaFin = new Date(fechaSeleccionada + "T23:59:59");

  const q = query(
    collection(db, "citas"),
    where("fechaHora", ">=", fechaInicio),
    where("fechaHora", "<=", fechaFin)
  );

  const snap = await getDocs(q);

  const ocupadas = [];

  snap.forEach(doc => {
    const data = doc.data();

    if (data.fechaHora) {
      const fecha = data.fechaHora.toDate();

      const hora = fecha.toTimeString().slice(0,5); // "HH:MM"
      ocupadas.push(hora);
    }
  });

  return ocupadas;
}

window.onChangeFecha = function() {
  generarHoras();
  validarFormulario();
};