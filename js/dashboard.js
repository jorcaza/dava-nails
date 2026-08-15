// 🔥 IMPORTS FIREBASE
import { auth,db } from "/js/firebase-config.js";
import { signOut } 
from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, getDocs, query, orderBy, where, getDoc, updateDoc, doc } 
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
  const d = dateStr ? parseDateInput(dateStr) : new Date();
  filterStart = startOfDay(d);
  filterEnd = endOfDay(d);
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
  const opts = { weekday: 'long', day: '2-digit', month: 'long' };
  const label = date.toLocaleDateString('es-CO', opts);
  return `Mostrando: ${label.charAt(0).toUpperCase()}${label.slice(1)}`;
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

window.actualizarKpis = async function(){
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



function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getFechaHora(cita) {
  if (!cita.fechaHora) return null;
  if (typeof cita.fechaHora.toDate === "function") return cita.fechaHora.toDate();
  return new Date(cita.fechaHora);
}

function formatHourLabel(fecha) {
  return fecha.toLocaleTimeString("es-CO", {
    hour: "2-digit",
    minute: "2-digit"
  });
}
function formatDateReadable(date) {
  return date.toLocaleDateString('es-ES');
}

function formatTimeReadable(date) {
  return date.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' });
}

function getDuracionMinutos(str) {
  if (!str) return 30;
  return parseInt(String(str).replace(/[^0-9]/g, '')) || 30;
}

function slotsFromCita(cita) {
  const slots = [];
  const fecha = getFechaHora(cita);
  if (!fecha) return slots;
  const minutos = getDuracionMinutos(cita.duracion || cita.duracionMin || cita.duracionM || '') ;
  const bloques = Math.ceil(minutos / 30);

  let h = fecha.getHours();
  let m = fecha.getMinutes();

  for (let i = 0; i < bloques; i++) {
    slots.push(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`);
    m += 30;
    if (m >= 60) { m = 0; h++; }
  }

  return slots;
}

function crearEventoCalendario(cita) {
  const fecha = getFechaHora(cita);
  const horaLabel = fecha ? formatHourLabel(fecha) : "?";
  const durMin = getDuracionMinutos(cita.duracion || '30');
  const fechaFin = fecha ? new Date(fecha.getTime() + durMin * 60000) : null;
  const horaFinLabel = fechaFin ? formatHourLabel(fechaFin) : "?";
  const servicio = cita.servicioNombre || "?";
  const manicurista = cita.manicuristaNombre || "?";
  const estado = cita.estado || "pendiente";
  const estadoLabel = {
    pendiente: "Pendiente",
    confirmada: "Confirmada",
    completada: "Completada",
    cancelada: "Cancelada",
    reprogramada: "Reprogramada"
  }[estado] || estado;

  const dataFecha = fecha ? formatDateReadable(fecha) : '';
  const dataHora = fecha ? formatTimeReadable(fecha) : '';
  const bloques = Math.max(1, Math.ceil(durMin / 30));

  return `
    <article class="appointment-card status-${estado}" data-id="${escapeHtml(cita.id)}" data-fecha="${escapeHtml(dataFecha)}" data-hora="${escapeHtml(dataHora)}" data-duracion="${escapeHtml(String(cita.duracion || ''))}" style="--blocks:${bloques};" onclick="editarCitaDesdeCalendario('${escapeHtml(cita.id)}')">
      <div class="appointment-top">
        <div>
          <div class="appointment-client">${escapeHtml(cita.cliente || "Cliente")}</div>
          <div class="appointment-phone">${escapeHtml(cita.telefono || "")}</div>
        </div>
        <span class="status-pill status-${estado}">${escapeHtml(estadoLabel)}</span>
      </div>

      <div class="appointment-meta">
        <div class="meta-item"><i class="fa-regular fa-clock"></i><span>${escapeHtml(`${horaLabel} - ${horaFinLabel}`)}</span></div>
        <div class="meta-item"><i class="fa-solid fa-spa"></i><span>${escapeHtml(servicio)}</span></div>
        <div class="meta-item"><i class="fa-solid fa-user-check"></i><span>${escapeHtml(manicurista)}</span></div>
      </div>

      <div class="appointment-actions">
        <select class="estado-select estado-${estado}" data-estado-anterior="${escapeHtml(estado)}" onclick="event.stopPropagation()" onchange="cambiarEstado(this, '${escapeHtml(cita.id)}')">
          <option value="pendiente" ${estado === "pendiente" ? "selected" : ""}>Pendiente</option>
          <option value="confirmada" ${estado === "confirmada" ? "selected" : ""}>Confirmada</option>
          <option value="completada" ${estado === "completada" ? "selected" : ""}>Completada</option>
          <option value="cancelada" ${estado === "cancelada" ? "selected" : ""}>Cancelada</option>
          <option value="reprogramada" ${estado === "reprogramada" ? "selected" : ""}>Reprogramada</option>
        </select>

        <div class="acciones" onclick="event.stopPropagation()">
          <a class="icon-btn btn-wa" title="Enviar WhatsApp" onclick="event.stopPropagation(); accionWhatsApp(this)"><i class="fab fa-whatsapp"></i></a>
          <a class="icon-btn btn-edit" title="Reprogramar cita" onclick="event.stopPropagation(); editarDesdeMenu(this)"><i class="fa-solid fa-clock"></i></a>
          <a class="icon-btn btn-cancel" title="Cancelar cita" onclick="event.stopPropagation(); cancelarDesdeMenu(this)"><i class="fa fa-ban"></i></a>
        </div>
      </div>
    </article>
  `;
}

function crearFila(cita) {
  return crearEventoCalendario(cita);
}

async function cargarCitas() {
  if (!filterStart || !filterEnd) applyDateFilter();

  const q = query(
    collection(db, "citas"),
    where("fechaHora", ">=", filterStart),
    where("fechaHora", "<=", filterEnd),
    orderBy("fechaHora", "asc")
  );

  const snap = await getDocs(q);
  const container = document.getElementById("citasContainer");
  const calendarTitle = document.getElementById("calendarTitle");
  const calendarSummary = document.getElementById("calendarSummary");
  const citasProcesadas = [];

  for (const docu of snap.docs) {
    let cita = docu.data();
    cita.id = docu.id;
    cita.estado = cita.estado || "pendiente";

    if (statusFilter && statusFilter !== 'all' && cita.estado !== statusFilter) continue;

    if (searchQuery) {
      const cliente = String(cita.cliente || "").toLowerCase();
      const telefono = String(cita.telefono || "").toLowerCase();
      if (!cliente.includes(searchQuery) && !telefono.includes(searchQuery)) continue;
    }

    if (cita.servicio) {
      try {
        if (typeof cita.servicio === "object") {
          const servicioSnap = await getDoc(cita.servicio);
          if (servicioSnap.exists()) {
            const sdata = servicioSnap.data();
            cita.servicioNombre = sdata.nombre;
            if (sdata.duracion) cita.duracion = sdata.duracion;
          }
        } else {
          cita.servicioNombre = cita.servicio;
        }
      } catch (e) {
        console.warn("Error cargando servicio:", e);
        cita.servicioNombre = cita.servicioNombre || "?";
      }
    }

    if (cita.manicurista) {
      try {
        const maniSnap = await getDoc(cita.manicurista);
        cita.manicuristaNombre = maniSnap.data().nombre;
      } catch (e) {
        console.warn('Error cargando manicurista', e);
      }
    }

    try {
      const inicio = getFechaHora(cita);
      cita._start = inicio;
      const durMin = getDuracionMinutos(cita.duracion || cita.duracionMin || cita.duracionM || '30');
      const fin = inicio ? new Date(inicio.getTime() + durMin * 60000) : null;
      cita._end = fin;
      cita._slots = inicio ? slotsFromCita(cita) : [];
    } catch (e) {
      cita._start = null;
      cita._end = null;
      cita._slots = [];
    }

    citasProcesadas.push(cita);
  }

  const selectedDate = filterStart ? new Date(filterStart) : new Date();
  const today = new Date();
  const isToday = selectedDate.toDateString() === today.toDateString();
  const currentHour = today.getHours();
  const currentMinute = today.getMinutes();

  if (calendarTitle) {
    const titleLabel = selectedDate.toLocaleDateString("es-CO", { weekday: "long", day: "2-digit", month: "long" });
    calendarTitle.textContent = titleLabel.charAt(0).toUpperCase() + titleLabel.slice(1);
  }

  if (calendarSummary) {
    calendarSummary.textContent = `${citasProcesadas.length} cita${citasProcesadas.length === 1 ? "" : "s"}`;
  }

  const slots = [];
  for (let h = 8; h <= 20; h++) {
    for (const m of [0, 30]) {
      const slotLabel = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      const slotStart = new Date(selectedDate);
      slotStart.setHours(h, m, 0, 0);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + 30);
      slots.push({ slotLabel, slotStart, slotEnd });
    }
  }

  container.innerHTML = slots.map(({ slotLabel, slotStart, slotEnd }) => {
    const slotOcultoPorCita = citasProcesadas.some(cita => {
      if ((cita.estado || 'pendiente') === 'cancelada' || !cita._start || !cita._end) return false;
      return cita._start < slotStart && slotEnd <= cita._end;
    });

    if (slotOcultoPorCita) return "";

    const citasSlot = citasProcesadas.filter(cita => {
      if ((cita.estado || 'pendiente') === 'cancelada') return false;
      return cita._start && cita._end && cita._start < slotEnd && cita._end > slotStart;
    });

    const selectedDateIso = formatDateForInput(selectedDate);
    let contenido = '';

    if (citasSlot.length) {
      const citasInicio = citasSlot.filter(cita => cita._start >= slotStart && cita._start < slotEnd);
      if (citasInicio.length) {
        contenido = citasInicio.map(crearEventoCalendario).join("");
      } else {
        contenido = "";
      }
    } else {
      contenido = `<div class="hour-empty clickable" onclick="irAReserva('${escapeHtml(selectedDateIso)}', '${slotLabel}')">Espacio libre</div>`;
    }

    const isCurrentSlot = isToday && (() => {
      const currentSlotStart = new Date(selectedDate);
      currentSlotStart.setHours(currentHour, currentMinute < 30 ? 0 : 30, 0, 0);
      return slotStart.getTime() === currentSlotStart.getTime();
    })();

    return `
      <div class="hour-row ${isCurrentSlot ? "current-hour" : ""}">
        <div class="hour-label"><span>${slotLabel}</span></div>
        <div class="hour-column">${contenido}</div>
      </div>
    `;
  }).join("");
}


// initialize filters, KPIs and load data
initFilters();
actualizarKpis();
cargarCitas();

window.getReservaUrl = function(fecha, hora, editId) {
  const params = new URLSearchParams();
  params.set('fecha', fecha);
  params.set('hora', hora);
  if (editId) params.set('editId', editId);
  return `reservar-cita.html?${params.toString()}`;
};

window.irAReserva = function(fecha, hora, editId) {
  window.location.href = window.getReservaUrl(fecha, hora, editId);
};

window.editarCitaDesdeCalendario = function(id) {
  const fecha = document.getElementById('filterDate')?.value || '';
  const hora = '';
  if (!id) return;
  window.location.href = `reservar-cita.html?editId=${encodeURIComponent(id)}`;
};


window.cambiarEstado = async function(select, id) {

  const nuevoEstado = select.value;
  const estadoAnterior = select.dataset.estadoAnterior;

  if (nuevoEstado === 'cancelada' && estadoAnterior !== 'cancelada') {
    const { isConfirmed } = await Swal.fire({
      title: 'Cancelar cita',
      text: '�Deseas marcar esta cita como cancelada?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'S�, cancelar',
      cancelButtonText: 'Volver',
      confirmButtonColor: '#d33'
    });

    if (!isConfirmed) {
      select.value = estadoAnterior || 'pendiente';
      return;
    }
  }

  try {

    // si se cancela, adem�s liberamos el slot quitando la fecha/hora
    if (nuevoEstado === 'cancelada') {
      await updateDoc(doc(db, "citas", id), {
        estado: nuevoEstado,
        fechaHora: null,
        fecha: null,
        hora: null
      });
    } else {
      await updateDoc(doc(db, "citas", id), {
        estado: nuevoEstado
      });
    }

    // ✅ actualizar color
    select.className = "estado-select estado-" + nuevoEstado;

    const card = select.closest(".appointment-card");
    if (card) {
      card.className = card.className.replace(/\bstatus-[^\s]+/g, "").trim();
      card.classList.add("status-" + nuevoEstado);

      const pill = card.querySelector(".status-pill");
      if (pill) {
        pill.className = pill.className.replace(/\bstatus-[^\s]+/g, "").trim();
        pill.classList.add("status-" + nuevoEstado);
        const labels = {
          pendiente: "Pendiente",
          confirmada: "Confirmada",
          completada: "Completada",
          cancelada: "Cancelada",
          reprogramada: "Reprogramada"
        };
        pill.textContent = labels[nuevoEstado] || nuevoEstado;
      }
    }

    // ✅ REGLAS DE ENVÍO 🔥


    // ✅ estados que envían mensaje
    const estadosConMensaje = ["confirmada", "cancelada", "reprogramada"];


    if (estadoAnterior !== nuevoEstado && estadosConMensaje.includes(nuevoEstado)) {
      await preguntarEnvioWhatsApp(select, nuevoEstado);
    }


    // ✅ actualizar estado anterior
    select.dataset.estadoAnterior = nuevoEstado;


    
    
    // ✅ 🔥 MOSTRAR TOAST
    mostrarToast("Guardado ✅", "ok");
    actualizarKpis();
    // refrescar lista para que la UI muestre cambios inmediatamente
    if (typeof cargarCitas === 'function') cargarCitas();

  } catch (error) {
    console.error("❌ Error:", error);
    mostrarToast("Error al guardar ❌", "error");
  }
};

function enviarWhatsApp(selectOrCliente, tipoOrHora, servicioParam, manicuristaParam, telefonoParam, fecha, tipoExplicit) {
  let cliente = "";
  let hora = "";
  let tipo = "";
  let servicio = "";
  let manicurista = "";
  let telefono = "";
  let fechaTexto = "";

  if (typeof selectOrCliente === 'string') {
    cliente = String(selectOrCliente || "").trim();
    hora = String(tipoOrHora || "").trim();
    servicio = String(servicioParam || "").trim();
    manicurista = String(manicuristaParam || "").trim();
    telefono = String(telefonoParam || "").trim();
    tipo = String(tipoExplicit || "").trim();
    fechaTexto = String(fecha || "").trim();
  } else {
    const card = selectOrCliente?.closest?.('.appointment-card') || selectOrCliente;
    cliente = card?.querySelector('.appointment-client')?.textContent.trim() || "";
    telefono = card?.querySelector('.appointment-phone')?.textContent.trim() || "";
    fechaTexto = card?.dataset?.fecha || "";
    hora = card?.dataset?.hora || card?.querySelector('.meta-item')?.textContent.trim() || "";
    servicio = card?.querySelectorAll('.meta-item')[1]?.textContent.trim() || "";
    manicurista = card?.querySelectorAll('.meta-item')[2]?.textContent.trim() || "Sin preferencia";

    const estadoReal = tipoOrHora;
    if (estadoReal === "pendiente") tipo = "confirmada";
    else if (estadoReal === "confirmada") tipo = "recordatorio";
    else tipo = estadoReal;
  }

  const lines = [];
  if (tipo === "confirmada") {
    lines.push("? CONFIRMACI�N DE CITA DAVANAILS");
    if (cliente) lines.push(`Hola ${cliente}`);
    lines.push("");
    lines.push("Tu cita ha sido CONFIRMADA");
    if (fechaTexto) lines.push(`?? Fecha: ${fechaTexto}`);
    if (hora) lines.push(`? Hora: ${hora}`);
    if (servicio) lines.push(`?? Servicio: ${servicio}`);
    if (manicurista) lines.push(`?? Manicurista: ${manicurista}`);
    lines.push("");
    lines.push("Te esperamos ??");
  } else if (tipo === "cancelada") {
    lines.push("CITA CANCELADA");
    if (cliente) lines.push(`Hola ${cliente}`);
    lines.push("");
    lines.push("Tu cita ha sido cancelada.");
    lines.push("Si deseas reprogramar, cont�ctanos");
  } else if (tipo === "reprogramada") {
    lines.push("?? CITA REPROGRAMADA");
    if (cliente) lines.push(`Hola ${cliente}`);
    lines.push("");
    lines.push("Tu cita ha sido REPROGRAMADA.");
    if (fechaTexto) lines.push(`?? Fecha: ${fechaTexto}`);
    if (hora) lines.push(`? Hora: ${hora}`);
    if (servicio) lines.push(`?? Servicio: ${servicio}`);
    if (manicurista) lines.push(`?? Manicurista: ${manicurista}`);
    lines.push("");
    lines.push("Por favor confirma si este horario te funciona");
  } else if (tipo === "recordatorio") {
    lines.push("?? RECORDATORIO DE CITA DAVANAILS");
    if (cliente) lines.push(`Hola ${cliente}`);
    lines.push("");
    lines.push("Te recordamos tu cita programada:");
    if (fechaTexto) lines.push(`?? Fecha: ${fechaTexto}`);
    if (hora) lines.push(`? Hora: ${hora}`);
    if (servicio) lines.push(`?? Servicio: ${servicio}`);
    if (manicurista) lines.push(`?? Manicurista: ${manicurista}`);
    lines.push("");
    lines.push("�Te esperamos! ??");
  }

  const mensaje = lines.join("\n").normalize("NFKC").replace(/\uFE0F/g, "").trim();

  if (!mensaje) {
    console.warn("No se pudo construir el mensaje de WhatsApp.");
    return;
  }

  const telefonoLimpio = String(telefono).replace(/\D/g, "");
  if (!telefonoLimpio) {
    console.warn("No hay tel�fono para abrir WhatsApp.");
    return;
  }

  const url = `https://wa.me/57${telefonoLimpio}?text=${encodeURIComponent(mensaje)}`;
  console.log("WA URL:", url);

  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (error) {
    window.location.href = url;
  }
}
function mostrarToast(msg, tipo = "ok") {

  const toast = document.createElement("div");
  toast.textContent = msg;

  toast.className = "toast " + tipo;

  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2000);
}


window.editarCita = async function(id) {

  const { value } = await Swal.fire({
    title: 'Reprogramar cita',
    html: `
      <div style="display:flex;flex-direction:column;gap:12px;">
        <label style="text-align:left;font-weight:600;">Nueva fecha</label>
        <input id="swal-fecha" type="date" class="swal2-input" style="margin:0;">
        <label style="text-align:left;font-weight:600;">Nueva hora</label>
        <input id="swal-hora" type="time" step="1800" class="swal2-input" style="margin:0;">
      </div>
    `,
    focusConfirm: false,
    showCancelButton: true,
    confirmButtonText: 'Guardar',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const nuevaFecha = document.getElementById('swal-fecha')?.value;
      const nuevaHora = document.getElementById('swal-hora')?.value;

      if (!nuevaFecha || !nuevaHora) {
        Swal.showValidationMessage('Debes completar fecha y hora.');
        return false;
      }

      return { nuevaFecha, nuevaHora };
    }
  });

  if (!value) return;

  const nuevaFechaHora = new Date(`${value.nuevaFecha}T${value.nuevaHora}:00`);

  try {

    await updateDoc(doc(db, "citas", id), {
      fechaHora: nuevaFechaHora,
      estado: "reprogramada"
    });

    const cardEl = document.querySelector(`.appointment-card[data-id="${id}"]`);
    enviarWhatsApp(cardEl, "reprogramada");
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
  const card = el.closest(".appointment-card");
  const estado = card?.querySelector("select")?.value || "pendiente";
  enviarWhatsApp(card, estado);
};


window.editarDesdeMenu = function (el) {
  const card = el.closest(".appointment-card");
  const id = card?.dataset.id;

  if (id) abrirModal(id);
};

window.cancelarDesdeMenu = async function(el) {
  const card = el.closest(".appointment-card");
  const select = card?.querySelector("select");

  if (!select || !card?.dataset.id) return;

  const { isConfirmed } = await Swal.fire({
    title: 'Cancelar cita',
    text: '�Deseas cancelar esta cita antes de continuar?',
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'S�, cancelar',
    cancelButtonText: 'Volver',
    confirmButtonColor: '#d33'
  });

  if (!isConfirmed) return;

  select.value = "cancelada";
  await cambiarEstado(select, card.dataset.id);
};

async function preguntarEnvioWhatsApp(select, estado) {

  let mensaje = "";

  if (estado === "confirmada") {
    mensaje = "�Enviar confirmaci�n por WhatsApp?";
  }

  if (estado === "cancelada") {
    mensaje = "�Enviar cancelaci�n por WhatsApp?";
  }

  if (estado === "reprogramada") {
    mensaje = "�Enviar reprogramaci�n por WhatsApp?";
  }

  const { isConfirmed } = await Swal.fire({
    title: 'WhatsApp',
    text: mensaje,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'S�, enviar',
    cancelButtonText: 'No enviar'
  });

  if (isConfirmed) {
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
  return select.closest(".appointment-card")?.querySelector('.appointment-client').innerText || "";
}

function obtenerTelefono(select) {
  return select.closest(".appointment-card")?.querySelector('.appointment-phone').innerText || "";
}

function obtenerHora(select) {
  return select.closest(".appointment-card")?.querySelectorAll('.meta-item')[0]?.innerText || "";
}

function obtenerServicio(select) {
  return select.closest(".appointment-card")?.querySelectorAll('.meta-item')[1]?.innerText || "";
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
      const durMin = getDuracionMinutos(data.duracion || '30');
      const fin = new Date(fecha.getTime() + durMin * 60000);
      let cursor = new Date(fecha);

      while (cursor < fin) {
        const hora = `${String(cursor.getHours()).padStart(2, "0")}:${String(cursor.getMinutes()).padStart(2, "0")}`;
        ocupadas.push(hora);
        cursor = new Date(cursor.getTime() + 30 * 60000);
      }
    }
  });

  return ocupadas;
}

window.onChangeFecha = function() {
  generarHoras();
  validarFormulario();
};

