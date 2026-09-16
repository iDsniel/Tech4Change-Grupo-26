import { emptyWorkspace, validateWorkspace, type Workspace } from "./operations.ts";

async function open() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("pulso-operations", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("workspaces");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("Não foi possível abrir os dados locais."));
  });
}

function currentOnly(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const workspace = value as Record<string, unknown>;
  if (!Array.isArray(workspace.datasets)) return value;
  return {
    ...workspace,
    datasets: workspace.datasets.map(item => {
      if (!item || typeof item !== "object") return item;
      const dataset = { ...(item as Record<string, unknown>) };
      delete dataset.legacy;
      delete dataset.historical2023;
      // Point-in-time status snapshots are not part of the historical Jun-Aug package.
      dataset.currentStatus = [];
      return dataset;
    })
  };
}

export async function readWorkspace(): Promise<Workspace> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("workspaces", "readonly");
    const request = tx.objectStore("workspaces").get("current");
    request.onsuccess = () => {
      try { resolve(request.result ? validateWorkspace(currentOnly(request.result)) : emptyWorkspace()); }
      catch (e) { reject(e); }
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function saveWorkspace(workspace: Workspace) {
  const sanitized = validateWorkspace(currentOnly(workspace));
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("workspaces", "readwrite");
    tx.objectStore("workspaces").put(sanitized, "current");
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onabort = () => { db.close(); reject(new Error("Não foi possível salvar. Exporte um backup antes de fechar.")); };
    tx.onerror = () => { db.close(); reject(new Error("Falha ao salvar os dados neste navegador.")); };
  });
}
