import { emptyWorkspace, validateWorkspace, type Workspace } from "./operations.ts";

async function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("pulso-operations", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("workspaces");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Não foi possível abrir os dados locais."));
  });
}
export async function readWorkspace(): Promise<Workspace> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspaces", "readonly");
    const request = tx.objectStore("workspaces").get("current");
    request.onsuccess = () => { try { resolve(request.result ? validateWorkspace(request.result) : emptyWorkspace()); } catch (e) { reject(e); } };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
export async function saveWorkspace(workspace: Workspace) {
  validateWorkspace(workspace);
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("workspaces", "readwrite");
    tx.objectStore("workspaces").put(workspace, "current");
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(new Error("Não foi possível salvar. Exporte um backup antes de fechar.")); };
    tx.onerror = () => { db.close(); reject(new Error("Falha ao salvar os dados neste navegador.")); };
  });
}
