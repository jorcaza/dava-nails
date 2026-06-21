import { db } from "./firebase-config.js";

import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

/* ================= DOM ================= */
const nombre = document.getElementById("nombre");
const precio = document.getElementById("precio");
const duracion = document.getElementById("duracion");
const icono = document.getElementById("icono");

const list = document.getElementById("serviciosList");
const preview = document.getElementById("previewIcon");
const iconResults = document.getElementById("iconResults");
const btnGuardar = document.getElementById("btnGuardar");

/* ================= STATE ================= */
let editId = null;

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
  "fa-hand-holding"
];

/* ================= BUSCADOR ICONOS ================= */
icono.addEventListener("input", () => {

  const texto = icono.value.toLowerCase();

  // preview en tiempo real
  preview.innerHTML = texto
    ? `<i class="fa-solid ${texto}"></i>`
    : "";

  iconResults.innerHTML = "";

  if (!texto) return;

  const filtrados = iconos.filter(i => i.includes(texto));

  filtrados.forEach(ic => {

    const div = document.createElement("div");
    div.className = "icon-item";

    div.innerHTML = `
      <i class="fa-solid ${ic}"></i>
      ${ic}
    `;

    div.addEventListener("click", () => {
      icono.value = ic;
      preview.innerHTML = `<i class="fa-solid ${ic}"></i>`;
      iconResults.innerHTML = "";
    });

    iconResults.appendChild(div);
  });
});

/* ================= CARGAR SERVICIOS ================= */
async function cargar() {

  try {

    const snap = await getDocs(collection(db, "servicios"));

    list.innerHTML = "";

    snap.forEach(docu => {

      const s = docu.data();

            const div = document.createElement("div");
            div.className = "svc-card"; // ? usa estilos de reservas

            div.innerHTML = `
            <div class="svc-check"><i class="fa fa-check"></i></div>

            <div class="svc-icon">
                <i class="fa-solid ${s.icono || "fa-star"}"></i>
            </div>

            <div class="svc-name">${s.nombre}</div>
            <div class="svc-time">${s.duracion} min</div>
            <div class="svc-price">$${Number(s.precio).toLocaleString("es-CO")}</div>
            `;

      /* ? EDITAR */
      div.addEventListener("click", () => {

        editId = docu.id;

        nombre.value = s.nombre || "";
        precio.value = s.precio || "";
        duracion.value = s.duracion || "";
        icono.value = s.icono || "";

        preview.innerHTML = `<i class="fa-solid ${s.icono}"></i>`;
      });

      /* ? ELIMINAR */
      const btnDelete = div.querySelector(".btnDelete");

      btnDelete.addEventListener("click", async (e) => {

        e.stopPropagation();

        const ok = confirm("¿Eliminar servicio?");
        if (!ok) return;

        await deleteDoc(doc(db, "servicios", docu.id));

        cargar();
      });

      list.appendChild(div);
    });

  } catch (error) {
    console.error("Error cargando servicios:", error);
  }
}

/* ================= GUARDAR ================= */
btnGuardar.addEventListener("click", async () => {

  const data = {
    nombre: nombre.value.trim(),
    precio: Number(precio.value),
    duracion: Number(duracion.value),
    icono: icono.value.trim(),

    activo: true, // ? SIEMPRE ACTIVO
    createdAt: serverTimestamp()
  };

  try {

    if (editId) {
      await updateDoc(doc(db, "servicios", editId), data);
      editId = null;
    } else {
      await addDoc(collection(db, "servicios"), data);
    }

    limpiar();
    cargar();

  } catch (error) {
    console.error("Error guardando servicio:", error);
    alert("Error al guardar ?");
  }
});

/* ================= LIMPIAR ================= */
function limpiar() {
  nombre.value = "";
  precio.value = "";
  duracion.value = "";
  icono.value = "";
  preview.innerHTML = "";
  editId = null;
}

/* ================= INIT ================= */
cargar();