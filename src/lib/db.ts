/* ---------------------------------------------------------------------------
   IndexedDB layer — the app's primary offline store.
   Stores: sessions (history), categories (subjects/custom), meta (activeTimer).
--------------------------------------------------------------------------- */

const DB_NAME = "tempo-tracker";
const DB_VERSION = 1;

export type StoreName = "sessions" | "categories" | "meta";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not available in this browser."));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("sessions")) {
        const s = db.createObjectStore("sessions", { keyPath: "id" });
        s.createIndex("startedAt", "startedAt");
      }
      if (!db.objectStoreNames.contains("categories")) {
        db.createObjectStore("categories", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("meta")) {
        db.createObjectStore("meta", { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Failed to open database."));
    req.onblocked = () => reject(new Error("Database open was blocked."));
  });
  return dbPromise;
}

function tx<T>(
  store: StoreName,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDB().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(store, mode);
        const req = run(t.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("Database request failed."));
      }),
  );
}

export const dbAll = <T,>(store: StoreName): Promise<T[]> => tx(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);

export const dbPut = <T,>(store: StoreName, value: T): Promise<IDBValidKey> =>
  tx(store, "readwrite", (s) => s.put(value as unknown as Record<string, unknown>));

export function dbPutAll<T>(store: StoreName, values: T[]): Promise<void> {
  return openDB().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const t = db.transaction(store, "readwrite");
        const s = t.objectStore(store);
        for (const v of values) s.put(v as unknown as Record<string, unknown>);
        t.oncomplete = () => resolve();
        t.onerror = () => reject(t.error ?? new Error("Bulk write failed."));
        t.onabort = () => reject(t.error ?? new Error("Bulk write aborted."));
      }),
  );
}

export const dbDelete = (store: StoreName, key: string): Promise<undefined> =>
  tx(store, "readwrite", (s) => s.delete(key));

export const dbClear = (store: StoreName): Promise<undefined> =>
  tx(store, "readwrite", (s) => s.clear());

/* meta helpers — stored as { key, value } */
export async function dbGetMeta<T>(key: string): Promise<T | undefined> {
  const row = await tx<{ key: string; value: T } | undefined>("meta", "readonly", (s) =>
    s.get(key),
  );
  return row ? row.value : undefined;
}
export const dbSetMeta = <T,>(key: string, value: T): Promise<IDBValidKey> =>
  dbPut("meta", { key, value });
export const dbDeleteMeta = (key: string): Promise<undefined> => dbDelete("meta", key);
