export type ImportHandoff = { prompt: string; images?: { name: string; mediaType: "image/png" | "image/jpeg" | "image/webp" | "image/gif"; data: string }[]; createdAt: number };
async function storage() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("idaevia-imports", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("pending");
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error("Browser storage is unavailable. Enable site storage and try again."));
  });
}
export async function saveImportHandoff(id: string, value: ImportHandoff) {
  const db = await storage();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction("pending", "readwrite"); tx.objectStore("pending").put(value, id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(new Error("Could not save the reference image. Free browser storage and retry.")); }); }
  finally { db.close(); }
}
export async function readImportHandoff(id: string): Promise<ImportHandoff | undefined> {
  const db = await storage();
  try { return await new Promise((resolve, reject) => { const req = db.transaction("pending").objectStore("pending").get(id); req.onsuccess = () => resolve(req.result?.createdAt > Date.now() - 86400000 ? req.result : undefined); req.onerror = () => reject(req.error); }); }
  finally { db.close(); }
}
export async function clearImportHandoff(id: string) {
  const db = await storage();
  try { await new Promise<void>((resolve, reject) => { const tx = db.transaction("pending", "readwrite"); tx.objectStore("pending").delete(id); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); }); }
  finally { db.close(); }
}
