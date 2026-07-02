import { db } from "./firebase-config.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ================= DOM ================= */
const nombre = document.getElementById("nombre");
const precio = document.getElementById("precio");
const duracion = document.getElementById("duracion");
const icono = document.getElementById("icono");
const servicioSearch = document.getElementById("servicioSearch");

const list = document.getElementById("serviciosList");
const preview = document.getElementById("previewIcon");
const iconResults = document.getElementById("iconResults");
const btnGuardar = document.getElementById("btnGuardar");
const btnNuevo = document.getElementById("btnNuevo");

/* ================= STATE ================= */
let editId = null;
let serviciosCache = [];

/* ================= ICONOS ================= */
const iconos = [
  "fa-hand-sparkles",
  "fa-scissors",
  "fa-heart",
  "fa-star",
  "fa-gem",
  "fa-brush",
  "fa-paint-brush",
  "fa-spa",
  "fa-hand",
  "fa-hand-holding",
  "fa-wand-magic-sparkles",
  "fa-sparkles",
  "fa-face-smile",
  "fa-crown",
  "fa-droplet",
  "fa-leaf"
];

/* ================= UTILIDADES ================= */
function debounce(fn, delay = 200) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getServiceRef(id) {
  return doc(db, "servicios", id);
}

function getFilterText() {
  return String(servicioSearch?.value || "").trim().toLowerCase();
}

function validarServicio() {
  const nombreValue = String(nombre.value || "").trim();
  const precioValue = Number(precio.value);
  const duracionValue = Number(duracion.value);
  const iconoValue = String(icono.value || "fa-star").trim() || "fa-star";

  if (!nombreValue) {
    alert("El nombre es obligatorio.");
    nombre.focus();
    return null;
  }

  if (!precioValue || precioValue <= 0) {
    alert("El precio debe ser mayor que 0.");
    precio.focus();
    return null;
  }

  if (!duracionValue || duracionValue <= 0) {
    alert("La duración debe ser mayor que 0.");
    duracion.focus();
    return null;
  }

  return {
    nombre: nombreValue,
    precio: precioValue,
    duracion: duracionValue,
    icono: iconoValue
  };
}

/* ================= BUSCADOR DE ÍCONOS ================= */
icono.addEventListener("input", () => {
  const texto = String(icono.value || "").toLowerCase().trim();

  preview.innerHTML = texto
    ? `<i class="fa-solid ${escapeHtml(texto)}"></i>`
    : "";

  iconResults.innerHTML = "";

  if (!texto) return;

  const filtrados = iconos.filter(i => i.toLowerCase().includes(texto));

  filtrados.forEach(ic => {
    const div = document.createElement("div");
    div.className = "icon-item";

    div.innerHTML = `
      <i class="fa-solid ${ic}"></i>
      <span>${ic}</span>
    `;

    div.addEventListener("click", () => {
      icono.value = ic;
      preview.innerHTML = `<i class="fa-solid ${ic}"></i>`;
      iconResults.innerHTML = "";
    });

    iconResults.appendChild(div);
  });
});

/* ================= RENDERIZADO ================= */
function renderServicioCard(servicio) {
  const iconClass = escapeHtml(servicio.icono || "fa-star");
  const estadoLabel = servicio.active ? "? Activo" : "? Inactivo";
  const actionLabel = servicio.active ? "Desactivar" : "Activar";

  return `
    <article class="svc-card ${servicio.active ? "active" : "inactive"}" data-id="${escapeHtml(servicio.id)}">
      <div class="svc-card-header">
        <div class="svc-icon"><i class="fa-solid ${iconClass}"></i></div>
        <div class="svc-meta">
          <div class="svc-name">${escapeHtml(servicio.nombre || "Sin nombre")}</div>
          <div class="svc-status">${estadoLabel}</div>
        </div>
      </div>

      <div class="svc-body">
        <div class="svc-detail">Duración: <strong>${Number(servicio.duracion || 0)} min</strong></div>
        <div class="svc-detail">Precio: <strong>$${Number(servicio.precio || 0).toLocaleString("es-CO")}</strong></div>
      </div>

      <div class="svc-actions">
        <button type="button" class="btnEdit">Editar</button>
        <button type="button" class="btnToggle">${actionLabel}</button>
      </div>
    </article>
  `;
}

function attachCardEvents() {
  list.querySelectorAll(".svc-card").forEach(card => {
    const servicioId = card.dataset.id;
    const servicio = serviciosCache.find(item => item.id === servicioId);
    const editBtn = card.querySelector(".btnEdit");
    const toggleBtn = card.querySelector(".btnToggle");

    if (editBtn) {
      editBtn.addEventListener("click", () => cargarParaEditar(servicio));
    }

    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => cambiarEstado(servicio));
    }
  });
}

function renderServicios() {
  const filtro = getFilterText();
  const serviciosFiltrados = serviciosCache.filter(servicio =>
    String(servicio.nombre || "").toLowerCase().includes(filtro)
  );

  if (!serviciosFiltrados.length) {
    list.innerHTML = `
      <div class="empty-list">No hay servicios que coincidan con la búsqueda.</div>
    `;
    return;
  }

  list.innerHTML = serviciosFiltrados.map(renderServicioCard).join("");
  attachCardEvents();
}

/* ================= FIRESTORE ================= */
async function cargarServicios() {
  try {
    const snap = await getDocs(collection(db, "servicios"));

    serviciosCache = snap.docs
      .map(docu => {
        const data = docu.data();
        return {
          id: docu.id,
          ...data,
          active: data.active ?? data.activo ?? true
        };
      })
      .sort((a, b) => String(a.nombre || "").localeCompare(String(b.nombre || ""), "es", { sensitivity: "base" }));

    renderServicios();
  } catch (error) {
    console.error("Error cargando servicios:", error);
    list.innerHTML = `<div class="empty-list">No se pudieron cargar los servicios.</div>`;
  }
}

async function cambiarEstado(servicio) {
  if (!servicio) return;

  try {
    await updateDoc(getServiceRef(servicio.id), {
      active: !servicio.active
    });
    await cargarServicios();
  } catch (error) {
    console.error("Error cambiando estado de servicio:", error);
    alert("No se pudo cambiar el estado del servicio.");
  }
}

async function guardarServicio() {
  const validacion = validarServicio();
  if (!validacion) return;

  try {
    if (editId) {
      await updateDoc(getServiceRef(editId), validacion);
      editId = null;
    } else {
      await addDoc(collection(db, "servicios"), {
        ...validacion,
        active: true,
        createdAt: serverTimestamp()
      });
    }

    limpiar();
    await cargarServicios();
  } catch (error) {
    console.error("Error guardando servicio:", error);
    alert("No se pudo guardar el servicio.");
  }
}

function cargarParaEditar(servicio) {
  if (!servicio) return;

  editId = servicio.id;
  nombre.value = servicio.nombre || "";
  precio.value = servicio.precio || "";
  duracion.value = servicio.duracion || "";
  icono.value = servicio.icono || "";
  preview.innerHTML = `<i class="fa-solid ${escapeHtml(servicio.icono || "fa-star")}"></i>`;
}

function limpiar() {
  nombre.value = "";
  precio.value = "";
  duracion.value = "";
  icono.value = "";
  preview.innerHTML = "";
  editId = null;
}

/* ================= EVENTS ================= */
btnGuardar.addEventListener("click", async event => {
  event.preventDefault();
  await guardarServicio();
});

btnNuevo?.addEventListener("click", event => {
  event.preventDefault();
  limpiar();
});

servicioSearch?.addEventListener("input", debounce(renderServicios, 200));

/* ================= INIT ================= */
async function init() {
  await cargarServicios();
}

init();