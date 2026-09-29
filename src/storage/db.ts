// Локальное хранилище (IndexedDB). Данные не покидают браузер.

import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { HistoryRecord, Patient } from '../core/types';

interface NephroDB extends DBSchema {
  patients: { key: string; value: Patient };
  records: { key: string; value: HistoryRecord; indexes: { byPatient: string } };
}

let dbPromise: Promise<IDBPDatabase<NephroDB>> | undefined;

function db(): Promise<IDBPDatabase<NephroDB>> {
  dbPromise ??= openDB<NephroDB>('nephrocontrol', 1, {
    upgrade(d) {
      d.createObjectStore('patients', { keyPath: 'id' });
      d.createObjectStore('records', { keyPath: 'id' }).createIndex('byPatient', 'patientId');
    },
  });
  return dbPromise;
}

/** Vue-прокси не сериализуются structured clone — сохраняем простую копию. */
const plain = <T>(x: T): T => JSON.parse(JSON.stringify(x)) as T;

export async function listPatients(): Promise<Patient[]> {
  const all = await (await db()).getAll('patients');
  return all.sort((a, b) => a.label.localeCompare(b.label, 'ru'));
}

export async function savePatient(p: Patient): Promise<void> {
  await (await db()).put('patients', plain(p));
}

export async function deletePatient(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(['patients', 'records'], 'readwrite');
  const keys = await tx.objectStore('records').index('byPatient').getAllKeys(id);
  await Promise.all([...keys.map((k) => tx.objectStore('records').delete(k)), tx.objectStore('patients').delete(id)]);
  await tx.done;
}

export async function listRecords(patientId: string): Promise<HistoryRecord[]> {
  const all = await (await db()).getAllFromIndex('records', 'byPatient', patientId);
  return all.sort((a, b) => new Date(a.sampledAt).getTime() - new Date(b.sampledAt).getTime());
}

export async function saveRecord(r: HistoryRecord): Promise<void> {
  await (await db()).put('records', plain(r));
}

export async function deleteRecord(id: string): Promise<void> {
  await (await db()).delete('records', id);
}
