import { auth, db } from './firebase-config.js';
import { signInWithEmailAndPassword, onAuthStateChanged, signOut }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ========== REFERENCIAS AL DOM ==========
const loginAdmin = document.getElementById('loginAdmin');
const panelAdmin = document.getElementById('panelAdmin');
const tabla = document.getElementById('tablaPedidos');
const adminMsg = document.getElementById('adminMsg');
const contador = document.getElementById('contadorResultados');
const buscadorInput = document.getElementById('buscadorInput');
const btnLimpiarBusqueda = document.getElementById('btnLimpiarBusqueda');

// ========== ESTADO GLOBAL ==========
let pedidos = [];
let filtroEstado = 'todos';
let filtroFecha = 'todo';
let rangoDesde = null;
let rangoHasta = null;
let textoBusqueda = '';

// ========== LOGIN ==========
document.getElementById('btnAdminLogin').onclick = async () => {
  const email = document.getElementById('adminEmail').value.trim();
  const pass = document.getElementById('adminPass').value;

  try {
    const cred = await signInWithEmailAndPassword(auth, email, pass);
    const snap = await getDoc(doc(db, 'usuarios', cred.user.uid));

    if (!snap.exists() || snap.data().rol !== 'admin') {
      adminMsg.textContent = 'No tienes permisos de administrador';
      await signOut(auth);
      return;
    }

    iniciarPanel();
  } catch (e) {
    adminMsg.textContent = 'Credenciales incorrectas';
  }
};

onAuthStateChanged(auth, async (user) => {
  if (user) {
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    if (snap.exists() && snap.data().rol === 'admin') iniciarPanel();
  }
});

// ========== PANEL ==========
function iniciarPanel() {
  loginAdmin.classList.add('hidden');
  panelAdmin.classList.remove('hidden');

  const q = query(collection(db, 'pedidos'), orderBy('fecha', 'desc'));
  onSnapshot(q, (snapshot) => {
    pedidos = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTabla();
  });
}

// ========== HELPERS DE FECHA ==========
function inicioDia(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function finDia(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function rangoSegunFiltro() {
  const hoy = new Date();

  switch (filtroFecha) {
    case 'hoy':
      return { desde: inicioDia(hoy), hasta: finDia(hoy) };

    case 'ayer': {
      const ayer = new Date(hoy);
      ayer.setDate(hoy.getDate() - 1);
      return { desde: inicioDia(ayer), hasta: finDia(ayer) };
    }

    case '7dias': {
      const hace7 = new Date(hoy);
      hace7.setDate(hoy.getDate() - 6);
      return { desde: inicioDia(hace7), hasta: finDia(hoy) };
    }

    case 'mes': {
      const primero = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      return { desde: inicioDia(primero), hasta: finDia(hoy) };
    }

    case 'rango':
      return {
        desde: rangoDesde ? inicioDia(rangoDesde) : null,
        hasta: rangoHasta ? finDia(rangoHasta) : null
      };

    case 'todo':
    default:
      return { desde: null, hasta: null };
  }
}

function filtrarPedidos() {
  let resultado = pedidos;

  // 1. Por estado
  if (filtroEstado !== 'todos') {
    resultado = resultado.filter(p => p.estado === filtroEstado);
  }

  // 2. Por búsqueda (nombre, teléfono, correo, dirección)
  if (textoBusqueda.trim()) {
    const t = textoBusqueda.trim().toLowerCase();
    resultado = resultado.filter(p => {
      const nombre = (p.nombre || '').toLowerCase();
      const telefono = (p.telefono || '').toString().toLowerCase();
      const email = (p.email || '').toLowerCase();
      const dir = (p.direccion || '').toLowerCase();
      return nombre.includes(t) || telefono.includes(t) || email.includes(t) || dir.includes(t);
    });
  }

  // 3. Por fecha
  const { desde, hasta } = rangoSegunFiltro();
  if (desde || hasta) {
    resultado = resultado.filter(p => {
      if (!p.fecha?.toDate) return false;
      const f = p.fecha.toDate();
      if (desde && f < desde) return false;
      if (hasta && f > hasta) return false;
      return true;
    });
  }

  return resultado;
}

// ========== RENDER ==========
function renderTabla() {
  const filtrados = filtrarPedidos();

  contador.innerHTML = `<i class="fas fa-list"></i> Mostrando <strong>${filtrados.length}</strong> de ${pedidos.length} pedidos`;

  if (!filtrados.length) {
    tabla.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:2rem;color:#417e9e;">No hay pedidos con esos filtros</td></tr>`;
    return;
  }

  tabla.innerHTML = filtrados.map(p => {
    const fecha = p.fecha?.toDate?.().toLocaleString('es-DO', {
      day: '2-digit', month: '2-digit', year: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }) || '—';

    let productosHTML = '';
    if (p.items && Array.isArray(p.items)) {
      productosHTML = p.items.map(i => `${i.cantidad}× ${i.nombre}`).join('<br>');
    } else if (p.cantidad) {
      productosHTML = `${p.cantidad}× Garrafón 20L`;
    }

    const total = p.total || p.precio || 0;

    // Botones según el estado
    let botones = '';
    if (p.estado === 'pendiente') {
      botones = `
        <button class="btn-ok" data-id="${p.id}" data-estado="entregado" title="Marcar como entregado y pagado">✓ Entregado</button>
        <button class="btn-cre" data-id="${p.id}" data-estado="credito" title="Entregado pero no pagado">💳 Crédito</button>
        <button class="btn-x" data-id="${p.id}" data-estado="cancelado" title="Cancelar pedido">✗ Cancelar</button>
      `;
    } else if (p.estado === 'entregado' || p.estado === 'credito') {
      botones = `
        <button class="btn-undo" data-id="${p.id}" data-estado="pendiente" title="Volver a pendiente">↩ Revertir</button>
      `;
    } else if (p.estado === 'cancelado') {
      botones = `<span style="font-size:.8rem;color:#8aa9bd;">Sin acciones</span>`;
    }

    return `
      <tr>
        <td>${fecha}</td>
        <td><strong>${p.nombre}</strong></td>
        <td>${p.telefono}</td>
        <td>${p.direccion}</td>
        <td style="font-size:.85rem;">${productosHTML}</td>
        <td><strong>$${total}</strong></td>
        <td>${p.horario}</td>
        <td><span class="estado ${p.estado}">${p.estado}</span></td>
        <td class="acciones">${botones}</td>
      </tr>
    `;
  }).join('');

  tabla.querySelectorAll('button[data-id]').forEach(btn => {
    btn.onclick = async () => {
      await updateDoc(doc(db, 'pedidos', btn.dataset.id), {
        estado: btn.dataset.estado
      });
    };
  });
}

// ========== BUSCADOR ==========
buscadorInput.addEventListener('input', () => {
  textoBusqueda = buscadorInput.value;
  btnLimpiarBusqueda.classList.toggle('visible', !!textoBusqueda.trim());
  renderTabla();
});

btnLimpiarBusqueda.onclick = () => {
  buscadorInput.value = '';
  textoBusqueda = '';
  btnLimpiarBusqueda.classList.remove('visible');
  renderTabla();
};

// ========== FILTROS POR ESTADO ==========
document.querySelectorAll('.filtros button[data-filtro]').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.filtros button[data-filtro]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filtroEstado = btn.dataset.filtro;
    renderTabla();
  };
});

// ========== FILTROS POR FECHA ==========
document.querySelectorAll('.filtros button[data-fecha]').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.filtros button[data-fecha]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filtroFecha = btn.dataset.fecha;

    if (filtroFecha !== 'rango') {
      document.getElementById('fechaDesde').value = '';
      document.getElementById('fechaHasta').value = '';
      rangoDesde = null;
      rangoHasta = null;
    }
    renderTabla();
  };
});

// ========== RANGO PERSONALIZADO ==========
document.getElementById('btnAplicarRango').onclick = () => {
  const desde = document.getElementById('fechaDesde').value;
  const hasta = document.getElementById('fechaHasta').value;

  if (!desde && !hasta) {
    alert('Selecciona al menos una fecha');
    return;
  }

  if (desde && hasta && new Date(desde) > new Date(hasta)) {
    alert('La fecha "desde" no puede ser mayor que "hasta"');
    return;
  }

  rangoDesde = desde ? new Date(desde + 'T00:00:00') : null;
  rangoHasta = hasta ? new Date(hasta + 'T00:00:00') : null;
  filtroFecha = 'rango';

  document.querySelectorAll('.filtros button[data-fecha]').forEach(b => b.classList.remove('active'));
  renderTabla();
};

document.getElementById('btnLimpiarFiltros').onclick = () => {
  document.getElementById('fechaDesde').value = '';
  document.getElementById('fechaHasta').value = '';
  rangoDesde = null;
  rangoHasta = null;
  filtroFecha = 'todo';
  filtroEstado = 'todos';
  textoBusqueda = '';
  buscadorInput.value = '';
  btnLimpiarBusqueda.classList.remove('visible');

  document.querySelectorAll('.filtros button[data-fecha]').forEach(b => b.classList.remove('active'));
  document.querySelector('.filtros button[data-fecha="todo"]').classList.add('active');

  document.querySelectorAll('.filtros button[data-filtro]').forEach(b => b.classList.remove('active'));
  document.querySelector('.filtros button[data-filtro="todos"]').classList.add('active');

  renderTabla();
};