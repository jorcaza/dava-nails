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

function getBillingRange() {
    const today = new Date();
    const monthMode = document.getElementById('facturacionMes')?.value || 'actual';
    const weekMode = document.getElementById('facturacionSemana')?.value || 'actual';

    const monthWindow = monthMode === 'todos'
        ? { start: new Date(2000, 0, 1), end: new Date(2100, 11, 31, 23, 59, 59, 999) }
        : getMonthWindow(today, monthMode);

    const weekWindow = weekMode === 'todos'
        ? { start: new Date(2000, 0, 1), end: new Date(2100, 11, 31, 23, 59, 59, 999) }
        : getWeekWindow(today, weekMode);

    return {
        start: monthWindow.start < weekWindow.start ? monthWindow.start : weekWindow.start,
        end: monthWindow.end > weekWindow.end ? monthWindow.end : weekWindow.end
    };
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

async function obtenerFacturacion() {
    const range = getBillingRange();
    const q = query(
        collection(db, 'citas'),
        where('estado', '==', 'completada')
    );

    const snap = await getDocs(q);
    const items = [];
    let efectivo = 0;
    let transferencia = 0;
    let total = 0;

    snap.forEach((docu) => {
        const data = docu.data() || {};
        if (String(data.estado || '').toLowerCase() !== 'completada') return;

        const fecha = getFechaFacturacion(data);
        if (!fecha || fecha < range.start || fecha > range.end) return;

        const precio = normalizarPrecioFacturacion(data.precio ?? 0);
        if (!Number.isFinite(precio) || precio <= 0) return;

        total += precio;
        const metodo = String(data.formaPago || 'efectivo').trim().toLowerCase();

        if (metodo === 'transferencia') {
            transferencia += precio;
        } else {
            efectivo += precio;
        }

        items.push({
            id: docu.id,
            cliente: data.cliente || 'Cliente',
            telefono: data.telefono || '',
            servicio: data.servicioNombre || data.servicio || 'Servicio',
            manicurista: data.manicuristaNombre || data.manicurista || 'Sin preferencia',
            fecha: fecha,
            metodoPago: metodo === 'transferencia' ? 'Transferencia' : 'Efectivo',
            precio,
            estado: data.estado || 'completada'
        });
    });

    return { efectivo, transferencia, total, items };
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

    const filterSelect = document.getElementById('facturacionChartFilter');
    const ring = container.querySelector('.donut-ring');

    if (ring) {
        ring.addEventListener('click', () => {
            if (!filterSelect) return;
            const next = selectedFilter === 'todos' ? 'efectivo' : selectedFilter === 'efectivo' ? 'transferencia' : 'todos';
            filterSelect.value = next;
            actualizarFacturacionView();
        });
    }

    container.querySelectorAll('.donut-legend-item').forEach((button) => {
        button.addEventListener('click', () => {
            const nextFilter = button.dataset.filter || 'todos';
            if (filterSelect) {
                filterSelect.value = nextFilter;
            }
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
    const data = await obtenerFacturacion();

    const totalEl = document.getElementById('facturacionTotal');
    const efectivoEl = document.getElementById('facturacionEfectivo');
    const transferenciaEl = document.getElementById('facturacionTransferencia');

    if (totalEl) totalEl.textContent = formatMoney(data.total);
    if (efectivoEl) efectivoEl.textContent = formatMoney(data.efectivo);
    if (transferenciaEl) transferenciaEl.textContent = formatMoney(data.transferencia);

    const filter = document.getElementById('facturacionChartFilter')?.value || 'todos';
    const chartData = getChartDataByFilter(data, filter);
    renderDonutChart('chartEstadoFacturacion', chartData.length ? chartData : [{ label: 'Sin datos', value: 0, color: '#e5e7eb' }], ['#25D366', '#c2185b'], filter);
}

function descargarDetalleExcel() {
    const btn = document.getElementById('btnDescargarExcel');
    if (btn) btn.disabled = true;

    obtenerFacturacion().then(({ items, total, efectivo, transferencia }) => {
        const rows = [
            ['Fecha', 'Nombre cliente', 'Servicio', 'Manicurista', 'Método de pago', 'Valor']
        ];

        items.forEach((item) => {
            rows.push([
                item.fecha ? item.fecha.toLocaleDateString('es-CO') : '',
                item.cliente || '',
                item.servicio || '',
                item.manicurista || '',
                item.metodoPago || '',
                Number(item.precio || 0)
            ]);
        });

        rows.push(
            [],
            ['Total general', '', '', '', '', Number(total || 0)],
            ['Efectivo', '', '', '', '', Number(efectivo || 0)],
            ['Transferencia', '', '', '', '', Number(transferencia || 0)]
        );

        if (typeof XLSX !== 'undefined') {
            const workbook = XLSX.utils.book_new();
            const sheet = XLSX.utils.aoa_to_sheet(rows);

            sheet['!cols'] = [
                { wch: 16 },
                { wch: 24 },
                { wch: 26 },
                { wch: 20 },
                { wch: 18 },
                { wch: 14 }
            ];

            XLSX.utils.book_append_sheet(workbook, sheet, 'Facturacion');
            XLSX.writeFile(workbook, `facturacion-detalle-${new Date().toISOString().slice(0, 10)}.xlsx`);
            return;
        }

        const csv = rows.map(row => row.map(escapeCSV).join(',')).join('\n');
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

function initFacturacionPage() {
    const mes = document.getElementById('facturacionMes');
    const semana = document.getElementById('facturacionSemana');
    const chartFilter = document.getElementById('facturacionChartFilter');
    const btn = document.getElementById('btnDescargarExcel');

    if (mes) mes.addEventListener('change', actualizarFacturacionView);
    if (semana) semana.addEventListener('change', actualizarFacturacionView);
    if (chartFilter) chartFilter.addEventListener('change', actualizarFacturacionView);
    if (btn) btn.addEventListener('click', descargarDetalleExcel);

    actualizarFacturacionView();
}

initFacturacionPage();
