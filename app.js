'use strict';
/* =========================================================
   CALM GYM — Constancia · Actitud · Lucha · Mente. 100% local (IndexedDB).
   ========================================================= */

// ---------- utilidades ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const clone = o => JSON.parse(JSON.stringify(o));
const DAY = 864e5;
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const fmtDate = (ts, o) => new Date(ts).toLocaleDateString('es-ES', o);
const fmtTime = ts => new Date(ts).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const startOfDay = ts => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); };
const startOfWeek = ts => { const d = new Date(startOfDay(ts)); const k = (d.getDay() + 6) % 7; d.setDate(d.getDate() - k); return d.getTime(); };
const startOfMonth = ts => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth(), 1).getTime(); };
const addMonths = (ts, n) => { const d = new Date(ts); return new Date(d.getFullYear(), d.getMonth() + n, 1).getTime(); };

const MUSCLES = ['Pecho', 'Espalda', 'Hombros', 'Bíceps', 'Tríceps', 'Antebrazo', 'Cuádriceps', 'Isquios', 'Glúteos', 'Gemelos', 'Core', 'Cardio', 'Completo'];
const EQUIP = ['Barra', 'Mancuernas', 'Máquina', 'Polea', 'Peso corporal', 'Kettlebell', 'Banda', 'Otro'];
const TYPES = { w: 'Peso y repeticiones', r: 'Solo repeticiones', t: 'Tiempo', c: 'Distancia y tiempo' };
const SET_T = { n: 'Normal', w: 'Calentamiento', d: 'Drop set', f: 'Al fallo' };
const ACCENTS = ['#8B5CF6', '#0A84FF', '#30B0C7', '#34C759', '#FF9F0A', '#FF453A', '#FF375F', '#8E8E93'];
const LB = 2.20462;
const PLATES = { kg: [25, 20, 15, 10, 5, 2.5, 1.25, 0.5], lb: [45, 35, 25, 10, 5, 2.5] };
const PLATE_COL = { 25: '#FF3B30', 20: '#0A84FF', 15: '#FFCC00', 10: '#34C759', 5: '#8E8E93', 2.5: '#3A3A3C', 1.25: '#AEAEB2', 0.5: '#C7C7CC', 45: '#0A84FF', 35: '#FFCC00', '2.5lb': '#3A3A3C' };

const DEFAULT_SETTINGS = {
  theme: 'dark', accent: '#8B5CF6', textSize: 'm', density: 'comfy',
  unit: 'kg', rest: 90, autoRest: true, restSound: true, haptics: true, wakeLock: true,
  showPrev: true, showRpe: false, weekGoal: 3, increment: 2.5,
  bar: 20, plates: [25, 20, 15, 10, 5, 2.5, 1.25],
};

// ---------- estado ----------
let S;           // estado persistido
const U = {      // estado de interfaz (no se guarda)
  tab: 'train', ed: null, sheets: [], pick: null, form: {}, cal: startOfMonth(Date.now()),
  prog: 'sum', exq: '', libq: '', metric: 0, scroll: {},
};

function freshState() {
  return { v: 1, saved: 0, lastBackup: 0, settings: { ...DEFAULT_SETTINGS, brand2: true }, exercises: LIB.map(e => ({ ...e })), routines: [], workouts: [], body: [], active: null, rest: null };
}
const ID_RE = /^[\w-]{1,40}$/;
const okId = id => typeof id === 'string' && ID_RE.test(id);
const numOrNull = v => (typeof v === 'number' && isFinite(v)) ? v : null;
function cleanSet(x, keepDone) {
  x = x && typeof x === 'object' ? x : {};
  const o = { t: SET_T[x.t] ? x.t : 'n', kg: numOrNull(x.kg), reps: numOrNull(x.reps), sec: numOrNull(x.sec), km: numOrNull(x.km), rpe: numOrNull(x.rpe), done: keepDone ? !!x.done : false };
  if (x.ph && typeof x.ph === 'object') o.ph = { kg: numOrNull(x.ph.kg), reps: numOrNull(x.ph.reps), sec: numOrNull(x.ph.sec), km: numOrNull(x.ph.km) };
  if ('tr' in x) o.tr = numOrNull(x.tr);
  return o;
}
function cleanItems(items, keepDone) {
  return (Array.isArray(items) ? items : []).filter(i => i && okId(i.exId)).map(i => {
    const o = {}; if (i.id !== undefined || keepDone) o.id = okId(i.id) ? i.id : uid();
    Object.assign(o, { exId: i.exId, rest: numOrNull(i.rest), note: String(i.note || ''), sets: (Array.isArray(i.sets) ? i.sets : []).map(x => cleanSet(x, keepDone)) });
    if (i.up !== undefined) o.up = !!i.up; return o;
  });
}
function normalize(st) {
  const f = freshState();
  st = st && typeof st === 'object' ? st : {};
  const hadBrand = !!(st.settings && st.settings.brand2);
  const out = f;
  out.saved = numOrNull(st.saved) || 0; out.lastBackup = numOrNull(st.lastBackup) || 0;
  out.settings = Object.assign({ ...DEFAULT_SETTINGS }, st.settings && typeof st.settings === 'object' ? st.settings : {});
  const s = out.settings;
  if (!['auto', 'light', 'dark'].includes(s.theme)) s.theme = DEFAULT_SETTINGS.theme;
  if (!/^#[0-9A-Fa-f]{6}$/.test(s.accent)) s.accent = DEFAULT_SETTINGS.accent;
  if (!['s', 'm', 'l', 'xl'].includes(s.textSize)) s.textSize = 'm';
  if (!['comfy', 'compact'].includes(s.density)) s.density = 'comfy';
  if (!['kg', 'lb'].includes(s.unit)) s.unit = 'kg';
  ['rest', 'weekGoal', 'increment', 'bar'].forEach(k => { if (typeof s[k] !== 'number' || !isFinite(s[k]) || s[k] < 0) s[k] = DEFAULT_SETTINGS[k]; });
  s.weekGoal = Math.max(1, Math.min(7, Math.round(s.weekGoal)));
  if (!Array.isArray(s.plates)) s.plates = [...DEFAULT_SETTINGS.plates];
  s.plates = s.plates.filter(p => typeof p === 'number' && p > 0);
  // marca morado y negro: se aplica una sola vez a quien tenía los colores de origen
  if (!hadBrand) { if (s.accent === '#0A84FF') s.accent = '#8B5CF6'; if (s.theme === 'auto') s.theme = 'dark'; }
  s.brand2 = true;
  if (Array.isArray(st.exercises)) out.exercises = st.exercises.filter(e => e && okId(e.id) && typeof e.name === 'string').map(e => ({ id: e.id, name: e.name.slice(0, 80), muscle: MUSCLES.includes(e.muscle) ? e.muscle : 'Completo', equip: EQUIP.includes(e.equip) ? e.equip : 'Otro', type: TYPES[e.type] ? e.type : 'w', ...(e.custom ? { custom: true } : {}), ...(e.hidden ? { hidden: true } : {}) }));
  out.routines = (Array.isArray(st.routines) ? st.routines : []).filter(r => r && typeof r === 'object').map(r => ({ id: okId(r.id) ? r.id : uid(), name: String(r.name || 'Rutina'), note: String(r.note || ''), items: cleanItems(r.items, false) }));
  out.workouts = (Array.isArray(st.workouts) ? st.workouts : []).filter(w => w && numOrNull(w.start)).map(w => ({ id: okId(w.id) ? w.id : uid(), name: String(w.name || 'Entreno'), routineId: okId(w.routineId) ? w.routineId : null, start: w.start, end: numOrNull(w.end) && w.end >= w.start ? w.end : w.start, note: String(w.note || ''), items: cleanItems(w.items, true), prs: Array.isArray(w.prs) ? w.prs.filter(p => p && typeof p === 'object').map(p => ({ name: String(p.name || ''), kind: String(p.kind || ''), val: String(p.val || '') })) : [] }));
  out.body = (Array.isArray(st.body) ? st.body : []).filter(b => b && numOrNull(b.date)).map(b => { const o = { id: okId(b.id) ? b.id : uid(), date: b.date, weight: numOrNull(b.weight) }; ['fat', 'waist', 'chest', 'arm', 'thigh', 'hips'].forEach(k => { if (numOrNull(b[k]) != null) o[k] = b[k]; }); return o; });
  const a = st.active;
  out.active = a && typeof a === 'object' && numOrNull(a.start) ? { id: okId(a.id) ? a.id : uid(), name: String(a.name || 'Entreno'), routineId: okId(a.routineId) ? a.routineId : null, start: a.start, end: null, note: String(a.note || ''), items: cleanItems(a.items, true) } : null;
  out.rest = out.active && st.rest && numOrNull(st.rest.end) && numOrNull(st.rest.total) ? { end: st.rest.end, total: st.rest.total } : null;
  st = out;
  const ids = new Set(st.exercises.map(e => e.id));
  LIB.forEach(e => { if (!ids.has(e.id)) st.exercises.push({ ...e }); });
  st.workouts.sort((a, b) => b.start - a.start);
  st.body.sort((a, b) => b.date - a.date);
  return st;
}
function recomputePRs() {
  const keep = S.workouts;
  const asc = [...keep].sort((a, b) => a.start - b.start);
  // calcula cada entreno contra los anteriores a él
  asc.forEach(w => { w.prs = detectPRs(w); });
}

// ---------- almacenamiento (IndexedDB + respaldo localStorage) ----------
const DB = {
  db: null,
  open() {
    return new Promise(res => {
      try {
        const r = indexedDB.open('gym', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => { this.db = r.result; res(); };
        r.onerror = () => res();
      } catch (e) { res(); }
    });
  },
  get(k) {
    return new Promise(res => {
      if (!this.db) return res(null);
      try { const q = this.db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result ?? null); q.onerror = () => res(null); }
      catch (e) { res(null); }
    });
  },
  set(k, v) { if (!this.db) return; try { this.db.transaction('kv', 'readwrite').objectStore('kv').put(v, k); } catch (e) { } },
};
let saveTimer;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 250); }
function saveNow() {
  clearTimeout(saveTimer);
  S.saved = Date.now();
  const json = JSON.stringify(S);
  DB.set('state', json);
  try { localStorage.setItem('gym-state', json); } catch (e) { }
}
async function load() {
  await DB.open();
  let a = null, b = null;
  try { a = JSON.parse(await DB.get('state')); } catch (e) { }
  try { b = JSON.parse(localStorage.getItem('gym-state')); } catch (e) { }
  const best = [a, b].filter(Boolean).sort((x, y) => (y.saved || 0) - (x.saved || 0))[0];
  S = normalize(best);
  try { if (navigator.storage && navigator.storage.persist) U.persisted = await navigator.storage.persist(); } catch (e) { }
}

// ---------- números y unidades ----------
const unit = () => S.settings.unit;
const toDisp = kg => kg == null ? null : (unit() === 'lb' ? kg * LB : kg);
const fromDisp = v => v == null ? null : (unit() === 'lb' ? v / LB : v);
const nf = (n, d = 1) => (n == null || isNaN(n)) ? '' : (+(+n).toFixed(d)).toLocaleString('es-ES', { maximumFractionDigits: d });
const numIn = n => (n == null || isNaN(n)) ? '' : String(+(+n).toFixed(2)).replace('.', ',');
const parseNum = s => { if (s == null) return null; s = String(s).trim().replace(',', '.'); if (s === '') return null; const n = parseFloat(s); return isNaN(n) ? null : n; };
const fmtW = kg => nf(toDisp(kg), unit() === 'lb' ? 1 : 2);
const fmt1 = kg => nf(toDisp(kg), 1);
const fmtVol = kg => { const v = toDisp(kg) || 0; if (unit() === 'kg' && v >= 10000) return nf(v / 1000, 1) + ' t'; return nf(v, 0) + ' ' + unit(); };
const fmtDur = ms => { const m = Math.max(0, Math.round(ms / 60000)); const h = Math.floor(m / 60); return h ? `${h} h ${m % 60} min` : `${m} min`; };
const clock = ms => { const s = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(x).padStart(2, '0'); };
const restLabel = s => !s ? 'Sin descanso' : (s >= 60 ? Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') : s + ' s');
const e1rm = (kg, reps) => !reps || reps <= 0 ? 0 : (reps === 1 ? kg : kg * (1 + reps / 30));
const rel = ts => {
  const d = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / DAY);
  if (d <= 0) return 'hoy'; if (d === 1) return 'ayer'; if (d < 7) return `hace ${d} días`;
  if (d < 30) { const w = Math.round(d / 7); return `hace ${w} ${w > 1 ? 'semanas' : 'semana'}`; }
  return fmtDate(ts, { day: 'numeric', month: 'short' });
};

// ---------- ejercicios y series ----------
const getEx = id => S.exercises.find(e => e.id === id) || { id, name: 'Ejercicio eliminado', muscle: '', equip: '', type: 'w' };
const exType = id => getEx(id).type || 'w';
function fieldsFor(t) {
  if (t === 'r') return [{ k: 'reps', l: 'Reps', im: 'numeric' }];
  if (t === 't') return [{ k: 'sec', l: 'Seg', im: 'numeric' }];
  if (t === 'c') return [{ k: 'km', l: 'Km', im: 'decimal' }, { k: 'min', l: 'Min', im: 'decimal' }];
  return [{ k: 'kg', l: unit(), im: 'decimal' }, { k: 'reps', l: 'Reps', im: 'numeric' }];
}
function valOf(o, k) {
  if (!o) return '';
  if (k === 'kg') return o.kg == null ? '' : numIn(toDisp(o.kg));
  if (k === 'min') return o.sec == null ? '' : numIn(o.sec / 60);
  return o[k] == null ? '' : numIn(o[k]);
}
function setField(o, k, raw) {
  let n = parseNum(raw);
  if (n != null) { n = Math.max(0, Math.min(n, k === 'rpe' ? 10 : 99999)); }
  if (k === 'kg') o.kg = n == null ? null : fromDisp(n);
  else if (k === 'min') o.sec = n == null ? null : Math.round(n * 60);
  else if (k === 'reps' || k === 'sec') o[k] = n == null ? null : Math.round(n);
  else o[k] = n;
}
const newSet = (t = 'n') => ({ t, kg: null, reps: null, sec: null, km: null, rpe: null, done: false });
function setText(s, t) {
  if (!s) return '—';
  if (t === 'r') return s.reps != null ? `× ${s.reps}` : '—';
  if (t === 't') return s.sec != null ? (s.sec >= 60 ? clock(s.sec * 1000) : s.sec + ' s') : '—';
  if (t === 'c') { const p = []; if (s.km != null) p.push(nf(s.km, 2) + ' km'); if (s.sec != null) p.push(Math.round(s.sec / 60) + '′'); return p.join(' · ') || '—'; }
  if (s.reps == null && s.kg == null) return '—';
  if (s.kg == null) return `× ${s.reps}`;
  return `${fmtW(s.kg)} × ${s.reps ?? '—'}`;
}
const setLabel = (sets, j) => { const s = sets[j]; if (s.t === 'w') return 'C'; if (s.t === 'd') return 'D'; if (s.t === 'f') return 'F'; let n = 0; for (let k = 0; k <= j; k++) if (sets[k].t !== 'w') n++; return n; };
const isWork = s => s.done && s.t !== 'w';

function lastPerf(exId, excludeId) {
  for (const w of S.workouts) {
    if (w.id === excludeId) continue;
    const it = w.items.find(i => i.exId === exId);
    if (it) { const sets = it.sets.filter(s => s.done); if (sets.length) return { w, sets }; }
  }
  return null;
}
const wVol = w => w.items.reduce((a, it) => a + (exType(it.exId) === 'w' ? it.sets.filter(isWork).reduce((b, s) => b + (s.kg || 0) * (s.reps || 0), 0) : 0), 0);
const wSets = w => w.items.reduce((a, it) => a + it.sets.filter(s => s.done).length, 0);
function bestSetText(it) {
  const t = exType(it.exId); const ss = it.sets.filter(s => s.done);
  if (!ss.length) return '';
  if (t === 'w') { const b = ss.reduce((a, s) => e1rm(s.kg || 0, s.reps) > e1rm(a.kg || 0, a.reps) ? s : a, ss[0]); return setText(b, t); }
  if (t === 'r') return setText(ss.reduce((a, s) => (s.reps || 0) > (a.reps || 0) ? s : a, ss[0]), t);
  if (t === 't') return setText(ss.reduce((a, s) => (s.sec || 0) > (a.sec || 0) ? s : a, ss[0]), t);
  return setText(ss[0], t);
}
function recentExIds(n = 6) {
  const out = [];
  for (const w of S.workouts) for (const it of w.items) { if (!out.includes(it.exId)) out.push(it.exId); if (out.length >= n) return out; }
  return out;
}
function exSessions(exId) {
  const out = [];
  for (const w of S.workouts) for (const it of w.items) if (it.exId === exId) { const sets = it.sets.filter(s => s.done); if (sets.length) out.push({ w, it, sets }); }
  return out.sort((a, b) => a.w.start - b.w.start);
}
function exUsed(id) { return (U.ed && U.ed.draft && U.ed.draft.items.some(i => i.exId === id)) || S.workouts.some(w => w.items.some(i => i.exId === id)) || S.routines.some(r => r.items.some(i => i.exId === id)) || (S.active && S.active.items.some(i => i.exId === id)); }

// ---------- récords ----------
function bestsBefore(exId, before) {
  const b = { kg: 0, e: 0, reps: 0, sec: 0, km: 0, any: false };
  for (const w of S.workouts) {
    if (w.start >= before) continue;
    for (const it of w.items) if (it.exId === exId) for (const s of it.sets) if (isWork(s)) {
      b.any = true; b.kg = Math.max(b.kg, s.reps ? s.kg || 0 : 0); b.e = Math.max(b.e, e1rm(s.kg || 0, s.reps));
      b.reps = Math.max(b.reps, s.reps || 0); b.sec = Math.max(b.sec, s.sec || 0); b.km = Math.max(b.km, s.km || 0);
    }
  }
  return b;
}
function detectPRs(w) {
  const out = [];
  for (const it of w.items) {
    const t = exType(it.exId), ss = it.sets.filter(isWork); if (!ss.length) continue;
    const b = bestsBefore(it.exId, w.start); if (!b.any) continue;
    const name = getEx(it.exId).name;
    if (t === 'w') {
      const mk = Math.max(...ss.map(s => s.reps ? s.kg || 0 : 0)), me = Math.max(...ss.map(s => e1rm(s.kg || 0, s.reps)));
      if (mk > b.kg + 1e-6) out.push({ name, kind: 'Peso máximo', val: fmtW(mk) + ' ' + unit() });
      else if (me > b.e + 1e-6) out.push({ name, kind: '1RM estimado', val: fmt1(me) + ' ' + unit() });
    } else if (t === 'r') { const m = Math.max(...ss.map(s => s.reps || 0)); if (m > b.reps) out.push({ name, kind: 'Más repeticiones', val: m + ' reps' }); }
    else if (t === 't') { const m = Math.max(...ss.map(s => s.sec || 0)); if (m > b.sec) out.push({ name, kind: 'Más tiempo', val: setText({ sec: m }, 't') }); }
    else if (t === 'c') { const m = Math.max(...ss.map(s => s.km || 0)); if (m > b.km) out.push({ name, kind: 'Más distancia', val: nf(m, 2) + ' km' }); }
  }
  return out;
}
function prEvents() {
  const best = {}, ev = [];
  [...S.workouts].sort((a, b) => a.start - b.start).forEach(w => w.items.forEach(it => {
    if (exType(it.exId) !== 'w') return;
    let m = 0; it.sets.forEach(s => { if (isWork(s)) m = Math.max(m, e1rm(s.kg || 0, s.reps)); });
    if (m <= 0) return;
    if (best[it.exId] != null && m > best[it.exId] + 1e-6) ev.push({ date: w.start, exId: it.exId, val: m, wid: w.id });
    if (best[it.exId] == null || m > best[it.exId]) best[it.exId] = m;
  }));
  return ev.reverse();
}
const prCount = w => (w.prs || []).length;

// ---------- iconos ----------
const svg = (p, s = 22, w = 1.8) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
const P = {
  train: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  hist: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  prog: '<path d="M4 4v15.5h16"/><path d="M8 15l3.5-4 3 2.5L20 7"/>',
  set: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  more: '<circle cx="6" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="18" cy="12" r="1.2" fill="currentColor"/>',
  down: '<path d="M6 9.5l6 6 6-6"/>', right: '<path d="M9.5 6l6 6-6 6"/>', left: '<path d="M14.5 6l-6 6 6 6"/>',
  close: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4zM8 6H5.5a2.5 2.5 0 0 0 2.5 3.5M16 6h2.5A2.5 2.5 0 0 1 16 9.5M12 13v4M8.5 20h7M10 17h4"/>',
  timer: '<circle cx="12" cy="13.5" r="7"/><path d="M12 10v3.5l2.2 1.5M10 3h4"/>',
  note: '<path d="M5 4.5h14v15H5zM8.5 9h7M8.5 12.5h7M8.5 16h4"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>', dn: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  trash: '<path d="M4.5 7h15M10 7V4.5h4V7M6.5 7l1 13h9l1-13"/>',
  swap: '<path d="M7 7h12l-3-3M17 17H5l3 3"/>',
  calc: '<rect x="5" y="3.5" width="14" height="17" rx="2.5"/><path d="M8.5 7.5h7M8.5 12h.01M12 12h.01M15.5 12h.01M8.5 16h.01M12 16h.01M15.5 16h.01"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>',
  play: '<path d="M8 5.5v13l10-6.5z" fill="currentColor"/>',
  edit: '<path d="M4.5 19.5l1-4L16 5l3 3L8.5 18.5zM14 7l3 3"/>',
  repeat: '<path d="M17 3l3 3-3 3M4 11V9a3 3 0 0 1 3-3h13M7 21l-3-3 3-3M20 13v2a3 3 0 0 1-3 3H4"/>',
  save: '<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>', open: '<path d="M12 15V4M7 9l5-5 5 5M5 20h14"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01"/>',
  scale: '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M9 9.5a4 4 0 0 1 6 0l-2 2.5"/>',
  bolt: '<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z"/>',
  shield: '<path d="M12 3.5l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9v-5z"/>',
  sparkle: '<path d="M12 4l1.8 4.7L18.5 10.5l-4.7 1.8L12 17l-1.8-4.7L5.5 10.5l4.7-1.8z"/>',
};
const ic = (n, s, w) => svg(P[n], s, w);

// ---------- feedback ----------
let actx;
function audioUnlock() {
  try {
    if (!actx) { actx = new (window.AudioContext || window.webkitAudioContext)(); if (navigator.audioSession) navigator.audioSession.type = 'ambient'; }
    if (actx.state === 'suspended') actx.resume();
  } catch (e) { }
}
function beep() {
  if (!S.settings.restSound || !actx) return;
  try {
    const t = actx.currentTime;
    [0, .22, .44].forEach((d, k) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = 'sine'; o.frequency.value = k === 2 ? 1318 : 988; o.connect(g); g.connect(actx.destination);
      g.gain.setValueAtTime(.0001, t + d); g.gain.exponentialRampToValueAtTime(.35, t + d + .02); g.gain.exponentialRampToValueAtTime(.0001, t + d + .18);
      o.start(t + d); o.stop(t + d + .2);
    });
  } catch (e) { }
}
let hapLabel;
function hap() {
  if (!S.settings.haptics) return;
  try {
    if (navigator.vibrate) { navigator.vibrate(12); return; }
    // iOS 18+: un <input switch> produce vibración háptica al pulsarse
    if (!hapLabel) {
      const w = document.createElement('div'); w.style.cssText = 'position:fixed;left:-99px;top:-99px;opacity:0;pointer-events:none';
      w.innerHTML = '<input type="checkbox" switch id="hapsw"><label for="hapsw"></label>';
      document.body.append(w); hapLabel = w.querySelector('label');
    }
    hapLabel.click();
  } catch (e) { }
}
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2000); }
let wake = null;
async function requestWake() { if (!S.settings.wakeLock || !S.active || !('wakeLock' in navigator)) return; try { wake = await navigator.wakeLock.request('screen'); } catch (e) { } }
function releaseWake() { try { wake && wake.release(); } catch (e) { } wake = null; }

// ---------- tema ----------
function applyTheme() {
  const s = S.settings, root = document.documentElement;
  const dark = s.theme === 'dark' || (s.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  root.classList.toggle('dark', dark);
  root.classList.toggle('compact', s.density === 'compact');
  root.style.setProperty('--accent', s.accent);
  root.style.setProperty('--fs', { s: '15px', m: '16px', l: '17.5px', xl: '19px' }[s.textSize] || '16px');
  document.querySelectorAll('meta[name=theme-color]').forEach(m => m.content = dark ? '#000000' : '#F2F2F7');
}

/* =========================================================
   VISTAS PRINCIPALES
   ========================================================= */
function weekInfo() {
  const ws = startOfWeek(Date.now()), today = startOfDay(Date.now());
  const L = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const days = L.map((l, k) => {
    const d = new Date(ws); d.setDate(d.getDate() + k); const t = d.getTime();
    return { l, n: d.getDate(), today: t === today, done: S.workouts.some(w => startOfDay(w.start) === t) };
  });
  return { days, count: S.workouts.filter(w => w.start >= ws).length };
}
const backupDue = () => S.workouts.length >= 3 && Date.now() - (S.lastBackup || 0) > 14 * DAY && Date.now() - (U.backupDismiss || 0) > DAY;

function vTrain() {
  const s = S.settings, wk = weekInfo();
  let h = `<header class="top"><p class="sub">${cap(fmtDate(Date.now(), { weekday: 'long', day: 'numeric', month: 'long' }))}</p><h1 class="title">Entrenar</h1></header>`;
  if (backupDue()) h += `<div class="banner"><span class="icon-btn fill acc">${ic('shield', 18)}</span><div class="li-t"><b>Haz una copia</b><span>Tus datos solo viven en este iPhone.</span></div><button class="link strong" data-a="exportJSON">Copiar</button><button class="icon-btn" data-a="dismissBackup">${ic('close', 16)}</button></div>`;
  h += `<div class="card weekcard"><div class="wk-h"><span>Esta semana</span><b class="tnum">${wk.count}<small> / ${s.weekGoal}</small></b></div><div class="week">${wk.days.map(d => `<div class="wd${d.done ? ' done' : ''}${d.today ? ' today' : ''}"><span>${d.l}</span><i>${d.n}</i></div>`).join('')}</div></div>`;
  if (S.active) h += `<button class="live" data-a="resume"><span class="dot"></span><div class="li-t"><b>${esc(S.active.name)}</b><span>En curso · <span data-elapsed>${clock(Date.now() - S.active.start)}</span></span></div>${ic('right', 20)}</button>`;
  else h += `<button class="btn pri" data-a="startEmpty">${ic('plus', 20, 2.2)} Empezar entreno vacío</button>`;
  h += `<div class="sh"><span>Rutinas</span>${S.routines.length ? `<button class="icon-btn fill acc" data-a="newRoutine">${ic('plus', 20, 2.2)}</button>` : ''}</div>`;
  if (!S.routines.length) {
    h += `<div class="empty"><b>Aún no tienes rutinas</b><p>Guarda tus entrenos habituales para empezarlos con un toque.</p><button class="btn pri" data-a="newRoutine">Crear rutina</button><button class="btn ghost" data-a="samples">Usar ejemplos: Empuje · Tirón · Pierna</button></div>`;
  } else h += `<div class="stack">${S.routines.map(rCard).join('')}</div>`;
  return h;
}
function rCard(r) {
  const last = S.workouts.find(w => w.routineId === r.id);
  const names = r.items.map(i => getEx(i.exId).name).join(' · ') || 'Sin ejercicios';
  const sets = r.items.reduce((a, i) => a + i.sets.length, 0);
  return `<button class="rc" data-a="rPrev" data-id="${r.id}"><div class="rc-h"><b>${esc(r.name)}</b><span class="icon-btn" data-a="rMenu" data-id="${r.id}">${ic('more', 20)}</span></div><p class="rc-ex">${esc(names)}</p><p class="rc-m">${r.items.length} ejercicios · ${sets} series${last ? ' · ' + rel(last.start) : ''}</p></button>`;
}

function vHist() {
  let h = `<header class="top"><h1 class="title">Historial</h1></header>`;
  if (!S.workouts.length) return h + `<div class="empty"><b>Nada por aquí todavía</b><p>Cuando termines tu primer entreno aparecerá en este calendario.</p></div>`;
  const m0 = U.cal, m1 = addMonths(m0, 1), md = new Date(m0);
  const inMonth = S.workouts.filter(w => w.start >= m0 && w.start < m1);
  const daysWith = new Set(inMonth.map(w => new Date(w.start).getDate()));
  const offset = (md.getDay() + 6) % 7, nDays = new Date(md.getFullYear(), md.getMonth() + 1, 0).getDate();
  const today = new Date(); const isCur = today.getFullYear() === md.getFullYear() && today.getMonth() === md.getMonth();
  let cal = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => `<span class="dn">${d}</span>`).join('');
  for (let k = 0; k < offset; k++) cal += '<span></span>';
  for (let d = 1; d <= nDays; d++) cal += `<span class="d${daysWith.has(d) ? ' has' : ''}${isCur && today.getDate() === d ? ' today' : ''}">${d}</span>`;
  const dur = inMonth.reduce((a, w) => a + (w.end - w.start), 0), vol = inMonth.reduce((a, w) => a + wVol(w), 0);
  h += `<div class="card"><div class="cal-h"><button class="icon-btn fill" data-a="calNav" data-d="-1">${ic('left', 18)}</button><b>${cap(fmtDate(m0, { month: 'long', year: 'numeric' }))}</b><button class="icon-btn fill" data-a="calNav" data-d="1" ${isCur ? 'disabled' : ''}>${ic('right', 18)}</button></div><div class="cal">${cal}</div>
    <div class="month-sum"><div><b>${inMonth.length}</b>entrenos</div><div><b>${fmtDur(dur)}</b>tiempo</div><div><b>${fmtVol(vol)}</b>volumen</div></div></div>`;
  h += inMonth.length ? `<div class="stack" style="margin-top:12px">${inMonth.map(wCard).join('')}</div>` : `<div class="empty plain"><p>Sin entrenos este mes</p></div>`;
  return h;
}
function wCard(w) {
  const prs = prCount(w);
  const items = w.items.slice(0, 4).map(it => `<li><span>${it.sets.filter(s => s.done).length}×</span><span class="n" style="color:var(--text);min-width:0">${esc(getEx(it.exId).name)}</span><em>${bestSetText(it)}</em></li>`).join('');
  return `<button class="wc" data-a="wDetail" data-id="${w.id}"><div class="wc-h"><b>${esc(w.name)}</b><span>${cap(fmtDate(w.start, { weekday: 'short', day: 'numeric' }))}</span></div>
    <div class="wc-m"><span>${fmtDur(w.end - w.start)}</span><span>${fmtVol(wVol(w))}</span>${prs ? `<span class="pr">${ic('trophy', 13, 2)}${prs}</span>` : ''}</div>
    <ul class="wc-ex">${items}${w.items.length > 4 ? `<li><span></span><span class="muted">+${w.items.length - 4} más</span></li>` : ''}</ul></button>`;
}

function vProg() {
  let h = `<header class="top"><h1 class="title">Progreso</h1></header>`;
  h += `<div class="seg full">${[['sum', 'Resumen'], ['ex', 'Ejercicios'], ['body', 'Cuerpo']].map(([k, l]) => `<button class="${U.prog === k ? 'on' : ''}" data-a="progTab" data-v="${k}">${l}</button>`).join('')}</div>`;
  if (U.prog === 'sum') h += vProgSum();
  else if (U.prog === 'ex') h += `<input class="search" data-f="exq" placeholder="Buscar ejercicio" value="${esc(U.exq)}" autocomplete="off"><div id="exList">${exListHTML()}</div>`;
  else h += vBody();
  return h;
}
function vProgSum() {
  if (!S.workouts.length) return `<div class="empty"><b>Tu progreso aparecerá aquí</b><p>Entrena unos días y verás tu constancia, volumen y récords.</p></div>`;
  const since = Date.now() - 30 * DAY, last = S.workouts.filter(w => w.start >= since);
  let h = `<div class="sh sm" style="margin-top:0">Últimos 30 días</div><div class="stats"><div class="stat"><b>${last.length}</b><span>Entrenos</span></div><div class="stat"><b>${fmtDur(last.reduce((a, w) => a + w.end - w.start, 0)).replace(' min', ' m')}</b><span>Tiempo</span></div><div class="stat"><b>${fmtVol(last.reduce((a, w) => a + wVol(w), 0))}</b><span>Volumen</span></div></div>`;
  // entrenos por semana (12 semanas)
  const ws = startOfWeek(Date.now()), vals = [], labels = [];
  for (let k = 11; k >= 0; k--) { const da = new Date(ws); da.setDate(da.getDate() - k * 7); const a = da.getTime(); const db = new Date(a); db.setDate(db.getDate() + 7); const b = db.getTime(); vals.push(S.workouts.filter(w => w.start >= a && w.start < b).length); labels.push(fmtDate(a, { day: 'numeric', month: 'numeric' })); }
  h += `<div class="card" style="margin-top:10px"><div class="card-t">Entrenos por semana<span>Objetivo ${S.settings.weekGoal}</span></div>${barChart(vals, labels, S.settings.weekGoal)}</div>`;
  // series por músculo
  const mc = {};
  last.forEach(w => w.items.forEach(it => { const m = getEx(it.exId).muscle || 'Otro'; mc[m] = (mc[m] || 0) + it.sets.filter(isWork).length; }));
  const arr = Object.entries(mc).filter(e => e[1] > 0).sort((a, b) => b[1] - a[1]); const mx = arr.length ? arr[0][1] : 1;
  if (arr.length) h += `<div class="card"><div class="card-t">Series por músculo<span>30 días</span></div>${arr.map(([m, n]) => `<div class="mb"><span>${m}</span><div class="mb-t"><i style="width:${n / mx * 100}%"></i></div><b>${n}</b></div>`).join('')}</div>`;
  const ev = prEvents().slice(0, 5);
  if (ev.length) h += `<div class="sh sm">Récords recientes</div><div class="list">${ev.map(e => `<button class="li tap" data-a="exDetail" data-id="${e.exId}"><span class="ico" style="color:var(--warm)">${ic('trophy', 16, 2)}</span><div class="li-t"><b>${esc(getEx(e.exId).name)}</b><span>1RM est. ${fmt1(e.val)} ${unit()} · ${rel(e.date)}</span></div><span class="chev">${ic('right', 16)}</span></button>`).join('')}</div>`;
  return h;
}
function exListHTML() {
  const q = norm(U.exq); const seen = new Map();
  S.workouts.forEach(w => w.items.forEach(it => { if (it.sets.some(s => s.done)) { const o = seen.get(it.exId) || { n: 0, last: 0 }; o.n++; o.last = Math.max(o.last, w.start); seen.set(it.exId, o); } }));
  const rows = [...seen.entries()].filter(([id]) => !q || norm(getEx(id).name).includes(q)).sort((a, b) => b[1].last - a[1].last);
  if (!rows.length) return `<div class="empty plain"><p>${seen.size ? 'Sin resultados' : 'Aún no hay ejercicios registrados'}</p></div>`;
  return `<div class="list">${rows.map(([id, o]) => `<button class="li tap" data-a="exDetail" data-id="${id}"><div class="li-t"><b>${esc(getEx(id).name)}</b><span>${o.n} ${o.n > 1 ? 'sesiones' : 'sesión'} · ${rel(o.last)}</span></div><span class="chev">${ic('right', 16)}</span></button>`).join('')}</div>`;
}
function vBody() {
  const B = S.body;
  let h = '';
  if (!B.length) return `<div class="empty"><b>Registra tu peso y medidas</b><p>Opcional. Te ayuda a ver la tendencia junto a tu fuerza.</p><button class="btn pri" data-a="bodyAdd">Añadir registro</button></div>`;
  const withW = B.filter(b => b.weight != null), lw = withW[0];
  if (lw) {
    const ref = withW.find(b => b.date <= lw.date - 28 * DAY); const dlt = ref ? toDisp(lw.weight) - toDisp(ref.weight) : null;
    h += `<div class="card"><div class="card-t">Peso corporal<span>${rel(lw.date)}</span></div><div class="big-num">${fmt1(lw.weight)}<small>${unit()}</small> ${dlt != null ? `<span class="delta">${dlt > 0 ? '+' : ''}${nf(dlt, 1)} en 4 sem.</span>` : ''}</div>
      ${lineChart([...withW].reverse().map(b => ({ x: b.date, y: toDisp(b.weight) })), v => nf(v, 1))}</div>`;
  }
  const M = [['fat', '% grasa', '%'], ['waist', 'Cintura', 'cm'], ['chest', 'Pecho', 'cm'], ['arm', 'Brazo', 'cm'], ['thigh', 'Muslo', 'cm'], ['hips', 'Cadera', 'cm']];
  const latest = M.map(([k, l, u]) => { const e = B.find(b => b[k] != null); return e ? `<div class="stat"><b>${nf(e[k], 1)}<small style="font-size:.75rem;color:var(--text2)"> ${u}</small></b><span>${l}</span></div>` : ''; }).filter(Boolean);
  if (latest.length) h += `<div class="stats" style="margin-top:10px">${latest.join('')}</div>`;
  h += `<button class="btn sec" data-a="bodyAdd" style="margin-top:12px">${ic('plus', 20, 2.2)} Añadir registro</button>`;
  h += `<div class="sh sm">Registros</div><div class="list">${B.slice(0, 40).map(b => `<button class="li tap" data-a="bodyAdd" data-id="${b.id}"><div class="li-t"><b>${b.weight != null ? fmt1(b.weight) + ' ' + unit() : 'Medidas'}</b><span>${M.filter(m => b[m[0]] != null).map(m => m[1] + ' ' + nf(b[m[0]], 1)).join(' · ') || '—'}</span></div><span class="val small">${fmtDate(b.date, { day: 'numeric', month: 'short', year: '2-digit' })}</span></button>`).join('')}</div>`;
  return h;
}

function vSet() {
  const s = S.settings;
  const seg = (k, opts) => `<div class="seg">${opts.map(([v, l]) => `<button class="${s[k] === v ? 'on' : ''}" data-a="setv" data-k="${k}" data-v="${v}">${l}</button>`).join('')}</div>`;
  const tog = k => `<input type="checkbox" class="sw" data-set="${k}" ${s[k] ? 'checked' : ''}>`;
  const row = (l, c, sub) => `<div class="li"><div class="li-t lbl"><b>${l}</b>${sub ? `<span>${sub}</span>` : ''}</div>${c}</div>`;
  const nav = (a, l, val, icn) => `<button class="li tap" data-a="${a}">${icn ? `<span class="ico">${ic(icn, 16, 2)}</span>` : ''}<span class="lbl">${l}</span>${val ? `<span class="val">${val}</span>` : ''}<span class="chev">${ic('right', 16)}</span></button>`;
  const restOpts = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300].map(v => `<option value="${v}" ${s.rest === v ? 'selected' : ''}>${restLabel(v)}</option>`).join('');
  const incOpts = (unit() === 'kg' ? [0.5, 1, 1.25, 2.5, 5] : [1, 2.5, 5, 10]).map(v => `<option value="${v}" ${s.increment === v ? 'selected' : ''}>${nf(v, 2)} ${unit()}</option>`).join('');
  let h = `<header class="top"><h1 class="title">Ajustes</h1></header>`;
  h += `<div class="sh sm">Apariencia</div><div class="list">
    ${row('Tema', seg('theme', [['auto', 'Auto'], ['light', 'Claro'], ['dark', 'Oscuro']]))}
    <div class="li" style="flex-direction:column;align-items:stretch;gap:10px"><b style="font-weight:500">Color</b><div class="swatches">${ACCENTS.map(c => `<button class="swatch${s.accent === c ? ' on' : ''}" style="--c:${c}" data-a="accent" data-v="${c}"></button>`).join('')}</div></div>
    ${row('Tamaño de texto', seg('textSize', [['s', 'A'], ['m', 'A+'], ['l', 'A++'], ['xl', 'A+++']]))}
    ${row('Densidad', seg('density', [['comfy', 'Cómoda'], ['compact', 'Compacta']]))}</div>`;
  h += `<div class="sh sm">Entreno</div><div class="list">
    ${row('Unidades', seg('unit', [['kg', 'kg'], ['lb', 'lb']]))}
    ${row('Descanso por defecto', `<select data-set="rest">${restOpts}</select>`)}
    ${row('Descanso automático', tog('autoRest'), 'Arranca al completar una serie')}
    ${row('Sonido al terminar', tog('restSound'))}
    ${row('Vibración', tog('haptics'), 'iOS 18 o superior')}
    ${row('Pantalla siempre encendida', tog('wakeLock'), 'Durante el entreno')}
    ${row('Columna «Anterior»', tog('showPrev'), 'Lo que hiciste la última vez')}
    ${row('Columna RPE', tog('showRpe'), 'Esfuerzo percibido 1–10')}
    ${row('Objetivo semanal', `<div class="stepper"><button data-a="step" data-k="weekGoal" data-d="-1">−</button><b>${s.weekGoal}</b><button data-a="step" data-k="weekGoal" data-d="1">+</button></div>`)}
    ${row('Incremento sugerido', `<select data-set="increment">${incOpts}</select>`, 'Para la sugerencia de subir peso')}</div>`;
  h += `<div class="sh sm">Equipo</div><div class="list">
    ${row('Peso de la barra', `<input class="r" data-set="bar" inputmode="decimal" value="${numIn(s.bar)}" style="max-width:5rem"> <span class="val">${unit()}</span>`)}
    <div class="li" style="flex-direction:column;align-items:stretch;gap:10px"><b style="font-weight:500">Discos disponibles</b><div style="display:flex;gap:6px;flex-wrap:wrap">${PLATES[unit()].map(p => `<button class="chip${s.plates.includes(p) ? ' on' : ''}" data-a="plateToggle" data-v="${p}">${nf(p, 2)}</button>`).join('')}</div></div></div>`;
  h += `<div class="sh sm">Biblioteca y herramientas</div><div class="list">
    ${nav('library', 'Ejercicios', S.exercises.filter(e => !e.hidden).length, 'list')}
    ${nav('plates', 'Calculadora de discos', '', 'calc')}
    ${nav('orm', 'Calculadora de 1RM', '', 'bolt')}</div>`;
  const lb = S.lastBackup ? rel(S.lastBackup) : 'nunca';
  h += `<div class="sh sm">Datos</div><div class="list">
    ${nav('exportJSON', 'Exportar copia', lb, 'save')}
    <label class="li tap"><span class="ico">${ic('open', 16, 2)}</span><span class="lbl">Importar copia</span><span class="chev">${ic('right', 16)}</span><input type="file" accept=".json,application/json" data-import hidden></label>
    ${nav('exportCSV', 'Exportar a CSV (Excel)', '', 'note')}
    <button class="li tap danger" data-a="wipe"><span class="ico">${ic('trash', 16, 2)}</span><span class="lbl">Borrar todos los datos</span></button></div>`;
  h += `<p class="foot-note"><b style="color:var(--text);letter-spacing:.08em">CALM GYM</b><br>Constancia · Actitud · Lucha · Mente<br><br>Todo se guarda solo en este iPhone, sin cuentas ni internet.<br>${S.workouts.length} entrenos · almacenamiento ${U.persisted ? 'protegido' : 'estándar'} · v1.0</p>`;
  return h;
}

/* =========================================================
   GRÁFICAS (SVG)
   ========================================================= */
function lineChart(pts, fmt) {
  if (pts.length < 2) return `<div class="chart-empty">${pts.length ? 'Con dos registros o más verás la evolución.' : 'Sin datos aún'}</div>`;
  const W = 320, H = 150, pl = 2, pr = 38, pt = 10, pb = 20;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs); let y0 = Math.min(...ys), y1 = Math.max(...ys);
  if (y1 - y0 < 1e-6) { y0 -= 1; y1 += 1; } const py = (y1 - y0) * .12; y0 -= py; y1 += py;
  const X = x => pl + (x - x0) / ((x1 - x0) || 1) * (W - pl - pr), Y = y => pt + (1 - (y - y0) / (y1 - y0)) * (H - pt - pb);
  const d = pts.map((p, k) => `${k ? 'L' : 'M'}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const id = 'g' + uid();
  let grid = '';
  for (let k = 0; k <= 2; k++) { const v = y0 + (y1 - y0) * (k / 2) ; const yy = Y(v); grid += `<line x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}" stroke="var(--sep)" stroke-dasharray="${k ? '2 3' : ''}"/><text x="${W - pr + 6}" y="${yy + 3}">${fmt(v)}</text>`; }
  const lp = pts[pts.length - 1];
  const showDots = pts.length <= 24;
  return `<svg class="chart" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="var(--accent)" stop-opacity=".22"/><stop offset="1" stop-color="var(--accent)" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path d="${d}L${X(x1)},${H - pb}L${X(x0)},${H - pb}Z" fill="url(#${id})"/><path d="${d}" fill="none" stroke="var(--accent)" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>
    ${showDots ? pts.map(p => `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="2.4" fill="var(--card)" stroke="var(--accent)" stroke-width="1.6"/>`).join('') : ''}
    <circle cx="${X(lp.x)}" cy="${Y(lp.y)}" r="4.5" fill="var(--accent)" stroke="var(--card)" stroke-width="2"/>
    <text x="${pl}" y="${H - 4}">${fmtDate(x0, { day: 'numeric', month: 'short' })}</text><text x="${W - pr}" y="${H - 4}" text-anchor="end">${fmtDate(x1, { day: 'numeric', month: 'short' })}</text></svg>`;
}
function barChart(vals, labels, goal) {
  const W = 320, H = 120, pb = 18, pt = 8, n = vals.length, gap = 6, bw = (W - gap * (n - 1)) / n;
  const mx = Math.max(goal, ...vals, 1);
  const Y = v => pt + (1 - v / mx) * (H - pt - pb);
  let b = '';
  vals.forEach((v, k) => {
    const x = k * (bw + gap), y = Y(v), h = H - pb - y;
    b += `<rect x="${x}" y="${v ? y : H - pb - 3}" width="${bw}" height="${v ? h : 3}" rx="4" fill="var(--accent)" opacity="${v >= goal ? 1 : v ? .45 : .15}"/>`;
    if (k % 3 === 2 || k === n - 1) b += `<text x="${x + bw / 2}" y="${H - 4}" text-anchor="middle">${k === n - 1 ? 'Esta' : labels[k]}</text>`;
  });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}"><line x1="0" x2="${W}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="var(--text3)" stroke-dasharray="3 4"/>${b}</svg>`;
}

/* =========================================================
   EDITOR (entreno en curso / rutina / entreno pasado)
   ========================================================= */
const doc = () => !U.ed ? null : (U.ed.mode === 'active' ? S.active : U.ed.draft);

function buildItem(exId, tmplSets, rest, note) {
  const lp = lastPerf(exId);
  const base = tmplSets && tmplSets.length ? tmplSets : (lp ? lp.sets : [newSet()]);
  const sets = base.map((ts, j) => {
    const p = lp ? lp.sets[j] : null, src = p || ts;
    return { ...newSet(ts.t || 'n'), ph: { kg: src.kg ?? null, reps: src.reps ?? null, sec: src.sec ?? null, km: src.km ?? null }, tr: tmplSets ? ts.reps ?? null : null };
  });
  let up = false;
  if (lp && tmplSets && exType(exId) === 'w') {
    const ws = sets.map((s, j) => [s, j]).filter(([s]) => s.t !== 'w');
    up = ws.length > 0 && ws.every(([s, j]) => { const p = lp.sets[j]; return p && p.t !== 'w' && s.tr != null && p.reps != null && p.reps >= s.tr && p.kg; });
  }
  return { id: uid(), exId, rest: rest ?? null, note: note || '', sets, up };
}
function nameByTime() { const h = new Date().getHours(); return h < 12 ? 'Entreno de mañana' : h < 20 ? 'Entreno de tarde' : 'Entreno de noche'; }
function startWorkout(tmpl) {
  if (S.active) { toast('Ya tienes un entreno en curso'); openEditor('active'); return; }
  S.active = { id: uid(), name: tmpl ? tmpl.name : nameByTime(), routineId: tmpl ? tmpl.id || null : null, start: Date.now(), end: null, note: '', items: [] };
  if (tmpl) S.active.items = tmpl.items.map(ri => buildItem(ri.exId, ri.sets, ri.rest, ri.note));
  S.rest = null; save(); U.sheets = []; openEditor('active'); requestWake();
}
function openEditor(mode, id) {
  if (mode === 'active') U.ed = { mode };
  else if (mode === 'routine') { const r = id ? S.routines.find(x => x.id === id) : null; U.ed = { mode, id, isNew: !r, draft: r ? clone(r) : { id: uid(), name: '', note: '', items: [] } }; }
  else if (mode === 'hist') { const w = S.workouts.find(x => x.id === id); if (!w) return; U.ed = { mode, id, draft: clone(w) }; }
  U.sheets = []; render();
  const body = $('#editor .ed-body'); if (body) body.scrollTop = 0;
}
function closeEditor() { U.ed = null; render(); }

function renderEditor() {
  const el = $('#editor');
  if (!U.ed || !doc()) { U.ed = null; el.classList.remove('open'); clearTimeout(U.edClear); U.edClear = setTimeout(() => { if (!U.ed) el.innerHTML = ''; }, 400); return; }
  const d = doc(), m = U.ed.mode;
  const body = el.querySelector('.ed-body'); const st = body ? body.scrollTop : 0;
  const top = m === 'active'
    ? `<button class="icon-btn fill" data-a="minimize">${ic('down', 22)}</button><div class="ed-clock">${ic('timer', 18)}<span data-elapsed>${clock(Date.now() - d.start)}</span></div><button class="btn pri sm" data-a="finish">Terminar</button>`
    : `<button class="link" data-a="edCancel">Cancelar</button><b>${m === 'routine' ? (U.ed.isNew ? 'Nueva rutina' : 'Editar rutina') : 'Editar entreno'}</b><button class="link strong" data-a="edSave">Guardar</button>`;
  let h = `<div class="ed-top">${top}</div><div class="ed-body">`;
  h += `<input class="ed-title" data-f="name" value="${esc(d.name)}" placeholder="${m === 'routine' ? 'Nombre de la rutina' : 'Nombre del entreno'}" enterkeyhint="done" autocomplete="off">`;
  if (m === 'active') h += `<p class="ed-meta">${cap(fmtDate(d.start, { weekday: 'long', day: 'numeric', month: 'long' }))} · ${fmtTime(d.start)}</p>`;
  if (m === 'hist') {
    const dt = new Date(d.start), pad = n => String(n).padStart(2, '0');
    const v = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;
    h += `<div class="list" style="margin-top:10px"><label class="li"><span class="lbl">Fecha</span><input type="datetime-local" data-f="hdate" value="${v}" style="color:var(--text2)"></label><label class="li"><span class="lbl">Duración (min)</span><input class="r" data-f="hdur" inputmode="numeric" value="${Math.round((d.end - d.start) / 60000)}"></label></div>`;
  }
  h += d.items.map((it, i) => exCard(it, i, m, d)).join('');
  if (!d.items.length) h += `<div class="empty plain"><p>${m === 'routine' ? 'Añade los ejercicios de esta rutina.' : 'Añade tu primer ejercicio para empezar.'}</p></div>`;
  h += `<button class="btn sec" data-a="addEx" style="margin-top:14px">${ic('plus', 20, 2.2)} Añadir ejercicio</button>`;
  h += `<textarea class="ed-note" data-f="dnote" rows="2" placeholder="${m === 'routine' ? 'Notas de la rutina' : 'Notas del entreno'}">${esc(d.note || '')}</textarea>`;
  if (m === 'active') h += `<button class="btn danger" data-a="discard" style="margin-top:12px">Descartar entreno</button>`;
  if (m === 'routine' && !U.ed.isNew) h += `<button class="btn danger" data-a="rDel" data-id="${d.id}" style="margin-top:12px">Eliminar rutina</button>`;
  h += `</div>${m === 'active' ? '<div id="restbar"></div>' : ''}`;
  el.innerHTML = h; el.classList.add('open');
  el.querySelector('.ed-body').scrollTop = st;
  updateTimers(true);
}
function exCard(it, i, m, d) {
  const e = getEx(it.exId), t = e.type || 'w', s = S.settings;
  const showPrev = m === 'active' && s.showPrev, showCk = m !== 'routine', showRpe = m !== 'routine' && s.showRpe && t !== 'c';
  const F = fieldsFor(t);
  const cols = ['2.1rem'];
  if (showPrev) cols.push('minmax(3.6rem,1fr)');
  F.forEach(() => cols.push(showPrev ? (F.length > 1 ? 'minmax(2.7rem,4.3rem)' : 'minmax(3.2rem,5.5rem)') : 'minmax(0,1fr)'));
  if (showRpe) cols.push('minmax(2.2rem,2.8rem)');
  if (showCk) cols.push('2.5rem');
  const lp = showPrev ? lastPerf(it.exId, d.id) : null;
  let h = `<section class="exc" style="--cols:${cols.join(' ')}"><div class="exc-h"><button class="exc-name" data-a="exDetail" data-id="${it.exId}">${esc(e.name)}</button>`;
  if (m === 'active' && it.up) h += `<button class="chip xs acc" data-a="bump" data-i="${i}">${ic('up', 12, 2.4)} ${nf(s.increment, 2)}</button>`;
  if (m !== 'hist') h += `<button class="chip xs" data-a="restPick" data-i="${i}">${ic('timer', 13, 2)}${it.rest == null ? restLabel(s.rest) : restLabel(it.rest)}</button>`;
  h += `<button class="icon-btn" data-a="exMenu" data-i="${i}">${ic('more', 20)}</button></div>`;
  if (it.note) h += `<p class="exc-note">${esc(it.note)}</p>`;
  h += `<div class="sr head"><span>#</span>${showPrev ? '<span>Antes</span>' : ''}${F.map(f => `<span>${f.l}</span>`).join('')}${showRpe ? '<span>RPE</span>' : ''}${showCk ? `<span>${ic('check', 14, 2.4)}</span>` : ''}</div>`;
  it.sets.forEach((st, j) => {
    h += `<div class="sr${showCk && st.done ? ' done' : ''}"><button class="sn ${st.t}" data-a="setMenu" data-i="${i}" data-j="${j}">${setLabel(it.sets, j)}</button>`;
    if (showPrev) h += `<span class="prev">${lp && lp.sets[j] ? setText(lp.sets[j], t) : '—'}</span>`;
    F.forEach(f => { h += `<input data-f="s" data-i="${i}" data-j="${j}" data-k="${f.k}" inputmode="${f.im}" value="${valOf(st, f.k)}" placeholder="${m === 'active' ? valOf(st.ph, f.k) : (m === 'routine' ? '–' : '')}" autocomplete="off">`; });
    if (showRpe) h += `<input data-f="s" data-i="${i}" data-j="${j}" data-k="rpe" inputmode="decimal" value="${valOf(st, 'rpe')}" autocomplete="off">`;
    if (showCk) h += `<button class="ck" data-a="ck" data-i="${i}" data-j="${j}">${ic('check', 18, 2.6)}</button>`;
    h += `</div>`;
  });
  h += `<button class="add-set" data-a="addSet" data-i="${i}">${ic('plus', 16, 2.4)} Añadir serie</button></section>`;
  return h;
}

// ---------- descanso y cronómetros ----------
function startRest(sec) { if (!sec) return; S.rest = { end: Date.now() + sec * 1000, total: sec }; save(); updateTimers(true); }
function updateTimers(force) {
  const now = Date.now();
  if (S.active) document.querySelectorAll('[data-elapsed]').forEach(e => e.textContent = clock(now - S.active.start));
  if (S.rest && now >= S.rest.end) {
    const late = now - S.rest.end; S.rest = null; save();
    if (late < 4000) { beep(); hap(); toast('¡Descanso terminado!'); }
    force = true;
  }
  const rb = $('#restbar');
  if (rb) {
    if (S.rest) {
      if (force || !rb.firstChild) rb.innerHTML = `<div class="restbar"><div class="rt"><small>Descanso</small><span data-rt></span></div><button class="btn sm" data-a="restAdj" data-d="-15">−15</button><button class="btn sm" data-a="restAdj" data-d="15">+15</button><button class="btn sm pri" data-a="restSkip">Saltar</button><div class="rp" data-rp></div></div>`;
      const left = S.rest.end - now;
      rb.querySelector('[data-rt]').textContent = clock(left + 999);
      rb.querySelector('[data-rp]').style.width = Math.max(0, Math.min(100, left / (S.rest.total * 1000) * 100)) + '%';
    } else if (rb.firstChild) rb.innerHTML = '';
  }
  renderPill(force);
}
function renderPill(force) {
  const el = $('#pill');
  const show = S.active && !U.ed;
  if (!show) { if (el.firstChild) el.innerHTML = ''; return; }
  const txt = S.rest ? `Descanso ${clock(S.rest.end - Date.now() + 999)}` : clock(Date.now() - S.active.start);
  if (force || !el.firstChild) el.innerHTML = `<button class="pill" data-a="resume"><span class="dot"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(S.active.name)}</span><span class="tnum" data-pt></span></button>`;
  el.querySelector('[data-pt]').textContent = txt;
}

/* =========================================================
   HOJAS (bottom sheets)
   ========================================================= */
function pushSheet(t, p = {}) { U.sheets.push({ t, p, anim: true }); renderSheets(); }
function popSheet() { U.sheets.pop(); renderSheets(); }
function closeSheet() {
  const top = U.sheets[U.sheets.length - 1]; if (!top) return;
  const el = $('#sheets').lastElementChild;
  if (!el) { popSheet(); return; }
  el.classList.add('closing');
  setTimeout(() => { U.sheets = U.sheets.filter(x => x !== top); renderSheets(); }, 190);
}
function renderSheets() {
  const root = $('#sheets');
  const tops = [...root.querySelectorAll('.sheet-b')].map(e => e.scrollTop);
  root.innerHTML = U.sheets.map((s, k) => {
    let c; try { c = SHEETS[s.t](s.p) || {}; } catch (err) { console.warn(err); s.dead = true; return ''; }
    const head = `<div class="grab"></div><div class="sheet-h"><span class="sh-side">${c.left || ''}</span><h3>${c.title || ''}</h3><span class="sh-side r">${c.right ?? `<button class="icon-btn fill" data-a="closeSheet">${ic('close', 16, 2.2)}</button>`}</span></div>`;
    const html = `<div class="swrap${s.anim ? ' anim' : ''}" style="z-index:${40 + k}"><div class="backdrop" data-a="closeSheet"></div><div class="sheet${c.tall ? ' tall' : ''}">${head}<div class="sheet-b">${c.body || ''}</div>${c.foot ? `<div class="sheet-f">${c.foot}</div>` : ''}</div></div>`;
    s.anim = false; return html;
  }).join('');
  if (U.sheets.some(x => x.dead)) U.sheets = U.sheets.filter(x => !x.dead);
  root.querySelectorAll('.sheet-b').forEach((e, k) => { if (tops[k] != null) e.scrollTop = tops[k]; });
}
const actList = rows => `<div class="list">${rows.filter(Boolean).map(([a, icn, l, extra = '', cls = '']) => `<button class="li tap ${cls}" data-a="${a}" ${extra}><span class="ico">${ic(icn, 16, 2)}</span><span class="lbl">${l}</span></button>`).join('')}</div>`;

function confirmSheet(title, text, ok, fn, danger = true) { U.confirm = fn; pushSheet('confirm', { title, text, ok, danger }); }

const SHEETS = {
  confirm: p => ({ title: '', right: '', body: `<div class="hero" style="padding-top:0"><h2 style="font-size:1.25rem">${p.title}</h2>${p.text ? `<p>${p.text}</p>` : ''}</div><div class="stack"><button class="btn ${p.danger ? 'danger' : 'pri'}" data-a="confirmOk">${p.ok}</button><button class="btn ghost" data-a="closeSheet">Cancelar</button></div>` }),

  // ----- selector de ejercicios -----
  picker: () => {
    const P = U.pick;
    return {
      tall: true, title: P.mode === 'replace' ? 'Reemplazar' : 'Añadir ejercicio',
      left: `<button class="link" data-a="exEdit">Nuevo</button>`,
      right: P.mode === 'replace' ? undefined : `<button class="link strong" data-a="pickDone" ${P.sel.length ? '' : 'disabled'}>Añadir${P.sel.length ? ` (${P.sel.length})` : ''}</button>`,
      body: `<input class="search" type="search" data-f="pickq" placeholder="Buscar" value="${esc(P.q)}" autocomplete="off"><div class="chips">${['Todos', ...MUSCLES].map(m => `<button class="chip${(P.m || 'Todos') === m ? ' on' : ''}" data-a="pickM" data-v="${m}">${m}</button>`).join('')}</div><div id="pickList">${pickListHTML()}</div>`,
    };
  },

  exEdit: () => {
    const F = U.form, used = F.id && exUsed(F.id);
    const opt = (arr, v) => arr.map(x => `<option ${x === v ? 'selected' : ''}>${x}</option>`).join('');
    return {
      title: F.id ? 'Editar ejercicio' : 'Nuevo ejercicio', right: `<button class="link strong" data-a="exSave">Guardar</button>`, left: `<button class="link" data-a="closeSheet">Cancelar</button>`,
      body: `<div class="list"><label class="li"><input data-f="form" name="name" value="${esc(F.name)}" placeholder="Nombre" style="flex:1" autocomplete="off"></label>
        <label class="li"><span class="lbl">Músculo</span><select data-f="form" name="muscle">${opt(MUSCLES, F.muscle)}</select></label>
        <label class="li"><span class="lbl">Material</span><select data-f="form" name="equip">${opt(EQUIP, F.equip)}</select></label>
        <label class="li"><span class="lbl">Registro</span><select data-f="form" name="type" ${used ? 'disabled' : ''}>${Object.entries(TYPES).map(([k, l]) => `<option value="${k}" ${F.type === k ? 'selected' : ''}>${l}</option>`).join('')}</select></label></div>
        ${used ? '<p class="form-ex">El tipo de registro no se puede cambiar porque ya tiene datos.</p>' : ''}
        ${F.id ? `<button class="btn danger" data-a="exDel" style="margin-top:20px">${used ? 'Ocultar de la biblioteca' : 'Eliminar ejercicio'}</button>` : ''}`,
    };
  },

  library: () => ({
    tall: true, title: 'Ejercicios', left: `<button class="link" data-a="exEdit">Nuevo</button>`,
    body: `<input class="search" type="search" data-f="libq" placeholder="Buscar" value="${esc(U.libq)}" autocomplete="off"><div id="libList">${libBody()}</div>`,
  }),

  exMenu: p => {
    const d = doc(), it = d.items[p.i], m = U.ed.mode, t = exType(it.exId);
    return {
      title: getEx(it.exId).name,
      body: actList([
        ['exNote', 'note', it.note ? 'Editar nota' : 'Añadir nota', `data-i="${p.i}"`],
        m !== 'hist' && ['restPick', 'timer', 'Tiempo de descanso', `data-i="${p.i}"`],
        t === 'w' && ['plates', 'calc', 'Calculadora de discos', `data-i="${p.i}"`],
        ['exReplace', 'swap', 'Reemplazar ejercicio', `data-i="${p.i}"`],
        p.i > 0 && ['exMove', 'up', 'Mover arriba', `data-i="${p.i}" data-d="-1"`],
        p.i < d.items.length - 1 && ['exMove', 'dn', 'Mover abajo', `data-i="${p.i}" data-d="1"`],
        ['exRemove', 'trash', 'Quitar ejercicio', `data-i="${p.i}"`, 'danger'],
      ]),
    };
  },

  setMenu: p => {
    const st = doc().items[p.i].sets[p.j];
    return {
      title: 'Serie ' + setLabel(doc().items[p.i].sets, p.j),
      body: `<div class="list">${Object.entries(SET_T).map(([k, l]) => `<button class="li tap" data-a="setType" data-i="${p.i}" data-j="${p.j}" data-v="${k}"><span class="sn ${k}" style="width:32px">${k === 'n' ? '1' : k === 'w' ? 'C' : k.toUpperCase()}</span><span class="lbl">${l}</span>${st.t === k ? `<span style="color:var(--accent)">${ic('check', 18, 2.4)}</span>` : ''}</button>`).join('')}</div>
        <div class="list" style="margin-top:12px"><button class="li tap danger" data-a="setDel" data-i="${p.i}" data-j="${p.j}"><span class="ico">${ic('trash', 16, 2)}</span><span class="lbl">Eliminar serie</span></button></div>`,
    };
  },

  restPick: p => {
    const it = doc().items[p.i], cur = it.rest;
    const opts = [0, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];
    return {
      title: 'Descanso', body: `<p class="muted small" style="text-align:center;margin-bottom:12px">${esc(getEx(it.exId).name)}</p><div class="opts">${opts.map(v => `<button class="${cur === v ? 'on' : ''}" data-a="restSet" data-i="${p.i}" data-v="${v}">${v ? restLabel(v) : 'Sin'}</button>`).join('')}<button class="${cur == null ? 'on' : ''}" data-a="restSet" data-i="${p.i}" data-v="">Por defecto</button></div>`,
    };
  },

  exNote: p => ({ title: 'Nota', right: `<button class="link strong" data-a="closeSheet">Hecho</button>`, body: `<textarea class="area" data-f="inote" data-i="${p.i}" placeholder="Ajuste del asiento, agarre, sensaciones…">${esc(doc().items[p.i].note)}</textarea>` }),

  finish: () => {
    const w = S.active, done = wSets(w), total = w.items.reduce((a, it) => a + it.sets.length, 0);
    return {
      title: '', right: '', body: `<div class="hero" style="padding-top:0"><h2 style="font-size:1.25rem">¿Terminar entreno?</h2><p>${done ? `${done} de ${total} series completadas${total > done ? '. Las no marcadas se descartarán.' : '.'}` : 'No has completado ninguna serie.'}</p></div>
      <div class="stack">${done ? `<button class="btn pri" data-a="finishOk">Terminar y guardar</button>` : ''}<button class="btn ${done ? 'ghost' : 'danger'}" data-a="${done ? 'closeSheet' : 'discardOk'}">${done ? 'Seguir entrenando' : 'Descartar entreno'}</button></div>`,
    };
  },

  summary: p => {
    const w = S.workouts.find(x => x.id === p.id); if (!w) return { body: '' };
    const n = S.workouts.length;
    return {
      title: '', right: '', body: `<div class="hero"><div class="ok">${ic('check', 34, 2.6)}</div><h2>¡Buen trabajo!</h2><p>${esc(w.name)} · entreno nº ${n}</p></div>
      <div class="stats four"><div class="stat"><b>${fmtDur(w.end - w.start)}</b><span>Duración</span></div><div class="stat"><b>${fmtVol(wVol(w))}</b><span>Volumen</span></div><div class="stat"><b>${wSets(w)}</b><span>Series</span></div><div class="stat"><b>${prCount(w)}</b><span>Récords</span></div></div>
      ${prCount(w) ? `<div class="list prs">${w.prs.map(r => `<div class="li"><span class="ico">${ic('trophy', 16, 2)}</span><div class="li-t"><b>${esc(r.name)}</b><span>${r.kind}</span></div><b class="tnum">${r.val}</b></div>`).join('')}</div>` : ''}
      <div class="stack" style="margin-top:16px">${p.canUpd ? `<button class="btn sec" data-a="updRoutine" data-id="${w.id}">Actualizar rutina con lo de hoy</button>` : ''}<button class="btn pri" data-a="closeSheet">Hecho</button></div>`,
    };
  },

  wDetail: p => {
    const w = S.workouts.find(x => x.id === p.id); if (!w) return { body: '' };
    const items = w.items.map(it => {
      const t = exType(it.exId);
      return `<div class="card"><button class="exc-name" style="padding:0 0 6px" data-a="exDetail" data-id="${it.exId}">${esc(getEx(it.exId).name)}</button>${it.note ? `<p class="exc-note" style="padding:0 0 6px">${esc(it.note)}</p>` : ''}
      ${it.sets.filter(s => s.done).map((s, j, arr) => `<div style="display:flex;gap:12px;font-size:.9375rem;padding:3px 0" class="tnum"><span class="sn ${s.t}" style="width:26px;height:24px;font-size:.75rem">${setLabel(arr, j)}</span><span style="flex:1">${setText(s, t)}${t === 'w' ? ' ' + unit() : ''}${s.rpe ? ` <span class="muted small">@${nf(s.rpe, 1)}</span>` : ''}</span>${t === 'w' && s.reps ? `<span class="muted small">1RM ${fmt1(e1rm(s.kg || 0, s.reps))}</span>` : ''}</div>`).join('')}</div>`;
    }).join('');
    return {
      tall: true, title: esc(w.name), body: `<p class="muted small" style="text-align:center;margin:-4px 0 12px">${cap(fmtDate(w.start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))} · ${fmtTime(w.start)}</p>
      <div class="stats"><div class="stat"><b>${fmtDur(w.end - w.start)}</b><span>Duración</span></div><div class="stat"><b>${fmtVol(wVol(w))}</b><span>Volumen</span></div><div class="stat"><b>${prCount(w) || wSets(w)}</b><span>${prCount(w) ? 'Récords' : 'Series'}</span></div></div>
      ${w.note ? `<div class="card" style="margin-top:10px;white-space:pre-wrap">${esc(w.note)}</div>` : ''}
      <div style="margin-top:10px">${items}</div>
      <div style="margin-top:16px">${actList([['wRepeat', 'repeat', 'Repetir este entreno', `data-id="${w.id}"`, 'acc'], ['wEdit', 'edit', 'Editar', `data-id="${w.id}"`], ['wAsRoutine', 'copy', 'Guardar como rutina', `data-id="${w.id}"`], ['wDel', 'trash', 'Eliminar', `data-id="${w.id}"`, 'danger']])}</div>`,
    };
  },

  rPrev: p => {
    const r = S.routines.find(x => x.id === p.id); if (!r) return { body: '' };
    const last = S.workouts.find(w => w.routineId === r.id);
    return {
      title: esc(r.name), left: `<button class="link" data-a="rEdit" data-id="${r.id}">Editar</button>`,
      body: `${last ? `<p class="muted small" style="text-align:center;margin:-4px 0 12px">Última vez ${rel(last.start)}</p>` : ''}<div class="list">${r.items.map(it => { const t = exType(it.exId); return `<div class="li"><span class="sn" style="width:32px;font-size:.8125rem">${it.sets.length}×</span><div class="li-t"><b>${esc(getEx(it.exId).name)}</b><span>${it.sets.map(s => setText(s, t)).filter(x => x !== '—').join(' · ') || getEx(it.exId).muscle}</span></div></div>`; }).join('') || '<div class="li muted">Sin ejercicios</div>'}</div>${r.note ? `<p class="form-ex">${esc(r.note)}</p>` : ''}`,
      foot: `<button class="btn pri" data-a="rStart" data-id="${r.id}">${ic('play', 18)} Empezar</button>`,
    };
  },

  rMenu: p => {
    const r = S.routines.find(x => x.id === p.id); const k = S.routines.indexOf(r);
    return { title: esc(r.name), body: actList([['rStart', 'play', 'Empezar', `data-id="${r.id}"`, 'acc'], ['rEdit', 'edit', 'Editar', `data-id="${r.id}"`], ['rDup', 'copy', 'Duplicar', `data-id="${r.id}"`], k > 0 && ['rUp', 'up', 'Mover arriba', `data-id="${r.id}"`], ['rDel', 'trash', 'Eliminar', `data-id="${r.id}"`, 'danger']]) };
  },

  plates: () => ({ title: 'Calculadora de discos', body: `<div class="list"><label class="li"><span class="lbl">Peso total</span><input class="r" data-f="plw" inputmode="decimal" value="${esc(U.plw ?? '')}" placeholder="0" style="font-weight:600;color:var(--text)"><span class="val">${unit()}</span></label><div class="li"><span class="lbl">Barra</span><span class="val">${nf(S.settings.bar, 2)} ${unit()}</span></div></div><div id="plOut">${platesHTML()}</div>` }),

  orm: () => ({ title: 'Calculadora de 1RM', body: `<div class="list"><label class="li"><span class="lbl">Peso</span><input class="r" data-f="ormw" inputmode="decimal" value="${esc(U.ormw ?? '')}" placeholder="0" style="font-weight:600;color:var(--text)"><span class="val">${unit()}</span></label><label class="li"><span class="lbl">Repeticiones</span><input class="r" data-f="ormr" inputmode="numeric" value="${esc(U.ormr ?? '')}" placeholder="0" style="font-weight:600;color:var(--text)"></label></div><div id="ormOut">${ormHTML()}</div>` }),

  bodyAdd: () => {
    const F = U.form; const pad = n => String(n).padStart(2, '0'); const dt = new Date(F.date);
    const fld = (k, l, u, im = 'decimal') => `<label class="li"><span class="lbl">${l}</span><input class="r" data-f="form" name="${k}" inputmode="${im}" value="${esc(F[k] ?? '')}" placeholder="—"><span class="val" style="min-width:1.6rem">${u}</span></label>`;
    return {
      title: F.id ? 'Editar registro' : 'Nuevo registro', left: `<button class="link" data-a="closeSheet">Cancelar</button>`, right: `<button class="link strong" data-a="bodySave">Guardar</button>`,
      body: `<div class="list"><label class="li"><span class="lbl">Fecha</span><input type="date" data-f="form" name="date" value="${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}" style="color:var(--text2)"></label>${fld('weight', 'Peso', unit())}${fld('fat', 'Grasa corporal', '%')}</div>
      <div class="sh sm">Medidas (opcional)</div><div class="list">${fld('waist', 'Cintura', 'cm')}${fld('chest', 'Pecho', 'cm')}${fld('arm', 'Brazo', 'cm')}${fld('thigh', 'Muslo', 'cm')}${fld('hips', 'Cadera', 'cm')}</div>
      ${F.id ? `<button class="btn danger" data-a="bodyDel" style="margin-top:20px">Eliminar registro</button>` : ''}`,
    };
  },

  exDetail: p => {
    const e = getEx(p.id), t = e.type || 'w', ses = exSessions(p.id);
    const M = t === 'w' ? [['1RM est.', x => Math.max(...x.sets.filter(isWork).map(s => e1rm(s.kg || 0, s.reps)), 0), v => fmtW(v)], ['Peso máx.', x => Math.max(...x.sets.filter(isWork).map(s => s.reps ? s.kg || 0 : 0), 0), v => fmtW(v)], ['Volumen', x => x.sets.filter(isWork).reduce((a, s) => a + (s.kg || 0) * (s.reps || 0), 0), v => fmtVol(v).replace(' ' + unit(), '')]]
      : t === 'r' ? [['Reps máx.', x => Math.max(...x.sets.map(s => s.reps || 0)), v => nf(v, 0)], ['Reps totales', x => x.sets.reduce((a, s) => a + (s.reps || 0), 0), v => nf(v, 0)]]
        : t === 't' ? [['Tiempo máx.', x => Math.max(...x.sets.map(s => s.sec || 0)), v => nf(v, 0) + 's']]
          : [['Distancia', x => x.sets.reduce((a, s) => a + (s.km || 0), 0), v => nf(v, 1)], ['Tiempo', x => x.sets.reduce((a, s) => a + (s.sec || 0), 0) / 60, v => nf(v, 0)]];
    const mi = Math.min(U.metric, M.length - 1), [, fn, fm] = M[mi];
    const conv = t === 'w' && mi < 2 ? v => toDisp(v) : t === 'w' ? v => toDisp(v) : v => v;
    const pts = ses.map(x => ({ x: x.w.start, y: conv(fn(x)) })).filter(p2 => p2.y > 0);
    let rec = '';
    if (t === 'w' && ses.length) {
      const all = ses.flatMap(x => x.sets.filter(isWork));
      const mk = Math.max(0, ...all.map(s => s.reps ? s.kg || 0 : 0)), me = Math.max(0, ...all.map(s => e1rm(s.kg || 0, s.reps))), mv = Math.max(0, ...all.map(s => (s.kg || 0) * (s.reps || 0)));
      rec = `<div class="rec-grid" style="margin-top:12px"><div><b>${fmtW(mk)}</b><span>Peso máx.</span></div><div><b>${fmt1(me)}</b><span>1RM est.</span></div><div><b>${fmt1(mv)}</b><span>Mejor serie</span></div></div>`;
      const byReps = [1, 3, 5, 8, 10, 12].map(r => { const c = all.filter(s => (s.reps || 0) >= r); return c.length ? [r, Math.max(...c.map(s => s.kg || 0))] : null; }).filter(Boolean);
      if (byReps.length) rec += `<div class="sh sm" style="margin-left:4px">Mejor peso por repeticiones</div><div class="rec-grid">${byReps.map(([r, k]) => `<div><b>${fmtW(k)}</b><span>${r} rep${r > 1 ? 's' : ''}</span></div>`).join('')}</div>`;
    }
    const hist = [...ses].reverse().slice(0, 12).map(x => `<div class="hist-l"><p class="muted">${cap(fmtDate(x.w.start, { weekday: 'short', day: 'numeric', month: 'short' }))} · ${esc(x.w.name)}</p><p class="tnum">${x.sets.map(s => setText(s, t)).join(' · ')}</p></div>`).join('');
    return {
      tall: true, title: esc(e.name), left: `<button class="link" data-a="exEdit" data-id="${e.id}">Editar</button>`,
      body: `<p class="muted small" style="text-align:center;margin:-4px 0 12px">${esc(e.muscle)} · ${esc(e.equip)} · ${ses.length} ${ses.length === 1 ? 'sesión' : 'sesiones'}</p>
      ${ses.length ? `<div class="card">${M.length > 1 ? `<div class="seg" style="margin-bottom:12px">${M.map((m, k) => `<button class="${k === mi ? 'on' : ''}" data-a="metric" data-v="${k}">${m[0]}</button>`).join('')}</div>` : ''}${lineChart(pts, v => nf(v, 0))}${rec}</div>
      <div class="sh sm">Historial</div><div class="card">${hist}</div>` : `<div class="empty"><p>Aún no has registrado este ejercicio.</p></div>`}`,
    };
  },
};

function libBody() {
  const q = norm(U.libq);
  const list = S.exercises.filter(e => !e.hidden && (!q || norm(e.name).includes(q) || norm(e.muscle).includes(q))).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const hidden = S.exercises.filter(e => e.hidden && (!q || norm(e.name).includes(q)));
  return libHTML(list) + (hidden.length ? `<div class="sh sm">Ocultos</div><div class="list">${hidden.map(e => `<button class="li tap" data-a="exUnhide" data-id="${e.id}"><div class="li-t"><b>${esc(e.name)}</b><span>Toca para mostrar</span></div></button>`).join('')}</div>` : '');
}
function libHTML(list) {
  if (!list.length) return `<div class="empty plain"><p>Sin resultados</p></div>`;
  return `<div class="list">${list.map(e => `<button class="li tap" data-a="exEdit" data-id="${e.id}"><div class="li-t"><b>${esc(e.name)}</b><span>${esc(e.muscle)} · ${esc(e.equip)}${e.type !== 'w' ? ' · ' + TYPES[e.type] : ''}</span></div><span class="chev">${ic('right', 16)}</span></button>`).join('')}</div>`;
}
function pickListHTML() {
  const P = U.pick, q = norm(P.q), m = P.m && P.m !== 'Todos' ? P.m : '';
  const row = e => { const on = P.sel.includes(e.id); return `<button class="li tap pick${on ? ' on' : ''}" data-a="pickT" data-id="${e.id}"><div class="li-t"><b>${esc(e.name)}</b><span>${esc(e.muscle)} · ${esc(e.equip)}</span></div><i class="rad">${on ? ic('check', 14, 3) : ''}</i></button>`; };
  const all = S.exercises.filter(e => !e.hidden && (!m || e.muscle === m) && (!q || norm(e.name).includes(q) || norm(e.equip).includes(q))).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  let h = '';
  if (!q && !m) { const rec = recentExIds(5).map(getEx).filter(e => e.muscle && !e.hidden); if (rec.length) h += `<div class="sh sm" style="margin-top:6px">Recientes</div><div class="list">${rec.map(row).join('')}</div><div class="sh sm">Todos</div>`; }
  h += all.length ? `<div class="list">${all.map(row).join('')}</div>` : `<div class="empty plain"><p>No encontrado.</p><button class="btn sec" data-a="exEdit">Crear «${esc(P.q)}»</button></div>`;
  return h;
}
function platesHTML() {
  const target = parseNum(U.plw), bar = S.settings.bar || 0;
  if (!target) return `<p class="form-ex" style="text-align:center">Escribe el peso total que quieres cargar.</p>`;
  if (target < bar) return `<p class="form-ex" style="text-align:center">El peso es menor que la barra.</p>`;
  let side = (target - bar) / 2; const plates = [...S.settings.plates].sort((a, b) => b - a), used = [];
  for (const p of plates) while (side >= p - 1e-9) { used.push(p); side -= p; }
  side = Math.round(side * 1000) / 1000;
  const maxP = plates[0] || 25;
  const vis = used.map(p => `<span class="plate" style="height:${40 + 70 * (p / maxP)}px;width:${p >= maxP / 2 ? 16 : 11}px;background:${PLATE_COL[p] || '#8E8E93'}"></span>`).join('');
  return `<div class="card" style="margin-top:12px"><div class="bar-vis"><span class="shaft"></span><span class="sleeve"></span>${vis}</div>
    <p style="text-align:center;font-weight:600">${used.length ? 'Por lado: ' + used.map(p => nf(p, 2)).join(' + ') : 'Solo la barra'}</p>
    ${side > 0 ? `<p class="form-ex" style="text-align:center">Faltan ${nf(side * 2, 2)} ${unit()} con los discos disponibles.</p>` : ''}</div>`;
}
function ormHTML() {
  const w = parseNum(U.ormw), r = parseNum(U.ormr);
  if (!w || !r) return `<p class="form-ex" style="text-align:center">Introduce un peso y las repeticiones que hiciste.</p>`;
  const one = e1rm(w, Math.round(r));
  const reps = { 100: 1, 95: 2, 90: 4, 85: 6, 80: 8, 75: 10, 70: 12, 65: 15, 60: 18 };
  return `<div class="card" style="margin-top:12px;text-align:center"><p class="muted small">1RM estimado (Epley)</p><p class="big-num">${nf(one, 1)}<small>${unit()}</small></p></div>
    <div class="card"><div class="pct" style="border-top:0;font-size:.75rem;color:var(--text2);font-weight:600"><span>%</span><span>PESO</span><span>≈ REPS</span></div>${Object.entries(reps).reverse().map(([p, n]) => `<div class="pct"><span>${p}%</span><span>${nf(one * p / 100, 1)}</span><span>${n}</span></div>`).join('')}</div>`;
}

/* =========================================================
   RENDER
   ========================================================= */
const TABS = [['train', 'Entrenar'], ['hist', 'Historial'], ['prog', 'Progreso'], ['set', 'Ajustes']];
function render() {
  const view = $('#view'); const st = view.scrollTop;
  view.innerHTML = ({ train: vTrain, hist: vHist, prog: vProg, set: vSet })[U.tab]();
  view.scrollTop = st;
  $('#tabs').innerHTML = TABS.map(([k, l]) => `<button class="tab${U.tab === k ? ' on' : ''}" data-a="tab" data-v="${k}">${ic(k, 26, U.tab === k ? 2.1 : 1.7)}<span>${l}</span></button>`).join('');
  renderEditor();
  renderSheets();
  updateTimers(true);
}

/* =========================================================
   ACCIONES
   ========================================================= */
const ds = el => el.dataset;
const item = el => doc().items[+ds(el).i];
const A = {
  tab(el) { const v = ds(el).v; if (U.tab === v) { $('#view').scrollTo({ top: 0, behavior: 'smooth' }); return; } U.tab = v; render(); $('#view').scrollTop = 0; },
  closeSheet() { closeSheet(); },
  confirmOk() { const fn = U.confirm; U.confirm = null; popSheet(); fn && fn(); },
  dismissBackup() { U.backupDismiss = Date.now(); render(); },

  // entreno
  startEmpty() { startWorkout(null); },
  resume() { openEditor('active'); requestWake(); },
  minimize() { U.ed = null; render(); },
  finish() { pushSheet('finish'); },
  discard() { confirmSheet('¿Descartar entreno?', 'Se perderá todo lo registrado en este entreno.', 'Descartar', A.discardOk); },
  discardOk() { S.active = null; S.rest = null; U.ed = null; U.sheets = []; releaseWake(); saveNow(); render(); },
  finishOk() {
    const w = S.active; w.end = Date.now();
    w.items = w.items.map(it => ({ id: it.id, exId: it.exId, rest: it.rest, note: it.note, sets: it.sets.filter(s => s.done).map(({ ph, tr, ...s }) => s) })).filter(it => it.sets.length);
    w.prs = detectPRs(w);
    S.workouts.unshift(w); S.workouts.sort((a, b) => b.start - a.start);
    S.active = null; S.rest = null; U.ed = null; releaseWake();
    const r = w.routineId && S.routines.find(x => x.id === w.routineId);
    const sig = items => JSON.stringify(items.map(i => [i.exId, i.sets.map(s => [s.t, s.kg, s.reps, s.sec, s.km])]));
    const canUpd = !!r && sig(r.items) !== sig(w.items);
    saveNow(); U.sheets = []; U.tab = 'train'; render(); hap();
    pushSheet('summary', { id: w.id, canUpd });
  },
  updRoutine(el) {
    const w = S.workouts.find(x => x.id === ds(el).id), r = w && S.routines.find(x => x.id === w.routineId);
    if (r) { r.items = w.items.map(it => ({ exId: it.exId, rest: it.rest, note: it.note, sets: it.sets.map(s => ({ t: s.t, kg: s.kg, reps: s.reps, sec: s.sec, km: s.km })) })); save(); toast('Rutina actualizada'); }
    U.sheets = []; render();
  },
  ck(el) {
    const it = item(el), st = it.sets[+ds(el).j], t = exType(it.exId), m = U.ed.mode;
    if (!st.done) {
      if (st.ph) for (const k of ['kg', 'reps', 'sec', 'km']) if (st[k] == null && st.ph[k] != null) st[k] = st.ph[k];
      const ok = t === 'w' || t === 'r' ? st.reps != null : t === 't' ? st.sec != null : (st.km != null || st.sec != null);
      if (!ok) { toast(t === 't' ? 'Introduce el tiempo' : t === 'c' ? 'Introduce distancia o tiempo' : 'Introduce las repeticiones'); const inp = el.parentElement.querySelector('input'); inp && inp.focus(); return; }
      st.done = true; hap();
      if (m === 'active' && S.settings.autoRest) { const r = it.rest ?? S.settings.rest; if (r > 0) S.rest = { end: Date.now() + r * 1000, total: r }; }
    } else st.done = false;
    save(); renderEditor();
  },
  addSet(el) {
    const it = item(el), last = it.sets[it.sets.length - 1], m = U.ed.mode, s = newSet('n');
    if (last) {
      if (m === 'active') s.ph = { kg: last.kg ?? last.ph?.kg ?? null, reps: last.reps ?? last.ph?.reps ?? null, sec: last.sec ?? last.ph?.sec ?? null, km: last.km ?? last.ph?.km ?? null };
      else { s.kg = last.kg; s.reps = last.reps; s.sec = last.sec; s.km = last.km; if (m === 'hist') s.done = true; }
    } else if (m === 'hist') s.done = true;
    it.sets.push(s); save(); renderEditor();
  },
  setMenu(el) { pushSheet('setMenu', { i: +ds(el).i, j: +ds(el).j }); },
  setType(el) { item(el).sets[+ds(el).j].t = ds(el).v; save(); popSheet(); renderEditor(); },
  setDel(el) { const it = item(el); it.sets.splice(+ds(el).j, 1); save(); popSheet(); renderEditor(); },
  restPick(el) { if (U.sheets.length && U.sheets[U.sheets.length - 1].t === 'exMenu') U.sheets.pop(); pushSheet('restPick', { i: +ds(el).i }); },
  restSet(el) { const v = ds(el).v; item(el).rest = v === '' ? null : +v; save(); popSheet(); renderEditor(); },
  restAdj(el) { if (!S.rest) return; const d = +ds(el).d; S.rest.end += d * 1000; if (d > 0) S.rest.total += d; if (S.rest.end <= Date.now()) S.rest = null; save(); updateTimers(true); },
  restSkip() { S.rest = null; save(); updateTimers(true); },
  bump(el) { const it = item(el); const inc = fromDisp(S.settings.increment); it.sets.forEach(s => { if (s.t !== 'w' && s.ph && s.ph.kg != null) s.ph.kg += inc; }); it.up = false; save(); renderEditor(); toast(`+${nf(S.settings.increment, 2)} ${unit()} en las series de trabajo`); },
  exMenu(el) { pushSheet('exMenu', { i: +ds(el).i }); },
  exNote(el) { popSheet(); pushSheet('exNote', { i: +ds(el).i }); setTimeout(() => { const t = $('#sheets textarea'); t && t.focus(); }, 350); },
  exMove(el) { const d = doc(), i = +ds(el).i, j = i + +ds(el).d; [d.items[i], d.items[j]] = [d.items[j], d.items[i]]; save(); popSheet(); renderEditor(); },
  exRemove(el) { doc().items.splice(+ds(el).i, 1); save(); popSheet(); renderEditor(); },
  exReplace(el) { popSheet(); U.pick = { mode: 'replace', i: +ds(el).i, sel: [], q: '', m: '' }; pushSheet('picker'); },
  addEx() { U.pick = { mode: 'add', sel: [], q: '', m: '' }; pushSheet('picker'); },
  pickM(el) { U.pick.m = ds(el).v; renderSheets(); },
  pickT(el) {
    const id = ds(el).id, P = U.pick;
    if (P.mode === 'replace') { P.sel = [id]; A.pickDone(); return; }
    P.sel = P.sel.includes(id) ? P.sel.filter(x => x !== id) : [...P.sel, id]; renderSheets();
  },
  pickDone() {
    const P = U.pick, d = doc(), m = U.ed.mode; if (!P.sel.length) return;
    const make = id => {
      if (m === 'active') return buildItem(id, null);
      const lp = lastPerf(id);
      if (m === 'routine') return { id: uid(), exId: id, rest: null, note: '', sets: (lp ? lp.sets : (['t', 'c'].includes(exType(id)) ? [1] : [1, 2, 3])).map(s => ({ ...newSet(s.t || 'n'), kg: s.kg ?? null, reps: s.reps ?? null, sec: s.sec ?? null, km: s.km ?? null })) };
      return { id: uid(), exId: id, rest: null, note: '', sets: [{ ...newSet(), done: true }] };
    };
    if (P.mode === 'replace') { const old = d.items[P.i]; const n = make(P.sel[0]); n.rest = old.rest; d.items[P.i] = n; }
    else d.items.push(...P.sel.map(make));
    U.pick = null; save(); U.sheets = U.sheets.filter(s => s.t !== 'picker'); renderSheets(); renderEditor();
    if (P.mode === 'add') setTimeout(() => { const b = $('#editor .ed-body'); b && b.scrollTo({ top: b.scrollHeight, behavior: 'smooth' }); }, 60);
  },
  edCancel() { closeEditor(); },
  edSave() {
    const d = U.ed.draft, m = U.ed.mode;
    if (m === 'routine') {
      d.name = d.name.trim() || 'Rutina sin nombre';
      d.items.forEach(it => it.sets.forEach(s => { delete s.done; }));
      const k = S.routines.findIndex(r => r.id === d.id); if (k >= 0) S.routines[k] = d; else S.routines.push(d);
    } else {
      d.name = d.name.trim() || 'Entreno';
      d.items = d.items.map(it => ({ ...it, sets: it.sets.filter(s => s.done) })).filter(it => it.sets.length);
      if (!d.items.length) { toast('Deja al menos una serie completada'); return; }
      const k = S.workouts.findIndex(w => w.id === d.id); if (k >= 0) S.workouts[k] = d;
      S.workouts.sort((a, b) => b.start - a.start);
      recomputePRs();
    }
    saveNow(); U.ed = null; render(); toast('Guardado');
  },

  // rutinas
  newRoutine() { openEditor('routine'); },
  samples() {
    SAMPLES.forEach(s => S.routines.push({ id: uid(), name: s.name, note: '', items: s.items.map(([exId, n, reps]) => ({ exId, rest: null, note: '', sets: Array.from({ length: n }, () => ({ ...newSet(), reps: exType(exId) === 'w' || exType(exId) === 'r' ? reps : null })) })) }));
    save(); render(); toast('Rutinas de ejemplo añadidas');
  },
  rPrev(el) { pushSheet('rPrev', { id: ds(el).id }); },
  rMenu(el) { pushSheet('rMenu', { id: ds(el).id }); },
  rStart(el) { const r = S.routines.find(x => x.id === ds(el).id); U.sheets = []; startWorkout(r); },
  rEdit(el) { openEditor('routine', ds(el).id); },
  rDup(el) { const r = S.routines.find(x => x.id === ds(el).id); const c = clone(r); c.id = uid(); c.name += ' (copia)'; S.routines.splice(S.routines.indexOf(r) + 1, 0, c); save(); U.sheets = []; render(); },
  rUp(el) { const k = S.routines.findIndex(x => x.id === ds(el).id); if (k > 0) [S.routines[k - 1], S.routines[k]] = [S.routines[k], S.routines[k - 1]]; save(); U.sheets = []; render(); },
  rDel(el) { const id = ds(el).id; confirmSheet('¿Eliminar rutina?', 'Tu historial de entrenos no se borra.', 'Eliminar', () => { S.routines = S.routines.filter(r => r.id !== id); if (U.ed && U.ed.mode === 'routine') U.ed = null; save(); U.sheets = []; render(); }); },

  // historial
  calNav(el) { U.cal = addMonths(U.cal, +ds(el).d); render(); },
  wDetail(el) { pushSheet('wDetail', { id: ds(el).id }); },
  wRepeat(el) { const w = S.workouts.find(x => x.id === ds(el).id); U.sheets = []; startWorkout({ id: w.routineId, name: w.name, items: w.items.map(it => ({ exId: it.exId, rest: it.rest, note: it.note, sets: it.sets })) }); },
  wEdit(el) { openEditor('hist', ds(el).id); },
  wAsRoutine(el) { const w = S.workouts.find(x => x.id === ds(el).id); S.routines.push({ id: uid(), name: w.name, note: '', items: w.items.map(it => ({ exId: it.exId, rest: it.rest, note: it.note, sets: it.sets.map(s => ({ t: s.t, kg: s.kg, reps: s.reps, sec: s.sec, km: s.km })) })) }); save(); U.sheets = []; render(); toast('Rutina creada'); },
  wDel(el) { const id = ds(el).id; confirmSheet('¿Eliminar entreno?', 'Esta acción no se puede deshacer.', 'Eliminar', () => { S.workouts = S.workouts.filter(w => w.id !== id); recomputePRs(); save(); U.sheets = []; render(); }); },

  // progreso
  progTab(el) { U.prog = ds(el).v; render(); },
  exDetail(el) { U.metric = 0; pushSheet('exDetail', { id: ds(el).id }); },
  metric(el) { U.metric = +ds(el).v; renderSheets(); },
  bodyAdd(el) {
    const id = ds(el).id, b = id && S.body.find(x => x.id === id);
    U.form = b ? { ...b, weight: b.weight != null ? numIn(toDisp(b.weight)) : '' } : { date: Date.now() };
    ['fat', 'waist', 'chest', 'arm', 'thigh', 'hips'].forEach(k => { if (U.form[k] != null && typeof U.form[k] === 'number') U.form[k] = numIn(U.form[k]); });
    pushSheet('bodyAdd');
  },
  bodySave() {
    const F = U.form, e = { id: F.id || uid(), date: typeof F.date === 'number' ? F.date : new Date(F.date + 'T12:00').getTime() };
    if (!isFinite(e.date)) { toast('Elige una fecha'); return; }
    const w = parseNum(F.weight); e.weight = w == null || w <= 0 ? null : fromDisp(w);
    ['fat', 'waist', 'chest', 'arm', 'thigh', 'hips'].forEach(k => { const v = parseNum(F[k]); if (v != null && v > 0) e[k] = v; });
    if (e.weight == null && !['fat', 'waist', 'chest', 'arm', 'thigh', 'hips'].some(k => e[k] != null)) { toast('Introduce al menos un valor'); return; }
    S.body = S.body.filter(b => b.id !== e.id); S.body.push(e); S.body.sort((a, b) => b.date - a.date);
    save(); U.sheets = []; render();
  },
  bodyDel() { const id = U.form.id; S.body = S.body.filter(b => b.id !== id); save(); U.sheets = []; render(); },

  // biblioteca
  library() { U.libq = ''; pushSheet('library'); },
  exEdit(el) {
    const id = ds(el).id, e = id && S.exercises.find(x => x.id === id);
    const P = U.sheets.some(x => x.t === 'picker') ? U.pick : null;
    U.form = e ? { ...e } : { name: P && P.q ? cap(P.q.trim()) : '', muscle: P && P.m && P.m !== 'Todos' ? P.m : 'Pecho', equip: 'Mancuernas', type: 'w' };
    pushSheet('exEdit'); setTimeout(() => { if (!e) { const i = $('#sheets input[name=name]'); i && i.focus(); } }, 350);
  },
  exSave() {
    const F = U.form; const name = (F.name || '').trim(); if (!name) { toast('Ponle un nombre'); return; }
    if (F.id) { const e = S.exercises.find(x => x.id === F.id); Object.assign(e, { name: name.slice(0, 80), muscle: F.muscle, equip: F.equip, type: exUsed(e.id) ? e.type : F.type }); }
    else { const e = { id: 'c' + uid(), name: name.slice(0, 80), muscle: F.muscle, equip: F.equip, type: F.type, custom: true }; S.exercises.push(e); const P = U.sheets.some(x => x.t === 'picker') ? U.pick : null; if (P && P.mode === 'add') P.sel.push(e.id); if (P) P.q = ''; }
    save(); popSheet(); render();
  },
  exDel() { const e = S.exercises.find(x => x.id === U.form.id); if (exUsed(e.id)) e.hidden = true; else S.exercises = S.exercises.filter(x => x !== e); save(); U.sheets = U.sheets.filter(s => s.t !== 'exEdit' && s.t !== 'exDetail'); render(); },
  exUnhide(el) { const e = S.exercises.find(x => x.id === ds(el).id); e.hidden = false; save(); renderSheets(); },

  // ajustes
  setv(el) {
    const k = ds(el).k, v = ds(el).v;
    if (k === 'unit' && v !== S.settings.unit) { const s = S.settings; const wasDef = JSON.stringify(s.plates) === JSON.stringify(DEFAULT_SETTINGS.plates) || s.plates.every(p => PLATES[s.unit].includes(p)); s.bar = v === 'lb' ? 45 : 20; if (wasDef) s.plates = v === 'lb' ? [...PLATES.lb] : [...DEFAULT_SETTINGS.plates]; s.increment = v === 'lb' ? 5 : 2.5; }
    S.settings[k] = v; save(); applyTheme(); render();
  },
  accent(el) { S.settings.accent = ds(el).v; save(); applyTheme(); render(); },
  step(el) { const k = ds(el).k; S.settings[k] = Math.max(1, Math.min(7, S.settings[k] + +ds(el).d)); save(); render(); },
  plateToggle(el) { const v = +ds(el).v, p = S.settings.plates; S.settings.plates = p.includes(v) ? p.filter(x => x !== v) : [...p, v].sort((a, b) => b - a); save(); render(); },
  plates(el) {
    U.plw = '';
    if (ds(el).i != null && doc()) { const it = item(el); const s = [...it.sets].reverse().find(x => x.kg != null || (x.ph && x.ph.kg != null)); if (s) U.plw = numIn(toDisp(s.kg ?? s.ph.kg)); popSheet(); }
    pushSheet('plates');
  },
  orm() { pushSheet('orm'); },
  async exportJSON() {
    const name = `calm-gym-copia-${new Date().toISOString().slice(0, 10)}.json`;
    const ok = await shareFile(name, JSON.stringify({ ...S, rest: null }, null, 1), 'application/json');
    if (ok) { S.lastBackup = Date.now(); save(); render(); }
  },
  async exportCSV() {
    const rows = [['Fecha', 'Entreno', 'Ejercicio', 'Serie', 'Tipo', 'Peso (kg)', 'Reps', 'Tiempo (s)', 'Distancia (km)', 'RPE', 'Nota']];
    [...S.workouts].reverse().forEach(w => w.items.forEach(it => it.sets.forEach((s, j) => rows.push([new Date(w.start).toISOString().slice(0, 16).replace('T', ' '), w.name, getEx(it.exId).name, j + 1, SET_T[s.t], s.kg ?? '', s.reps ?? '', s.sec ?? '', s.km ?? '', s.rpe ?? '', j ? '' : it.note || '']))));
    const csv = '﻿' + rows.map(r => r.map(c => { c = String(c); return /[;"\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c; }).join(';')).join('\n');
    await shareFile(`calm-gym-${new Date().toISOString().slice(0, 10)}.csv`, csv, 'text/csv');
  },
  wipe() { confirmSheet('¿Borrar todos los datos?', 'Se eliminarán entrenos, rutinas, medidas y ajustes de este iPhone. Haz antes una copia si la quieres conservar.', 'Borrar todo', () => { S = freshState(); U.ed = null; U.sheets = []; saveNow(); applyTheme(); render(); toast('Datos borrados'); }); },
};

async function shareFile(name, text, mime) {
  const blob = new Blob([text], { type: mime });
  try {
    const file = new File([blob], name, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return true; }
  } catch (e) { if (e && e.name === 'AbortError') return false; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  return true;
}
function importFile(file) {
  const rd = new FileReader();
  rd.onload = () => {
    let o; try { o = JSON.parse(rd.result); } catch (e) { toast('Archivo no válido'); return; }
    if (!o || !Array.isArray(o.workouts) || !Array.isArray(o.exercises)) { toast('No es una copia de esta app'); return; }
    confirmSheet('¿Restaurar copia?', `Contiene ${o.workouts.length} entrenos y ${(o.routines || []).length} rutinas. Sustituirá los datos actuales.`, 'Restaurar', () => { S = normalize(o); S.rest = null; recomputePRs(); saveNow(); applyTheme(); U.sheets = []; render(); toast('Copia restaurada'); }, false);
  };
  rd.readAsText(file);
}

/* =========================================================
   EVENTOS
   ========================================================= */
document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-a]'); if (!el || el.disabled) return;
  const fn = A[el.dataset.a]; if (!fn) return;
  ev.preventDefault();
  try { const r = fn(el, ev); if (r && r.catch) r.catch(err => { console.error(err); toast('Algo ha fallado'); }); }
  catch (err) { console.error(err); toast('Algo ha fallado'); try { saveNow(); render(); } catch (e2) { } }
});
document.addEventListener('pointerdown', audioUnlock, { passive: true });
function onField(ev) {
  const el = ev.target, f = el.dataset && el.dataset.f; if (!f) return;
  const d = doc();
  switch (f) {
    case 's': setField(d.items[+el.dataset.i].sets[+el.dataset.j], el.dataset.k, el.value); save(); break;
    case 'name': d.name = el.value; save(); break;
    case 'dnote': d.note = el.value; save(); break;
    case 'inote': d.items[+el.dataset.i].note = el.value; save(); renderEditor(); break;
    case 'hdate': { const t = new Date(el.value).getTime(); if (!isNaN(t)) { const dur = d.end - d.start; d.start = t; d.end = t + dur; } break; }
    case 'hdur': { const n = parseNum(el.value); if (n != null) d.end = d.start + n * 60000; break; }
    case 'pickq': U.pick.q = el.value; $('#pickList').innerHTML = pickListHTML(); break;
    case 'libq': U.libq = el.value; $('#libList').innerHTML = libBody(); break;
    case 'exq': U.exq = el.value; $('#exList').innerHTML = exListHTML(); break;
    case 'plw': U.plw = el.value; $('#plOut').innerHTML = platesHTML(); break;
    case 'ormw': U.ormw = el.value; $('#ormOut').innerHTML = ormHTML(); break;
    case 'ormr': U.ormr = el.value; $('#ormOut').innerHTML = ormHTML(); break;
    case 'form': U.form[el.name] = el.value; break;
  }
}
document.addEventListener('input', ev => { try { onField(ev); } catch (err) { console.error(err); } });
document.addEventListener('change', ev => {
  const el = ev.target;
  if (el.hasAttribute('data-import')) { if (el.files[0]) importFile(el.files[0]); el.value = ''; return; }
  if (el.dataset.f) { if (['hdate', 'hdur', 'form'].includes(el.dataset.f)) { try { onField(ev); } catch (err) { console.error(err); } } return; }
  const k = el.dataset.set; if (!k) return;
  let v = el.type === 'checkbox' ? el.checked : el.value;
  if (k === 'rest') v = +v;
  if (k === 'bar' || k === 'increment') v = parseNum(v) || 0;
  S.settings[k] = v; save(); applyTheme();
  if (k === 'wakeLock') { v ? requestWake() : releaseWake(); }
  if (el.type !== 'checkbox') render();
});
document.addEventListener('focusin', ev => { const el = ev.target; if (el.dataset && el.dataset.f === 's') setTimeout(() => { try { el.select(); } catch (e) { } }, 0); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveNow();
  else { if (S.active) requestWake(); updateTimers(true); if (U.tab === 'train' && !U.ed) render(); }
});
window.addEventListener('pagehide', saveNow);
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { applyTheme(); });

// ---------- arranque ----------
(async function init() {
  await load();
  applyTheme();
  render();
  if (S.active) requestWake();
  setInterval(() => updateTimers(false), 500);
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    const hadCtrl = !!navigator.serviceWorker.controller; let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hadCtrl && !reloaded && !U.ed) { reloaded = true; saveNow(); location.reload(); } });
    navigator.serviceWorker.register('sw.js').catch(() => { });
  }
})();
