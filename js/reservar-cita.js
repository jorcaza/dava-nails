/* ================= STORAGE ================= */
const STORAGE_KEY = 'ns_client';

function loadClient() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function saveClient(data) {
  try {
    const existing = loadClient() || {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...data }));
  } catch (e) {}
}

function clearSavedData() {
  localStorage.removeItem(STORAGE_KEY);
}

/* ================= INIT ================= */
const hoy = new Date();
const fechaInput = document.getElementById('fecha');
fechaInput.min = hoy.toISOString().split('T')[0];

/* ================= STATE ================= */
const booking = {
  servicio: '',
  duracion: '',
  precio: '',
  manicurista: 'Sin preferencia',
  fechaRaw: '',
  hora: ''
};

/* ================= SELECTORES ================= */
function selectSvc(el, name, dur, price) {
  document.querySelectorAll('.svc-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');

  booking.servicio = name;
  booking.duracion = dur;
  booking.precio = price;
}

function selectMani(el, name) {
  document.querySelectorAll('.mani-pill').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');

  booking.manicurista = name;

  renderSlots();
}

function selectSlot(el) {
  if (el.classList.contains('taken')) return;

  document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');

  booking.hora = el.textContent.trim();
}

/* ================= FIREBASE ================= */
import {
  collection,
  getDocs,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

import { db } from "./firebase-config.js";

/* ================= UTILIDADES ================= */
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

function formatHora(h) {
  const d = new Date(`2000-01-01T${h}:00`);
  return d.toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
}

/* ================= FIRESTORE QUERY ================= */
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

/* ================= BLOQUEO DE SLOTS ================= */
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

/* ================= RENDER UI ================= */
async function renderSlots() {

  if (!booking.fechaRaw) return;

  const container = document.querySelector(".slot-grid");

  const horas = generarHorasBase();
  const citas = await obtenerCitasFecha(booking.fechaRaw);

  // ? filtrar por manicurista
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

/* ================= VALIDACIÓN FINAL ================= */
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
const originalConfirm = window.confirmar;

window.confirmar = async function() {

  const ok = await validarDisponibilidad();

  if (!ok) {
    alert("Ese horario ya no está disponible ?");
    return;
  }

  originalConfirm();
};