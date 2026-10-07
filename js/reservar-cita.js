/* ================= FIREBASE ================= */
import {
  collection,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";


import { db } from "./firebase-config.js";

/* ================= STATE ================= */
const fechaInput = document.getElementById('fecha');
const nombreInput = document.getElementById('nombre');
const apellidoInput = document.getElementById('apellido');
const celularInput = document.getElementById('celular');
const emailInput = document.getElementById('email');
const primeraInput = document.getElementById('primera');
const notasInput = document.getElementById('notas');
const clienteSearchInput = document.getElementById('clienteSearch');
const MANICURISTA_PREDETERMINADA = 'Stefany nava';

const booking = {
  servicio: '',
  servicioId: '',
  duracion: '',
  duracionCita: 0,
  precio: 0,
  manicurista: MANICURISTA_PREDETERMINADA,
  fechaRaw: '',
  hora: '',
  cliente: null,
  clienteRef: null,
  editId: null,
  prefilledDateTime: false
};

function normalizarPrecioNumero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
  if (!valor && valor !== 0) return 0;

  const limpio = String(valor)
    .replace(/\$/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '')
    .replace(/\s/g, '');

  const numero = Number(limpio);
  return Number.isFinite(numero) ? numero : 0;
}

let selectedCliente = null;
let lastQuery = '';
let debounceTimer = null;
let serviciosDisponibles = [];

const buscarServicioInput = document.getElementById('buscarServicio');
if (buscarServicioInput) {
  buscarServicioInput.addEventListener('input', () => {
    renderServicios(buscarServicioInput.value);
  });
}

function getQueryParams() {
  return new URLSearchParams(window.location.search);
}

async function prefillFromQuery() {
  const params = getQueryParams();
  const fecha = params.get('fecha');
  const hora = params.get('hora');
  const editId = params.get('editId');

  if (editId) {
    try {
      const citaDoc = await getDoc(doc(db, 'citas', editId));
      if (citaDoc.exists()) {
        const data = citaDoc.data();
        const fechaHora = data.fechaHora?.toDate();
        if (fechaHora) {
          const fechaIso = fechaHora.toISOString().slice(0, 10);
          const horaRaw = fechaHora.toTimeString().slice(0, 5);
          booking.fechaRaw = fechaIso;
          booking.hora = formatHora(horaRaw);
          booking.prefilledDateTime = true;
          if (fechaInput) fechaInput.value = fechaIso;
        }

        if (data.servicio) {
          booking.servicioId = data.servicio.id || data.servicio;
          booking.servicio = data.servicioNombre || '';
          booking.duracion = data.duracion || '';
          try {
            const servicioSnap = await getDoc(doc(db, 'servicios', booking.servicioId));
            const duracionServicio = servicioSnap.exists() ? servicioSnap.data().duracion : null;
            if (duracionServicio) {
              booking.duracion = `${duracionServicio} min`;
            }
          } catch (error) {
            console.warn('No se pudo cargar la duración original del servicio:', error);
          }
          booking.duracionCita = Number(data.duracionCita) || getDuracionMinutos(booking.duracion);
          booking.precio = normalizarPrecioNumero(data.precio ?? 0);
        }

        if (data.manicuristaNombre) {
          booking.manicurista = data.manicuristaNombre;
        }

        booking.editId = editId;

        if (data.cliente) {
          const nombreCompleto = String(data.cliente).trim();
          const parts = nombreCompleto.split(' ');
          const first = parts.shift() || '';
          const last = parts.join(' ');
          if (nombreInput) nombreInput.value = first;
          if (apellidoInput) apellidoInput.value = last;
        }

        if (celularInput) celularInput.value = normalizePhone(data.telefono || '');
        if (emailInput) emailInput.value = data.email || '';
        if (primeraInput) primeraInput.value = data.primera || 'si';
        if (notasInput) notasInput.value = data.notas || '';
      }
    } catch (error) {
      console.warn('No se pudo cargar la cita para editar:', error);
    }
  } else if (fecha) {
    booking.fechaRaw = fecha;
    if (fechaInput) fechaInput.value = fecha;
  }

  if (hora && !booking.hora) {
    booking.hora = formatHora(hora);
  }

  if (fecha && hora) {
    booking.prefilledDateTime = true;
  }

  if (booking.fechaRaw) {
    await renderSlots();
  }

  if (booking.hora) {
    const slot = Array.from(document.querySelectorAll('.slot')).find(s => s.textContent.trim() === booking.hora);
    if (slot) {
      slot.classList.add('selected');
    }
  }

  highlightSelectedService();
  highlightSelectedManicurista();
  actualizarControlDuracionCita();

  applyPrefilledDateTimeState();
}

function highlightSelectedService() {
  if (!booking.servicioId) return;
  renderServicios(buscarServicioInput?.value || '');
  const cards = document.querySelectorAll('.svc-card');
  cards.forEach(card => {
    if (card.dataset.servicioId === booking.servicioId) {
      card.classList.add('selected');
      const input = card.querySelector('input[type="radio"]');
      if (input) input.checked = true;
    }
  });
}

function highlightSelectedManicurista() {
  const pills = document.querySelectorAll('.mani-pill');
  pills.forEach(pill => {
    const input = pill.querySelector('input[type="radio"]');
    const selected = Boolean(input && input.value === booking.manicurista);
    pill.classList.toggle('selected', selected);
    if (input) input.checked = selected;
  });
}

function applyPrefilledDateTimeState() {
  if (!booking.prefilledDateTime) return;

  const panel2 = document.getElementById('panel2');
  if (panel2) panel2.style.display = 'none';

  const step2 = document.getElementById('s2');
  if (step2) {
    step2.classList.add('done');
    step2.classList.remove('active');
  }

  const line1 = document.getElementById('line1');
  if (line1) line1.classList.add('done');

  const panel1 = document.getElementById('panel1');
  if (panel1 && !document.getElementById('prefillInfoBox')) {
    const infoBox = document.createElement('div');
    infoBox.id = 'prefillInfoBox';
    infoBox.className = 'prefill-info';
    infoBox.textContent = `Fecha y hora predefinidas: ${booking.fechaRaw} - ${booking.hora}`;
    panel1.insertBefore(infoBox, panel1.querySelector('.field'));
  }

  const btnContinue = document.getElementById('btnContinueService');
  if (btnContinue) {
    btnContinue.textContent = 'Siguiente: tus datos';
    btnContinue.onclick = () => goTo(3);
  }
}

window.debouncedBuscar = function (text) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    buscarClientes(text);
  }, 350);
};


/* ================= SERVICIOS DINÁMICOS ================= */
async function cargarServicios() {
  const container = document.querySelector(".service-grid");

  try {
    const q = query(
      collection(db, "servicios"),
      orderBy("nombre")
    );

    const [snap, citasSnap] = await Promise.all([
      getDocs(q),
      getDocs(collection(db, 'citas'))
    ]);

    if (snap.empty) {
      container.innerHTML = `<div class="empty-list">No hay servicios activos disponibles.</div>`;
      return;
    }

    serviciosDisponibles = [];

    snap.forEach(doc => {
      const s = doc.data();
      const activo = s.active ?? s.activo ?? false;
      if (!activo) return;
      serviciosDisponibles.push({ id: doc.id, ...s, frecuencia: 0 });
    });

    if (!serviciosDisponibles.length) {
      container.innerHTML = `<div class="empty-list">No hay servicios activos disponibles.</div>`;
      return;
    }

    const frecuenciaPorId = new Map();
    const frecuenciaPorNombre = new Map();
    citasSnap.forEach(citaDoc => {
      const cita = citaDoc.data() || {};
      if (String(cita.estado || '').toLowerCase() === 'cancelada') return;

      const servicioRef = cita.servicio;
      const servicioId = typeof servicioRef === 'object'
        ? servicioRef.id || servicioRef.path?.split('/').pop()
        : String(servicioRef || '');
      const servicioNombre = String(cita.servicioNombre || (typeof servicioRef === 'string' ? servicioRef : ''))
        .trim()
        .toLocaleLowerCase();

      if (servicioId) frecuenciaPorId.set(servicioId, (frecuenciaPorId.get(servicioId) || 0) + 1);
      if (servicioNombre) frecuenciaPorNombre.set(servicioNombre, (frecuenciaPorNombre.get(servicioNombre) || 0) + 1);
    });

    serviciosDisponibles.forEach(servicio => {
      servicio.frecuencia = frecuenciaPorId.get(servicio.id)
        ?? frecuenciaPorNombre.get(String(servicio.nombre || '').trim().toLocaleLowerCase())
        ?? 0;
    });
    serviciosDisponibles.sort((a, b) => b.frecuencia - a.frecuencia
      || String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' }));

    renderServicios();
  } catch (error) {
    console.error("Error cargando servicios activos:", error);
    container.innerHTML = `<div class="empty-list">No se pudieron cargar los servicios.</div>`;
  }
}

function escapeServicioHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function renderServicios(searchText = '') {
  const container = document.querySelector('.service-grid');
  if (!container) return;

  const term = String(searchText || '').trim().toLocaleLowerCase();
  let serviciosVisibles = term
    ? serviciosDisponibles.filter(servicio => String(servicio.nombre || '').toLocaleLowerCase().includes(term))
    : serviciosDisponibles.slice(0, 3);

  const servicioSeleccionado = serviciosDisponibles.find(servicio => servicio.id === booking.servicioId);
  if (!term && servicioSeleccionado && !serviciosVisibles.some(servicio => servicio.id === servicioSeleccionado.id)) {
    serviciosVisibles = [...serviciosVisibles, servicioSeleccionado];
  }

  if (!serviciosVisibles.length) {
    container.innerHTML = `<div class="empty-list">No hay servicios que coincidan con la búsqueda.</div>`;
    return;
  }

  container.innerHTML = serviciosVisibles.map(servicio => {
    const precioNumero = normalizarPrecioNumero(servicio.precio);
    const seleccionado = servicio.id === booking.servicioId;
    return `
      <label class="svc-card ${seleccionado ? 'selected' : ''}" data-servicio-id="${escapeServicioHtml(servicio.id)}">
        <input type="radio" name="servicio" ${seleccionado ? 'checked' : ''}>
        <div class="svc-check"><i class="fa fa-check"></i></div>
        <div class="svc-icon"><i class="fa-solid ${escapeServicioHtml(servicio.icono || 'fa-hand-sparkles')}"></i></div>
        <div class="svc-name">${escapeServicioHtml(servicio.nombre)}</div>
        <div class="svc-time">${escapeServicioHtml(servicio.duracion)} min</div>
        <div class="svc-price">$${precioNumero.toLocaleString('es-CO')}</div>
      </label>
    `;
  }).join('');

  container.querySelectorAll('.svc-card').forEach(card => {
    const servicio = serviciosDisponibles.find(item => item.id === card.dataset.servicioId);
    if (!servicio) return;

    card.addEventListener('click', () => {
      window.selectSvc(card, servicio.nombre, `${servicio.duracion} min`, servicio.precio, servicio.id);
    });
  });
}

/* ================= FUNCIONES GLOBALES ================= */

window.selectSvc = function (el, name, dur, price, id) {

  document.querySelectorAll('.svc-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');

  booking.servicio = name;
  booking.servicioId = id;
  booking.duracion = dur;
  booking.duracionCita = getDuracionMinutos(dur);
  booking.precio = normalizarPrecioNumero(price);
  actualizarControlDuracionCita();
  renderSlots();
};

function actualizarControlDuracionCita() {
  const field = document.getElementById('duracionCitaField');
  const input = document.getElementById('duracionCitaInput');
  if (!field || !input) return;

  field.hidden = !booking.servicioId;
  input.value = booking.duracionCita || '';
}

function actualizarDuracionCita(value) {
  const minutos = Number.parseInt(value, 10);
  booking.duracionCita = Number.isFinite(minutos) && minutos >= 5 ? minutos : 0;
}

const duracionCitaInput = document.getElementById('duracionCitaInput');
if (duracionCitaInput) {
  duracionCitaInput.addEventListener('input', () => {
    actualizarDuracionCita(duracionCitaInput.value);
  });
  duracionCitaInput.addEventListener('change', () => {
    if (booking.duracionCita) duracionCitaInput.value = booking.duracionCita;
    renderSlots();
  });
}

window.selectMani = function (el, name) {
  booking.manicurista = name;
  highlightSelectedManicurista();

  renderSlots();
};

window.selectSlot = function (el) {
  if (el.classList.contains('taken')) return;

  document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');

  booking.hora = el.textContent.trim();
};

window.buscarClientes = async function (text) {
  const queryText = String(text || "").trim().toLowerCase();
  const resultsEl = document.getElementById('clientSearchResults');

  if (!resultsEl) return;

  // hide the visible client form while typing/new search
  const formEl = document.getElementById('clientForm');
  if (formEl) formEl.style.display = 'none';

  if (selectedCliente) {
    selectedCliente = null;
    booking.cliente = null;
  }

  if (!queryText) {
    resultsEl.innerHTML = "";
    lastQuery = '';
    return;
  }

  // clear form inputs to avoid mixing data while searching
  if (nombreInput) nombreInput.value = '';
  if (apellidoInput) apellidoInput.value = '';
  if (celularInput) celularInput.value = '';
  if (emailInput) emailInput.value = '';

  // avoid repeating the same query
  if (queryText === lastQuery) return;
  lastQuery = queryText;

  const snap = await getDocs(collection(db, "clientes"));
  const clientes = [];

  snap.forEach(doc => {
    const data = doc.data();
    const nombre = String(data.nombre || "").toLowerCase();
    const telefono = String(data.telefono || "").toLowerCase();

    if (nombre.includes(queryText) || telefono.includes(queryText)) {
      clientes.push({ id: doc.id, ...data });
    }
  });

  if (!clientes.length) {
    resultsEl.innerHTML = `
      <div class="client-result-empty">No existe un cliente con ese nombre o teléfono.</div>
      <button type="button" class="client-create-btn" onclick="crearNuevoCliente('${encodeURIComponent(queryText)}')">Crear nuevo cliente</button>
    `;
    return;
  }

  resultsEl.innerHTML = clientes.map(cliente => `
    <button type="button" class="client-result-item" onclick="seleccionarCliente('${cliente.id}', '${encodeURIComponent(cliente.nombre)}', '${encodeURIComponent(cliente.telefono)}', '${encodeURIComponent(cliente.email || "")}')">
      <strong>${cliente.nombre}</strong>
      <span>${cliente.telefono}</span>
    </button>
  `).join("");
}

window.seleccionarCliente = function (id, nombre, telefono, email) {
  const nombreCompleto = decodeURIComponent(nombre);
  const telefonoDec = decodeURIComponent(telefono);
  const emailDec = decodeURIComponent(email);

  const [nombreTxt, ...apellidoParts] = nombreCompleto.split(' ');
  const apellidoTxt = apellidoParts.join(' ');

  nombreInput.value = nombreTxt || '';
  apellidoInput.value = apellidoTxt || '';
  celularInput.value = telefonoDec || '';
  if (emailInput) emailInput.value = emailDec || '';

  selectedCliente = {
    id,
    nombre: nombreCompleto,
    telefono: telefonoDec,
    email: emailDec
  };

  booking.cliente = selectedCliente;
  booking.clienteRef = doc(db, 'clientes', id);
  // show selected indicator and reveal the form for editing/confirmation
  const resultsEl = document.getElementById('clientSearchResults');
  if (resultsEl) resultsEl.innerHTML = `
    <div class="client-result-selected">Cliente seleccionado: <strong>${nombreCompleto}</strong></div>
  `;

  const formEl = document.getElementById('clientForm');
  if (formEl) formEl.style.display = 'block';
};

window.clearClienteSeleccionado = function () {
  selectedCliente = null;
  booking.cliente = null;
  booking.clienteRef = null;
  const resultsEl = document.getElementById('clientSearchResults');
  if (resultsEl) resultsEl.innerHTML = "";
  if (clienteSearchInput) clienteSearchInput.value = "";
};

window.crearNuevoCliente = function (query) {
  clearClienteSeleccionado();
  booking.cliente = null;
  booking.clienteRef = null;

  const decoded = decodeURIComponent(query || "");
  const onlyDigits = decoded.replace(/\D/g, "");

  // reveal the form for the new client
  const formEl = document.getElementById('clientForm');
  if (formEl) formEl.style.display = 'block';

  if (/^\d{7,}$/.test(onlyDigits)) {
    celularInput.value = onlyDigits;
    nombreInput.focus();
  } else {
    nombreInput.value = decoded;
    apellidoInput.focus();
  }
};

/* ================= HORAS ================= */
function getDuracionMinutos(str) {
  if (!str) return 30;

  const text = String(str).toLowerCase();
  const horasMatch = text.match(/(\d+)\s*h/);
  const minutosMatch = text.match(/(\d+)\s*m/);

  if (horasMatch || minutosMatch) {
    const horas = horasMatch ? parseInt(horasMatch[1], 10) : 0;
    const minutos = minutosMatch ? parseInt(minutosMatch[1], 10) : 0;
    return horas * 60 + minutos;
  }

  const numero = parseInt(text.replace(/\D/g, ""), 10);
  return Number.isNaN(numero) ? 30 : numero;
}

function generarHorasBase() {
  const arr = [];

  for (let h = 8; h <= 18; h++) {
    for (let m of [0, 30]) {
      arr.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }

  return arr;
}

function formatHora(hora) {
  const d = new Date(`2000-01-01T${hora}:00`);
  return d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
}

/* ================= FIRESTORE ================= */
async function obtenerCitasFecha(fecha) {

  const inicio = new Date(fecha + "T00:00:00");
  const fin = new Date(fecha + "T23:59:59");

  const q = query(
    collection(db, "citas"),
    where("fechaHora", ">=", inicio),
    where("fechaHora", "<=", fin)
  );

  const snap = await getDocs(q);

  const citas = [];

  snap.forEach(doc => {
    const d = doc.data();

    const fecha = d.fechaHora?.toDate();
    const hora = fecha ? fecha.toTimeString().slice(0, 5) : null;

    citas.push({
      id: doc.id,
      hora,
      duracion: d.duracionCita || d.duracion || "30 min",
      manicurista: d.manicuristaNombre || "Sin preferencia"
    });
  });

  return citas;
}

function parseHoraSlot(horaTexto) {
  const partes = horaTexto.match(/(\d+):(\d+)\s*(a\. m\.|p\. m\.)?/i);
  if (!partes) return horaTexto;
  let h = Number(partes[1]);
  const m = Number(partes[2]);
  const ampm = partes[3] ? partes[3].toLowerCase() : '';
  if (ampm.includes('p') && h < 12) h += 12;
  if (ampm.includes('a') && h === 12) h = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function normalizeDuration(duracion) {
  return String(duracion || '30 min').replace(/[^0-9]/g, '');
}

function normalizeSlotsForEdit() {
  if (!booking.editId || !booking.hora || !booking.duracionCita) return [];
  const raw = parseHoraSlot(booking.hora);
  return obtenerSlotsOcupados([{ hora: raw, duracion: booking.duracionCita }]);
}

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

async function guardarClienteYRetornarRef(nombre, apellido, telefono, email, notas) {
  const telefonoLimpio = normalizePhone(telefono);
  const clienteData = {
    nombre: `${nombre} ${apellido}`.trim(),
    telefono: telefonoLimpio,
    email: email || "",
    notas: notas || "",
    updatedAt: serverTimestamp()
  };

  // si hay cliente seleccionado, actualizar sus datos conservando createdAt
  if (booking.cliente && booking.cliente.id) {
    const clienteId = booking.cliente.id;
    try {
      await updateDoc(doc(db, 'clientes', clienteId), clienteData);
      return doc(db, 'clientes', clienteId);
    } catch (e) {
      console.warn('Error actualizando cliente:', e);
    }
  }

  // si no hay cliente seleccionado, buscar por teléfono
  const q = query(
    collection(db, "clientes"),
    where("telefono", "==", telefonoLimpio)
  );

  const snap = await getDocs(q);
  if (!snap.empty) {
    const foundId = snap.docs[0].id;
    try {
      await updateDoc(doc(db, 'clientes', foundId), clienteData);
    } catch (e) {
      console.warn('Error actualizando cliente existente por teléfono:', e);
    }
    return doc(db, 'clientes', foundId);
  }

  const clienteRef = await addDoc(collection(db, 'clientes'), {
    ...clienteData,
    createdAt: serverTimestamp()
  });

  return clienteRef;
}

/* ================= BLOQUEO ================= */
function obtenerSlotsOcupados(citas) {

  const ocupados = [];

  citas.forEach(c => {
    const [h, m] = c.hora.split(":").map(Number);
    const startMin = h * 60 + m;
    const duracionMin = getDuracionMinutos(c.duracion);
    const bloques = Math.ceil(duracionMin / 30);

    for (let i = 0; i < bloques; i++) {
      const currentMin = startMin + i * 30;
      const slotH = Math.floor(currentMin / 60);
      const slotM = currentMin % 60;
      ocupados.push(`${String(slotH).padStart(2, "0")}:${String(slotM).padStart(2, "0")}`);
    }
  });

  return ocupados;
}

function obtenerSlotsOcultos(citas) {
  const ocultos = new Set();

  citas.forEach(c => {
    const bloques = Math.ceil(getDuracionMinutos(c.duracion) / 30);
    let [h, m] = String(c.hora || "00:00").split(":").map(Number);

    for (let i = 1; i < bloques; i++) {
      m += 30;
      if (m >= 60) {
        m = 0;
        h++;
      }

      ocultos.add(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  });

  return ocultos;
}

/* ================= RENDER ================= */
async function renderSlots() {

  if (!booking.fechaRaw) return;

  const container = document.querySelector(".slot-grid");

  const horas = generarHorasBase();
  const citas = await obtenerCitasFecha(booking.fechaRaw);

  const filtradas = citas.filter(c => {
    if (booking.manicurista === "Sin preferencia") return true;
    return c.manicurista === booking.manicurista;
  });

  let ocupados = obtenerSlotsOcupados(filtradas);
  const ocultos = obtenerSlotsOcultos(filtradas);
  if (booking.editId && booking.hora && booking.duracionCita) {
    const currentSlots = normalizeSlotsForEdit();
    ocupados = ocupados.filter(slot => !currentSlots.includes(slot));
  }

  container.innerHTML = "";

  horas.forEach(h => {
    if (ocultos.has(h)) return;

    const div = document.createElement("div");
    div.className = "slot";
    div.textContent = formatHora(h);

    if (ocupados.includes(h)) {
      div.classList.add("taken");
    } else {
      div.onclick = () => selectSlot(div);
    }

    if (booking.hora && div.textContent.trim() === booking.hora) {
      div.classList.add('selected');
    }

    container.appendChild(div);

  });
}

/* ================= EVENTOS ================= */
fechaInput.addEventListener("change", () => {
  booking.fechaRaw = fechaInput.value;
  booking.hora = "";
  renderSlots();
});

/* ================= VALIDACIÓN ================= */
async function validarDisponibilidad() {

  const citas = await obtenerCitasFecha(booking.fechaRaw);

  const filtradas = citas.filter(c => {
    if (booking.manicurista === "Sin preferencia") return true;
    return c.manicurista === booking.manicurista;
  });

  let ocupados = obtenerSlotsOcupados(filtradas);

  if (booking.editId && booking.hora && booking.duracionCita) {
    const currentSlots = normalizeSlotsForEdit();
    ocupados = ocupados.filter(slot => !currentSlots.includes(slot));
  }

  const [h, m] = booking.hora.match(/\d+/g).map(Number);

  let hh = h;
  let mm = m;

  const bloques = Math.ceil(booking.duracionCita / 30);

  for (let i = 0; i < bloques; i++) {

    const slot = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;

    if (ocupados.includes(slot)) return false;

    mm += 30;
    if (mm >= 60) {
      mm = 0;
      hh++;
    }
  }

  return true;
}

/* ================= CONFIRMAR ================= */

window.confirmar = async function () {

  // validar que haya fecha y hora
  if (!booking.fechaRaw || !booking.hora) {
    await Swal.fire({
      title: 'Falta la fecha y la hora',
      text: 'Selecciona fecha y hora.',
      icon: 'warning',
      confirmButtonText: 'Aceptar'
    });
    return;
  }

  if (!booking.duracionCita || booking.duracionCita < 5) {
    await Swal.fire({
      title: 'Duración no válida',
      text: 'Ingresa una duración de al menos 5 minutos para esta cita.',
      icon: 'warning',
      confirmButtonText: 'Aceptar'
    });
    return;
  }

  // validar disponibilidad real
  const disponible = await validarDisponibilidad();

  if (!disponible) {
    await Swal.fire({
      title: 'Horario no disponible',
      text: 'Ese horario ya no está disponible.',
      icon: 'warning',
      confirmButtonText: 'Aceptar'
    });
    return;
  }

  try {

    const nombre = nombreInput?.value.trim() || "";
    const apellido = apellidoInput?.value.trim() || "";
    const celular = normalizePhone(celularInput?.value || "");
    const email = emailInput?.value.trim() || "";
    const primera = primeraInput?.value || "si";
    const notas = notasInput?.value.trim() || "";

    if (!nombre) {
      showErr('err-nombre', nombreInput);
      return;
    }

    if (!apellido) {
      showErr('err-apellido', apellidoInput);
      return;
    }

    if (!celular || celular.length !== 10) {
      showErr('err-cel', celularInput);
      return;
    }

    const fechaHora = convertirFechaHora(
      booking.fechaRaw,
      booking.hora
    );

    const clienteRef = await guardarClienteYRetornarRef(nombre, apellido, celular, email, notas);
    if (clienteRef && clienteRef.id) {
      booking.cliente = { id: clienteRef.id, nombre: `${nombre} ${apellido}`.trim(), telefono: celular };
      booking.clienteRef = clienteRef;
    }

    let manicuristaRef = null;
    if (booking.manicurista && booking.manicurista !== "Sin preferencia") {
      const mQuery = query(
        collection(db, "clientes"),
        where("nombre", "==", booking.manicurista)
      );
      const manicuristaSnap = await getDocs(mQuery);
      if (!manicuristaSnap.empty) {
        manicuristaRef = doc(db, "clientes", manicuristaSnap.docs[0].id);
      }
    }

    if (booking.editId) {
      await updateDoc(doc(db, 'citas', booking.editId), {
        cliente: `${nombre} ${apellido}`.trim(),
        clienteRef,
        telefono: celular,
        email,
        primera: primera,
        notas,
        servicio: doc(db, "servicios", booking.servicioId),
        servicioNombre: booking.servicio,
        duracion: booking.duracion,
        duracionCita: booking.duracionCita,
        precio: Number(booking.precio),
        manicurista: manicuristaRef,
        manicuristaNombre: booking.manicurista,
        fechaCambioEstado: serverTimestamp(),
        fechaHora: fechaHora
      });
    } else {
      await addDoc(collection(db, "citas"), {
        cliente: `${nombre} ${apellido}`.trim(),
        clienteRef,
        telefono: celular,
        email,
        primera: primera,
        notas,
        servicio: doc(db, "servicios", booking.servicioId),
        servicioNombre: booking.servicio,
        duracion: booking.duracion,
        duracionCita: booking.duracionCita,
        precio: Number(booking.precio),
        manicurista: manicuristaRef,
        manicuristaNombre: booking.manicurista,
        estado: "pendiente",
        fechaCambioEstado: serverTimestamp(),
        fechaHora: fechaHora,
        createdAt: serverTimestamp()
      });
    }

    const datosCita = {
      servicio: booking.servicio,
      fecha: booking.fechaRaw,
      hora: booking.hora,
      manicurista: booking.manicurista,
      cliente: `${nombre} ${apellido}`.trim(),
      celular
    };

    if (booking.editId) {
      mostrarSuccessScreen(datosCita);
      return;
    }

    await preguntarEnvioWhatsAppYVolverDashboard(datosCita);

  } catch (error) {
    console.error(error);
    await Swal.fire({
      title: 'Error al guardar',
      text: 'Error al guardar la cita.',
      icon: 'error',
      confirmButtonText: 'Aceptar'
    });
  }
};

/* ================= INIT ================= */
window.addEventListener('DOMContentLoaded', async () => {
  try {
    await cargarServicios();
    await prefillFromQuery();
  } catch (error) {
    console.error('Error iniciando la reserva:', error);
  }
});


/* ================= NAVEGACIÓN ENTRE PASOS ================= */

window.goTo = function (step) {

  // validaciones básicas
  if (step === 2) {
    if (!booking.servicio) {
      Swal.fire({
        title: 'Selecciona un servicio',
        text: 'Debes elegir un servicio antes de continuar.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }
    if (booking.prefilledDateTime) {
      step = 3;
    }
  }

  if (step === 3) {
    if (!booking.servicio) {
      Swal.fire({
        title: 'Selecciona un servicio',
        text: 'Debes elegir un servicio antes de continuar.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }
    if (!booking.fechaRaw || !booking.hora) {
      Swal.fire({
        title: 'Falta la fecha y la hora',
        text: 'Selecciona fecha y hora.',
        icon: 'warning',
        confirmButtonText: 'Aceptar'
      });
      return;
    }
  }

  const successPanel = document.getElementById('successPanel');
  if (successPanel) successPanel.classList.remove('show');

  // ocultar todos los paneles
  document.querySelectorAll('.panel').forEach(p => {
    p.classList.remove('active');
  });

  // mostrar el panel correspondiente
  const panel = document.getElementById('panel' + step);
  if (panel) panel.classList.add('active');

  if (step === 3) renderBookingSummary();

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.volverDesdeDatos = function () {
  goTo(booking.prefilledDateTime ? 1 : 2);
};

window.clearSavedData = function () {
  localStorage.removeItem('ns_client');

  const banner = document.getElementById('welcomeBanner');
  if (banner) banner.classList.remove('show');
};

window.resetForm = function () {

  // reset estado
  booking.servicio = '';
  booking.servicioId = '';
  booking.duracion = '';
  booking.duracionCita = 0;
  booking.precio = '';
  booking.manicurista = MANICURISTA_PREDETERMINADA;
  booking.fechaRaw = '';
  booking.hora = '';

  selectedCliente = null;

  // reset visual
  document.querySelectorAll('.svc-card').forEach(c => c.classList.remove('selected'));
  renderServicios(buscarServicioInput?.value || '');
  actualizarControlDuracionCita();
  highlightSelectedManicurista();
  document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));

  // reset form inputs
  if (nombreInput) nombreInput.value = '';
  if (apellidoInput) apellidoInput.value = '';
  if (celularInput) celularInput.value = '';
  if (emailInput) emailInput.value = '';
  if (clienteSearchInput) clienteSearchInput.value = '';
  if (notasInput) notasInput.value = '';
  if (primeraInput) primeraInput.value = 'si';
  if (fechaInput) fechaInput.value = '';
  const resultsEl = document.getElementById('clientSearchResults');
  if (resultsEl) resultsEl.innerHTML = '';

  // hide success screen if visible
  const successPanel = document.getElementById('successPanel');
  if (successPanel) successPanel.classList.remove('show');

  // volver al paso 1
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel1').classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
};

window.confirmar = window.confirmar || async function () {
  await Swal.fire({
    title: 'Cita confirmada',
    text: 'La cita se ha confirmado correctamente.',
    icon: 'success',
    confirmButtonText: 'Aceptar'
  });
};

function convertirFechaHora(fecha, horaTexto) {

  // extraer números
  const partes = horaTexto.match(/\d+/g).map(Number);

  let h = partes[0];
  let m = partes[1];

  // detectar AM / PM
  const esPM = horaTexto.toLowerCase().includes("p");

  if (esPM && h < 12) h += 12;
  if (!esPM && h === 12) h = 0;

  return new Date(`${fecha}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
}

function renderBookingSummary() {
  const svc = document.getElementById('r-svc');
  const fecha = document.getElementById('r-fecha');
  const hora = document.getElementById('r-hora');
  const mani = document.getElementById('r-mani');

  if (svc) svc.textContent = booking.servicio || '?';
  if (fecha) fecha.textContent = booking.fechaRaw || '?';
  if (hora) hora.textContent = booking.hora || '?';
  if (mani) {
    mani.textContent = booking.manicurista || '?';
    const row = mani.closest('.summary-row');
    if (row) row.hidden = String(booking.manicurista || '').trim().toLowerCase() === 'sin preferencia';
  }
}

function crearWhatsAppUrlCita(data) {
  const parts = [];
  const emoji = {
    servicio: "💅",
    fecha: "📅",
    hora: "⏰",
    manicurista: "👩‍💼",
    espera: "👋"
  };

  if (data.servicio) parts.push(`${emoji.servicio} Servicio: ${data.servicio}`);
  if (data.fecha) parts.push(`${emoji.fecha} Fecha: ${data.fecha}`);
  if (data.hora) parts.push(`${emoji.hora} Hora: ${data.hora}`);
  if (data.manicurista) parts.push(`${emoji.manicurista} Manicurista: ${data.manicurista}`);

  const header = 'CONFIRMACIÓN DE CITA DAVANAILS';
  const nombreLine = data.cliente ? `Hola ${data.cliente}\n ` : '';
  const body = [header, nombreLine, '', ...parts, '', `Te esperamos ${emoji.espera}`].filter(Boolean).join('\n').trim();
  const telefono = String(data.celular || '').replace(/\D/g, '');

  return body && telefono
    ? `https://wa.me/57${telefono}?text=${encodeURIComponent(body)}`
    : '';
}

async function preguntarEnvioWhatsAppYVolverDashboard(data) {
  const whatsappUrl = crearWhatsAppUrlCita(data);

  await Swal.fire({
    title: '¿Enviar WhatsApp?',
    text: '¿Deseas enviar al cliente la confirmación de la cita?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Enviar WhatsApp',
    cancelButtonText: 'Omitir',
    allowOutsideClick: false,
    allowEscapeKey: false,
    preConfirm: () => {
      if (whatsappUrl) window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
    }
  });

  window.location.replace('dashboard.html');
}

function mostrarSuccessScreen(data) {
  const successPanel = document.getElementById('successPanel');
  const summarySvc = document.getElementById('c-svc');
  const summaryFecha = document.getElementById('c-fecha');
  const summaryMani = document.getElementById('c-mani');
  const waLink = document.getElementById('waLink');

  if (summarySvc) summarySvc.textContent = data.servicio || '?';
  if (summaryFecha) summaryFecha.textContent = `${data.fecha} - ${data.hora}`;
  if (summaryMani) {
    summaryMani.textContent = data.manicurista || '?';
    const row = summaryMani.closest('.summary-row');
    if (row) row.hidden = String(data.manicurista || '').trim().toLowerCase() === 'sin preferencia';
  }

  if (waLink) {
    const whatsappUrl = crearWhatsAppUrlCita(data);
    if (whatsappUrl) waLink.href = whatsappUrl;
    else waLink.removeAttribute('href');
  }

  if (successPanel) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    successPanel.classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

window.irInicio = function () {
  window.location.href = 'dashboard.html';
};

window.clearErr = function (id, input) {

  const el = document.getElementById(id);
  if (el) el.classList.remove('show');

  if (input) input.classList.remove('error');

};

window.showErr = function (errId, inputId) {

  const el = document.getElementById(errId);
  if (el) el.classList.add('show');

  const input = document.getElementById(inputId);
  if (input) input.classList.add('error');

};