
/* ═══════════════════════════════════════════════════
   STORAGE LAYER
   Clave: 'ns_client' → JSON con datos del cliente
   Preparado para backend: cuando exista el API,
   se reemplaza loadClient() y saveClient() sin tocar
   nada más del código.
═══════════════════════════════════════════════════ */
const STORAGE_KEY = 'ns_client';

function loadClient() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function saveClient(data) {
  try {
    // Merge con datos existentes para no perder campos
    const existing = loadClient() || {};
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...data }));
  } catch (e) {
    // localStorage bloqueado (modo privado) → se ignora silenciosamente
    console.warn('No se pudo guardar en localStorage:', e);
  }
}

function clearSavedData() {
  localStorage.removeItem(STORAGE_KEY);
  document.getElementById('welcomeBanner').classList.remove('show');
  // Limpiar formulario también
  ['nombre', 'apellido', 'celular', 'email', 'notas'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('prefilledChip').classList.remove('show');
}

/* ═══════════════════════════════════════════════════
   INIT: cargar datos guardados al abrir la página
═══════════════════════════════════════════════════ */
const saved = loadClient();

if (saved && saved.nombre) {
  // Mostrar banner de bienvenida
  const banner = document.getElementById('welcomeBanner');
  banner.classList.add('show');
  document.getElementById('wbAvatar').textContent = saved.nombre.charAt(0).toUpperCase();
  document.getElementById('wbName').textContent = `¡Hola de nuevo, ${saved.nombre}! 👋`;
  document.getElementById('wbSub').textContent = `${saved.celular || ''} · Solo elige servicio y hora 💅`;
}

// Fecha mínima = hoy
const hoy = new Date();
const fechaInput = document.getElementById('fecha');
fechaInput.min = hoy.toISOString().split('T')[0];

/* ═══════════════════════════════════════════════════
   ESTADO DE LA RESERVA
═══════════════════════════════════════════════════ */
const booking = {
  servicio: '', precio: '', duracion: '',
  manicurista: 'Sin preferencia',
  fecha: '', fechaRaw: '', hora: ''
};

/* ── Servicio ── */
function selectSvc(el, name, dur, price) {
  document.querySelectorAll('.svc-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  booking.servicio = name;
  booking.duracion = dur;
  booking.precio = price;
  document.getElementById('err-svc').style.display = 'none';
}

/* ── Manicurista ── */
function selectMani(el, name) {
  document.querySelectorAll('.mani-pill').forEach(p => p.classList.remove('selected'));
  el.classList.add('selected');
  booking.manicurista = name;
}

/* ── Slot ── */
function selectSlot(el) {
  if (el.classList.contains('taken')) return;
  document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
  booking.hora = el.textContent.trim();
  document.getElementById('err-slot').classList.remove('show');
}

/* ═══════════════════════════════════════════════════
   NAVEGACIÓN ENTRE PASOS
═══════════════════════════════════════════════════ */
function goTo(step) {
  if (step === 2 && !validateStep1()) return;
  if (step === 3 && !validateStep2()) return;
  if (step === 3) {
    fillSummary();
    prefillClientFields();
  }
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel' + step).classList.add('active');
  updateSteps(step);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function updateSteps(active) {
  [1, 2, 3].forEach(i => {
    const s = document.getElementById('s' + i);
    s.classList.remove('active', 'done');
    if (i < active) s.classList.add('done');
    else if (i === active) s.classList.add('active');
  });
  [1, 2].forEach(i => {
    document.getElementById('line' + i).classList.toggle('done', i < active);
  });
}

/* ── Precargar datos del cliente guardados ── */
function prefillClientFields() {
  const c = loadClient();
  if (!c) return;
  const chip = document.getElementById('prefilledChip');
  let preloaded = false;
  if (c.nombre) { document.getElementById('nombre').value = c.nombre; preloaded = true; }
  if (c.apellido) { document.getElementById('apellido').value = c.apellido; preloaded = true; }
  if (c.celular) { document.getElementById('celular').value = c.celular; preloaded = true; }
  if (c.email) { document.getElementById('email').value = c.email; }
  if (c.primera) { document.getElementById('primera').value = 'no'; } // ya vino antes
  if (c.notas) { document.getElementById('notas').value = c.notas; }
  if (preloaded) chip.classList.add('show');
}

/* ═══════════════════════════════════════════════════
   VALIDACIONES
═══════════════════════════════════════════════════ */
function validateStep1() {
  if (!booking.servicio) {
    document.getElementById('err-svc').style.display = 'block';
    return false;
  }
  return true;
}

function validateStep2() {
  let ok = true;
  if (!fechaInput.value) {
    document.getElementById('err-fecha').classList.add('show'); ok = false;
  }
  if (!booking.hora) {
    document.getElementById('err-slot').classList.add('show'); ok = false;
  }
  if (ok) {
    booking.fechaRaw = fechaInput.value;
    const [y, m, d] = fechaInput.value.split('-');
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
      'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    booking.fecha = `${parseInt(d)} de ${meses[parseInt(m) - 1]} de ${y}`;
  }
  return ok;
}

function clearErr(id, input) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
  if (input) input.classList.remove('error');
}

function showErr(errId, inputId) {
  document.getElementById(errId).classList.add('show');
  document.getElementById(inputId).classList.add('error');
}

function fillSummary() {
  document.getElementById('r-svc').textContent = `${booking.servicio} — ${booking.precio}`;
  document.getElementById('r-fecha').textContent = booking.fecha;
  document.getElementById('r-hora').textContent = `${booking.hora} (${booking.duracion})`;
  document.getElementById('r-mani').textContent = booking.manicurista;
}

/* ═══════════════════════════════════════════════════
   CONFIRMAR CITA
═══════════════════════════════════════════════════ */
function confirmar() {
  const nombre = document.getElementById('nombre').value.trim();
  const apellido = document.getElementById('apellido').value.trim();
  const celular = document.getElementById('celular').value.trim();
  const email = document.getElementById('email').value.trim();
  const notas = document.getElementById('notas').value.trim();
  const primera = document.getElementById('primera').value;

  let ok = true;
  if (!nombre) { showErr('err-nombre', 'nombre'); ok = false; }
  if (!apellido) { showErr('err-apellido', 'apellido'); ok = false; }
  if (!celular || celular.length < 7) { showErr('err-cel', 'celular'); ok = false; }
  if (!ok) return;

  /* ── GUARDAR en localStorage ── */
  saveClient({
    nombre, apellido, celular, email, notas, primera,
    ultimaVisita: booking.fechaRaw
  });

  /* ── Mensaje WhatsApp ── */
  const phone = '573001234567'; // ← número del salón
  const msg = encodeURIComponent(
    `Hola NailStudio! 👋 Quiero confirmar mi cita:\n\n` +
    `👤 *${nombre} ${apellido}*\n` +
    `📱 Cel: ${celular}\n` +
    `💅 Servicio: ${booking.servicio}\n` +
    `📅 Fecha: ${booking.fecha}\n` +
    `⏰ Hora: ${booking.hora}\n` +
    `💇 Manicurista: ${booking.manicurista}\n` +
    (notas ? `📝 Notas: ${notas}\n` : '') +
    `\n¡Gracias! 🌸`
  );
  document.getElementById('waLink').href = `https://wa.me/${phone}?text=${msg}`;

  /* ── Pantalla de éxito ── */
  document.getElementById('c-svc').textContent = `${booking.servicio} — ${booking.precio}`;
  document.getElementById('c-fecha').textContent = `${booking.fecha} a las ${booking.hora}`;
  document.getElementById('c-mani').textContent = booking.manicurista;
  document.getElementById('successMsg').innerHTML =
    `¡Listo, <strong>${nombre}</strong>! Tu cita está reservada.<br>` +
    `La próxima vez no tendrás que ingresar tus datos de nuevo 💾`;

  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('successPanel').classList.add('show');
  updateSteps(4);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ═══════════════════════════════════════════════════
   RESET
═══════════════════════════════════════════════════ */
function resetForm() {
  booking.servicio = ''; booking.precio = ''; booking.duracion = '';
  booking.manicurista = 'Sin preferencia'; booking.fecha = ''; booking.hora = '';

  document.querySelectorAll('.svc-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.mani-pill').forEach(p => p.classList.remove('selected'));
  document.querySelector('.mani-pill:first-child').classList.add('selected');
  document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected'));
  fechaInput.value = '';

  document.getElementById('successPanel').classList.remove('show');
  document.getElementById('panel1').classList.add('active');
  document.getElementById('prefilledChip').classList.remove('show');
  updateSteps(1);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
