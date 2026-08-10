/* IndexedDB store for meal records. Photos live in the record as Blobs —
   localStorage would blow its quota after a couple of dozen pictures. */

const NAME = 'sancan-diary';
const VER = 1;
const STORE = 'meals';

let dbp = null;

function open() {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(NAME, VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' }).createIndex('date', 'date');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

const wrap = req => new Promise((resolve, reject) => {
  req.onsuccess = () => resolve(req.result);
  req.onerror = () => reject(req.error);
});

const done = tx => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = () => reject(tx.error);
  tx.onabort = () => reject(tx.error);
});

async function store(mode) {
  const db = await open();
  const tx = db.transaction(STORE, mode);
  return [tx.objectStore(STORE), tx];
}

const byDateTime = (a, b) =>
  a.date === b.date ? String(a.time).localeCompare(String(b.time)) : a.date.localeCompare(b.date);

export const DB = {
  async all() {
    const [s] = await store('readonly');
    return (await wrap(s.getAll())).sort(byDateTime);
  },
  async put(rec) {
    const [s, tx] = await store('readwrite');
    s.put(rec);
    return done(tx);
  },
  async del(id) {
    const [s, tx] = await store('readwrite');
    s.delete(id);
    return done(tx);
  },
  async bulkPut(list) {
    const [s, tx] = await store('readwrite');
    list.forEach(r => s.put(r));
    return done(tx);
  },
  async clear() {
    const [s, tx] = await store('readwrite');
    s.clear();
    return done(tx);
  },
};
