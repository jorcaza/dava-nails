import { db } from '/js/firebase-config.js';
import { collection, getDocs, query, where } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

function escapeCSV(value) {
    const texto = String(value ?? '');
    return `"${texto.replace(/"/g, '""')}"`;
}

function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0); }
function endOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59); }

function getWeekStart(date) {
    const copy = new Date(date);
    const day = copy.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    copy.setDate(copy.getDate() + diff);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function getWeekEnd(date) {
    const start = getWeekStart(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return end;
}

function getMonthWindow(baseDate, mode) {
    const date = new Date(baseDate);
    const currentStart = new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
    const currentEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);

    if (mode === 'anterior') {
        return {
            start: new Date(date.getFullYear(), date.getMonth() - 1, 1, 0, 0, 0, 0),
            end: new Date(date.getFullYear(), date.getMonth(), 0, 23, 59, 59, 999)
        };
    }

    return { start: currentStart, end: currentEnd };
}

function getWeekWindow(baseDate, mode) {
    const date = new Date(baseDate);
    const currentStart = getWeekStart(date);
    const currentEnd = getWeekEnd(date);

    if (mode === 'anterior') {
        const prev = new Date(currentStart);
        prev.setDate(prev.getDate() - 7);
        const prevEnd = new Date(prev);
        prevEnd.setDate(prev.getDate() + 6);
        prevEnd.setHours(23, 59, 59, 999);
        return { start: prev, end: prevEnd };
    }

    return { start: currentStart, end: currentEnd };
}

function parseInputDate(value, fallback = new Date()) {
    if (!value) return new Date(fallback);
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
}

function formatInputDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getPeriodWindow(period, baseDate = new Date()) {
    const date = new Date(baseDate);
    if (period === 'hoy') return { start: startOfDay(date), end: endOfDay(date) };
    if (period === 'semana') return { start: getWeekStart(date), end: endOfDay(date) };
    if (period === 'mesAnterior') return getMonthWindow(date, 'anterior');
    if (period === 'personalizado') {
        const start = startOfDay(parseInputDate(document.getElementById('facturacionFechaInicio')?.value, date));
        const end = endOfDay(parseInputDate(document.getElementById('facturacionFechaFin')?.value, date));
        return start <= end ? { start, end } : { start: endOfDay(start), end: endOfDay(start) };
    }
    return getMonthWindow(date, 'actual');
}

function sincronizarFechasPeriodo(periodo, fechaInicio, fechaFin) {
    const esPersonalizado = periodo === 'personalizado';
    if (fechaInicio) fechaInicio.disabled = !esPersonalizado;
    if (fechaFin) fechaFin.disabled = !esPersonalizado;

    if (esPersonalizado) return;

    const rango = getPeriodWindow(periodo, new Date());
    if (fechaInicio) fechaInicio.value = formatInputDate(rango.start);
    if (fechaFin) fechaFin.value = formatInputDate(rango.end);
}

function getBillingRange() {
    return getPeriodWindow(document.getElementById('facturacionPeriodo')?.value || 'mes', new Date());
}

function actualizarEtiquetaPeriodo() {
    const label = document.getElementById('facturacionRango');
    if (!label) return;

    const periodo = document.getElementById('facturacionPeriodo')?.value || 'mes';
    const rango = getBillingRange();
    if (periodo === 'mes' || periodo === 'mesAnterior') {
        const texto = rango.start.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        label.textContent = `Mostrando información de: ${texto.charAt(0).toUpperCase()}${texto.slice(1)}`;
        return;
    }

    const formato = { day: '2-digit', month: '2-digit', year: 'numeric' };
    label.textContent = `Mostrando información de: ${rango.start.toLocaleDateString('es-CO', formato)} - ${rango.end.toLocaleDateString('es-CO', formato)}`;
}

function formatearPeriodoComparado(rango, periodo) {
    if (periodo === 'mes' || periodo === 'mesAnterior') {
        const texto = rango.start.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        return texto.charAt(0).toUpperCase() + texto.slice(1);
    }

    const formato = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return `${rango.start.toLocaleDateString('es-CO', formato)} - ${rango.end.toLocaleDateString('es-CO', formato)}`;
}

function getPreviousPeriodRange(range, period) {
    if (period === 'hoy') {
        const previous = new Date(range.start);
        previous.setDate(previous.getDate() - 1);
        return { start: startOfDay(previous), end: endOfDay(previous) };
    }
    if (period === 'semana') {
        const previous = new Date(range.start);
        previous.setDate(previous.getDate() - 7);
        return { start: startOfDay(previous), end: getWeekEnd(previous) };
    }
    if (period === 'mes' || period === 'mesAnterior') {
        const previous = new Date(range.start.getFullYear(), range.start.getMonth() - 1, 1);
        return getMonthWindow(previous, 'actual');
    }

    const days = Math.round((startOfDay(range.end) - startOfDay(range.start)) / 86400000) + 1;
    const previousStart = new Date(range.start);
    previousStart.setDate(previousStart.getDate() - days);
    const previousEnd = new Date(previousStart);
    previousEnd.setDate(previousEnd.getDate() + days - 1);
    return { start: startOfDay(previousStart), end: endOfDay(previousEnd) };
}

function normalizarPrecioFacturacion(valor) {
    if (typeof valor === 'number') return Number.isFinite(valor) ? valor : 0;
    if (valor === null || valor === undefined || valor === '') return 0;

    const limpio = String(valor)
        .replace(/\$/g, '')
        .replace(/\./g, '')
        .replace(/,/g, '.')
        .replace(/\s/g, '')
        .replace(/[^\d.-]/g, '');

    const numero = Number(limpio);
    return Number.isFinite(numero) ? numero : 0;
}

function formatMoney(value) {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        maximumFractionDigits: 0
    }).format(Number(value || 0));
}

function hexToRgba(hex, alpha = 1) {
    let color = hex.replace('#', '');
    if (color.length === 3) {
        color = color.split('').map(char => char + char).join('');
    }
    const num = Number.parseInt(color, 16);
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getFechaFacturacion(data) {
    const candidatos = [
        data?.fechaPago,
        data?.fechaCompletada,
        data?.fechaCambioEstado,
        data?.fechaHora,
        data?.fecha
    ];

    for (const value of candidatos) {
        if (!value) continue;
        if (typeof value.toDate === 'function') return value.toDate();
        if (value instanceof Date) return value;
        if (typeof value === 'string' || typeof value === 'number') {
            const parsed = new Date(value);
            if (!Number.isNaN(parsed.getTime())) return parsed;
        }
    }

    return null;
}

async function obtenerFacturacion(range = getBillingRange()) {
    const snap = await getDocs(query(collection(db, 'citas')));
    const filtros = {
        metodo: document.getElementById('facturacionMetodo')?.value || 'todos',
        estado: document.getElementById('facturacionEstado')?.value || 'todos',
        servicio: document.getElementById('facturacionServicio')?.value || 'todos',
        manicurista: document.getElementById('facturacionManicurista')?.value || 'todos',
        cliente: String(document.getElementById('facturacionCliente')?.value || '').trim().toLowerCase()
    };
    const items = [];

    snap.forEach((docu) => {
        const data = docu.data() || {};
        const estado = String(data.estado || 'pendiente').trim().toLowerCase();
        const fecha = getFechaFacturacion(data);
        if (!fecha || fecha < range.start || fecha > range.end) return;

        const servicio = String(data.servicioNombre || data.servicio || 'Servicio').trim();
        const manicurista = String(data.manicuristaNombre || data.manicurista || 'Sin preferencia').trim();
        const cliente = String(data.cliente || 'Cliente').trim();
        const metodo = String(data.formaPago || 'efectivo').trim().toLowerCase() === 'transferencia'
            ? 'transferencia' : 'efectivo';
        if (filtros.estado !== 'todos' && estado !== filtros.estado) return;
        if (filtros.metodo !== 'todos' && metodo !== filtros.metodo) return;
        if (filtros.servicio !== 'todos' && servicio !== filtros.servicio) return;
        if (filtros.manicurista !== 'todos' && manicurista !== filtros.manicurista) return;
        if (filtros.cliente && !cliente.toLowerCase().includes(filtros.cliente)) return;

        items.push({
            id: docu.id,
            cliente,
            telefono: data.telefono || '',
            servicio,
            manicurista,
            fecha,
            metodoPago: metodo === 'transferencia' ? 'Transferencia' : 'Efectivo',
            precio: normalizarPrecioFacturacion(data.precio ?? 0),
            estado
        });
    });

    items.sort((a, b) => b.fecha - a.fecha);
    const completadas = items.filter(item => item.estado === 'completada' && item.precio > 0);
    const efectivo = completadas.filter(item => item.metodoPago === 'Efectivo').reduce((sum, item) => sum + item.precio, 0);
    const transferencia = completadas.filter(item => item.metodoPago === 'Transferencia').reduce((sum, item) => sum + item.precio, 0);
    const total = efectivo + transferencia;
    const facturacionPorDia = {};
    completadas.forEach(item => {
        const key = formatInputDate(item.fecha);
        if (!facturacionPorDia[key]) {
            facturacionPorDia[key] = { fecha: item.fecha, total: 0, servicios: new Set() };
        }
        facturacionPorDia[key].total += item.precio;
        facturacionPorDia[key].servicios.add(item.servicio);
    });
    const mayorDia = Object.values(facturacionPorDia).sort((a, b) => b.total - a.total)[0] || null;
    const mayorValor = mayorDia ? {
        fecha: mayorDia.fecha,
        total: mayorDia.total,
        servicios: [...mayorDia.servicios]
    } : null;
    return { efectivo, transferencia, total, completadas: completadas.length, ticket: completadas.length ? total / completadas.length : 0, mayorValor, items };
}

function renderDonutChart(containerId, items, colors = ['#c2185b', '#25D366', '#1565c0'], selectedFilter = 'todos') {
    const container = document.getElementById(containerId);
    if (!container) return;

    const safeItems = Array.isArray(items) ? items : [];
    if (!safeItems.length || safeItems.every(item => Number(item.value || 0) <= 0)) {
        container.innerHTML = '<div class="empty-chart">Sin datos para este rango.</div>';
        return;
    }

    const total = safeItems.reduce((sum, item) => sum + Number(item.value || 0), 0) || 1;
    let cumulative = 0;

    const segments = safeItems.map((item, index) => {
        const value = Number(item.value || 0);
        const percentage = total > 0 ? (value / total) * 100 : 0;
        const start = cumulative;
        cumulative += percentage;
        const color = item.color || colors[index % colors.length] || '#c2185b';
        return { ...item, color, start, end: cumulative, percentage };
    });

    const activeFilter = selectedFilter === 'todos' ? null : selectedFilter;
    const gradient = segments.map(segment => {
        const alpha = activeFilter && segment.label.toLowerCase() !== activeFilter ? 0.25 : 1;
        return `${hexToRgba(segment.color, alpha)} ${segment.start * 3.6}deg ${segment.end * 3.6}deg`;
    }).join(', ');

    const legend = segments.map((item, index) => {
        const itemFilter = item.label === 'Efectivo' ? 'efectivo' : 'transferencia';
        const isActive = !activeFilter || itemFilter === activeFilter;
        const opacity = isActive ? 1 : 0.35;
        const percentage = total > 0 ? ((Number(item.value || 0) / total) * 100) : 0;

        return `
            <button type="button" class="donut-legend-item ${activeFilter && !isActive ? 'muted' : ''} ${!activeFilter || isActive ? 'active' : ''}" data-filter="${itemFilter}" aria-label="Ver ${item.label}">
                <span style="opacity:${opacity};">
                    <i class="legend-dot" style="background:${item.color || colors[index % colors.length] || '#c2185b'}; opacity:${opacity};"></i>
                    ${item.label}
                </span>
                <strong style="opacity:${opacity};">${percentage.toFixed(0)}%<br><small>${formatMoney(item.value)}</small></strong>
            </button>
        `;
    }).join('');

    container.innerHTML = `
    <div class="donut-chart">
      <div class="donut-ring" style="background: conic-gradient(${gradient}, #f5f0f2 0deg 360deg);" title="Facturación total">
        <div class="donut-center">
          <strong>${formatMoney(total)}</strong>
        </div>
      </div>
      <div class="donut-legend">${legend}</div>
    </div>
  `;

    container.querySelectorAll('.donut-legend-item').forEach((button) => {
        button.addEventListener('click', () => {
            const metodoSelect = document.getElementById('facturacionMetodo');
            if (metodoSelect) metodoSelect.value = button.dataset.filter || 'todos';
            actualizarFacturacionView();
        });
    });
}

function getChartDataByFilter(data, filter) {
    const base = [
        { label: 'Efectivo', value: data.efectivo, color: '#25D366' },
        { label: 'Transferencia', value: data.transferencia, color: '#c2185b' }
    ];

    if (filter === 'efectivo') {
        return base.map(item => ({ ...item, label: item.label === 'Efectivo' ? 'Efectivo' : 'Transferencia', value: item.label === 'Efectivo' ? item.value : 0 }));
    }

    if (filter === 'transferencia') {
        return base.map(item => ({ ...item, label: item.label === 'Transferencia' ? 'Transferencia' : 'Efectivo', value: item.label === 'Transferencia' ? item.value : 0 }));
    }

    return base.filter(item => Number(item.value || 0) > 0);
}

async function actualizarFacturacionView() {
    actualizarEtiquetaPeriodo();
    const range = getBillingRange();
    const data = await obtenerFacturacion(range);

    const totalEl = document.getElementById('facturacionTotal');
    const efectivoEl = document.getElementById('facturacionEfectivo');
    const transferenciaEl = document.getElementById('facturacionTransferencia');
    const completadasEl = document.getElementById('facturacionCompletadas');
    const mayorValorEl = document.getElementById('facturacionMayorValor');

    if (totalEl) totalEl.textContent = formatMoney(data.total);
    if (efectivoEl) efectivoEl.textContent = formatMoney(data.efectivo);
    if (transferenciaEl) transferenciaEl.textContent = formatMoney(data.transferencia);
    if (completadasEl) completadasEl.textContent = String(data.completadas);
    renderMayorValor(data.mayorValor, mayorValorEl);

    const metodo = document.getElementById('facturacionMetodo')?.value || 'todos';
    renderDonutChart('chartEstadoFacturacion', getChartDataByFilter(data, metodo), ['#25D366', '#c2185b'], metodo);
    renderIncomeChart(data.items, metodo);
    renderFacturacionTable(data.items);

    const comparison = document.getElementById('facturacionComparacion');
    if (comparison) {
        const period = document.getElementById('facturacionPeriodo')?.value || 'mes';
        const previousRange = getPreviousPeriodRange(range, period);
        const comparisonTitle = document.getElementById('facturacionComparacionTitulo');
        if (comparisonTitle) {
            comparisonTitle.textContent = `Periodo anterior: ${formatearPeriodoComparado(previousRange, period)}`;
        }
        const previous = await obtenerFacturacion(previousRange);
        const totalComparison = document.getElementById('facturacionComparacionTotal');
        const variation = document.getElementById('facturacionComparacionVariacion');
        if (totalComparison) totalComparison.textContent = formatMoney(previous.total);
        if (variation) {
            const difference = previous.total ? ((data.total - previous.total) / previous.total) * 100 : data.total ? 100 : 0;
            variation.textContent = `${difference >= 0 ? '+' : ''}${difference.toFixed(1)}% frente al periodo anterior`;
            variation.className = difference >= 0 ? 'facturacion-variacion positiva' : 'facturacion-variacion negativa';
        }
    }
}

function renderMayorValor(mayorValor, valueElement) {
    const tooltip = document.getElementById('facturacionMayorValorTooltip');
    if (valueElement) valueElement.textContent = formatMoney(mayorValor?.total || 0);
    if (!tooltip) return;

    if (!mayorValor) {
        tooltip.innerHTML = `
            <strong>Sin datos</strong>
            <span>Fecha exacta: Sin datos</span>
            <span>Total facturado: ${formatMoney(0)}</span>
            <span>Servicios facturados: Sin datos</span>
        `;
        return;
    }

    const fecha = mayorValor.fecha.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' });
    tooltip.innerHTML = `
        <strong>Detalle del día</strong>
        <span>Fecha exacta: ${escapeHtml(fecha)}</span>
        <span>Total facturado: ${formatMoney(mayorValor.total)}</span>
        <span>Servicios facturados: ${escapeHtml(mayorValor.servicios.join(', '))}</span>
    `;
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, character => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[character]));
}

function renderIncomeChart(items, selectedMethod = 'todos') {
    const container = document.getElementById('chartIngresosFecha');
    if (!container) return;
    const grouped = {};
    items.filter(item => item.estado === 'completada' && item.precio > 0).forEach(item => {
        const key = item.fecha.toISOString().slice(0, 10);
        if (!grouped[key]) grouped[key] = { efectivo: 0, transferencia: 0 };
        grouped[key][item.metodoPago.toLowerCase()] += item.precio;
    });
    const entries = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));
    if (!entries.length) {
        container.innerHTML = '<div class="empty-chart">Sin ingresos para este periodo.</div>';
        return;
    }
    const max = Math.max(...entries.map(([, values]) => values.efectivo + values.transferencia), 1);
    container.innerHTML = entries.map(([date, values]) => {
        const segmentos = selectedMethod === 'todos'
            ? [['efectivo', values.efectivo, '#25D366'], ['transferencia', values.transferencia, '#c2185b']]
            : [[selectedMethod, values[selectedMethod] || 0, selectedMethod === 'efectivo' ? '#25D366' : '#c2185b']];
        const efectivo = selectedMethod === 'transferencia' ? 0 : values.efectivo;
        const transferencia = selectedMethod === 'efectivo' ? 0 : values.transferencia;
        const total = efectivo + transferencia;
        const fechaLabel = new Date(`${date}T12:00:00`).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
        return `
        <div class="facturacion-bar-row">
                    <span>${escapeHtml(fechaLabel)}</span>
                    <div class="facturacion-bar-track">${segmentos.filter(([, value]) => value > 0).map(([, value, color]) => `<i style="width:${value / max * 100}%;background:${color};"></i>`).join('')}</div>
                    <strong>${formatMoney(total)}</strong>
                    <div class="facturacion-bar-tooltip" role="tooltip">
                        <strong>${escapeHtml(fechaLabel)}</strong>
                        <span>💵 Efectivo: ${formatMoney(efectivo)}</span>
                        <span>🏦 Transferencia: ${formatMoney(transferencia)}</span>
                        <b>Total del día: ${formatMoney(total)}</b>
                    </div>
        </div>
                `;
    }).join('');
}

function renderFacturacionTable(items) {
    const body = document.getElementById('facturacionTablaBody');
    const count = document.getElementById('facturacionResumenFilas');
    if (!body) return;
    if (count) count.textContent = `${items.length} registro${items.length === 1 ? '' : 's'}`;
    body.innerHTML = items.length ? items.map(item => `
        <tr>
          <td>${escapeHtml(item.fecha.toLocaleDateString('es-CO'))}</td>
          <td>${escapeHtml(item.cliente)}</td>
          <td>${escapeHtml(item.servicio)}</td>
          <td>${escapeHtml(item.manicurista)}</td>
          <td class="facturacion-precio">${formatMoney(item.precio)}</td>
          <td>${escapeHtml(item.metodoPago)}</td>
          <td><span class="facturacion-estado estado-${escapeHtml(item.estado)}">${escapeHtml(item.estado)}</span></td>
        </tr>
    `).join('') : '<tr><td colspan="7" class="facturacion-vacio">No hay registros con estos filtros.</td></tr>';
}

async function cargarOpcionesFiltro() {
    const servicioSelect = document.getElementById('facturacionServicio');
    const manicuristaSelect = document.getElementById('facturacionManicurista');
    const [serviciosSnap, citasSnap] = await Promise.all([
        getDocs(collection(db, 'servicios')),
        getDocs(collection(db, 'citas'))
    ]);
    const servicios = serviciosSnap.docs
        .map(docu => String(docu.data()?.nombre || '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    const manicuristasConfiguradas = ['Stefany nava'];
    const manicuristas = [...new Set(manicuristasConfiguradas.concat(citasSnap.docs
        .map(docu => String(docu.data()?.manicuristaNombre || '').trim())
        .filter(Boolean)))]
        .sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

    if (servicioSelect) {
        servicioSelect.innerHTML = '<option value="todos">Todos</option>' + servicios
            .map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    }
    if (manicuristaSelect) {
        manicuristaSelect.innerHTML = '<option value="todos">Todos</option>' + manicuristas
            .map(value => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join('');
    }
}

function descargarDetalleExcel() {
    const btn = document.getElementById('btnDescargarExcel');
    if (btn) btn.disabled = true;

    obtenerFacturacion().then((data) => {
        const resumen = [
            ['Resumen de facturación'],
            ['Periodo', document.getElementById('facturacionPeriodo')?.value || ''],
            ['Total facturado', Number(data.total || 0)],
            ['Efectivo', Number(data.efectivo || 0)],
            ['Transferencias', Number(data.transferencia || 0)],
            ['Citas completadas', Number(data.completadas || 0)],
            ['Ticket promedio', Number(data.ticket || 0)]
        ];
        const rows = [['Fecha', 'Cliente', 'Servicio', 'Manicurista', 'Precio', 'Método de pago', 'Estado']];
        data.items.forEach((item) => rows.push([
            item.fecha ? item.fecha.toLocaleDateString('es-CO') : '',
            item.cliente || '',
            item.servicio || '',
            item.manicurista || '',
            Number(item.precio || 0),
            item.metodoPago || '',
            item.estado || ''
        ]));

        if (typeof XLSX !== 'undefined') {
            const workbook = XLSX.utils.book_new();
            const summarySheet = XLSX.utils.aoa_to_sheet(resumen);
            const detailSheet = XLSX.utils.aoa_to_sheet(rows);

            summarySheet['!cols'] = [{ wch: 24 }, { wch: 20 }];
            detailSheet['!cols'] = [
                { wch: 16 },
                { wch: 24 },
                { wch: 26 },
                { wch: 20 },
                { wch: 14 },
                { wch: 18 },
                { wch: 16 }
            ];

            XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
            XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detalle');
            XLSX.writeFile(workbook, `facturacion-${new Date().toISOString().slice(0, 10)}.xlsx`);
            return;
        }

        const csv = resumen.concat([[], ...rows]).map(row => row.map(escapeCSV).join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `facturacion-detalle-${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }).catch((error) => {
        console.error('Error exportando Excel:', error);
        Swal.fire({ title: 'Error', text: 'No se pudo descargar el detalle.', icon: 'error' });
    }).finally(() => {
        if (btn) btn.disabled = false;
    });
}

async function initFacturacionPage() {
    const periodo = document.getElementById('facturacionPeriodo');
    const fechaInicio = document.getElementById('facturacionFechaInicio');
    const fechaFin = document.getElementById('facturacionFechaFin');
    const btn = document.getElementById('btnDescargarExcel');
    const filtrosMetricas = document.getElementById('facturacionFiltrosMetricas');
    const filtroIds = ['facturacionMetodo', 'facturacionEstado', 'facturacionServicio', 'facturacionManicurista', 'facturacionCliente'];

    if (periodo) periodo.value = 'mes';
    ['facturacionMetodo', 'facturacionEstado', 'facturacionServicio', 'facturacionManicurista'].forEach(id => {
        const select = document.getElementById(id);
        if (select) select.value = 'todos';
    });
    const cliente = document.getElementById('facturacionCliente');
    if (cliente) cliente.value = '';
    if (filtrosMetricas) {
        filtrosMetricas.hidden = true;
    }
    sincronizarFechasPeriodo(periodo?.value || 'mes', fechaInicio, fechaFin);
    if (periodo) periodo.addEventListener('change', () => {
        sincronizarFechasPeriodo(periodo.value, fechaInicio, fechaFin);
        actualizarFacturacionView();
    });
    fechaInicio?.addEventListener('change', actualizarFacturacionView);
    fechaFin?.addEventListener('change', actualizarFacturacionView);
    filtroIds.forEach(id => document.getElementById(id)?.addEventListener('input', actualizarFacturacionView));
    if (btn) btn.addEventListener('click', descargarDetalleExcel);

    await cargarOpcionesFiltro();
    actualizarFacturacionView();
}

initFacturacionPage();
