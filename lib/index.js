import z from '@deepseek-ai/schemastery';
import { spawn } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync, statSync, readdirSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMilestoneStore, validateMilestone } from './milestones.js';

export const name = 'dsh-notify-all';
export const inject = ['connection'];
export const DEFAULTS = Object.freeze({
  enabled: true, toastsEnabled: true, sound: true, badgeColor: 'red',
  suppressWhenViewing: false, muteWhenViewing: false,
  showBadge: true, trayIcon: false, toastTarget: 'app', clearOnFocus: false,
  completion: true, failure: true, blocked: true, approval: true, question: true,
  planReview: true, subagentUnread: false, completeMergeMs: 0,
  toastMinIntervalMs: 0, summaryMaxChars: 180,
});
export const Config = z.object(Object.fromEntries(Object.entries(DEFAULTS).map(([key, value]) => {
  const schema = key === 'badgeColor' ? z.union(['red', 'black'].map(x => z.const(x)))
    : key === 'toastTarget' ? z.union(['app', 'browser'].map(x => z.const(x)))
    : typeof value === 'boolean' ? z.boolean()
    : z.natural().min(key === 'summaryMaxChars' ? 40 : 0).max(key === 'summaryMaxChars' ? 500 : 60000);
  return [key, schema.default(value).volatile()];
})));
const dryRun = process.env.DSH_NOTIFY_ALL_DRY_RUN === '1';
const script = x => fileURLToPath(new URL('../scripts/' + x, import.meta.url));
const colors = { red: '#E62B34', black: '#1A1A1A' };
export const APP_ID = 'DeepSeekHarness.NotifyAll';
export const SESSION_ID = /^session-[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/u;
export const SESSION_LOOKUP_TIMEOUT_MS = 5000;
/** Public links grant navigation only; Toast activations retain their private key. */
export function activationSession(address, key) {
  const url = new URL(address);
  if (url.protocol !== 'dsh-notify-all:' || url.username || url.password || url.port || url.hash) throw new Error('Invalid activation');
  if (url.hostname === 'session') {
    const id = url.pathname.slice(1);
    if (!SESSION_ID.test(id) || address !== 'dsh-notify-all://session/' + id) throw new Error('Invalid Session link');
    return id;
  }
  if (url.hostname !== 'open' || (url.pathname && url.pathname !== '/') || url.searchParams.get('key') !== key ||
      url.searchParams.getAll('key').length !== 1 || url.searchParams.getAll('session').length > 1 ||
      [...url.searchParams.keys()].some(x => !['key', 'session'].includes(x))) throw new Error('Invalid notification key');
  const id = url.searchParams.get('session');
  if (id !== null && !SESSION_ID.test(id)) throw new Error('Invalid Session ID');
  return id;
}
const compact = (x, max = 180) => String(x ?? '').replace(/\s+/gu, ' ').trim().slice(0, max);
const textOf = blocks => (blocks ?? []).filter(x => x.type === 'text').map(x => x.text).join('\n');
const parse = x => typeof x === 'string' ? JSON.parse(x.replace(/^\uFEFF/u, '')) : x;
const read = (file, fallback = {}) => { try { return parse(readFileSync(file, 'utf8')); } catch { return fallback; } };

/** Current Session IDs are reported by UiSession, never inferred from a title. */
export function apply(ctx, config = {}) {
  if (process.platform !== 'win32') return;
  const root = ctx.get('profileContext')?.home ?? process.env.DSH_HOME ?? join(homedir(), '.dsh');
  const dir = join(root, name);
  mkdirSync(dir, { recursive: true });
  const milestones = createMilestoneStore(join(dir, 'milestones.json'));
  const inbox = join(dir, 'activation-inbox'); mkdirSync(inbox, { recursive: true });
  const keyFile = join(dir, 'activation-key.txt');
  let activationKey; try { activationKey = readFileSync(keyFile, 'utf8').trim(); } catch { /* First install. */ }
  if (!/^[a-f0-9]{48}$/u.test(activationKey ?? '')) { activationKey = randomBytes(24).toString('hex'); writeFileSync(keyFile, activationKey); }
  let disposed = false, child = null, lastSpawn = 0, helperStamp = '';
  let activation = null, navigationFence = null, nativeReady = Promise.resolve(), notificationError = null;
  const stateGeneration = randomBytes(12).toString('hex');
  let stateRevision = 0;
  const children = new Set(), timers = new Set(), viewers = new Map(), titles = new Map(), lookups = new Set();
  const summaries = new Map(), lastToast = new Map();
  const saved = read(join(dir, 'state.json'), { version: 1, unread: [], waits: [], seen: [] });
  const unread = new Map(saved.version === 1 ? saved.unread : []);
  const manualUnread = new Set(saved.version === 1 ? (saved.manualUnread ?? []).filter(id => unread.has(id)) : []);
  const manualHolds = new Map();
  const waits = new Map(saved.version === 1 ? saved.waits : []);
  const seen = new Map(saved.version === 1 ? saved.seen : []);
  const legacy = { ...read(join(dir, 'config.json')), ...read(join(dir, 'prefs.json')) };
  let migrating = false, migrationDone = existsSync(join(dir, 'settings-migrated.json'));
  let cfg = { ...DEFAULTS };
  function log(line) {
    try {
      const path = join(dir, 'log.txt');
      if (existsSync(path) && statSync(path).size > 512000) writeFileSync(path, '');
      writeFileSync(path, new Date().toISOString() + ' ' + line + '\n', { flag: 'a' });
    } catch { /* Session append must not fail because of logging. */ }
  }
  function atomic(file, value) {
    const path = join(dir, file);
    writeFileSync(path + '.tmp', JSON.stringify(value));
    renameSync(path + '.tmp', path);
  }
  function syncConfig() {
    cfg = { ...DEFAULTS };
    for (const key of Object.keys(DEFAULTS)) {
      const val = config[key];
      if (val !== undefined) cfg[key] = val && typeof val.get === 'function' ? val.get() : val;
    }
  }
  function later(fn, ms) {
    const timer = setTimeout(() => { timers.delete(timer); if (!disposed) fn(); }, ms);
    timers.add(timer); timer.unref?.(); return timer;
  }
  function launch(file, payload, extra = []) {
    if (dryRun || disposed) return null;
    const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', ...extra,
      '-File', script(file), '-Payload', Buffer.from(JSON.stringify(payload)).toString('base64')],
    { stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    children.add(ps);
    let errors = '';
    ps.stderr.on('data', buf => { errors = (errors + buf.toString()).slice(-2000); });
    ps.on('error', err => log(file + ': ' + err.message));
    ps.on('close', code => { children.delete(ps); if (code || file === 'toast.ps1') log(file + ' exit=' + code + (errors ? ' ' + errors : '')); });
    return ps;
  }
  const count = () => ({ pending: waits.size, unread: [...unread.values()].reduce((a, b) => a + b, 0) });
  function persist() {
    try { atomic('state.json', { version: 1, unread: [...unread], manualUnread: [...manualUnread], waits: [...waits], seen: [...seen].slice(-1000) }); }
    catch (err) { log('state write: ' + err.message); }
  }
  function webUrl() {
    const port = ctx.get('webServer')?.port;
    return port ? ctx.connection.authenticatedUrl('http://127.0.0.1:' + port + '/') : '';
  }
  function activationUrl(sid) {
    const url = new URL('dsh-notify-all://open');
    url.searchParams.set('key', activationKey);
    if (sid) url.searchParams.set('session', sid);
    return url.href;
  }
  function toastUrl(sid) {
    if (cfg.toastTarget !== 'browser') return activationUrl(sid);
    const address = webUrl(); if (!address) return activationUrl(sid);
    const url = new URL(address);
    if (sid) url.hash = 'dsh-notify-session=' + encodeURIComponent(sid);
    return url.href;
  }
  function readActivation() {
    for (const file of readdirSync(inbox).filter(x => /^[a-f0-9]{32}\.uri$/u.test(x)).sort((a, b) => statSync(join(inbox, a)).mtimeMs - statSync(join(inbox, b)).mtimeMs)) {
      const path = join(inbox, file);
      try {
        if (statSync(path).size > 8192) continue;
        const sid = activationSession(readFileSync(path, 'utf8'), activationKey);
        activation = { id:file.slice(0,-4), sessionId:sid, at:Date.now() };
        log('notification clicked: ' + (sid ?? 'main window'));
      } catch (err) { log('activation read: ' + err.message); }
      finally { try { unlinkSync(path); } catch { /* Retry on the next poll. */ } }
    }
    return activation;
  }
  function badgeState(exit = false) {
    const c = count();
    return { count: !exit && cfg.enabled && cfg.showBadge ? c.pending + c.unread : 0,
      color: colors[cfg.badgeColor], trayIcon: cfg.enabled && cfg.trayIcon,
      url: toastUrl(), ts: Date.now(), exit };
  }
  function pushBadge() {
    if (disposed) return;
    syncConfig();
    try {
      const state = badgeState(), stamp = JSON.stringify([state.count, state.color, state.trayIcon, state.url]);
      if (stamp !== helperStamp) { atomic('badge.json', state); helperStamp = stamp; }
      if (cfg.enabled && cfg.showBadge && (!child || child.exitCode !== null) && Date.now() - lastSpawn > 5000) {
        lastSpawn = Date.now();
        child = launch('tray.ps1', { dir, url: state.url, watchPid: process.pid,
          mutex: 'dsh-notify-' + createHash('sha256').update(dir).digest('hex').slice(0, 24),
          exePath: process.execPath, trayIcon: cfg.trayIcon, hexRed: colors.red, hexBlack: colors.black }, ['-STA']);
      }
    } catch (err) { log('badge: ' + err.message); }
  }
  function changed() { stateRevision++; persist(); pushBadge(); }
  function label(sid) { return titles.get(sid) ?? compact(sid, 45); }
  function focusedDesktop(sid) {
    if (!sid) return false;
    for (const viewer of viewers.values()) {
      if (viewer.desktop && viewer.focused && viewer.sessionId === sid && Date.now() - viewer.at < 6000) return true;
    }
    return false;
  }
  function toast(kind, title, body, force = false, sid = null, sessionIds = [sid]) {
    syncConfig();
    if (!force && (!cfg.enabled || !cfg.toastsEnabled || !cfg[kind === 'plan' ? 'planReview' : kind])) return;
    const viewing = sessionIds.length > 0 && sessionIds.every(focusedDesktop);
    if (!force && cfg.suppressWhenViewing && viewing) return;
    const now = Date.now();
    if (!force && now - (lastToast.get(kind) ?? 0) < cfg.toastMinIntervalMs) return;
    lastToast.set(kind, now);
    const payload = { title, body: compact(body, 300), sound: cfg.sound && !(!force && cfg.muteWhenViewing && viewing), appId: APP_ID, url:toastUrl(sid), iconPath:join(dir,'dsh.png') };
    log((dryRun ? 'toast dry-run ' : 'toast ') + kind + ' ' + compact(body, 70) + ' sound=' + payload.sound);
    void nativeReady.then(() => { launch('toast.ps1', payload); }).catch(err => log('toast setup: ' + err.message));
  }
  function isRoot(session) {
    if (session.header?.parentSession != null) return false;
    const agents = ctx.get('agents'), agent = agents?.get?.(session.id);
    return agent ? agents.roots().includes(agent) : true;
  }
  function visible(sid) {
    for (const viewer of viewers.values()) if (viewer.focused && Date.now() - viewer.at < 6000 && viewer.sessionId === sid) return true;
    return false;
  }
  function settle(sid, id) { if (waits.delete(sid + ':' + id)) changed(); }
  function addWait(session, kind, id, body) {
    if (!cfg.enabled || !isRoot(session) || typeof id !== 'string') return;
    const key = session.id + ':' + id;
    if (waits.has(key)) return;
    waits.set(key, { sessionId: session.id, kind }); changed();
    toast(kind, { question: 'DSH 正在问你', approval: 'DSH 需要审批', plan: 'DSH 计划待确认' }[kind], label(session.id) + '\n' + body, false, session.id);
  }
  const waiting = sid => [...waits.values()].some(x => x.sessionId === sid);
  let merged = [], mergeTimer = null;
  function notifyEnd(kind, sid, reason) {
    if (cfg.suppressWhenViewing && focusedDesktop(sid)) return;
    const heads = { completion: 'DSH 任务完成', failure: 'DSH 任务异常结束', blocked: 'DSH 任务受阻' };
    const body = [label(sid), reason?.error?.message ?? reason?.message ?? '', compact(summaries.get(sid), cfg.summaryMaxChars)].filter(Boolean).join('\n');
    if (kind !== 'completion' || cfg.completeMergeMs === 0 || mergeTimer === null) toast(kind, heads[kind], body, false, sid);
    else merged.push({sid, title:label(sid)});
    if (kind === 'completion' && cfg.completeMergeMs > 0 && mergeTimer === null) mergeTimer = later(() => {
      syncConfig();
      mergeTimer = null; const batch = merged.filter(x => !(cfg.suppressWhenViewing && focusedDesktop(x.sid))); merged = [];
      if (batch.length) toast('completion', 'DSH 任务完成（' + batch.length + '）', batch.slice(0, 3).map(x=>x.title).join('、'), false, batch.at(-1).sid, batch.map(x=>x.sid));
    }, cfg.completeMergeMs);
  }
  ctx.on('session/event', (session, event) => {
    if (disposed) return;
    try {
      syncConfig();
      const sid = session.id, d = event.data ?? {};
      if (event.type === 'session/title') { if (typeof d.title === 'string') titles.set(sid, d.title); return; }
      if (event.type === 'assistant/message') { const text = textOf(d.message?.content ?? d.content); if (text) summaries.set(sid, text); return; }
      if (event.type === 'tool/result') {
        let result = {}; try { result = parse(textOf(d.message?.content)); } catch { /* A plain result settles. */ }
        if (result?.pending === true || d.error?.code === 'TOOL_OUTCOME_UNKNOWN') return;
        settle(sid, d.message?.toolCallId); return;
      }
      if (event.type === 'approval/decided') { settle(sid, 'approval:' + d.id); return; }
      if (event.type === 'user/message') { if (d.source?.kind === 'user-question-reply') settle(sid, d.source.callId); return; }
      if (!cfg.enabled) return;
      if (event.type === 'approval/asked') { addWait(session, 'approval', 'approval:' + d.id, '工具 ' + (d.toolName ?? 'tool') + ' 请求授权'); return; }
      if (event.type === 'tool/call' || event.type === 'tool/ptc-dispatch') {
        if (!['ask_user_question', 'exit_plan_mode'].includes(d.name)) return;
        let callId = d.callId;
        if (event.type === 'tool/ptc-dispatch') {
          // PTC dispatch is recorded after execution, with a distinct sub-call ID.
          let result; try { result = parse(textOf(d.content)); } catch { return; }
          if (d.isError || result?.pending !== true) return;
          callId = d.subCallId;
        }
        let args; try { args = parse(d.arguments); } catch { return; }
        if (d.name === 'ask_user_question' && args?.questions?.length) addWait(session, 'question', callId, compact(args.questions[0].question));
        if (d.name === 'exit_plan_mode') addWait(session, 'plan', callId, compact(args?.plan) || '计划等待确认');
        return;
      }
      if (event.type !== 'turn/end') return;
      const rootSession = isRoot(session);
      if (!rootSession && !cfg.subagentUnread) return;
      const kind = d.reason?.kind === 'completed' ? 'completion' : d.reason?.kind === 'blocked' ? 'blocked'
        : ['error', 'aborted', 'interrupted', 'max-tokens'].includes(d.reason?.kind) ? 'failure' : null;
      if (!kind) return;
      const last = seen.get(sid) ?? -1;
      if (typeof event.seq === 'number') { if (event.seq <= last) return; seen.set(sid, event.seq); }
      // A human wait is one item; its turn-end event must not add another unread item.
      if (kind === 'failure') {
        for (const [key, wait] of waits) if (wait.sessionId === sid) waits.delete(key);
      } else if (waiting(sid)) { changed(); log('turn/end human wait: ' + sid); return; }
      if (!visible(sid)) unread.set(sid, (unread.get(sid) ?? 0) + 1);
      changed();
      log('turn/end ' + kind + ' ' + sid + ' visible=' + visible(sid) + ' count=' + badgeState().count);
      if (rootSession) notifyEnd(kind, sid, d.reason);
    } catch (err) { log('session event: ' + err.stack); }
  }, { global: true });
  function status() {
    syncConfig(); const c = count();
    return { version: '0.3.1', generation:stateGeneration, revision:stateRevision, badge: { ...c, count: c.pending + c.unread, color: cfg.badgeColor },
      unread: [...unread].map(([id, count]) => ({ id, title: label(id), count, manual:manualUnread.has(id) })), config: cfg,
      native: read(join(dir, 'native-status.json'), null), notification: { appId:APP_ID, error:notificationError },
      viewers: [...viewers.values()].map(x => ({ sessionId: x.sessionId, focused: x.focused && Date.now() - x.at < 6000 })) };
  }
  function response(value, code = 200) {
    return new Response(JSON.stringify(value), { status: code, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
  }
  function markRead(sessionId) {
    manualUnread.delete(sessionId); manualHolds.delete(sessionId);
    if (unread.delete(sessionId)) changed();
  }
  async function assertKnownSession(sessionId, signal) {
    signal?.throwIfAborted();
    // The public live roster does not read persistence or change Agent status.
    if (ctx.get('sessions')?.get(sessionId)?.id === sessionId) return;
    const query = ctx.get('sessionQuery');
    if (!query) throw new Error('Session query service unavailable');
    const controller = new AbortController();
    lookups.add(controller);
    const cancel = () => controller.abort(signal.reason);
    signal?.addEventListener('abort', cancel, { once:true });
    if (signal?.aborted) cancel();
    const timeout = setTimeout(() => controller.abort(new Error('Session lookup timed out. Please try again.')), SESSION_LOOKUP_TIMEOUT_MS);
    let onAbort;
    try {
      const aborted = new Promise((_, reject) => {
        onAbort = () => reject(controller.signal.reason);
        controller.signal.addEventListener('abort', onAbort, { once:true });
        if (controller.signal.aborted) onAbort();
      });
      const rows = await Promise.race([Promise.resolve().then(() => {
        controller.signal.throwIfAborted();
        return query.listSessions(controller.signal);
      }), aborted]);
      controller.signal.throwIfAborted();
      if (!rows.some(row => row.header.id === sessionId)) throw new Error('Conversation does not exist in this profile');
    } finally {
      clearTimeout(timeout);
      controller.signal.removeEventListener('abort', onAbort);
      signal?.removeEventListener('abort', cancel);
      lookups.delete(controller);
    }
  }
  async function markUnread({ sessionId, clientId, selectedSessionId, viewEpoch }, signal) {
    syncConfig();
    if (!cfg.enabled) throw new Error('Notification plugin is disabled');
    if (!SESSION_ID.test(sessionId ?? '')) throw new Error('Invalid Session ID');
    if (clientId !== undefined && (typeof clientId !== 'string' || !clientId || clientId.length > 100 || !Number.isSafeInteger(viewEpoch) || viewEpoch < 0)) throw new Error('Invalid viewer revision');
    await assertKnownSession(sessionId, signal);
    signal?.throwIfAborted();
    if (disposed) throw new Error('Notification plugin was unloaded');
    syncConfig();
    if (!cfg.enabled) throw new Error('Notification plugin is disabled');
    const holds = new Map();
    for (const [id, v] of viewers) if (v.selectedSessionId === sessionId && Date.now() - v.at < 30000) holds.set(id, v.viewEpoch);
    if (clientId && selectedSessionId === sessionId) holds.set(clientId, viewEpoch);
    manualHolds.set(sessionId, holds); manualUnread.add(sessionId);
    unread.set(sessionId, Math.max(1, unread.get(sessionId) ?? 0));
    changed(); // A user-created unread flag never invokes the Toast path.
    log('manual unread: ' + sessionId + ' count=' + badgeState().count);
    return { sessionId, unread:unread.get(sessionId), pending:count().pending, count:badgeState().count };
  }
  const sessionActions = { markUnread, markRead };
  async function handle(request, action) {
    try {
      syncConfig();
      if (action === 'milestones' && request.method === 'GET') {
        const sessionId = new URL(request.url).searchParams.get('sessionId');
        if (!SESSION_ID.test(sessionId ?? '')) throw new Error('Invalid Session ID');
        await assertKnownSession(sessionId, request.signal);
        request.signal.throwIfAborted();
        if (disposed) throw new Error('Notification plugin was unloaded');
        return response(milestones.snapshot(sessionId));
      }
      if (request.method === 'GET') return response(status());
      const raw = await request.text();
      if (raw.length > 65536) return response({ error: 'Body too large' }, 413);
      const body = raw ? parse(raw) : {};
      if (action === 'milestones') {
        if (!cfg.enabled) throw new Error('Notification plugin is disabled');
        if (!['set','remove'].includes(body.op)) throw new Error('Invalid milestone operation');
        const row = validateMilestone(body, body.op === 'remove');
        await assertKnownSession(row.sessionId, request.signal);
        request.signal.throwIfAborted();
        if (disposed) throw new Error('Notification plugin was unloaded');
        syncConfig();
        if (!cfg.enabled) throw new Error('Notification plugin is disabled');
        return response(milestones.set(row, body.op === 'remove'));
      } else if (action === 'viewer') {
        if (typeof body.clientId !== 'string' || body.clientId.length > 100 || typeof body.focused !== 'boolean') return response({ error: 'Invalid viewer' }, 400);
        if (body.sessionId !== null && typeof body.sessionId !== 'string') return response({ error: 'Invalid Session ID' }, 400);
        if (body.viewEpoch !== undefined && (!Number.isSafeInteger(body.viewEpoch) || body.viewEpoch < 0)) return response({error:'Invalid viewer revision'},400);
        if (body.selectedSessionId !== undefined && body.selectedSessionId !== null && typeof body.selectedSessionId !== 'string') return response({error:'Invalid selected Session ID'},400);
        if (body.desktop !== undefined && typeof body.desktop !== 'boolean') return response({error:'Invalid desktop viewer'},400);
        const prior = viewers.get(body.clientId);
        readActivation();
        const target = activation && Date.now()-activation.at < 60000 ? activation.sessionId
          : navigationFence && Date.now()<navigationFence.until ? navigationFence.sessionId : null;
        const selectedSessionId = body.selectedSessionId === undefined ? body.sessionId ?? prior?.selectedSessionId ?? null : body.selectedSessionId;
        const viewEpoch = body.viewEpoch ?? (prior?.viewEpoch ?? 0) + (selectedSessionId !== (prior?.selectedSessionId ?? selectedSessionId) ? 1 : 0);
        viewers.set(body.clientId, { sessionId: body.sessionId, selectedSessionId, viewEpoch, focused: body.focused, desktop:body.desktop === true, at: Date.now() });
        for (const holds of manualHolds.values()) if (holds.has(body.clientId) && viewEpoch > holds.get(body.clientId)) holds.delete(body.clientId);
        if (prior?.sessionId !== body.sessionId || prior?.focused !== body.focused) log('viewer ' + (body.sessionId ?? 'none') + ' focused=' + body.focused);
        for (const [id, v] of viewers) if (Date.now() - v.at > 30000) viewers.delete(id);
        for (const row of Array.isArray(body.titles) ? body.titles.slice(0, 300) : []) if (typeof row.id === 'string' && typeof row.title === 'string') titles.set(row.id, compact(row.title, 200));
        let cleared = false;
        const canRead = !target || body.sessionId === target;
        if (body.focused && body.sessionId && canRead && !manualHolds.get(body.sessionId)?.has(body.clientId)) {
          cleared = unread.has(body.sessionId); sessionActions.markRead(body.sessionId);
        }
        if (body.focused && !prior?.focused && cfg.clearOnFocus && canRead) {
          for (const id of unread.keys()) if (!manualUnread.has(id)) { unread.delete(id); cleared = true; }
        }
        if (cleared) changed();
      } else if (action === 'activation') {
        if (typeof body.clientId !== 'string') return response({error:'Invalid activation client'},400);
        const pending = readActivation();
        if (body.ack && pending?.id === body.ack) {
          log('notification navigation acknowledged: ' + pending.sessionId);
          navigationFence = {sessionId:pending.sessionId,until:Date.now()+2500}; activation = null;
        }
        return response({activation:activation && Date.now()-activation.at < 60000 ? activation : null});
      } else if (action === 'clear') { unread.clear(); manualUnread.clear(); manualHolds.clear(); changed(); }
      else if (action === 'unread') {
        const result = await sessionActions.markUnread(body, request.signal);
        return response({ ...result, state:status() });
      }
      else if (action === 'viewed') { if (typeof body.sessionId === 'string') sessionActions.markRead(body.sessionId); }
      else if (action === 'test') {
        if (body.kind === 'badge') { unread.set('__test__', (unread.get('__test__') ?? 0) + 1); changed(); }
        else {
          const sid = typeof body.sessionId === 'string' ? body.sessionId : [...viewers.values()].find(x=>x.sessionId)?.sessionId;
          toast(body.kind ?? 'completion', 'DSH 测试通知', '点击打开 ' + (sid ? label(sid) : 'DeepSeek Harness'), true, sid);
        }
      }
      return response(status());
    } catch (err) { return response({ error: err.message }, 400); }
  }
  // The Connection carrier owns authentication and browser trust checks.
  for (const [action, methods] of [['status', ['GET']], ['milestones', ['GET','POST']], ['viewer', ['POST']], ['activation', ['POST']], ['unread', ['POST']], ['viewed', ['POST']], ['clear', ['POST']], ['test', ['POST']]]) ctx.effect(() => ctx.connection.fetch.register({
    path: '/api/dsh-notify-all/' + action, methods, requestBody: 'buffered', fetch: request => handle(request, action) }));
  // The menu and agent tool call the same Host operation and return the same result.
  ctx.inject(['tools'], toolCtx => toolCtx.effect(() => toolCtx.tools.register({
    name:'dsh_notify_mark_unread', description:'Mark one DSH conversation unread without sending a system notification. Repeated marking does not increase its count.',
    parameters:{ sessionId:{type:'string',required:true,description:'Exact session-UUID of the conversation.'} },
    output:{ schema:{type:'object',additionalProperties:false,properties:{
      sessionId:{type:'string',required:true}, unread:{type:'integer',required:true}, pending:{type:'integer',required:true}, count:{type:'integer',required:true},
    }}, render:(_args,value)=>[{type:'text',text:JSON.stringify(value)}] },
    execute:args=>sessionActions.markUnread(args),
  })));
  ctx.inject(['settings'], settingsCtx => {
    settingsCtx.effect(() => settingsCtx.settings.configure({ auto: false }, ctx.fiber));
    const migrate = async () => {
      if (migrationDone || migrating || disposed) return;
      const descriptor = settingsCtx.settings.describe().find(row => row.ns === name);
      if (!descriptor) { later(migrate, 1000); return; }
      migrating = true;
      try {
        const patch = Object.fromEntries(Object.entries(legacy).filter(([k]) => k in DEFAULTS && descriptor.user?.[k] === undefined));
        if (Object.keys(patch).length) await settingsCtx.settings.update(name, patch, descriptor.revision);
        migrationDone = true; atomic('settings-migrated.json', { at: Date.now(), version: '0.2.0' });
        syncConfig(); pushBadge(); log('legacy preferences migrated to DSH Settings');
      } catch (err) { log('settings migration: ' + err.message); }
      finally { migrating = false; }
    };
    later(migrate, 1000);
  });
  ctx.on('loader/volatile-update', () => { if (!disposed) { syncConfig(); pushBadge(); } });
  syncConfig();
  if (!dryRun) {
    const proc = launch('setup-native.ps1', {dir, exePath:process.execPath, key:activationKey, appId:APP_ID});
    nativeReady = new Promise((resolve,reject) => {
      proc.once('error',reject);
      proc.once('close',code => { log('native notification setup exit=' + code); if(code===0)resolve();else reject(new Error('native setup failed (' + code + ')')); });
    });
    void nativeReady.catch(error=>{notificationError=error.message;});
  }
  const heartbeat = setInterval(pushBadge, 3000); heartbeat.unref?.();
  ctx.effect(() => () => {
    disposed = true; clearInterval(heartbeat);
    for (const controller of lookups) controller.abort(new Error('Notification plugin was unloaded'));
    for (const timer of timers) clearTimeout(timer);
    viewers.clear();
    try { atomic('badge.json', badgeState(true)); } catch { /* Best effort shutdown. */ }
    for (const proc of children) if (proc !== child) proc.kill();
    const old = child;
    if (old && old.exitCode === null) { const timeout = setTimeout(() => old.kill(), 2000); timeout.unref?.(); }
  });
  pushBadge(); log('activated v0.3.0 (named turn milestones, independent notification state)');
}
