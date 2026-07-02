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

const booking = {
  servicio: '',
  servicioId: '',   
  duracion: '',
  precio: '',
  manicurista: 'Sin preferencia',
  fechaRaw: '',
  hora: '',
  cliente: null,
  clienteRef: null,
  editId: null
};

let selectedCliente = null;
let lastQuery = '';
let debounceTimer = null;

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
          const horaRaw = fechaHora.toTimeString().slice(0,5);
          booking.fechaRaw = fechaIso;
          booking.hora = formatHora(horaRaw);
          if (fechaInput) fechaInput.value = fechaIso;
        }

        if (data.servicio) {
          booking.servicioId = data.servicio.id || data.servicio;
          booking.servicio = data.servicioNombre || '';
          booking.duracion = data.duracion || '';
          booking.precio = data.precio || '';
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

  if (booking.fechaRaw || booking.editId) {
    goTo(2);
  }
}

function highlightSelectedService() {
  if (!booking.servicioId) return;
  const cards = document.querySelectorAll('.svc-card');
  cards.forEach(card => {
    const onclickAttr = card.getAttribute('onclick') || '';
    const match = onclickAttr.match(/selectSvc\(this,'[^']*','[^']*','[^']*','([^']*)'\)/);
    if (match && match[1] === booking.servicioId) {
      card.classList.add('selected');
      const input = card.querySelector('input[type="radio"]');
      if (input) input.checked = true;
    }
  });
}

function highlightSelectedManicurista() {
  if (!booking.manicurista || booking.manicurista === 'Sin preferencia') return;
  const pills = document.querySelectorAll('.mani-pill');
  pills.forEach(pill => {
    if (pill.textContent.trim() === booking.manicurista) {
      pill.classList.add('selected');
      const input = pill.querySelector('input[type="radio"]');
      if (input) input.checked = true;
    }
  });
}

window.debouncedBuscar = function(text) {
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

    const snap = await getDocs(q);
    container.innerHTML = "";

    if (snap.empty) {
      container.innerHTML = `<div class="empty-list">No hay servicios activos disponibles.</div>`;
      return;
    }

    const serviciosActivos = [];

    snap.forEach(doc => {
      const s = doc.data();
      const activo = s.active ?? s.activo ?? false;
      if (!activo) return;
      serviciosActivos.push({ id: doc.id, ...s });
    });

    if (!serviciosActivos.length) {
      container.innerHTML = `<div class="empty-list">No hay servicios activos disponibles.</div>`;
      return;
    }

    serviciosActivos.forEach(s => {
      const html = `
        <label class="svc-card"
          onclick="selectSvc(this,'${s.nombre}','${s.duracion} min','$${s.precio}','${s.id}')">

          <input type="radio" name="servicio">

          <div class="svc-check"><i class="fa fa-check"></i></div>

          <div class="svc-icon">
            <i class="fa-solid ${s.icono || "fa-hand-sparkles"}"></i>
          </div>

          <div class="svc-name">${s.nombre}</div>
          <div class="svc-time">${s.duracion} min</div>
          <div class="svc-price">$${s.precio}</div>

        </label>
      `;

      container.innerHTML += html;
    });
  } catch (error) {
    console.error("Error cargando servicios activos:", error);
    container.innerHTML = `<div class="empty-list">No se pudieron cargar los servicios.</div>`;
  }
}

/* ================= FUNCIONES GLOBALES ================= */

window.selectSvc = function(el, name, dur, price, id) {

  document.querySelectorAll('.svc-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');

  booking.servicio = name;
  booking.servicioId = id; 
  booking.duracion = dur;
  booking.precio = price;
};

window.selectMani = function(el, name) {
  document.querySelectorAll('.mani-pill').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');

  booking.manicurista = name;

  renderSlots();
};

window.selectSlot = function(el) {
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

window.seleccionarCliente = function(id, nombre, telefono, email) {
  const nombreCompleto = decodeURIComponent(nombre);
  const telefonoDec = decodeURIComponent(telefono);
  const emailDec = decodeURIComponent(email);

  const [nombreTxt, ...apellidoParts] = nombreCompleto.split(' ');
  const apellidoTxt = apellidoParts.join(' ');

  nombreInput.value = nombreTxt || '';
  apellidoInput.value = apellidoTxt || '';
  celularInput.value = telefonoDec || '';
  emailInput.value = emailDec || '';

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

window.clearClienteSeleccionado = function() {
  selectedCliente = null;
  booking.cliente = null;
  booking.clienteRef = null;
  const resultsEl = document.getElementById('clientSearchResults');
  if (resultsEl) resultsEl.innerHTML = "";
  if (clienteSearchInput) clienteSearchInput.value = "";
};

window.crearNuevoCliente = function(query) {
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
  return parseInt(str.replace(" min", ""));
}

function generarHorasBase() {
  const arr = [];

  for (let h = 9; h <= 18; h++) {
    for (let m of [0, 30]) {
      arr.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
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
    const hora = fecha ? fecha.toTimeString().slice(0,5) : null;

    citas.push({
      id: doc.id,
      hora,
      duracion: d.duracion || "30 min",
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
  if (!booking.editId || !booking.hora || !booking.duracion) return [];
  const raw = parseHoraSlot(booking.hora);
  return obtenerSlotsOcupados([{ hora: raw, duracion: booking.duracion }]);
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

    const bloques = getDuracionMinutos(c.duracion) / 30;

    let [h, m] = c.hora.split(":").map(Number);

    for (let i = 0; i < bloques; i++) {

      ocupados.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);

      m += 30;
      if (m >= 60) {
        m = 0;
        h++;
      }
    }
  });

  return ocupados;
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
  if (booking.editId && booking.hora && booking.duracion) {
    const currentSlots = normalizeSlotsForEdit();
    ocupados = ocupados.filter(slot => !currentSlots.includes(slot));
  }

  container.innerHTML = "";

  horas.forEach(h => {

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

  if (booking.editId && booking.hora && booking.duracion) {
    const currentSlots = normalizeSlotsForEdit();
    ocupados = ocupados.filter(slot => !currentSlots.includes(slot));
  }

  const [h, m] = booking.hora.match(/\d+/g).map(Number);

  let hh = h;
  let mm = m;

  const bloques = getDuracionMinutos(booking.duracion) / 30;

  for (let i = 0; i < bloques; i++) {

    const slot = `${String(hh).padStart(2,"0")}:${String(mm).padStart(2,"0")}`;

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
    alert("Selecciona fecha y hora ?");
    return;
  }

  // validar disponibilidad real
  const disponible = await validarDisponibilidad();

  if (!disponible) {
    alert("Ese horario ya no está disponible ?");
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
        precio: booking.precio,
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
        precio: booking.precio,
        manicurista: manicuristaRef,
        manicuristaNombre: booking.manicurista,
        estado: "pendiente",
        fechaCambioEstado: serverTimestamp(),
        fechaHora: fechaHora,
        createdAt: serverTimestamp()
      });
    }

    mostrarSuccessScreen({
      servicio: booking.servicio,
      fecha: booking.fechaRaw,
      hora: booking.hora,
      manicurista: booking.manicurista,
      cliente: `${nombre} ${apellido}`.trim(),
      celular
    });

  } catch (error) {
    console.error(error);
    alert("Error al guardar la cita ?");
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

window.goTo = function(step) {

  // validaciones básicas
  if (step === 2 && !booking.servicio) {
    alert("Selecciona un servicio ?");
    return;
  }

  if (step === 3 && (!booking.fechaRaw || !booking.hora)) {
    alert("Selecciona fecha y hora ?");
    return;
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
  booking.precio = '';
  booking.manicurista = 'Sin preferencia';
  booking.fechaRaw = '';
  booking.hora = '';

  selectedCliente = null;

  // reset visual
  document.querySelectorAll('.svc-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.mani-pill').forEach(p => p.classList.remove('selected'));
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
  alert("Cita confirmada ?");
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

  return new Date(`${fecha}T${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:00`);
}

function renderBookingSummary() {
  const svc = document.getElementById('r-svc');
  const fecha = document.getElementById('r-fecha');
  const hora = document.getElementById('r-hora');
  const mani = document.getElementById('r-mani');

  if (svc) svc.textContent = booking.servicio || '?';
  if (fecha) fecha.textContent = booking.fechaRaw || '?';
  if (hora) hora.textContent = booking.hora || '?';
  if (mani) mani.textContent = booking.manicurista || '?';
}

function mostrarSuccessScreen(data) {
  const successPanel = document.getElementById('successPanel');
  const summarySvc = document.getElementById('c-svc');
  const summaryFecha = document.getElementById('c-fecha');
  const summaryMani = document.getElementById('c-mani');
  const waLink = document.getElementById('waLink');

  if (summarySvc) summarySvc.textContent = data.servicio || '?';
  if (summaryFecha) summaryFecha.textContent = `${data.fecha} · ${data.hora}`;
  if (summaryMani) summaryMani.textContent = data.manicurista || '?';

  if (waLink) {
    const mensaje = encodeURIComponent(`Hola, quiero confirmar mi cita para ${data.servicio} el ${data.fecha} a las ${data.hora}. Mi nombre es ${data.cliente}.`);
    waLink.href = `https://wa.me/57${data.celular}?text=${mensaje}`;
  }

  if (successPanel) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    successPanel.classList.add('show');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

window.irInicio = function() {
  window.location.href = 'dashboard.html';
};

window.clearErr = function(id, input) {

  const el = document.getElementById(id);
  if (el) el.classList.remove('show');

  if (input) input.classList.remove('error');

};

window.showErr = function(errId, inputId) {

  const el = document.getElementById(errId);
  if (el) el.classList.add('show');

  const input = document.getElementById(inputId);
  if (input) input.classList.add('error');

};