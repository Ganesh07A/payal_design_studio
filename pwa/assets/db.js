// ─── IndexedDB for offline storage ───

const DB_NAME    = 'PayalStudioDB';
const DB_VERSION = 1;

let db;

function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      // Orders store
      if (!db.objectStoreNames.contains('orders')) {
        const ordersStore = db.createObjectStore(
          'orders', { keyPath: 'id' }
        );
        ordersStore.createIndex('status',  'status',  { unique: false });
        ordersStore.createIndex('phone',   'phone',   { unique: false });
        ordersStore.createIndex('synced',  'synced',  { unique: false });
      }

      // Customers store
      if (!db.objectStoreNames.contains('customers')) {
        const custStore = db.createObjectStore(
          'customers', { keyPath: 'phone' }
        );
        custStore.createIndex('name', 'name', { unique: false });
      }

      // Catalog store
      if (!db.objectStoreNames.contains('catalog')) {
        db.createObjectStore('catalog', { keyPath: 'id' });
      }

      // Pending actions (offline queue)
      if (!db.objectStoreNames.contains('pendingActions')) {
        db.createObjectStore(
          'pendingActions', { keyPath: 'id', autoIncrement: true }
        );
      }
    };

    request.onsuccess   = (e) => { db = e.target.result; resolve(db); };
    request.onerror     = (e) => reject(e.target.error);
  });
}

// ─── Generic DB operations ───

function dbAdd(storeName, data) {
  return new Promise((resolve, reject) => {
    const tx      = db.transaction(storeName, 'readwrite');
    const store   = tx.objectStore(storeName);
    const request = store.put(data);
    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => reject(request.error);
  });
}

function dbGetAll(storeName) {
  return new Promise((resolve, reject) => {
    const tx      = db.transaction(storeName, 'readonly');
    const store   = tx.objectStore(storeName);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => reject(request.error);
  });
}

function dbGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx      = db.transaction(storeName, 'readonly');
    const store   = tx.objectStore(storeName);
    const request = store.get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror   = () => reject(request.error);
  });
}

function dbDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx      = db.transaction(storeName, 'readwrite');
    const store   = tx.objectStore(storeName);
    const request = store.delete(key);
    request.onsuccess = () => resolve();
    request.onerror   = () => reject(request.error);
  });
}

// ─── Seed demo data ───

async function seedDemoData() {
  const existing = await dbGetAll('orders');
  if (existing.length > 0) return; // Already seeded

  const demoCustomers = [
    { phone: '9876543210', name: 'सुनीता पाटील',  orders: 3 },
    { phone: '9823456789', name: 'प्रिया देशमुख', orders: 1 },
    { phone: '9765432109', name: 'मीना जोशी',     orders: 2 },
    { phone: '9812345678', name: 'रेखा शिंदे',    orders: 1 },
    { phone: '9890123456', name: 'अनिता कुलकर्णी', orders: 4 },
  ];

  const demoOrders = [
    {
      id: 'PDS-2025-0142',
      phone: '9876543210',
      customerName: 'सुनीता पाटील',
      items: [
        { name: 'बोट नेक ब्लाउज',  price: 450 },
        { name: 'साडी पिको',        price: 80  },
        { name: 'साडी फॉल',         price: 100 },
      ],
      total:       630,
      advance:     200,
      balance:     430,
      status:      'ready',
      notes:       'पॅडिंग + डोरी हवी',
      date:        '2025-01-12',
      deliveryDate:'2025-01-16',
      synced:      true
    },
    {
      id: 'PDS-2025-0143',
      phone: '9823456789',
      customerName: 'प्रिया देशमुख',
      items: [
        { name: 'प्रिन्सेस कट ब्लाउज', price: 500 },
      ],
      total:       500,
      advance:     200,
      balance:     300,
      status:      'in_progress',
      notes:       'बॅक डिझाइन',
      date:        '2025-01-13',
      deliveryDate:'2025-01-17',
      synced:      true
    },
    {
      id: 'PDS-2025-0144',
      phone: '9765432109',
      customerName: 'मीना जोशी',
      items: [
        { name: 'लेडीज पँट',        price: 400 },
        { name: 'टू-पीस ड्रेस',     price: 600 },
      ],
      total:       1000,
      advance:     500,
      balance:     500,
      status:      'received',
      notes:       'कापड मीनाताईंचा',
      date:        '2025-01-14',
      deliveryDate:'2025-01-19',
      synced:      true
    },
    {
      id: 'PDS-2025-0141',
      phone: '9812345678',
      customerName: 'रेखा शिंदे',
      items: [
        { name: 'कॉलर नेक ब्लाउज', price: 480 },
      ],
      total:       480,
      advance:     480,
      balance:     0,
      status:      'delivered',
      notes:       '',
      date:        '2025-01-10',
      deliveryDate:'2025-01-14',
      synced:      true
    },
    {
      id: 'PDS-2025-0140',
      phone: '9890123456',
      customerName: 'अनिता कुलकर्णी',
      items: [
        { name: 'साडीपासून ड्रेस',  price: 700 },
        { name: 'साडी पिको',        price: 80  },
      ],
      total:       780,
      advance:     300,
      balance:     480,
      status:      'delivered',
      notes:       'जुन्या पैठणीपासून',
      date:        '2025-01-08',
      deliveryDate:'2025-01-12',
      synced:      true
    },
  ];

  const demoCatalog = [
    { id: 1, category: 'ब्लाउज', name: 'बोट नेक',         priceMin: 350, priceMax: 500, trending: true,  emoji: '👗' },
    { id: 2, category: 'ब्लाउज', name: 'बॅकलेस',          priceMin: 400, priceMax: 600, trending: true,  emoji: '✨' },
    { id: 3, category: 'ब्लाउज', name: 'प्रिन्सेस कट',    priceMin: 450, priceMax: 650, trending: false, emoji: '👑' },
    { id: 4, category: 'ब्लाउज', name: 'पफ स्लीव्ह',      priceMin: 400, priceMax: 550, trending: true,  emoji: '💫' },
    { id: 5, category: 'ब्लाउज', name: 'कॉलर नेक',        priceMin: 380, priceMax: 500, trending: false, emoji: '🎀' },
    { id: 6, category: 'पँट',    name: 'लेडीज पँट',        priceMin: 300, priceMax: 500, trending: false, emoji: '👖' },
    { id: 7, category: 'ड्रेस',  name: 'साडीपासून ड्रेस', priceMin: 500, priceMax: 800, trending: true,  emoji: '🌸' },
    { id: 8, category: 'ड्रेस',  name: 'टू-पीस ड्रेस',    priceMin: 400, priceMax: 700, trending: false, emoji: '💃' },
    { id: 9, category: 'इतर',    name: 'साडी पिको',        priceMin: 80,  priceMax: 80,  trending: false, emoji: '🪡' },
    { id: 10, category: 'इतर',   name: 'साडी फॉल',         priceMin: 100, priceMax: 100, trending: false, emoji: '🧵' },
  ];

  for (const c of demoCustomers) await dbAdd('customers', c);
  for (const o of demoOrders)    await dbAdd('orders', o);
  for (const c of demoCatalog)   await dbAdd('catalog', c);
}