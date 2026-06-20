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

/* ================= DASHBOARD FILTERS & METRICS ================= */
let filterStart = null;
let filterEnd = null;
let statusFilter = localStorage.getItem('dsf_status') || 'all';
let searchQuery = localStorage.getItem('dsf_search') || '';
let debounceSearchTimer = null;

function startOfDay(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0,0,0); }
function endOfDay(d){ return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23,59,59); }
function parseDateInput(value) {
  if (!value) return new Date();
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function formatDateForInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function initFilters() {
  const fd = document.getElementById('filterDate');
  const sc = document.getElementById('searchCitas');
  const clearBtn = document.getElementById('clearFilterBtn');

  const today = new Date();
  if (fd) {
    const iso = formatDateForInput(today);
    fd.value = localStorage.getItem('dsf_date') || iso;
    fd.addEventListener('change', onFilterDateChange);
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', resetFilter);
  }

  if (sc) {
    sc.value = searchQuery || '';
    sc.addEventListener('input', (e)=>{
      clearTimeout(debounceSearchTimer);
      debounceSearchTimer = setTimeout(()=>{
        searchQuery = String(e.target.value || '').trim().toLowerCase();
        localStorage.setItem('dsf_search', searchQuery);
        cargarCitas();
      }, 300);
    });
  }

  // set initial date range (default: hoy + mañana)
  applyDateFilter();
  updateRangeLabel();
  updateTopbarSubtitle();
  // attach KPI card listeners and visual state
  const kpis = document.querySelectorAll('.kpi-strip .kpi-card');
  if (kpis && kpis.length >= 4) {
    const map = ['all','completada','pendiente','confirmada'];
    kpis.forEach((c, i) => {
      c.dataset.estado = map[i] || 'all';
      c.addEventListener('click', ()=> setEstadoFilter(c.dataset.estado));
      if (c.dataset.estado === statusFilter) c.classList.add('active');
    });
  }
}

function onFilterDateChange() {
  const fd = document.getElementById('filterDate');
  localStorage.setItem('dsf_date', fd ? fd.value : '');
  applyDateFilter();
  updateRangeLabel();
  updateTopbarSubtitle();
  cargarCitas();
  actualizarKpis();
}

function applyDateFilter(){
  const fd = document.getElementById('filterDate');
  const dateStr = fd ? fd.value : null;
  let d = dateStr ? parseDateInput(dateStr) : new Date();
  filterStart = startOfDay(d);
  const tomo = new Date(d);
  tomo.setDate(tomo.getDate()+1);
  filterEnd = endOfDay(tomo);
}

function setEstadoFilter(estado){
  if (statusFilter === estado) {
    statusFilter = 'all';
  } else {
    statusFilter = estado;
  }
  localStorage.setItem('dsf_status', statusFilter);
  // update visual
  document.querySelectorAll('.kpi-strip .kpi-card').forEach(c=>{
    if (c.dataset.estado === statusFilter) c.classList.add('active'); else c.classList.remove('active');
  });
  cargarCitas();
}

function resetFilter(){
  const fd = document.getElementById('filterDate');
  const today = new Date();
  const iso = formatDateForInput(today);
  if (fd) fd.value = iso;
  localStorage.setItem('dsf_date', iso);
  applyDateFilter();
  updateRangeLabel();
  updateTopbarSubtitle();
  cargarCitas();
  actualizarKpis();
}

function formatRangeLabel(date) {
  const opts = { day: '2-digit', month: 'short' };
  const d1 = date.toLocaleDateString('es-CO', opts);
  const next = new Date(date);
  next.setDate(next.getDate()+1);
  const d2 = next.toLocaleDateString('es-CO', opts);
  return `Mostrando: ${d1} - ${d2}`;
}

function updateRangeLabel(){
  const fd = document.getElementById('filterDate');
  const rangeEl = document.getElementById('rangeLabel');
  const dateStr = fd ? fd.value : null;
  const date = dateStr ? parseDateInput(dateStr) : new Date();
  if (rangeEl) rangeEl.textContent = formatRangeLabel(date);
}

function updateTopbarSubtitle(){
  const fd = document.getElementById('filterDate');
  const subtitle = document.getElementById('topbarSubtitle');
  const dateStr = fd ? fd.value : null;
  const date = dateStr ? parseDateInput(dateStr) : new Date();
  if (subtitle) subtitle.textContent = formatRangeLabel(date);
}

async function actualizarKpis(){
  if (!filterStart || !filterEnd) applyDateFilter();
  const qk = query(
    collection(db, 'citas'),
    where('fechaHora', '>=', filterStart),
    where('fechaHora', '<=', filterEnd)
  );
  const snap = await getDocs(qk);
  let total = 0, comp=0, pend=0, conf=0;
  snap.forEach(docu=>{
    total++;
    const e = (docu.data().estado || 'pendiente');
    if (e === 'completada') comp++;
    if (e === 'pendiente') pend++;
    if (e === 'confirmada') conf++;
  });
  const elTotal = document.getElementById('kpi-total');
  const elComp = document.getElementById('kpi-completadas');
  const elPend = document.getElementById('kpi-pendientes');
  const elConf = document.getElementById('kpi-confirmadas');
  const badge = document.getElementById('badgeToday');
  if (elTotal) elTotal.textContent = total;
  if (elComp) elComp.textContent = comp;
  if (elPend) elPend.textContent = pend;
  if (elConf) elConf.textContent = conf;
  if (badge) badge.textContent = `💅 ${total} citas`; 
}



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
  // build time-filtered query
  if (!filterStart || !filterEnd) applyDateFilter();

  const q = query(
    collection(db, "citas"),
    where("fechaHora", ">=", filterStart),
    where("fechaHora", "<=", filterEnd),
    orderBy("fechaHora", "asc")
  );

  const snap = await getDocs(q);
  const container = document.getElementById("citasContainer");
  container.innerHTML = "";

  for (const docu of snap.docs) {
    let cita = docu.data();
    cita.id = docu.id;
    cita.estado = cita.estado || "pendiente";

    // filter by status if needed
    if (statusFilter && statusFilter !== 'all' && cita.estado !== statusFilter) continue;

    // filter by searchQuery if present
    if (searchQuery) {
      const cliente = String(cita.cliente || "").toLowerCase();
      const telefono = String(cita.telefono || "").toLowerCase();
      if (!cliente.includes(searchQuery) && !telefono.includes(searchQuery)) continue;
    }

    // resolve servicio name
    if (cita.servicio) {
      try {
        if (typeof cita.servicio === "object") {
          const servicioSnap = await getDoc(cita.servicio);
          if (servicioSnap.exists()) cita.servicioNombre = servicioSnap.data().nombre;
        } else {
          cita.servicioNombre = cita.servicio;
        }
      } catch(e){
        console.warn("Error cargando servicio:", e);
        cita.servicioNombre = cita.servicioNombre || "—";
      }
    }

    if (cita.manicurista) {
      try{
        const maniSnap = await getDoc(cita.manicurista);
        cita.manicuristaNombre = maniSnap.data().nombre;
      }catch(e){
        console.warn('Error cargando manicurista', e);
      }
    }

    container.innerHTML += crearFila(cita);
  }
}


// initialize filters, KPIs and load data
initFilters();
actualizarKpis();
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


function enviarWhatsApp(selectOrCliente, tipoOrHora, servicio, manicuristaParam, telefono, fecha, tipoExplicit){
  let cliente, hora, tipo, manicurista;

  // Si el primer parámetro es un string, es la firma explícita
  if (typeof selectOrCliente === 'string') {
    cliente = selectOrCliente;
    hora = tipoOrHora;
    servicio = servicio;
    manicurista = manicuristaParam || '';
    telefono = telefono;
    tipo = tipoExplicit || '';
  } else {
    // Si es un elemento DOM, extraer datos de la fila
    const select = selectOrCliente;
    tipo = tipoOrHora;
    const row = select.closest(".t-row");
    cliente = row.querySelector('[data-label="Cliente"] strong').innerText;
    telefono = row.querySelector('[data-label="Cliente"] small').innerText;
    hora = row.querySelector('[data-label="Hora"]').innerText;
    servicio = row.querySelector('[data-label="Servicio"]').innerText;
    manicurista = row.querySelector('[data-label="Manicurista"]')?.innerText || '';
  }

  let mensaje = "";

  // ✅ CONFIRMADA
  if (tipo === "confirmada") {
    mensaje =
`✅ CONFIRMACIÓN DE CITA DAVANAILS

Hola ${cliente}

Tu cita ha sido CONFIRMADA ✅

📅 Hora: ${hora}
💅 Servicio: ${servicio}
👩‍🦰 Manicurista: ${manicurista}

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

Hola ${cliente}

Tu cita ha sido REPROGRAMADA.

📅 Hora: ${hora}
💅 Servicio: ${servicio}
👩‍🦰 Manicurista: ${manicurista}

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