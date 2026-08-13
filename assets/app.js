// ─── Global State ───
const APP = {
  currentPage: 'dashboard',
  orders:      [],
  customers:   [],
  catalog:     [],
  isOnline:    navigator.onLine,
  editingOrder: null
};

// ─── Init ───
document.addEventListener('DOMContentLoaded', async () => {
  await initDB();
  await seedDemoData();
  APP.orders    = await dbGetAll('orders');
  APP.customers = await dbGetAll('customers');
  APP.catalog   = await dbGetAll('catalog');

  // Register service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // Online/offline detection
  window.addEventListener('online',  () => {
    APP.isOnline = true;
    showToast('✅ इंटरनेट आले! Sync होत आहे...', 'success');
  });
  window.addEventListener('offline', () => {
    APP.isOnline = false;
    showToast('📴 Offline आहात. बदल save होत आहेत.', '');
  });

  // Init current page
  initCurrentPage();
});

function initCurrentPage() {
  const page = document.body.dataset.page;
  switch(page) {
    case 'dashboard':   initDashboard();  break;
    case 'orders':      initOrders();     break;
    case 'new-order':   initNewOrder();   break;
    case 'bill':        initBill();       break;
    case 'catalog':     initCatalog();    break;
    case 'broadcast':   initBroadcast();  break;
  }
}

// ─── Dashboard ───
async function initDashboard() {
  const orders    = await dbGetAll('orders');
  const active    = orders.filter(o => o.status !== 'delivered');
  const ready     = orders.filter(o => o.status === 'ready');
  const today     = orders.filter(o =>
    o.date === new Date().toISOString().split('T')[0]
  );
  const customers = await dbGetAll('customers');

  const todayRevenue = today.reduce((s, o) => s + (o.advance || 0), 0);

  setEl('stat-active',    active.length);
  setEl('stat-ready',     ready.length);
  setEl('stat-customers', customers.length);
  setEl('stat-revenue',   '₹' + todayRevenue);

  // Recent orders
  const recent = orders
    .filter(o => o.status !== 'delivered')
    .sort((a, b) => b.id.localeCompare(a.id))
    .slice(0, 5);

  const container = document.getElementById('recent-orders');
  if (!container) return;

  if (recent.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">📋</span>
        <h3>कोणतीही ऑर्डर नाही</h3>
        <p>+ New Order बटण दाबा</p>
      </div>`;
    return;
  }

  container.innerHTML = recent.map(o => orderCard(o, true)).join('');
}

// ─── Orders Page ───
async function initOrders() {
  const orders  = await dbGetAll('orders');
  APP.orders    = orders;
  renderOrders('all');

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab')
              .forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderOrders(tab.dataset.filter);
    });
  });
}

function renderOrders(filter) {
  let list = APP.orders;

  if (filter === 'received')    list = list.filter(o => o.status === 'received');
  else if (filter === 'progress') list = list.filter(o => o.status === 'in_progress');
  else if (filter === 'ready')  list = list.filter(o => o.status === 'ready');
  else if (filter === 'done')   list = list.filter(o => o.status === 'delivered');
  else list = list.filter(o => o.status !== 'delivered');

  list = list.sort((a, b) => b.id.localeCompare(a.id));

  const container = document.getElementById('orders-list');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `
      <div class="empty-state fade-in">
        <span class="empty-icon">🎉</span>
        <h3>या category मध्ये ऑर्डर नाही</h3>
      </div>`;
    return;
  }

  container.innerHTML = list.map(o => orderCard(o, false)).join('');
}

// ─── Order Card HTML ───
function orderCard(order, mini = false) {
  const statusMap = {
    received:    { label: 'मिळाली',       badge: 'badge-received',  emoji: '🔵', next: 'in_progress', nextLabel: 'शिवायला सुरू करा' },
    in_progress: { label: 'शिवत आहोत',   badge: 'badge-progress',  emoji: '🟡', next: 'ready',       nextLabel: 'तयार झाली!' },
    ready:       { label: 'तयार आहे!',   badge: 'badge-ready',     emoji: '🟢', next: 'delivered',   nextLabel: 'दिले ✅' },
    delivered:   { label: 'दिले',         badge: 'badge-delivered', emoji: '✅', next: null,          nextLabel: '' },
  };

  const s     = statusMap[order.status] || statusMap.received;
  const items = order.items.map(i => i.name).join(', ');
  const days  = getDaysAgo(order.date);

  return `
    <div class="card fade-in" onclick="openOrder('${order.id}')">
      <div class="card-header">
        <div>
          <h3 style="color:var(--gray-800)">${order.customerName}</h3>
          <p class="text-xs text-gray mt-4">
            📞 ${order.phone} · ${days}
          </p>
        </div>
        <span class="badge ${s.badge}">${s.emoji} ${s.label}</span>
      </div>

      <p class="text-sm" style="color:var(--gray-600);margin-bottom:10px">
        👗 ${items}
      </p>

      ${order.notes ? `
        <p class="text-xs text-gray" style="margin-bottom:10px">
          📝 ${order.notes}
        </p>` : ''}

      <div class="divider"></div>

      <div class="flex-between" style="margin-top:10px">
        <div>
          <p class="text-xs text-gray">एकूण</p>
          <p class="text-bold text-pink">₹${order.total}</p>
        </div>
        <div style="text-align:right">
          <p class="text-xs text-gray">बाकी</p>
          <p class="text-bold" style="color:${order.balance > 0 ? 'var(--orange)' : 'var(--green)'}">
            ₹${order.balance}
          </p>
        </div>
        <div style="text-align:right">
          <p class="text-xs text-gray">ऑर्डर नं</p>
          <p class="text-xs text-bold">${order.id}</p>
        </div>
      </div>

      ${!mini && s.next ? `
        <div style="margin-top:12px;display:flex;gap:8px">
          <button
            class="btn btn-primary btn-sm"
            style="flex:1"
            onclick="event.stopPropagation();updateStatus('${order.id}','${s.next}')"
          >
            ${s.nextLabel}
          </button>
          <button
            class="btn btn-secondary btn-sm"
            onclick="event.stopPropagation();goToBill('${order.id}')"
          >
            🧾 बिल
          </button>
        </div>` : ''}

      ${mini ? `
        <div style="margin-top:10px">
          <a href="orders.html" class="text-pink text-xs text-bold">
            सगळ्या ऑर्डर पहा →
          </a>
        </div>` : ''}
    </div>`;
}

// ─── Update Order Status ───
async function updateStatus(orderId, newStatus) {
  const order  = await dbGet('orders', orderId);
  if (!order) return;

  order.status  = newStatus;
  order.synced  = false;
  order.updated = new Date().toISOString();

  await dbAdd('orders', order);
  APP.orders = await dbGetAll('orders');

  const statusMessages = {
    in_progress: `✅ "${order.customerName}" ची ऑर्डर सुरू केली!`,
    ready:       `🎉 "${order.customerName}" ची ऑर्डर तयार! WhatsApp message जाईल.`,
    delivered:   `✅ "${order.customerName}" ला कपडे दिले!`
  };

  showToast(statusMessages[newStatus] || 'Status updated!', 'success');

  // Simulate WhatsApp notification in demo
  if (newStatus === 'ready') {
    setTimeout(() => {
      showToast('📱 WhatsApp message पाठवला: "' + order.customerName + '"', 'success');
    }, 1500);
  }

  renderOrders(document.querySelector('.filter-tab.active')?.dataset.filter || 'all');
  initDashboard();
}

// ─── New Order ───
function initNewOrder() {
  // Add item rows
  document.getElementById('add-item-btn')?.addEventListener('click', addItemRow);

  // Calculate total live
  document.addEventListener('input', (e) => {
    if (e.target.classList.contains('item-price')) calculateTotal();
    if (e.target.id === 'advance') calculateBalance();
  });

  // Preset items
  document.querySelectorAll('.preset-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const name  = btn.dataset.name;
      const price = btn.dataset.price;
      addItemRow(name, price);
      btn.style.background = 'var(--pink)';
      btn.style.color      = 'white';
    });
  });

  // Submit
  document.getElementById('order-form')?.addEventListener('submit', submitOrder);

  // Add first empty row
  addItemRow();
}

function addItemRow(name = '', price = '') {
  const container = document.getElementById('items-container');
  if (!container) return;

  const row = document.createElement('div');
  row.className = 'item-row';
  row.innerHTML = `
    <input
      type="text"
      class="form-input item-name"
      placeholder="काय शिवायचे"
      value="${name}"
      style="flex:2"
    >
    <input
      type="number"
      class="form-input item-price"
      placeholder="₹"
      value="${price}"
      style="flex:1"
    >
    <button
      type="button"
      class="btn btn-icon"
      style="background:var(--pink-light);color:var(--red);flex-shrink:0"
      onclick="this.parentElement.remove();calculateTotal()"
    >✕</button>`;

  container.appendChild(row);
  calculateTotal();
}

function calculateTotal() {
  let total = 0;
  document.querySelectorAll('.item-price').forEach(input => {
    total += parseFloat(input.value) || 0;
  });
  setEl('total-display', '₹' + total);
  calculateBalance();
  return total;
}

function calculateBalance() {
  const total   = parseFloat(
    document.getElementById('total-display')?.textContent?.replace('₹','')
  ) || 0;
  const advance = parseFloat(
    document.getElementById('advance')?.value
  ) || 0;
  const balance = total - advance;
  setEl('balance-display', '₹' + balance);
}

async function submitOrder(e) {
  e.preventDefault();

  const phone = document.getElementById('phone')?.value?.trim();
  const name  = document.getElementById('cname')?.value?.trim();

  if (!phone || !name) {
    showToast('कृपया नाव आणि फोन नंबर भरा!', 'error');
    return;
  }

  const items = [];
  const nameInputs  = document.querySelectorAll('.item-name');
  const priceInputs = document.querySelectorAll('.item-price');

  nameInputs.forEach((input, i) => {
    const n = input.value.trim();
    const p = parseFloat(priceInputs[i]?.value) || 0;
    if (n && p) items.push({ name: n, price: p });
  });

  if (items.length === 0) {
    showToast('किमान एक item जोडा!', 'error');
    return;
  }

  const total   = items.reduce((s, i) => s + i.price, 0);
  const advance = parseFloat(document.getElementById('advance')?.value) || 0;
  const notes   = document.getElementById('notes')?.value?.trim() || '';
  const ddate   = document.getElementById('delivery-date')?.value || '';

  const year = new Date().getFullYear();
  const rand = Math.floor(Math.random() * 9000 + 1000);
  const orderId = `PDS-${year}-${rand}`;

  const order = {
    id:           orderId,
    phone,
    customerName: name,
    items,
    total,
    advance,
    balance:      total - advance,
    status:       'received',
    notes,
    date:         new Date().toISOString().split('T')[0],
    deliveryDate: ddate,
    synced:       false
  };

  await dbAdd('orders', order);

  // Save customer
  await dbAdd('customers', { phone, name, orders: 1 });

  showToast('✅ ऑर्डर जोडली! WhatsApp message जाईल.', 'success');

  setTimeout(() => {
    showToast(`📱 "${name}" ला confirmation message पाठवला!`, 'success');
  }, 1500);

  setTimeout(() => {
    window.location.href = 'orders.html';
  }, 2500);
}

// ─── Bill Generator ───
async function initBill() {
  const orders  = await dbGetAll('orders');
  const pending = orders.filter(o =>
    o.status !== 'delivered' && o.balance > 0
  );

  // Populate order selector
  const selector = document.getElementById('bill-order-select');
  if (selector) {
    selector.innerHTML = `
      <option value="">-- ऑर्डर निवडा --</option>
      ${pending.map(o => `
        <option value="${o.id}">
          ${o.customerName} — ${o.id} — ₹${o.balance} बाकी
        </option>
      `).join('')}`;

    selector.addEventListener('change', () => {
      const order = pending.find(o => o.id === selector.value);
      if (order) showBillPreview(order);
      else clearBillPreview();
    });
  }
}

function showBillPreview(order) {
  const today     = new Date().toLocaleDateString('mr-IN');
  const itemLines = order.items.map((item, i) => {
    const dots = '.'.repeat(Math.max(1, 22 - item.name.length));
    return `${i+1}. ${item.name}${dots}₹${item.price}`;
  }).join('\n');

  const bill = `╔══════════════════════════╗
║  ✨ PAYAL DESIGN STUDIO  ✨  ║
║     Ladies Tailoring      ║
╚══════════════════════════╝

📋 बिल / INVOICE
━━━━━━━━━━━━━━━━━━━━━━━━
बिल नं:  ${order.id}
दिनांक:  ${today}
ग्राहक: ${order.customerName}
📞 ${order.phone}
━━━━━━━━━━━━━━━━━━━━━━━━

📦 तपशील:
${itemLines}
━━━━━━━━━━━━━━━━━━━━━━━━
💰 एकूण:        ₹${order.total}
✅ Advance:     ₹${order.advance}
💳 बाकी रक्कम: ₹${order.balance}
━━━━━━━━━━━━━━━━━━━━━━━━

💳 UPI Payment:
payal@upi

✅ पेमेंट झाल्यावर screenshot
   पाठवा 🙏

धन्यवाद! 🌸
पायल डिझाइन स्टुडिओ ✨`;

  setEl('bill-preview', bill);

  document.getElementById('bill-actions')?.classList.remove('hidden');
  document.getElementById('qr-amount')?.setAttribute(
    'data-amount', order.balance
  );
  setEl('qr-label', `₹${order.balance} साठी QR Code`);
}

function clearBillPreview() {
  setEl('bill-preview', 'ऑर्डर निवडा...');
  document.getElementById('bill-actions')?.classList.add('hidden');
}

function copyBill() {
  const text = document.getElementById('bill-preview')?.textContent;
  navigator.clipboard?.writeText(text).then(() => {
    showToast('📋 Bill Copy झाला!', 'success');
  }).catch(() => {
    showToast('Copy नाही झाला, manually select करा', 'error');
  });
}

function sendBillWhatsApp() {
  const orders    = document.getElementById('bill-order-select');
  const orderId   = orders?.value;
  if (!orderId) return;

  const billText = document.getElementById('bill-preview')?.textContent;
  const encoded  = encodeURIComponent(billText);

  showToast('📱 WhatsApp उघडत आहे...', 'success');
  // In real: window.open(`https://wa.me/${phone}?text=${encoded}`)
  setTimeout(() => {
    showToast('✅ Bill WhatsApp वर पाठवला!', 'success');
  }, 1000);
}

// ─── Catalog ───
async function initCatalog() {
  const catalog = await dbGetAll('catalog');
  renderCatalog(catalog, 'all');

  document.querySelectorAll('.cat-filter').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.cat-filter')
              .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.cat;
      renderCatalog(
        filter === 'all'
          ? catalog
          : catalog.filter(c => c.category === filter),
        filter
      );
    });
  });
}

function renderCatalog(items) {
  const container = document.getElementById('catalog-grid');
  if (!container) return;

  container.innerHTML = items.map(item => `
    <div class="card" style="text-align:center;padding:20px 12px">
      <div style="font-size:2.5rem;margin-bottom:8px">${item.emoji}</div>
      <h3 style="font-size:0.85rem;margin-bottom:4px">${item.name}</h3>
      <p class="text-xs text-gray">${item.category}</p>
      <p class="text-sm text-pink text-bold" style="margin-top:8px">
        ₹${item.priceMin}${item.priceMax !== item.priceMin ? ' - ₹'+item.priceMax : ''}
      </p>
      ${item.trending ? `
        <span class="badge badge-ready" style="margin-top:8px">
          🔥 Trending
        </span>` : ''}
      <div style="display:flex;gap:6px;margin-top:12px">
        <button
          class="btn btn-secondary btn-sm"
          style="flex:1;font-size:0.72rem"
          onclick="showToast('Edit feature coming!','')"
        >✏️ Edit</button>
        <button
          class="btn btn-icon btn-sm"
          style="background:var(--pink-light)"
          onclick="toggleTrending(${item.id})"
        >${item.trending ? '⭐' : '☆'}</button>
      </div>
    </div>`).join('');
}

async function toggleTrending(id) {
  const item = await dbGet('catalog', id);
  if (!item) return;
  item.trending = !item.trending;
  await dbAdd('catalog', item);
  APP.catalog = await dbGetAll('catalog');
  showToast(item.trending ? '⭐ Trending केला!' : 'Trending काढला', 'success');
  initCatalog();
}

// ─── Broadcast ───
async function initBroadcast() {
  const customers = await dbGetAll('customers');
  setEl('customer-count', customers.length);

  // Template selection
  document.querySelectorAll('.template-card').forEach(card => {
    card.addEventListener('click', () => {
      document.querySelectorAll('.template-card')
              .forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      previewTemplate(card.dataset.template);
    });
  });

  // Custom message
  document.getElementById('custom-msg')?.addEventListener(
    'input',
    previewCustom
  );

  // Send button
  document.getElementById('send-broadcast')?.addEventListener(
    'click',
    sendBroadcast
  );
}

function previewTemplate(type) {
  const templates = {
    navratri: `🎉 नवरात्री स्पेशल!
✨ पायल डिझाइन स्टुडिओ

नवरात्रीसाठी नवीन ब्लाउज डिझाइन आले!
👗 ब्लाउज ₹350 पासून
📸 डिझाइन पाहण्यासाठी "DESIGN" पाठवा!
📍 [Address] ⏰ 10am - 7pm`,

    diwali: `🪔 दिवाळीच्या शुभेच्छा!
✨ पायल डिझाइन स्टुडिओ

दिवाळी स्पेशल ऑफर!
🎆 सर्व ब्लाउज वर ₹50 सूट
🛍️ आजच order करा!
📞 [Phone] 📍 [Address]`,

    new_designs: `✨ नवीन डिझाइन आले!
👗 पायल डिझाइन स्टुडिओ

🔥 ट्रेंडिंग ब्लाउज डिझाइन
💃 टू-पीस ड्रेस
👘 साडीपासून ड्रेस

डिझाइन पाहण्यासाठी "DESIGN" पाठवा!
📍 [Address] ⏰ 10am - 7pm`,

    reminder: `नमस्कार! 🙏
पायल डिझाइन स्टुडिओ

खूप दिवसात भेट नाही!
🌸 नवीन डिझाइन पाहायला या
✂️ आम्ही तुमची वाट पाहतो!
📞 [Phone]`
  };

  const preview = document.getElementById('msg-preview');
  if (preview) preview.textContent = templates[type] || '';
}

function previewCustom() {
  const msg     = document.getElementById('custom-msg')?.value;
  const preview = document.getElementById('msg-preview');
  if (preview) preview.textContent = msg || '';
}

async function sendBroadcast() {
  const customers   = await dbGetAll('customers');
  const selectedTpl = document.querySelector('.template-card.selected');
  const customMsg   = document.getElementById('custom-msg')?.value;

  if (!selectedTpl && !customMsg) {
    showToast('कृपया template किंवा message निवडा!', 'error');
    return;
  }

  const btn = document.getElementById('send-broadcast');
  if (btn) {
    btn.disabled     = true;
    btn.innerHTML    = '<span class="loader"></span> पाठवत आहे...';
  }

  // Simulate sending
  let sent = 0;
  for (let i = 0; i < customers.length; i++) {
    await new Promise(r => setTimeout(r, 200));
    sent++;
    if (btn) btn.innerHTML = `<span class="loader"></span> ${sent}/${customers.length} पाठवले...`;
  }

  if (btn) {
    btn.disabled  = false;
    btn.innerHTML = '📤 Broadcast पाठवा';
  }

  showToast(`✅ ${customers.length} customers ला message पाठवला!`, 'success');
}

// ─── Navigation ───
function goTo(page) {
  window.location.href = page;
}

function goBack() {
  window.history.back();
}

function openOrder(id) {
  window.location.href = `new-order.html?edit=${id}`;
}

function goToBill(orderId) {
  window.location.href = `bill.html?order=${orderId}`;
}

// ─── Helpers ───
function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function showToast(msg, type = '') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = msg;
  container.appendChild(toast);

  setTimeout(() => toast.remove(), 3500);
}

function getDaysAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Math.floor(
    (new Date() - new Date(dateStr)) / (1000 * 60 * 60 * 24)
  );
  if (diff === 0) return 'आज';
  if (diff === 1) return 'काल';
  return `${diff} दिवसांपूर्वी`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('mr-IN', {
    day: 'numeric', month: 'short', year: 'numeric'
  });
}