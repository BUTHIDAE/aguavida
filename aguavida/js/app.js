import { auth, db } from './firebase-config.js';
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  signOut, onAuthStateChanged, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  doc, setDoc, getDoc, collection, addDoc, serverTimestamp,
  query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ⚠️ CAMBIA ESTE NÚMERO POR EL TUYO (formato internacional, sin + ni espacios)
const WHATSAPP = "18296759264";

const NEGOCIO = {
  nombre: "Verbier",
  slogan: "Agua potable a domicilio",
  telefono: "+1 809 415-9310",
  email: "contacto@verbier.do",
  direccion: "Santo Domingo, República Dominicana"
};

// ========== REFERENCIAS AL DOM ==========
const modal = document.getElementById('modal');
const closeModal = document.getElementById('closeModal');
const authArea = document.getElementById('authArea');
const viewLogin = document.getElementById('viewLogin');
const viewRegister = document.getElementById('viewRegister');
const viewForgot = document.getElementById('viewForgot');
const viewPedido = document.getElementById('viewPedido');
const msg = document.getElementById('msg');
const viewHistorial = document.getElementById('viewHistorial');

// ========== ESTADO GLOBAL ==========
let currentUser = null;
let userData = null;
let carrito = [];

// ========== UTILIDADES ==========
function showMsg(text, type = 'ok') {
  msg.textContent = text;
  msg.className = `msg ${type}`;
  msg.classList.remove('hidden');
  setTimeout(() => msg.classList.add('hidden'), 4000);
}

function showView(view) {
  [viewLogin, viewRegister, viewForgot, viewPedido, viewHistorial].forEach(v => v.classList.add('hidden'));
  view.classList.remove('hidden');
  msg.classList.add('hidden');
}

function openModal(view) {
  modal.classList.remove('hidden');
  showView(view);
}

function formatoMoneda(n) {
  return `$${n.toLocaleString('es-DO')}`;
}

function abrirWhatsAppContacto() {
  const texto = `¡Hola ${NEGOCIO.nombre}! %0AQuisiera más información sobre el servicio de agua a domicilio.`;
  window.open(`https://wa.me/${WHATSAPP}?text=${texto}`, '_blank');
}

// ========== NAVEGACIÓN HEADER ==========
document.getElementById('navPrecios').onclick = (e) => {
  e.preventDefault();
  document.getElementById('precios').scrollIntoView({ behavior: 'smooth' });
};

document.getElementById('navContacto').onclick = (e) => {
  e.preventDefault();
  abrirWhatsAppContacto();
};

document.getElementById('footerWhatsapp').onclick = (e) => {
  e.preventDefault();
  abrirWhatsAppContacto();
};

// ========== AUTH STATE ==========
onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    const snap = await getDoc(doc(db, 'usuarios', user.uid));
    userData = snap.exists() ? snap.data() : {};

    authArea.innerHTML = `
      <a href="#" id="btnMisPedidos" style="color:#0b5e8a;font-weight:600;text-decoration:none;font-size:.9rem;">Mis pedidos</a>
      <span style="color:#0b5e8a;font-weight:600;">Hola, ${userData.nombre?.split(' ')[0] || 'cliente'}</span>
      <button class="btn-primary" id="btnNuevoPedido" style="padding:.5rem 1.2rem;font-size:.9rem;">
        <i class="fas fa-plus"></i> Pedir
      </button>
      <a href="#" id="btnLogout" style="color:#a02020;font-size:.85rem;">Salir</a>
    `;

    document.getElementById('btnMisPedidos').onclick = (e) => {
      e.preventDefault();
      abrirHistorial();
    };

    document.getElementById('btnNuevoPedido').onclick = () => openPedido();
    document.getElementById('btnLogout').onclick = async (e) => {
      e.preventDefault();
      await signOut(auth);
      location.reload();
    };
  } else {
    currentUser = null;
    userData = null;

    authArea.innerHTML = `
      <button class="btn-primary" id="btnLoginOpen" style="padding:.5rem 1.2rem;font-size:.9rem;">
        <i class="fas fa-user"></i> Entrar
      </button>
    `;

    document.getElementById('btnLoginOpen').onclick = () => openModal(viewLogin);
  }
}); // <-- AQUÍ ESTABA EL ERROR. Faltaba cerrar esta función.

// ========== MODAL ==========
closeModal.onclick = () => modal.classList.add('hidden');
modal.onclick = (e) => { if (e.target === modal) modal.classList.add('hidden'); };

document.getElementById('goRegister').onclick = (e) => {
  e.preventDefault();
  showView(viewRegister);
};

document.getElementById('goLogin').onclick = (e) => {
  e.preventDefault();
  showView(viewLogin);
};

// ========== LOGIN ==========
document.getElementById('btnLogin').onclick = async () => {
  const email = document.getElementById('loginEmail').value.trim();
  const pass = document.getElementById('loginPass').value;

  if (!email || !pass) return showMsg('Completa todos los campos', 'error');

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    modal.classList.add('hidden');
  } catch (e) {
    showMsg('Credenciales incorrectas', 'error');
  }
};

// ========== REGISTRO ==========
document.getElementById('btnRegister').onclick = async () => {
  const nombre = document.getElementById('regNombre').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const tel = document.getElementById('regTel').value.trim();
  const dir = document.getElementById('regDir').value.trim();
  const pass = document.getElementById('regPass').value;

  if (!nombre || !email || !tel || !dir || !pass)
    return showMsg('Completa todos los campos', 'error');
  if (pass.length < 6)
    return showMsg('La contraseña debe tener al menos 6 caracteres', 'error');

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await setDoc(doc(db, 'usuarios', cred.user.uid), {
      nombre, email, telefono: tel, direccion: dir,
      rol: 'cliente', creado: serverTimestamp()
    });
    modal.classList.add('hidden');
    alert('¡Cuenta creada! Ya puedes pedir.');
  } catch (e) {
    console.error(e);
    showMsg(e.message.includes('email') ? 'Ese correo ya está registrado' : 'Error al registrar', 'error');
  }
};

// ========== CARRITO ==========
function renderCarrito() {
  const cont = document.getElementById('carrito');

  if (!carrito.length) {
    cont.innerHTML = `<div class="carrito-vacio"><i class="fas fa-shopping-basket"></i> Carrito vacío — agrega productos</div>`;
  } else {
    cont.innerHTML = carrito.map((item, i) => `
      <div class="carrito-item">
        <div class="item-info">
          <span><strong>${item.cantidad}×</strong> ${item.nombre}</span>
        </div>
        <div>
          <span class="item-precio">${formatoMoneda(item.precio * item.cantidad)}</span>
          <button class="btn-remove" data-index="${i}" title="Quitar">✕</button>
        </div>
      </div>
    `).join('');

    cont.querySelectorAll('.btn-remove').forEach(btn => {
      btn.onclick = () => {
        carrito.splice(parseInt(btn.dataset.index), 1);
        renderCarrito();
      };
    });
  }

  const total = carrito.reduce((s, it) => s + it.precio * it.cantidad, 0);
  document.getElementById('totalPedido').textContent = formatoMoneda(total);
}

document.getElementById('btnAgregar').onclick = () => {
  const select = document.getElementById('prodSelect');
  const opt = select.options[select.selectedIndex];
  const nombre = opt.value;
  const precio = parseInt(opt.dataset.precio);
  const cantidad = parseInt(document.getElementById('prodCantidad').value) || 1;

  if (cantidad < 1 || cantidad > 50) {
    showMsg('Cantidad entre 1 y 50', 'error');
    return;
  }

  const existente = carrito.find(i => i.nombre === nombre);
  if (existente) existente.cantidad += cantidad;
  else carrito.push({ nombre, precio, cantidad });

  document.getElementById('prodCantidad').value = 1;
  renderCarrito();
};

// ========== ABRIR PEDIDO ==========
function openPedido() {
  document.getElementById('userInfo').textContent = `${userData.nombre} · ${userData.telefono}`;
  document.getElementById('pedidoDir').value = userData.direccion || '';
  carrito = [];
  renderCarrito();
  openModal(viewPedido);
}

// ========== GENERAR PDF ==========
function generarFacturaPDF(pedido) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  const pageW = 210;
  const margen = 15;
  const total = pedido.total;
  const numFactura = `AV-${Date.now().toString().slice(-8)}`;

  // ----- ENCABEZADO con banda azul -----
  doc.setFillColor(42, 157, 244);
  doc.rect(0, 0, pageW, 35, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(NEGOCIO.nombre, margen, 15);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(NEGOCIO.slogan, margen, 22);
  doc.text(NEGOCIO.telefono + ' · ' + NEGOCIO.email, margen, 28);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('FACTURA', pageW - margen, 15, { align: 'right' });

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('No. ' + numFactura, pageW - margen, 22, { align: 'right' });
  doc.text(new Date().toLocaleString('es-DO'), pageW - margen, 28, { align: 'right' });

  // ----- DATOS DEL CLIENTE -----
  let y = 50;
  doc.setTextColor(11, 53, 80);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Cliente', margen, y);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  y += 6;
  doc.text(`Nombre: ${pedido.nombre}`, margen, y);
  y += 5;
  doc.text(`Teléfono: ${pedido.telefono}`, margen, y);
  y += 5;
  doc.text(`Email: ${pedido.email}`, margen, y);
  y += 5;
  doc.text(`Dirección: ${pedido.direccion}`, margen, y);
  y += 5;
  doc.text(`Horario: ${pedido.horario}`, margen, y);

  // ----- TABLA DE PRODUCTOS -----
  y += 12;

  doc.setFillColor(230, 244, 255);
  doc.rect(margen, y - 6, pageW - margen * 2, 9, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(11, 53, 80);
  doc.text('Producto', margen + 3, y);
  doc.text('Cant.', 130, y, { align: 'center' });
  doc.text('Precio', 155, y, { align: 'right' });
  doc.text('Subtotal', pageW - margen - 3, y, { align: 'right' });

  y += 8;
  doc.setFont('helvetica', 'normal');

  pedido.items.forEach(item => {
    doc.text(item.nombre, margen + 3, y);
    doc.text(String(item.cantidad), 130, y, { align: 'center' });
    doc.text(formatoMoneda(item.precio), 155, y, { align: 'right' });
    doc.text(formatoMoneda(item.precio * item.cantidad), pageW - margen - 3, y, { align: 'right' });
    y += 7;
  });

  doc.setDrawColor(200, 220, 235);
  doc.line(margen, y, pageW - margen, y);
  y += 8;

  // ----- TOTAL -----
  doc.setFillColor(240, 249, 255);
  doc.rect(120, y - 6, pageW - margen - 120, 14, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(11, 53, 80);
  doc.text('TOTAL:', 125, y + 3);

  doc.setFontSize(16);
  doc.setTextColor(31, 138, 192);
  doc.text(formatoMoneda(total), pageW - margen - 3, y + 3, { align: 'right' });

  // ----- NOTAS -----
  if (pedido.notas) {
    y += 20;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(11, 53, 80);
    doc.text('Notas:', margen, y);

    doc.setFont('helvetica', 'normal');
    y += 6;
    const notaLines = doc.splitTextToSize(pedido.notas, pageW - margen * 2);
    doc.text(notaLines, margen, y);
  }

  // ----- PIE -----
  doc.setFontSize(9);
  doc.setTextColor(120, 140, 155);
  doc.text(
    'Gracias por tu preferencia · Pago contra entrega · ' + NEGOCIO.direccion,
    pageW / 2,
    285,
    { align: 'center' }
  );

  doc.save(`Factura-${numFactura}.pdf`);
  return numFactura;
}

// ========== ENVIAR PEDIDO ==========
document.getElementById('btnPedir').onclick = async () => {
  if (!carrito.length) return showMsg('Agrega al menos un producto', 'error');

  const dir = document.getElementById('pedidoDir').value.trim();
  const horario = document.getElementById('pedidoHorario').value;
  const notas = document.getElementById('pedidoNotas').value.trim();

  if (!dir) return showMsg('Ingresa tu dirección', 'error');

  const total = carrito.reduce((s, it) => s + it.precio * it.cantidad, 0);
  const totalItems = carrito.reduce((s, it) => s + it.cantidad, 0);

  try {
    const pedido = {
      uid: currentUser.uid,
      nombre: userData.nombre,
      telefono: userData.telefono,
      email: userData.email,
      direccion: dir,
      items: carrito.map(i => ({ ...i })),
      totalItems,
      total,
      horario,
      notas,
      estado: 'pendiente',
      fecha: serverTimestamp()
    };

    await addDoc(collection(db, 'pedidos'), pedido);
    const numFactura = generarFacturaPDF(pedido);

    const mensaje =
      `*${NEGOCIO.nombre} — Nuevo pedido*%0A%0A` +
      `Hola, acabo de generar mi factura *${numFactura}* por un total de *${formatoMoneda(total)}*.%0A%0A` +
      `Adjunto el PDF de la factura 📎%0A%0A` +
      `_Gracias!_`;

    showMsg('✅ Factura descargada. Abriendo WhatsApp...');

    setTimeout(() => {
      window.open(`https://wa.me/${WHATSAPP}?text=${mensaje}`, '_blank');
      modal.classList.add('hidden');
    }, 1500);
  } catch (e) {
    console.error(e);
    showMsg('Error al guardar el pedido', 'error');
  }
};

// ========== OLVIDÉ MI CONTRASEÑA ==========
document.getElementById('goForgot').onclick = (e) => {
  e.preventDefault();
  showView(viewForgot);
};

document.getElementById('goLoginFromForgot').onclick = (e) => {
  e.preventDefault();
  showView(viewLogin);
};

document.getElementById('btnForgot').onclick = async () => {
  const email = document.getElementById('forgotEmail').value.trim();

  if (!email) return showMsg('Escribe tu correo', 'error');

  try {
    await sendPasswordResetEmail(auth, email);
    showMsg('✅ Revisa tu correo. Te enviamos un enlace para restablecer tu contraseña.');
    document.getElementById('forgotEmail').value = '';
    setTimeout(() => showView(viewLogin), 3000);
  } catch (e) {
    console.error(e);
    if (e.code === 'auth/user-not-found') {
      showMsg('No existe una cuenta con ese correo', 'error');
    } else if (e.code === 'auth/invalid-email') {
      showMsg('El correo no es válido', 'error');
    } else {
      showMsg('Error al enviar. Intenta de nuevo.', 'error');
    }
  }
};

// ========== MENÚ HAMBURGUESA ==========
const menuToggle = document.getElementById('menuToggle');
const menuNav = document.getElementById('menuNav');

if (menuToggle && menuNav) {
  menuToggle.onclick = () => {
    menuNav.classList.toggle('open');
    const icon = menuToggle.querySelector('i');
    icon.className = menuNav.classList.contains('open') ? 'fas fa-times' : 'fas fa-bars';
  };

  menuNav.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      menuNav.classList.remove('open');
      menuToggle.querySelector('i').className = 'fas fa-bars';
    });
  });
}

// ========== CARRUSEL HERO ==========
(function() {
  const slides = document.querySelectorAll('.slide');
  const dotsContainer = document.getElementById('slideDots');
  const btnPrev = document.getElementById('slidePrev');
  const btnNext = document.getElementById('slideNext');

  if (!slides.length || !dotsContainer || !btnPrev || !btnNext) {
    console.warn('Carrusel: faltan elementos');
    return;
  }

  let slideActual = 0;
  let autoplayTimer = null;
  const DURACION = 6000;

  slides.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'dot' + (i === 0 ? ' active' : '');
    dot.setAttribute('aria-label', 'Ir al slide ' + (i + 1));
    dot.addEventListener('click', () => irASlide(i));
    dotsContainer.appendChild(dot);
  });

  const dots = dotsContainer.querySelectorAll('.dot');

  function irASlide(index) {
    slides[slideActual].classList.remove('active');
    dots[slideActual].classList.remove('active');

    slideActual = (index + slides.length) % slides.length;

    slides[slideActual].classList.add('active');
    dots[slideActual].classList.add('active');

    reiniciarAutoplay();
  }

  function siguiente() { irASlide(slideActual + 1); }
  function anterior() { irASlide(slideActual - 1); }

  btnNext.addEventListener('click', siguiente);
  btnPrev.addEventListener('click', anterior);

  function iniciarAutoplay() {
    autoplayTimer = setInterval(siguiente, DURACION);
  }
  function reiniciarAutoplay() {
    clearInterval(autoplayTimer);
    iniciarAutoplay();
  }
  function pausarAutoplay() {
    clearInterval(autoplayTimer);
  }

  const carrusel = document.querySelector('.hero-carrusel');
  if (carrusel) {
    carrusel.addEventListener('mouseenter', pausarAutoplay);
    carrusel.addEventListener('mouseleave', iniciarAutoplay);

    let touchStartX = 0;
    carrusel.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });
    carrusel.addEventListener('touchend', (e) => {
      const diff = touchStartX - e.changedTouches[0].screenX;
      if (Math.abs(diff) > 50) {
        if (diff > 0) siguiente();
        else anterior();
      }
    }, { passive: true });
  }

  iniciarAutoplay();
})();

// ========== BOTONES "PEDIR" DEL CARRUSEL ==========
document.querySelectorAll('.cta-pedir').forEach(btn => {
  btn.onclick = () => {
    if (auth.currentUser) {
      if (userData && userData.nombre) openPedido();
      else setTimeout(() => openPedido(), 300);
    } else {
      openModal(viewRegister);
    }
  };
});

// ========== HISTORIAL DE PEDIDOS ==========
async function abrirHistorial() {
  const contenedor = document.getElementById('listaHistorial');
  contenedor.innerHTML = `<div class="historial-vacio"><i class="fas fa-spinner fa-spin"></i> Cargando pedidos...</div>`;
  
  openModal(viewHistorial);

  try {
    const q = query(
      collection(db, 'pedidos'),
      where('uid', '==', currentUser.uid)
    );
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      contenedor.innerHTML = `<div class="historial-vacio"><i class="fas fa-box-open"></i> Aún no tienes pedidos.</div>`;
      return;
    }

    // Convertir a array y ordenar por fecha descendente
    const pedidos = snapshot.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const fa = a.fecha?.toDate?.() || new Date(0);
        const fb = b.fecha?.toDate?.() || new Date(0);
        return fb - fa;
      });

    contenedor.innerHTML = pedidos.map(p => {
      const fecha = p.fecha?.toDate?.().toLocaleString('es-DO', {
        day: '2-digit', month: '2-digit', year: '2-digit',
        hour: '2-digit', minute: '2-digit'
      }) || '—';

      // Icono según el estado
      const iconos = {
        pendiente: '<i class="fas fa-clock" style="color:#856404;"></i>',
        entregado: '<i class="fas fa-check-circle" style="color:#186b4b;"></i>',
        credito: '<i class="fas fa-credit-card" style="color:#6d28d9;"></i>',
        cancelado: '<i class="fas fa-times-circle" style="color:#a02020;"></i>'
      };
      const icono = iconos[p.estado] || '<i class="fas fa-circle"></i>';

      // Lista de productos
      let productosHTML = '';
      if (p.items && Array.isArray(p.items)) {
        productosHTML = p.items.map(i => `${i.cantidad}× ${i.nombre}`).join('<br>');
      } else if (p.cantidad) {
        productosHTML = `${p.cantidad}× Garrafón 20L`;
      }

      return `
        <div class="historial-item">
          <div class="historial-header">
            <span class="historial-fecha">${fecha}</span>
            <span class="historial-estado estado ${p.estado}">${icono} ${p.estado}</span>
          </div>
          <div class="historial-productos">${productosHTML || '—'}</div>
          <div class="historial-footer">
            <span>Total: <strong>$${p.total || p.precio || 0}</strong></span>
            <span style="font-size:.8rem;color:#8aa9bd;">${p.horario || ''}</span>
          </div>
        </div>
      `;
    }).join('');

  } catch (err) {
    console.error(err);
    contenedor.innerHTML = `<div class="historial-vacio" style="color:#a02020;"><i class="fas fa-exclamation-triangle"></i> Error al cargar pedidos.</div>`;
  }
}

// Botón para cerrar el historial
document.getElementById('btnCerrarHistorial').onclick = () => {
  modal.classList.add('hidden');
};