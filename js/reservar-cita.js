/* ================= FIREBASE ================= */
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,           
  serverTimestamp ,
  doc
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

const booking = {
  servicio: '',
  servicioId: '',   
  duracion: '',
  precio: '',
  manicurista: 'Sin preferencia',
  fechaRaw: '',
  hora: ''
};


/* ================= SERVICIOS DINÁMICOS ================= */
async function cargarServicios() {

  const container = document.querySelector(".service-grid");

  const snap = await getDocs(collection(db, "servicios"));

  container.innerHTML = "";

  snap.forEach(doc => {

    const s = doc.data();

      const html = `
        <label class="svc-card"
          onclick="selectSvc(this,'${s.nombre}','${s.duracion} min','$${s.precio}','${doc.id}')">

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

async function buscarClientes(text) {
  const queryText = String(text || "").trim().toLowerCase();
  const resultsEl = document.getElementById('clientSearchResults');

  if (!resultsEl) return;

  if (!queryText) {
    resultsEl.innerHTML = "";
    return;
  }

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
    resultsEl.innerHTML = `<div class="client-result-empty">No existe un cliente con ese nombre o teléfono. Completa el formulario para crear uno nuevo.</div>`;
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

  document.getElementById('nombre').value = nombreTxt || '';
  document.getElementById('apellido').value = apellidoTxt || '';
  document.getElementById('celular').value = telefonoDec || '';
  document.getElementById('email').value = emailDec || '';

  document.getElementById('clientSearchResults').innerHTML = `
    <div class="client-result-selected">Cliente seleccionado: <strong>${nombreCompleto}</strong></div>
  `;
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
      hora,
      duracion: d.duracion || "30 min",
      manicurista: d.manicuristaNombre || "Sin preferencia"
    });
  });

  return citas;
}

async function obtenerOCrearClienteRef(nombre, apellido, telefono, email) {
  const telefonoLimpio = telefono.replace(/\D/g, "");

  const q = query(
    collection(db, "clientes"),
    where("telefono", "==", telefonoLimpio)
  );

  const snap = await getDocs(q);

  if (!snap.empty) {
    return doc(db, "clientes", snap.docs[0].id);
  }

  const cliente = await addDoc(collection(db, "clientes"), {
    nombre: `${nombre} ${apellido}`.trim(),
    telefono: telefonoLimpio,
    email: email || "",
    createdAt: serverTimestamp()
  });

  return cliente;
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

  const ocupados = obtenerSlotsOcupados(filtradas);

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

  const ocupados = obtenerSlotsOcupados(filtradas);

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

  // ? validar que haya fecha y hora
  if (!booking.fechaRaw || !booking.hora) {
    alert("Selecciona fecha y hora ?");
    return;
  }

  // ? validar disponibilidad real
  const disponible = await validarDisponibilidad();

  if (!disponible) {
    alert("Ese horario ya no está disponible ?");
    return;
  }

  try {

    // ? validar datos de cliente
    const nombre = nombreInput?.value.trim() || "";
    const apellido = apellidoInput?.value.trim() || "";
    const celular = celularInput?.value.replace(/\D/g, "") || "";
    const email = emailInput?.value.trim() || "";
    const primera = primeraInput?.value || "si";
    const notas = notasInput?.value.trim() || "";

    if (!nombre || !apellido) {
      alert("Ingresa nombre y apellido del cliente ?");
      return;
    }

    if (!celular || celular.length !== 10) {
      alert("Ingresa un número de celular válido de 10 dígitos ?");
      return;
    }

    // ? convertir fecha + hora a Date real
    const fechaHora = convertirFechaHora(
      booking.fechaRaw,
      booking.hora
    );

    const clienteRef = await obtenerOCrearClienteRef(nombre, apellido, celular, email);

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

    // ? guardar en Firebase
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
    // ? feedback
    console.log("? cita guardada correctamente");
    alert("Cita registrada ?");

    // ? limpiar formulario
    if (typeof resetForm === "function") {
      resetForm();
    }

  } catch (error) {

    console.error(error);
    alert("Error al guardar la cita ?");
  }
};

/* ================= INIT ================= */
cargarServicios();


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

  // ocultar todos los paneles
  document.querySelectorAll('.panel').forEach(p => {
    p.classList.remove('active');
  });

  // mostrar el panel correspondiente
  const panel = document.getElementById('panel' + step);
  if (panel) panel.classList.add('active');

  // scroll arriba
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
  booking.duracion = '';
  booking.precio = '';
  booking.manicurista = 'Sin preferencia';
  booking.fechaRaw = '';
  booking.hora = '';

  // reset visual
  document.querySelectorAll('.svc-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.mani-pill').forEach(p => p.classList.remove('selected'));
  document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));

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