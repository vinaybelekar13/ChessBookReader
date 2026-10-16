import type { BookRecord, BookSession } from "./model";

const DB_NAME = "chessbook-reader";
const DB_VERSION = 1;
const ACTIVE_KEY = "activeBookId";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("books")) {
        db.createObjectStore("books", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("sessions")) {
        db.createObjectStore("sessions", { keyPath: "bookId" });
      }
      if (!db.objectStoreNames.contains("settings")) {
        db.createObjectStore("settings", { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open local library."));
  });
}

async function transact<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = db.transaction(storeName, mode);
      let outcome: { value: T } | null = null;
      transaction.oncomplete = () => {
        if (outcome) resolve(outcome.value);
        else reject(new Error("Local library transaction completed without a result."));
      };
      transaction.onerror = () => reject(transaction.error ?? new Error("Local library transaction failed."));
      transaction.onabort = () => reject(transaction.error ?? new Error("Local library transaction aborted."));
      const request = run(transaction.objectStore(storeName));
      request.onsuccess = () => { outcome = { value: request.result }; };
      request.onerror = () => reject(request.error ?? new Error("Local library operation failed."));
    });
  } finally {
    db.close();
  }
}

export const getBooks = () =>
  transact<BookRecord[]>("books", "readonly", (store) => store.getAll());

export const getBook = (id: string) =>
  transact<BookRecord | undefined>("books", "readonly", (store) => store.get(id));

export const putBook = (book: BookRecord) =>
  transact<IDBValidKey>("books", "readwrite", (store) => store.put(book));

export const removeBook = (id: string) =>
  transact<undefined>("books", "readwrite", (store) => store.delete(id));

export const getSession = (id: string) =>
  transact<BookSession | undefined>("sessions", "readonly", (store) => store.get(id));

export const putSession = (session: BookSession) =>
  transact<IDBValidKey>("sessions", "readwrite", (store) => store.put(session));

export const removeSession = (id: string) =>
  transact<undefined>("sessions", "readwrite", (store) => store.delete(id));

export const getActiveBookId = async (): Promise<string | null> => {
  const item = await transact<{ key: string; value: string } | undefined>(
    "settings",
    "readonly",
    (store) => store.get(ACTIVE_KEY),
  );
  return item?.value ?? null;
};

export const setActiveBookId = (value: string | null) =>
  value
    ? transact<IDBValidKey>("settings", "readwrite", (store) =>
        store.put({ key: ACTIVE_KEY, value }),
      )
    : transact<undefined>("settings", "readwrite", (store) => store.delete(ACTIVE_KEY));
