'use client';
/** Reusable questions. Stored in the account when the online service is available (table quiz_bank_items), otherwise on this device. */
import { api } from './client';
import { ensureCloudSession } from './session-client';
import { prepare, uid } from './editor-model';
import type { Question } from './types';

export type BankItem = { id: string; question: Question; tags: string[]; createdAt: string; where: 'account' | 'device' };
const KEY = 'qz:bank:v1';

function readLocal(): BankItem[] {
  try { return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as BankItem[]).filter((x) => x?.question); } catch { return []; }
}
function writeLocal(items: BankItem[]): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(items.slice(0, 300))); return true; } catch { return false; }
}

export async function listBank(): Promise<{ items: BankItem[]; account: boolean; note?: string }> {
  const local = readLocal();
  const cloud = await ensureCloudSession();
  if (cloud.status !== 'ready') return { items: local, account: false, note: 'Online saving isn’t available, so the bank on this device is shown.' };
  try {
    const d = await api<{ items: BankItem[] }>('/api/quiz/bank');
    return { items: [...d.items.map((i) => ({ ...i, where: 'account' as const })), ...local], account: true };
  } catch (e) {
    return { items: local, account: false, note: `Your account bank couldn’t be loaded (${(e as Error).message}). Showing this device’s bank.` };
  }
}

export async function addToBank(q: Question, tags: string[]): Promise<'account' | 'device'> {
  const question = prepare(JSON.parse(JSON.stringify({ ...q, id: undefined })) as Question);
  const cloud = await ensureCloudSession();
  if (cloud.status === 'ready') {
    try { await api('/api/quiz/bank', { method: 'POST', json: { question, tags } }); return 'account'; } catch { /* fall back to device */ }
  }
  const items = readLocal();
  const ok = writeLocal([{ id: uid('bk'), question, tags, createdAt: new Date().toISOString(), where: 'device' }, ...items]);
  if (!ok) throw new Error('Could not save: this browser is not allowing storage.');
  return 'device';
}

export async function removeFromBank(item: BankItem) {
  if (item.where === 'device') { writeLocal(readLocal().filter((x) => x.id !== item.id)); return; }
  await api(`/api/quiz/bank?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' });
}
