import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';

const SESSION = /^session-[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
const integer = value => Number.isSafeInteger(value) && value >= 0 && !Object.is(value, -0);
export const MILESTONE_LIMIT = 256;
export function validateMilestone(value, removing = false) {
  if (!value || !SESSION.test(value.sessionId ?? '')) throw new Error('Invalid Session ID');
  if (!integer(value.turn)) throw new Error('Invalid milestone turn');
  if (value.seq !== undefined && !integer(value.seq)) throw new Error('Invalid milestone sequence');
  const name = typeof value.name === 'string' ? value.name.trim() : '';
  if (!removing && (!name || name.length > 80 || /[\p{Cc}\p{Cf}]/u.test(name))) throw new Error('Milestone name must contain 1–80 characters without control characters');
  return { sessionId:value.sessionId, turn:value.turn, ...(value.seq === undefined ? {} : {seq:value.seq}), ...(removing ? {} : {name}) };
}

/** Independent metadata: no Session log, running state, unread, badge or Toast writes. */
export function createMilestoneStore(file) {
  let rows = new Map(), revision = 0;
  const generation = randomBytes(12).toString('hex');
  try {
    const saved = JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/u, ''));
    if (saved.version === 1 && Array.isArray(saved.rows)) for (const raw of saved.rows.slice(0, 16384)) {
      try {
        const row = validateMilestone(raw), session = rows.get(row.sessionId) ?? new Map();
        if (session.size >= MILESTONE_LIMIT && !session.has(row.turn)) continue;
        session.set(row.turn, row); rows.set(row.sessionId, session);
      } catch { /* Ignore individual malformed entries, preserving valid metadata. */ }
    }
  } catch { /* First install or malformed metadata. */ }
  const snapshot = sessionId => ({ sessionId, generation, revision,
    milestones:[...(rows.get(sessionId)?.values() ?? [])].sort((a,b)=>a.turn-b.turn) });
  return {
    snapshot,
    set(value, removing = false) {
      const row = validateMilestone(value, removing), previous = rows.get(row.sessionId) ?? new Map();
      if (!removing && previous.size >= MILESTONE_LIMIT && !previous.has(row.turn)) throw new Error('At most 256 milestones per conversation');
      if (!removing && !previous.has(row.turn) && [...rows.values()].reduce((n,s)=>n+s.size,0) >= 16384) throw new Error('Milestone storage is full');
      const old = previous.get(row.turn);
      if (removing ? !old : old?.name === row.name && old?.seq === row.seq) return snapshot(row.sessionId);
      const next = new Map(rows), session = new Map(previous);
      if (removing) session.delete(row.turn); else session.set(row.turn,row);
      if (session.size) next.set(row.sessionId,session); else next.delete(row.sessionId);
      // Publish only after durable storage succeeds. A failed rename preserves the old snapshot.
      writeFileSync(file + '.tmp', JSON.stringify({version:1,rows:[...next.values()].flatMap(s=>[...s.values()])}));
      renameSync(file + '.tmp', file);
      rows = next; revision++;
      return snapshot(row.sessionId);
    },
  };
}
