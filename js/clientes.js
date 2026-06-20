import { db } from "./firebase-config.js";
import {
  collection,
  getDocs,
  query,
  where,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const nombreInput = document.getElementById('nombre');
const apellidoInput = document.getElementById('apellido');
const celularInput = document.getElementById('celular');
const emailInput = document.getElementById('email');
const notasInput = document.getElementById('notas');
const searchInput = document.getElementById('searchClientes');
const clientesList = document.getElementById('clientesList');
const formTitle = document.getElementById('formTitle');
const saveBtn = document.getElementById('saveBtn');

let clientesCache = [];
let selectedCliente = null;
let searchTimer = null;

function normalizePhone(value) {
  return String(value || "").replace(/\D/g, "");
}

function showError(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
}

function hideErrors() {
  ['err-nombre', 'err-cel'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
}

function mostrarToast(msg, tipo = 'ok') {
  const toast = document.createElement('div');
  toast.className = 'toast ' + tipo;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2200);
}

async function cargarClientes() {
  const snap = await getDocs(query(collection(db, 'clientes'), orderBy('nombre', 'asc')));
  clientesCache = [];
  snap.forEach(docu => {
    clientesCache.push({ id: docu.id, ...docu.data() });
  });
  renderClientes();
}

function renderClientes() {
  const filtro = String(searchInput.value || '').trim().toLowerCase();
  const lista = clientesCache.filter(cliente => {
    if (!filtro) return true;
    return String(cliente.nombre || '').toLowerCase().includes(filtro)
      || String(cliente.telefono || '').toLowerCase().includes(filtro);
  });

  if (!lista.length) {
    clientesList.innerHTML = '<div class="field-error">No hay clientes coincidentes.</div>';
    return;
  }

  clientesList.innerHTML = lista.map(cliente => {
    return `
      <div class="cliente-item ${selectedCliente && selectedCliente.id === cliente.id ? 'active' : ''}" onclick="window.seleccionarCliente('${cliente.id}')">
        <div class="cliente-meta">
          <span class="cliente-name">${cliente.nombre || 'Sin nombre'}</span>
          <span class="cliente-phone">${cliente.telefono || '?'}</span>
          <span class="cliente-email">${cliente.email || 'Sin email'}</span>
        </div>
        <div class="cliente-actions">
          <button type="button" title="Editar" onclick="window.editarCliente(event, '${cliente.id}')"><i class="fa fa-pen"></i></button>
          <button type="button" title="Eliminar" onclick="window.eliminarCliente(event, '${cliente.id}')"><i class="fa fa-trash"></i></button>
        </div>
      </div>
    `;
  }).join('');
}

function seleccionarClientePorId(id) {
  const cliente = clientesCache.find(c => c.id === id);
  if (!cliente) return;
  selectedCliente = cliente;
  nombreInput.value = cliente.nombre || '';
  apellidoInput.value = cliente.apellido || '';
  celularInput.value = cliente.telefono || '';
  emailInput.value = cliente.email || '';
  notasInput.value = cliente.notas || '';
  formTitle.textContent = 'Editar cliente';
  saveBtn.textContent = 'Actualizar cliente';
  renderClientes();
}

window.seleccionarCliente = id => seleccionarClientePorId(id);

window.editarCliente = (event, id) => {
  event.stopPropagation();
  seleccionarClientePorId(id);
};

window.eliminarCliente = async (event, id) => {
  event.stopPropagation();
  const cliente = clientesCache.find(c => c.id === id);
  if (!cliente) return;
  const confirmed = confirm(`Eliminar cliente ${cliente.nombre}? Esta acción no se puede deshacer.`);
  if (!confirmed) return;
  try {
    await deleteDoc(doc(db, 'clientes', id));
    if (selectedCliente && selectedCliente.id === id) {
      resetForm();
    }
    await cargarClientes();
    mostrarToast('Cliente eliminado', 'ok');
  } catch (e) {
    console.error('Error eliminando cliente:', e);
    mostrarToast('Error eliminando cliente', 'error');
  }
};

function validarFormulario() {
  hideErrors();
  const nombre = String(nombreInput.value || '').trim();
  const celular = normalizePhone(celularInput.value);
  let valido = true;
  if (!nombre) {
    showError('err-nombre', 'Nombre es obligatorio.');
    valido = false;
  }
  if (!celular || celular.length !== 10) {
    showError('err-cel', 'Teléfono válido de 10 dígitos.');
    valido = false;
  }
  return valido;
}

async function guardarCliente() {
  if (!validarFormulario()) return;
  const nombre = String(nombreInput.value || '').trim();
  const apellido = String(apellidoInput.value || '').trim();
  const telefono = normalizePhone(celularInput.value);
  const email = String(emailInput.value || '').trim();
  const notas = String(notasInput.value || '').trim();

  const clienteData = {
    nombre,
    apellido,
    telefono,
    email,
    notas,
    updatedAt: serverTimestamp()
  };

  try {
    if (selectedCliente && selectedCliente.id) {
      await updateDoc(doc(db, 'clientes', selectedCliente.id), clienteData);
      mostrarToast('Cliente actualizado', 'ok');
    } else {
      const duplicado = clientesCache.find(c => c.telefono === telefono);
      if (duplicado) {
        const confirmed = confirm('Ya existe un cliente con ese teléfono. ¿Deseas actualizar sus datos?');
        if (confirmed) {
          await updateDoc(doc(db, 'clientes', duplicado.id), clienteData);
          selectedCliente = duplicado;
          mostrarToast('Cliente existente actualizado', 'ok');
        } else {
          return;
        }
      } else {
        await addDoc(collection(db, 'clientes'), {
          ...clienteData,
          createdAt: serverTimestamp()
        });
        mostrarToast('Cliente creado', 'ok');
      }
    }
    await cargarClientes();
    resetForm();
  } catch (e) {
    console.error('Error guardando cliente:', e);
    mostrarToast('Error guardando cliente', 'error');
  }
}

function resetForm() {
  selectedCliente = null;
  nombreInput.value = '';
  apellidoInput.value = '';
  celularInput.value = '';
  emailInput.value = '';
  notasInput.value = '';
  formTitle.textContent = 'Crear cliente';
  saveBtn.textContent = 'Guardar cliente';
  hideErrors();
  renderClientes();
}

searchInput.addEventListener('input', () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(renderClientes, 250);
});

window.addEventListener('DOMContentLoaded', () => {
  if (clientesList) cargarClientes();
});
