(() => {
const L = HubLogic;
const DEFAULT_SETTINGS = {
  player: 'Jaxson', bats: 'left', gameBatOz: 19, level: 1, tankLb: null, medBallLb: null, dailyMax: 75,
  batList: [
    { id: 'game', name: 'Easton Hype Fire 29"', oz: 19, est: false, role: 'Game bat' },
    { id: 'practice', name: 'Practice bats 29"', oz: 19, est: false, role: 'Game-weight swings' },
    { id: 'unloaded', name: 'SKLZ unloaded 31"', oz: 18.4, est: true, role: 'Fast swings' },
    { id: 'hand', name: 'SKLZ hand-loaded 31"', oz: 27.6, est: true, role: 'Heavy, tee only' },
    { id: 'end', name: 'SKLZ end-loaded 31"', oz: 27.6, est: true, role: 'Heavy, tee only' },
    { id: 'camwood', name: 'CamWood trainer 29"', oz: 35, est: true, role: 'Swing path, tee only' },
    { id: 'skinny', name: 'Skinny bat', oz: null, est: true, role: 'Pitching machine' }
  ]
};
const ICONS = {
  star: '<path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9z" fill="currentColor"/>',
  flame: '<path d="M12 2c1 3.5 5 5.5 5 10.5A5 5 0 0 1 7 12.5c0-1.6.6-2.8 1.5-3.8.3 1.3 1 2 2 2.3C10 8 10.5 4.5 12 2z" fill="currentColor"/>',
  bolt: '<path d="M13.5 2L5 13.5h5.5L9.5 22 19 10h-5.8z" fill="currentColor"/>',
  trophy: '<path d="M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3zm-1 4v1a2 2 0 0 0 1 1.7V7zm12 0h-1v2.7A2 2 0 0 0 18 8z" fill="currentColor"/>',
  target: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="5" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>',
  bat: '<path d="M4 20l8.5-8.5" stroke="currentColor" stroke-width="3" stroke-linecap="round"/><path d="M11.5 12.5l6-7a2.3 2.3 0 0 1 3.3 3.3l-7 6z" fill="currentColor"/><circle cx="6" cy="8" r="2.6" fill="currentColor"/>',
  flag: '<path d="M5 3v18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/><path d="M6.5 4h11l-2.5 4 2.5 4h-11z" fill="currentColor"/>',
  play: '<rect x="3" y="5" width="18" height="14" rx="2" fill="none" stroke="currentColor" stroke-width="2.2"/><path d="M10 9l5 3-5 3z" fill="currentColor"/>'
};
const FRAME_NAMES = ['Stance', 'Load', 'Stride', 'Launch', 'Just before', 'Contact', 'Extension', 'Finish'];
const FRAME_OFFSETS = [-1, -0.5, -0.25, -0.1, -0.033, 0, 0.1, 0.3];
const state = { route: 'today', entries: [], settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), dbState: 'connecting',
  ticks: {}, counts: {}, form: {}, slot: null, snap: null, confirmDel: null, dirty: false, gearDraft: null, cheer: null, openCheck: null, cmpA: null, cmpB: null, unlocked: null, pinMsg: '',
  needKey: false, keyMsg: '', keyBusy: false, keyNet: false, loading: false, media: {}, mediaAsked: {} };
const film = { file: null, url: null, video: null, ready: false, busy: false, msg: '', step: '' };
// Parent code: a speed bump that keeps the Coach side with a parent. It is not encryption.
const pinHash = pin => { let x = 5381; const s = 'dugout:' + pin; for (let i = 0; i < s.length; i++) x = ((x * 33) ^ s.charCodeAt(i)) >>> 0; return 'h' + x.toString(36); };
const locked = () => !!state.settings.pinHash && state.unlocked !== state.settings.pinHash;
const relock = () => { state.unlocked = null; };
function unlockBox(why) {
  const tryIt = () => { const el = document.getElementById('pin-in'), v = el ? el.value.trim() : '';
    if (pinHash(v) === state.settings.pinHash) { state.unlocked = state.settings.pinHash; state.pinMsg = ''; render(); }
    else { state.pinMsg = 'That code is not right. Try again.'; render(); const e2 = document.getElementById('pin-in'); if (e2) e2.focus(); } };
  return h('section', { class: 'sec' }, h('h2', null, 'Parent code'), why ? h('p', null, why) : null,
    h('div', { class: 'row' }, h('label', { class: 'fld', for: 'pin-in', style: 'flex:0 1 200px' }, h('span', null, 'Code'),
      h('input', { id: 'pin-in', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '6', onkeydown: e => { if (e.key === 'Enter') tryIt(); } })),
      h('button', { type: 'button', class: 'btn', onclick: tryIt }, 'Unlock')),
    state.pinMsg ? h('p', { class: 'status stop', role: 'alert' }, state.pinMsg) : null,
    h('p', { class: 'small mid' }, 'Forgot it? Ask Claude in chat to clear the parent code.'));
}
let saving = false;
// A second tap while a save is still running is ignored, so nothing is logged twice.
const guard = fn => async (...a) => { if (saving) return; saving = true; try { await fn(...a); } finally { saving = false; } };

const $view = document.getElementById('view'), $toast = document.getElementById('toast'), $tabs = document.getElementById('tabs'), $cheer = document.getElementById('cheer');
const pad = n => String(n).padStart(2, '0');
const today = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
const fmtDate = s => s ? L.parse(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '';
const fix = (v, n) => v == null ? '–' : Number(v).toFixed(n == null ? 1 : n);
const pcs = v => v == null ? '–' : Math.round(v * 100) + '%';
const commas = n => Number(n).toLocaleString('en-US');
const who = () => state.settings.player || 'Player';
const str = (v, n) => typeof v === 'string' ? v.slice(0, n || 240) : '';

function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.slice(0, 2) === 'on') el.addEventListener(k.slice(2), v);
    else if (typeof v !== 'string' && k in el) el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) { if (c == null || c === false) continue; el.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return el;
}
function svg(markup, cls) { const s = h('span', { 'aria-hidden': 'true' }); s.style.display = 'contents'; s.innerHTML = '<svg viewBox="0 0 24 24"' + (cls ? ' class="' + cls + '"' : '') + '>' + markup + '</svg>'; return s; }
const icon = name => svg(ICONS[name] || ICONS.star);
let toastTimer = null;
function toast(msg) { $toast.textContent = msg; $toast.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $toast.classList.remove('on'), 4500); }

/* ---------- data: saved in the family database, behind the family code ---------- */
const KEY_STORE = 'dugout-key';
const normKey = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
function readKey() {
  let k = '';
  let out = false; try { out = localStorage.getItem('dugout-out') === '1'; } catch (e) {}
  if (!out) { try { k = new URLSearchParams(location.search).get('k') || ''; } catch (e) {} }
  if (!k) { try { k = localStorage.getItem(KEY_STORE) || ''; } catch (e) {} }
  return normKey(k);
}
function storeKey(k) { try { localStorage.setItem(KEY_STORE, k); localStorage.removeItem('dugout-out'); } catch (e) {} }
function forgetKey() { try { localStorage.removeItem(KEY_STORE); } catch (e) {} }
let familyKey = '', polling = false;
// The page talks straight to the database's own functions; every one checks the family code itself.
const SUPA_RPC = 'https://yglqvmdrocoknogamagr.supabase.co/rest/v1/rpc/';
const SUPA_KEY = 'sb_publishable_C6Z4sJSfrNNs3OLah7ljhw_oPFMordt';   // public by design; it opens nothing without the family code
const RPC = {
  check: b => ['hub_check', {}],
  load: b => ['hub_load', {}],
  media: b => ['hub_media', { p_ids: b.ids }],
  add: b => ['hub_add', { p_ts: Math.round(b.ts), p_data: b.data, p_media: b.media || null }],
  del: b => ['hub_remove', { p_id: b.id }],
  settings: b => ['hub_save_settings', { p_data: b.data }]
};
async function api(op, body) {
  const [fn, args] = RPC[op](body || {});
  let res;
  try {
    res = await fetch(SUPA_RPC + fn, { method: 'POST', cache: 'no-store',
      headers: { apikey: SUPA_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(Object.assign({ k: familyKey }, args)) });
  } catch (e) { throw { code: 'offline' }; }
  let data = null; try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw { code: res.status === 403 || res.status === 401 ? 'denied' : res.status === 400 ? 'rejected' : 'unavailable', status: res.status };
  if (op === 'check' && data !== true) throw { code: 'denied' };
  return data || {};
}
function dbMsg(e) {
  const c = e && e.code;
  if (c === 'denied') { state.needKey = true; state.keyMsg = 'This device needs the family code again.'; render(); return 'The family code was not accepted, so nothing was saved.'; }
  if (c === 'offline') return 'No internet connection, so nothing was saved.';
  if (c === 'rejected') return 'That entry was not valid, so it was not saved.';
  return 'The hub could not be reached, so nothing was saved. Try again in a minute.';
}
async function addEntry(obj) {
  const e = Object.assign({ ts: Date.now() }, obj), media = Array.isArray(e.thumbs) ? { thumbs: e.thumbs } : null;
  delete e.thumbs; delete e.id;
  if (e.date && e.date > today()) { toast('That date is in the future. Pick today or an earlier day.'); return false; }
  if (e.date && !/^\d{4}-\d{2}-\d{2}$/.test(e.date)) { toast('Pick a date first.'); return false; }
  try {
    const row = await api('add', { ts: e.ts, data: e, media });
    state.entries = [Object.assign({}, e, { id: row.id })].concat(state.entries);
    if (media) state.media[row.id] = media.thumbs;
    return true;
  } catch (err) { toast(dbMsg(err)); return false; }
}
async function delEntry(id) {
  try { await api('del', { id }); state.entries = state.entries.filter(e => e.id !== id); delete state.media[id]; }
  catch (err) { toast(dbMsg(err)); }
}
async function saveSettings(next) {
  const prev = state.settings; state.settings = next; render();
  try { await api('settings', { data: next }); toast('Saved.'); }
  catch (err) { state.settings = prev; if (state.gearDraft) state.gearDraft = null; render(); toast(dbMsg(err)); }
}
function mergeSettings(d) {
  const s = Object.assign(JSON.parse(JSON.stringify(DEFAULT_SETTINGS)), d || {});
  if (Array.isArray(d && d.bats)) { s.batList = d.bats; s.bats = DEFAULT_SETTINGS.bats; }
  if (!Array.isArray(s.batList) || !s.batList.length) s.batList = JSON.parse(JSON.stringify(DEFAULT_SETTINGS.batList));
  if (s.bats !== 'left' && s.bats !== 'right') s.bats = 'left';
  if (!s.player) s.player = DEFAULT_SETTINGS.player;
  return s;
}
const typing = () => { const a = document.activeElement; return !!(a && $view.contains(a) && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)); };
function softRender() { if (typing() || film.busy) { state.dirty = true; return; } render(); }
$view.addEventListener('focusout', () => { if (state.dirty) setTimeout(() => { if (!typing() && !film.busy) { state.dirty = false; render(); } }, 60); });

async function load() {
  if (state.loading || saving || state.needKey) return;
  state.loading = true;
  try {
    const d = await api('load');
    state.entries = (d.entries || []).map(r => Object.assign({}, r.data, { id: r.id, ts: r.ts }));
    if (d.settings) state.settings = mergeSettings(d.settings);
    state.cut = d.total > state.entries.length;
    state.dbState = 'live';
  } catch (err) {
    if (err.code === 'denied') { state.needKey = true; state.keyMsg = 'This device needs the family code again.'; }
    else state.dbState = state.entries.length ? 'stale' : 'none';
  }
  state.loading = false; softRender();
}
function startPolling() {
  if (polling) return; polling = true;
  setInterval(() => { if (document.visibilityState === 'visible') load(); }, 60000);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') load(); });
}
async function tryKey(k, typed) {
  familyKey = normKey(k); state.keyBusy = true; state.keyMsg = ''; render();
  try {
    await api('check');
    storeKey(familyKey); state.needKey = false; state.keyBusy = false; state.dbState = 'connecting';
    render(); await load(); startPolling();
  } catch (err) {
    state.keyBusy = false; state.needKey = true; state.keyNet = err.code !== 'denied';
    state.keyMsg = err.code === 'denied' ? (typed ? 'That code did not open the hub. Check it and try again.' : 'This device needs the family code.')
      : err.code === 'offline' ? 'No internet connection. Connect, then try again.' : 'The hub could not be reached. Try again in a minute.';
    if (err.code === 'denied' && !typed) forgetKey();
    render();
  }
}
const mediaOf = e => (e && state.media[e.id]) || null;
function needMedia(list) {
  const ids = list.filter(e => e && e.id && !state.media[e.id] && !state.mediaAsked[e.id]).map(e => e.id).slice(0, 20);
  if (!ids.length) return;
  ids.forEach(id => { state.mediaAsked[id] = true; });
  api('media', { ids }).then(d => { for (const r of d.rows || []) state.media[r.id] = r.media && Array.isArray(r.media.thumbs) ? r.media.thumbs : []; softRender(); })
    .catch(() => { ids.forEach(id => { delete state.mediaAsked[id]; }); });
}
function viewSetup() {
  const go = () => { const v = (document.getElementById('fam-code') || {}).value || ''; if (normKey(v).length < 8) { state.keyMsg = 'Enter the whole family code.'; render(); return; } tryKey(v, true); };
  return page(strip('Dugout Hub', 'Enter the family code to open the hub on this device. You only do this once.'),
    h('section', { class: 'sec plain' },
      h('div', { class: 'row' }, h('label', { class: 'fld', for: 'fam-code', style: 'flex:1 1 260px' }, h('span', null, 'Family code'),
        h('input', { id: 'fam-code', type: 'text', autocomplete: 'off', autocapitalize: 'characters', spellcheck: false, placeholder: 'XXXX-XXXX-XXXX-XXXX-XXXX', disabled: state.keyBusy, onkeydown: e => { if (e.key === 'Enter') go(); } })),
        h('button', { type: 'button', class: 'btn', disabled: state.keyBusy, onclick: go }, state.keyBusy ? 'Opening...' : 'Open the hub')),
      state.keyMsg ? h('p', { class: 'status ' + (state.keyNet ? 'wait' : 'stop'), role: 'alert' }, state.keyMsg) : null,
      state.keyNet && familyKey ? h('div', null, h('button', { type: 'button', class: 'btn line', onclick: () => tryKey(familyKey, false) }, 'Try again')) : null,
      h('p', { class: 'small mid' }, 'The code is on the setup message. Opening the hub from the setup link fills it in for you.')));
}

async function boot() {
  route();
  familyKey = readKey();
  if (!familyKey) { state.needKey = true; render(); return; }
  await tryKey(familyKey, false);
}

/* ---------- shared bits ---------- */
function banner() {
  const m = { none: 'The hub could not be reached. Check the internet connection; it tries again every minute.',
    stale: 'Showing what was loaded last. The hub could not be reached just now.',
    slow: 'Still reaching the saved data. What you see may be out of date.' }[state.dbState];
  if (!m && state.cut) return h('p', { class: 'note' }, 'Only the newest 20,000 entries are loaded, so some old totals may read low. Tell Claude to raise the limit.');
  return m ? h('p', { class: 'note' }, m) : null;
}
function inp(key, label, o) {
  o = o || {};
  if (state.form[key] == null && o.def != null) state.form[key] = String(o.def);
  const type = o.type || 'number', id = 'f-' + key;
  return h('label', { class: 'fld', for: id }, h('span', null, label),
    h('input', { id, type, inputmode: type === 'number' ? (o.mode || 'decimal') : null, step: type === 'number' ? 'any' : null, min: type === 'number' ? '0' : null,
      value: state.form[key] == null ? '' : state.form[key], oninput: e => { state.form[key] = e.target.value; } }));
}
function sel(key, label, opts, def) {
  if (state.form[key] == null) state.form[key] = def;
  const id = 'f-' + key;
  return h('label', { class: 'fld', for: id }, h('span', null, label),
    h('select', { id, onchange: e => { state.form[key] = e.target.value; } }, opts.map(o => h('option', { value: o[0], selected: state.form[key] === o[0] }, o[1]))));
}
const num = key => { const v = parseFloat(state.form[key]); return isFinite(v) ? v : null; };
const clear = (...keys) => keys.forEach(k => delete state.form[k]);
function spark(points, unit) {
  const w = h('div');
  if (points.length < 2) { w.append(h('p', { class: 'small mid' }, points.length ? 'One entry so far. The line appears after the second.' : 'No entries yet.')); return w; }
  const vs = points.map(p => p.v), lo = Math.min.apply(null, vs), hi = Math.max.apply(null, vs), span = (hi - lo) || 1;
  const X = i => 6 + i * (288 / (points.length - 1)), Y = v => 62 - (v - lo) / span * 48, last = points.length - 1;
  const line = points.map((p, i) => (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1)).join(' ');
  w.innerHTML = '<svg class="spark" viewBox="0 0 300 84" role="img" aria-label="Trend from ' + fix(vs[0]) + ' to ' + fix(vs[last]) + ' ' + unit + '">' +
    '<line x1="6" x2="294" y1="14" y2="14" stroke="#cdd5df"/><line x1="6" x2="294" y1="62" y2="62" stroke="#cdd5df"/>' +
    '<path d="' + line + ' L294 70 L6 70 Z" fill="#93cff2" opacity=".45"/><path d="' + line + '" fill="none" stroke="#0d2b55" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>' +
    '<circle cx="' + X(last).toFixed(1) + '" cy="' + Y(vs[last]).toFixed(1) + '" r="5" fill="#d2342a" stroke="#fff" stroke-width="2"/>' +
    '<text x="6" y="10" font-size="10" fill="#55667f">high ' + fix(hi) + '</text><text x="6" y="80" font-size="10" fill="#55667f">low ' + fix(lo) + '</text></svg>';
  return w;
}
function strip(title, sub) { return h('div', { class: 'strip' }, h('div', { class: 'in' }, h('h1', null, title), sub ? h('p', { class: 'mid' }, sub) : null)); }
const page = (head, ...body) => [head, h('main', { class: 'in' }, banner(), body)];

/* ---------- Player: jersey header ---------- */
function diamond(frac) {
  const P = [[66, 118], [118, 66], [66, 14], [14, 66], [66, 118]], seg = Math.min(3, Math.floor(frac * 4)), t = frac * 4 - seg;
  const x = P[seg][0] + (P[seg + 1][0] - P[seg][0]) * t, y = P[seg][1] + (P[seg + 1][1] - P[seg][1]) * t, side = 73.54, total = side * 4;
  const base = (i, on) => '<rect x="' + (P[i][0] - 8) + '" y="' + (P[i][1] - 8) + '" width="16" height="16" transform="rotate(45 ' + P[i][0] + ' ' + P[i][1] + ')" fill="' + (on ? '#0d2b55' : '#fff') + '" stroke="#0d2b55" stroke-width="3"/>';
  const w = h('span', { role: 'img', 'aria-label': Math.round(frac * 100) + ' percent of the way around the bases' }); w.style.display = 'contents';
  w.innerHTML = '<svg viewBox="0 0 132 132"><path d="M66 118L118 66L66 14L14 66Z" fill="none" stroke="#fff" stroke-width="9" stroke-linejoin="round"/>' +
    '<path d="M66 118L118 66L66 14L14 66Z" fill="none" stroke="#0d2b55" stroke-width="5" stroke-linejoin="round" stroke-dasharray="' + (frac * total).toFixed(1) + ' ' + total + '"/>' +
    base(1, frac >= .25) + base(2, frac >= .5) + base(3, frac >= .75) +
    '<path d="M58 118h16v-8l-8-7-8 7z" fill="#fff" stroke="#0d2b55" stroke-width="3" stroke-linejoin="round"/>' +
    '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="8" fill="#d2342a" stroke="#fff" stroke-width="3"/></svg>';
  return w;
}
function jersey(p) {
  const g = L.game(state.entries), earned = L.badges(state.entries).filter(b => b.on).length, st = L.streak(state.entries, p.t);
  const tail = h('span', { 'aria-hidden': 'true' }); tail.style.display = 'contents';
  tail.innerHTML = '<svg class="tail" viewBox="0 0 430 46"><path d="M4 20C120 2 290 4 426 16C300 18 170 26 92 42C120 28 80 22 4 20Z" fill="#0d2b55" stroke="#fff" stroke-width="2.5" stroke-linejoin="round"/></svg>';
  return h('div', { class: 'jersey' }, h('div', { class: 'in' },
    h('div', null, h('div', { class: 'name' }, who()), tail,
      h('div', { class: 'rank' }, 'Level ' + g.level + ' ' + g.title),
      h('div', { class: 'line' }, h('span', null, h('b', null, st), st === 1 ? ' week streak' : ' week streak'), h('span', null, h('b', null, p.wk.count + ' of 3'), ' sessions this week'), h('span', null, h('b', null, earned), earned === 1 ? ' badge' : ' badges'))),
    h('div', { class: 'bases' }, diamond(g.frac), h('div', null, h('div', { class: 'xp num' }, g.into + ' XP'), h('div', null, g.baseText), h('div', { class: 'small' }, (g.need - g.into) + ' more to score and reach Level ' + (g.level + 1))))));
}

/* ---------- Player: Today ---------- */
function plan() {
  const t = today(), wk = L.weekInfo(state.entries, t), arm = L.armStatus(state.entries, t, state.settings.dailyMax);
  const tuned = L.tune(state.entries, t);
  const pick = wk.lockedFocus ? { focus: wk.lockedFocus, why: wk.lockedWhy || '' } : L.decideFocus(L.stats(state.entries, t), state.entries, t, tuned.rules);
  if (!L.FOCUS[pick.focus]) pick.focus = 'baseline';
  return { t, wk, arm, pick, tuned, week: L.buildWeek(pick.focus, state.settings.level, !arm.cleared) };
}
const checks = () => state.entries.filter(e => e.kind === 'analysis').sort(L.byDate).reverse();
function viewToday() {
  const p = plan(), slots = ['A', 'B', 'C'], F = L.FOCUS[p.pick.focus];
  if (!state.slot || !p.week[state.slot]) state.slot = slots.find(s => !p.wk.done[s]) || 'A';
  const ses = p.week[state.slot], tk = p.wk.monday + state.slot;
  const ticks = state.ticks[tk] || (state.ticks[tk] = {}), counts = state.counts[tk] || (state.counts[tk] = {});
  const items = ses.blocks.flatMap(b => b.items), doneN = items.filter(i => ticks[i.id]).length, isDone = !!p.wk.done[state.slot];
  const last = checks()[0]; let n = 0;
  return page(jersey(p), h('div', { class: 'two' },
    h('div', { class: 'stack' },
      h('section', { class: 'sec' }, h('h2', null, 'This week: ' + F.name), h('p', { class: 'say' }, F.kid),
        p.arm.cleared ? null : h('p', { class: 'note' }, 'Arm rest until ' + fmtDate(L.addDays(p.arm.clearedOn, -1)) + '. No throwing drills today.')),
      last && str(last.fix && last.fix.title) ? h('section', { class: 'sec' }, h('h2', null, 'From your last filmstrip'), h('p', { class: 'say' }, str(last.fix && last.fix.title, 80)),
        h('p', null, h('a', { href: '#film' }, 'Open the film room'))) : null),
    h('div', { class: 'stack' },
      slots.every(s => p.wk.done[s]) ? h('div', { class: 'weekdone' }, h('b', null, 'Week complete!'), h('span', null, 'All 3 days done. A new plan shows up Monday.')) : null,
      h('div', { class: 'stabs', role: 'group', 'aria-label': 'Pick a session' }, slots.map(s => h('button', { type: 'button', 'aria-pressed': String(state.slot === s), onclick: () => { state.slot = s; render(); } },
        p.week[s].title, h('small', null, p.week[s].sub), h('small', null, p.wk.done[s] ? 'Done ✓' : p.week[s].min + ' minutes')))),
      h('div', null, ses.blocks.map(b => [
        h('div', { class: 'inning' }, h('span', null, b.name), h('span', { class: 'num' }, b.min + ' min')),
        b.items.map(i => { n++; const on = !!ticks[i.id] || isDone; return [
          h('button', { type: 'button', class: 'li', 'aria-pressed': String(on), disabled: isDone, onclick: () => { ticks[i.id] = !ticks[i.id]; saveTicks(); render(); } },
            h('span', { class: 'n' }, n), h('span', null, h('span', { class: 't' }, i.title), h('span', { class: 'd' }, i.text)), h('span', { class: 'mark' })),
          i.count && !isDone ? h('div', { class: 'count' }, h('label', { for: 'cnt-' + i.id }, 'Solid hits'),
            h('input', { id: 'cnt-' + i.id, type: 'number', inputmode: 'numeric', min: '0', max: String(i.count), value: counts[i.id] == null ? '' : counts[i.id], oninput: e => { counts[i.id] = e.target.value; saveTicks(); } }),
            h('span', { class: 'mid' }, 'out of ' + i.count)) : null]; })])),
      isDone ? h('p', { class: 'status ok' }, ses.title + ' is done for this week.')
        : h('button', { type: 'button', class: 'btn big', disabled: doneN < items.length, onclick: guard(() => finish(p, ses, tk)) },
          doneN < items.length ? (items.length - doneN) + ' to go' : 'Finish and collect ' + L.XP[state.slot] + ' XP'))));
}
function saveTicks() { try { localStorage.setItem('dugout-ticks', JSON.stringify({ t: state.ticks, c: state.counts })); } catch (e) {} }
async function finish(p, ses, tk) {
  const counts = state.counts[tk] || {}, before = L.badges(state.entries).filter(b => b.on).map(b => b.id), lvlBefore = L.game(state.entries).level;
  const added = [{ kind: 'session', date: p.t, slot: state.slot, focus: p.pick.focus, why: p.pick.why, complete: true, level: state.settings.level, ts: Date.now() }];
  if (!(await addEntry(added[0]))) return;
  for (const i of ses.blocks.flatMap(b => b.items)) {
    const made = parseInt(counts[i.id], 10);
    if (i.count && isFinite(made)) { const m = { kind: 'machine', date: p.t, made: Math.max(0, Math.min(made, i.count)), of: i.count, from: added[0].ts }; added.push(m); await addEntry(m); }
  }
  const credit = L.sessionReps(ses);
  if (credit.swings + credit.pushups + credit.situps + credit.squats > 0) { const r = Object.assign({ kind: 'reps', date: p.t, from: added[0].ts, slot: added[0].slot }, credit); added.push(r); await addEntry(r); }
  const after = state.entries;
  const g = L.game(after);
  state.cheer = { title: ses.title + ' done', xp: L.XP[added[0].slot], badges: L.badges(after).filter(b => b.on && before.indexOf(b.id) < 0), levelUp: g.level > lvlBefore ? g : null, base: g.baseText,
    logged: [[credit.swings, 'swings'], [credit.squats, 'squats'], [credit.pushups, 'push-ups'], [credit.situps, 'sit-ups']].filter(x => x[0] > 0).map(x => x[0] + ' ' + x[1]).join(', ') };
  delete state.ticks[tk]; delete state.counts[tk]; saveTicks(); state.slot = null; render();
}
function renderCheer() {
  const c = state.cheer;
  if (!c) { $cheer.replaceChildren(); return; }
  $cheer.replaceChildren(h('div', { class: 'cheer', role: 'dialog', 'aria-modal': 'true', 'aria-label': c.title },
    h('div', { class: 'box' }, h('h1', null, c.title), h('div', { class: 'gain' }, '+' + c.xp + ' XP'),
      h('p', { class: 'say' }, c.levelUp ? 'You scored. Level ' + c.levelUp.level + ', ' + c.levelUp.title + '.' : c.base + '.'),
      c.logged ? h('p', null, 'Logged for you: ' + c.logged + '.') : null,
      c.badges.map(b => h('p', { class: 'say' }, 'New badge: ', h('b', null, b.name))),
      h('button', { type: 'button', class: 'btn big', id: 'cheer-ok', onclick: () => { state.cheer = null; renderCheer(); } }, 'Back to the dugout'))));
  const ok = document.getElementById('cheer-ok'); if (ok) ok.focus();
}

/* ---------- Player: Film room ---------- */
function loadFilm(file) {
  if (!file) return;
  if (film.url) URL.revokeObjectURL(film.url);
  const v = document.createElement('video');
  v.muted = true; v.defaultMuted = true; v.setAttribute('muted', ''); v.playsInline = true; v.setAttribute('playsinline', ''); v.preload = 'auto'; v.controls = false;
  v.autoplay = true;   // iPad Safari only loads frames once a muted clip starts; it is paused as soon as the first frame arrives
  film.file = file; film.url = URL.createObjectURL(file); film.video = v; film.ready = false; film.needTap = false; film.msg = ''; film.step = '';
  const ready = () => { if (film.video !== v) return; try { v.pause(); } catch (e) {} if (film.ready) return; film.ready = true; film.needTap = false;
    try { v.currentTime = Math.min(v.duration / 2, Math.max(0, v.duration - 0.05)); } catch (e) {} render(); };
  v.addEventListener('loadeddata', ready); v.addEventListener('playing', ready);
  setTimeout(() => { if (film.video === v && !film.ready) { film.needTap = true; render(); } }, 5000);
  v.addEventListener('error', () => { film.msg = 'This video could not be opened here. Try a shorter clip, or record it in the standard camera format.'; film.video = null; render(); });
  v.addEventListener('seeked', () => { const s = document.getElementById('scrub'), t = document.getElementById('scrub-t'); if (s && !film.busy) s.value = String(v.currentTime); if (t) t.textContent = v.currentTime.toFixed(2) + ' s'; });
  v.src = film.url; v.load(); render();
}
function seekTo(v, t) {
  return new Promise(res => {
    const tt = Math.max(0, Math.min((v.duration || 0) - 0.02, t));
    if (Math.abs(v.currentTime - tt) < 0.004) return res();
    let done = false; const fin = () => { if (done) return; done = true; v.removeEventListener('seeked', fin); setTimeout(res, 90); };
    v.addEventListener('seeked', fin); setTimeout(fin, 3000); v.currentTime = tt;
  });
}
function grab(v, maxSide) {
  const s = Math.min(1, maxSide / Math.max(v.videoWidth, v.videoHeight)), c = document.createElement('canvas');
  c.width = Math.max(2, Math.round(v.videoWidth * s)); c.height = Math.max(2, Math.round(v.videoHeight * s));
  c.getContext('2d').drawImage(v, 0, 0, c.width, c.height); return c;
}
const toBlob = (c, q) => new Promise(r => c.toBlob(r, 'image/jpeg', q));
async function saveStrip() {
  const v = film.video;
  if (!v || !film.ready || film.busy) return;
  const contact = v.currentTime, speed = parseFloat(state.form.k_speed || '1') || 1, tag = state.form.k_tag || 'practice', view = state.form.k_view || 'side';
  film.busy = true; film.msg = ''; film.step = 'Pulling 8 frames from the video...'; render();
  let thumbs;
  try {
    thumbs = [];
    for (const off of FRAME_OFFSETS) { await seekTo(v, contact + off * speed); thumbs.push(grab(v, 300).toDataURL('image/jpeg', 0.6)); }
    await seekTo(v, contact);
  } catch (e) { thumbs = null; }
  film.busy = false; film.step = '';
  if (!thumbs) { film.msg = 'The frames could not be pulled from this video. Try a shorter clip in the standard camera format.'; state.dirty = false; return render(); }
  const area = ['contact', 'path', 'timing', 'speed'].indexOf(state.form.k_area) >= 0 ? state.form.k_area : 'none';
  const entry = { kind: 'analysis', date: state.form.k_date || today(), tag, view, speed, contactAt: Math.round(contact * 100) / 100,
    fix: { title: String(state.form.k_note || '').trim().slice(0, 120) }, fixArea: area, thumbs };
  if (await addEntry(entry)) {
    state.openCheck = null; film.msg = 'Filmstrip saved.'; clear('k_note', 'k_area');
    if (film.url) URL.revokeObjectURL(film.url); film.video = null; film.file = null; film.url = null; film.ready = false;
  }
  state.dirty = false; render();
}
function renderFilmStatus() { const el = document.getElementById('film-step'); if (el) el.textContent = film.step; }
function showCheck(e) {
  const safe = u => typeof u === 'string' && u.indexOf('data:image/jpeg;base64,') === 0;
  const m = mediaOf(e), th = (m || []).filter(safe), idx = th.length === 8 ? [0, 1, 2, 3, 4, 5, 6, 7] : [1, 3, 5, 7];
  const note = str(e.fix && e.fix.title, 120), area = L.FOCUS[e.fixArea];
  return [
    th.length ? h('div', { class: 'strip8' }, th.map((u, k) => { const i = idx[k]; return h('div', { class: 'fr' + (i === 5 ? ' hit' : '') },
      h('img', { src: u, alt: FRAME_NAMES[i] + ' frame', loading: 'lazy' }), h('b', null, FRAME_NAMES[i])); }))
      : h('p', { class: 'small mid' }, m ? 'No frames were saved for this swing.' : 'Loading the frames...'),
    h('div', { class: 'stack' }, h('h3', null, "Coach's note"), h('p', { class: 'say' }, note || 'No note yet.'), area ? h('p', { class: 'mid' }, 'Points to: ' + area.name) : null)];
}
function compare(all) {
  if (all.length < 2) return null;
  needMedia(all.filter(e => e.id === state.cmpA || e.id === state.cmpB).concat(all.slice(0, 2)));
  const safe = u => typeof u === 'string' && u.indexOf('data:image/jpeg;base64,') === 0;
  const frame = (e, i) => { const th = mediaOf(e) || []; const u = th.length === 8 ? th[i] : th.length === 4 ? th[[1, 3, 5, 7].indexOf(i)] : null; return safe(u) ? u : null; };
  let A = all.find(e => e.id === state.cmpA) || all[0];
  let B = all.find(e => e.id === state.cmpB) || all.find(e => e.id !== A.id && e.tag !== A.tag) || all.find(e => e.id !== A.id);
  if (B.id === A.id) B = all.find(e => e.id !== A.id);
  const opt = e => fmtDate(e.date) + ', ' + (e.tag === 'game' ? 'game' : 'practice') + ': ' + (str(e.fix && e.fix.title, 40) || 'no note');
  const pick = (id, label, cur, key) => h('label', { class: 'fld', for: id }, h('span', null, label), h('select', { id, onchange: ev => { state[key] = ev.target.value; render(); } }, all.map(e => h('option', { value: e.id, selected: e.id === cur.id }, opt(e)))));
  const cell = (e, i) => { const u = frame(e, i); return u ? h('img', { src: u, alt: FRAME_NAMES[i] + ', ' + fmtDate(e.date), loading: 'lazy' }) : h('div', { class: 'blank' }); };
  const nameOf = e => (L.FOCUS[e.fixArea] || {}).name || 'nothing specific', run = L.fixRun(all);
  const side = (e, tag) => h('div', { class: 'stack' }, h('h3', null, tag + ': ' + fmtDate(e.date) + ', ' + (e.tag === 'game' ? 'game' : 'practice')), h('p', { class: 'say' }, str(e.fix && e.fix.title, 80) || 'No note'));
  return h('section', { class: 'sec' }, h('h2', null, 'Compare two swings'),
    h('div', { class: 'row' }, pick('cmp-a', 'Top row', A, 'cmpA'), pick('cmp-b', 'Bottom row', B, 'cmpB')),
    h('div', { class: 'cmp' }, FRAME_NAMES.map((n, i) => [cell(A, i), h('b', null, n), cell(B, i)])),
    h('div', { class: 'two even' }, side(A, 'Top'), side(B, 'Bottom')),
    h('p', null, A.fixArea === B.fixArea ? (A.fixArea === 'none' || !L.FOCUS[A.fixArea] ? 'Neither note points to anything yet.' : 'Both notes point to the same thing: ' + nameOf(A) + '.') : 'They point to different things: ' + nameOf(A) + ' on top, ' + nameOf(B) + ' on the bottom.'),
    run ? h('p', null, run.name + ' has come up in ' + run.count + ' of his last ' + run.of + ' filmstrips.') : null,
    h('p', { class: 'small mid' }, 'The frames line up by moment, so differences show only if contact was marked carefully on both.'));
}
function viewFilm() {
  const all = checks(), open = all.find(e => e.id === state.openCheck) || all[0], v = film.video, t = today();
  if (open) needMedia([open]);
  const uploader = h('section', { class: 'sec' }, h('h2', null, 'Add a swing'),
    h('label', { class: 'fld', for: 'film-file' }, h('span', null, 'Pick a video of one swing. A side view in good light works best.'),
      h('input', { id: 'film-file', type: 'file', accept: 'video/*', disabled: film.busy, onchange: e => loadFilm(e.target.files[0]) })),
    v ? [h('div', { class: 'stage' }, v),
      film.ready ? [
        h('label', { class: 'fld', for: 'scrub' }, h('span', null, 'Slide to the moment the bat meets the ball. It works best with a second of video before that.'),
          h('input', { id: 'scrub', type: 'range', min: '0', max: String(v.duration || 0), step: '0.01', value: String(v.currentTime), disabled: film.busy, oninput: e => { v.currentTime = parseFloat(e.target.value); } })),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn line sm', disabled: film.busy, onclick: () => { v.currentTime = Math.max(0, v.currentTime - 1 / 30); } }, 'Back one frame'),
          h('button', { type: 'button', class: 'btn line sm', disabled: film.busy, onclick: () => { v.currentTime = Math.min(v.duration, v.currentTime + 1 / 30); } }, 'Forward one frame'),
          h('span', { id: 'scrub-t', class: 'num mid' }, v.currentTime.toFixed(2) + ' s')),
        h('div', { class: 'row' }, sel('k_tag', 'Where', [['practice', 'Practice'], ['game', 'Game']], 'practice'), sel('k_view', 'Camera angle', [['side', 'From the side'], ['front', 'From the pitcher side'], ['behind', 'From behind'], ['other', 'Other']], 'side'),
          sel('k_speed', 'Video speed', [['1', 'Normal'], ['4', 'Slow motion (4x)'], ['8', 'Slow motion (8x)']], '1'), inp('k_date', 'Date', { type: 'date', def: t })),
        h('div', { class: 'row' }, inp('k_note', "Coach's note: one thing to work on (optional)", { type: 'text' }),
          sel('k_area', 'It points to', [['none', 'Nothing yet'], ['contact', 'Contact'], ['path', 'Swing path'], ['timing', 'Timing'], ['speed', 'Bat speed']], 'none')),
        h('button', { type: 'button', class: 'btn big', disabled: film.busy, onclick: guard(saveStrip) }, film.busy ? 'Saving...' : 'Save filmstrip'),
        h('p', { id: 'film-step', class: 'status wait', role: 'status' }, film.step)]
        : film.needTap ? h('div', null, h('button', { type: 'button', class: 'btn', onclick: () => { const pr = v.play(); if (pr && pr.catch) pr.catch(() => { film.msg = 'This video could not be opened here. Try a shorter clip.'; render(); }); } }, 'Tap to load the video'))
        : h('p', { class: 'mid' }, 'Loading the video...')] : null,
    film.msg ? h('p', { class: film.msg === 'Filmstrip saved.' ? 'status ok' : 'note' }, film.msg) : null);
  return page(strip('Film room', 'Freeze a swing into 8 frames, add a note, and compare it with other swings.'),
    open ? h('section', { class: 'sec plain' }, h('div', { class: 'row between' }, h('h2', null, (open === all[0] ? 'Latest swing' : 'Swing') + ', ' + fmtDate(open.date)),
        h('span', { class: 'status ' + (open.tag === 'game' ? 'wait' : 'ok') }, open.tag === 'game' ? 'Game swing' : 'Practice swing')), showCheck(open)) : null,
    uploader,
    compare(all),
    all.length ? h('section', { class: 'sec' }, h('h2', null, 'All swings'), all.map(e => h('div', { class: 'entry' },
      h('button', { type: 'button', class: 'hist', style: 'border:0;padding:0', onclick: () => { state.openCheck = e.id; render(); window.scrollTo(0, 0); } },
        h('span', null, h('span', { class: 'mid num' }, fmtDate(e.date) + ', ' + (e.tag === 'game' ? 'game' : 'practice') + ': '), str(e.fix && e.fix.title, 80) || 'No note')), locked() ? null : delBtn(e)))) : null,
    !open && !v ? h('p', { class: 'say' }, 'No swings saved yet. Film one swing from the side, then pick the video above.') : null);
}

/* ---------- Player: Trophies ---------- */
function viewTrophies() {
  const B = L.badges(state.entries), rec = L.records(state.entries), t = L.totals(state.entries);
  const recs = [['Top bat speed', rec.bat, r => fix(r.v) + ' mph'], ['Top exit speed', rec.exit, r => fix(r.v) + ' mph'], ['Best machine round', rec.contact, r => r.made + ' of ' + r.of],
    ['Longest jump', rec.jump, r => fix(r.v, 0) + ' in'], ['Most push-ups in a test', rec.pushups, r => fix(r.v, 0)], ['Longest plank', rec.plank, r => fix(r.v, 0) + ' sec'], ['Fastest pitch', rec.velo, r => fix(r.v) + ' mph']];
  return page(strip('Trophies', B.filter(b => b.on).length + ' of ' + B.length + ' badges earned'),
    h('section', { class: 'sec plain' }, h('div', { class: 'patches' }, B.map(b => h('div', { class: 'patch' + (b.on ? ' on' : '') }, h('div', { class: 'ring' }, icon(b.icon)), h('b', null, b.name), h('span', null, b.on ? 'Earned' : b.how))))),
    h('div', { class: 'two even' },
      h('section', { class: 'sec' }, h('h2', null, 'Your records'), h('table', null, h('tbody', null, recs.map(r => h('tr', null, h('td', null, r[0], r[1] ? h('div', { class: 'math' }, fmtDate(r[1].date)) : null), h('td', { class: 'v' }, r[1] ? r[2](r[1]) : '–'))))),
        h('p', { class: 'small mid' }, 'Beat a record and you earn ' + L.XP.record + ' XP.')),
      h('section', { class: 'sec' }, h('h2', null, 'All-time totals'), h('table', null, h('tbody', null,
        [['Swings', t.swings], ['Push-ups', t.pushups], ['Sit-ups', t.situps], ['Squats', t.squats], ['Sessions finished', t.sessions]].map(x => h('tr', null, h('td', null, x[0]), h('td', { class: 'v' }, commas(x[1])))))))));
}

/* ---------- Coach: Log ---------- */
async function saveQuick() {
  const t = state.form.q_date || today(), saved = [];
  let tried = 0;   // a failed save already showed its own message, so it must not be replaced by "nothing to save"
  const reps = { swings: num('q_swings'), pushups: num('q_push'), situps: num('q_sit'), squats: num('q_squat') };
  if (num('q_made') != null && !num('q_of')) return toast('Enter how many pitches he saw on the machine.');
  if (num('q_made') != null && num('q_made') > num('q_of')) return toast('Solid hits cannot be more than pitches.');
  if (Object.keys(reps).some(k => reps[k] != null)) { tried++; if (await addEntry(Object.assign({ kind: 'reps', date: t }, reps))) { saved.push('reps'); clear('q_swings', 'q_push', 'q_sit', 'q_squat'); } }
  if (num('q_bat') != null || num('q_exit') != null) { tried++; if (await addEntry({ kind: 'swing', date: t, ball: state.form.q_ball || 'real', batSpeed: num('q_bat'), batMax: num('q_batmax'), exitVelo: num('q_exit'), exitMax: num('q_exitmax') })) { saved.push('speeds'); clear('q_bat', 'q_batmax', 'q_exit', 'q_exitmax'); } }
  if (num('q_made') != null) { tried++; if (await addEntry({ kind: 'machine', date: t, made: num('q_made'), of: num('q_of') })) { saved.push('machine count'); clear('q_made', 'q_of'); } }
  if (!tried) toast('Nothing to save yet. Fill in at least one box.');
  else if (saved.length === tried) toast('Saved: ' + saved.join(', ') + '.');
  else if (saved.length) toast('Saved: ' + saved.join(', ') + '. The rest did not save, so it is still filled in. Try again.');
  render();
}
function viewLog() {
  const t = today(), recent = state.entries.slice().sort(L.byDate).reverse().slice(0, 25);
  const part = (v, w) => v ? v + ' ' + w : null;
  const label = e => e.kind === 'swing' ? 'Speeds: bat ' + fix(e.batSpeed) + ', exit ' + fix(e.exitVelo) + ' mph' + (e.ball === 'mini' ? ' (mini balls)' : '') :
    e.kind === 'reps' ? (e.from ? 'Reps from ' + (({ A: 'Day 1', B: 'Day 2', C: 'Day 3' })[e.slot] || 'a session') + ': ' : 'Extra reps: ') + ([part(e.swings, 'swings'), part(e.pushups, 'push-ups'), part(e.situps, 'sit-ups'), part(e.squats, 'squats')].filter(Boolean).join(', ') || 'none') :
    e.kind === 'machine' ? 'Machine' + (e.from ? ' (in session)' : '') + ': ' + e.made + ' of ' + e.of + ' solid' : e.kind === 'game' ? 'Game: ' + e.h + ' for ' + e.ab + ', ' + e.k + ' K, ' + e.bb + ' BB' :
    e.kind === 'pitch' ? 'Pitched: ' + e.pitches + ' pitches, ' + L.fmtInnings(e.outs || 0) + ' innings' : e.kind === 'strength' ? 'Test: jump ' + fix(e.jump, 0) + ' in, ' + fix(e.pushups, 0) + ' push-ups, plank ' + fix(e.plank, 0) + ' sec' :
    e.kind === 'session' ? (({ A: 'Day 1', B: 'Day 2', C: 'Day 3' })[e.slot] || 'Session') + ' (' + ((L.FOCUS[e.focus] || {}).name || e.focus) + ')' : e.kind === 'analysis' ? 'Filmstrip: ' + (str(e.fix && e.fix.title, 60) || 'no note') :
    e.kind === 'velo' ? 'Pitch speed' + (e.where === 'game' ? ' (game)' : '') + ': ' + [L.isNum(e.avg) ? 'average ' + fix(e.avg) : null, L.isNum(e.max) ? 'fastest ' + fix(e.max) : null].filter(Boolean).join(', ') + ' mph' :
    e.kind === 'body' ? 'Measured: ' + [L.isNum(e.heightIn) ? L.fmtHeight(e.heightIn) : null, L.isNum(e.weightLb) ? (Math.round(e.weightLb * 10) / 10) + ' lb' : null].filter(Boolean).join(', ') : e.kind;
  return page(strip('Log ' + who() + "'s work", 'Finished sessions log their own reps. Use this for extra work, speeds and games.'),
    h('section', { class: 'sec plain' }, h('div', { class: 'row between' }, h('h2', null, 'Today'), h('div', { style: 'flex:0 1 200px' }, inp('q_date', 'Date', { type: 'date', def: t }))),
      h('h3', null, 'Extra reps (outside sessions)'),
      h('div', { class: 'row' }, inp('q_swings', 'Swings', { mode: 'numeric' }), inp('q_push', 'Push-ups', { mode: 'numeric' }), inp('q_sit', 'Sit-ups', { mode: 'numeric' }), inp('q_squat', 'Squats', { mode: 'numeric' })),
      h('h3', null, 'Swing speeds'),
      h('div', { class: 'row' }, inp('q_bat', 'Bat speed avg (mph)'), inp('q_batmax', 'Bat speed best'), inp('q_exit', 'Exit speed avg (mph)'), inp('q_exitmax', 'Exit speed best'), sel('q_ball', 'Balls used', [['real', 'Real baseballs'], ['mini', 'Mini balls']], 'real')),
      h('h3', null, 'Pitching machine'),
      h('div', { class: 'row' }, inp('q_made', 'Solid hits', { mode: 'numeric' }), inp('q_of', 'Pitches', { mode: 'numeric' })),
      h('p', { class: 'small mid' }, 'Only for machine work outside a session. Hits he types into a session are already counted.'),
      h('div', null, h('button', { type: 'button', class: 'btn', id: 'quick-save', onclick: guard(saveQuick) }, 'Save'))),
    h('div', { class: 'two even' },
      h('section', { class: 'sec' }, h('h2', null, 'Swing video'), h('p', null, 'Save swing filmstrips and compare them in the film room on the Player side.'), h('p', null, h('a', { href: '#film' }, 'Open the film room'))),
      h('section', { class: 'sec' }, h('h2', null, 'Game line'),
        h('div', { class: 'row' }, inp('g_date', 'Date', { type: 'date', def: t })),
        h('div', { class: 'row' }, inp('g_ab', 'At-bats', { mode: 'numeric' }), inp('g_h', 'Hits', { mode: 'numeric' }), inp('g_k', 'Strikeouts', { mode: 'numeric' }), inp('g_bb', 'Walks', { mode: 'numeric' })),
        h('div', null, h('button', { type: 'button', class: 'btn', onclick: guard(async () => {
          if (num('g_ab') == null) return toast('Enter at-bats first.');
          if ((num('g_h') || 0) + (num('g_k') || 0) > num('g_ab')) return toast('Hits plus strikeouts cannot be more than at-bats.');
          if (await addEntry({ kind: 'game', date: state.form.g_date || t, ab: num('g_ab'), h: num('g_h') || 0, k: num('g_k') || 0, bb: num('g_bb') || 0 })) { clear('g_ab', 'g_h', 'g_k', 'g_bb'); toast('Game line saved.'); } render(); }) }, 'Save game line'))),
      h('section', { class: 'sec' }, h('h2', null, 'Strength test'),
        h('div', { class: 'row' }, inp('t_date', 'Date', { type: 'date', def: t })),
        h('div', { class: 'row' }, inp('t_jump', 'Long jump (inches)'), inp('t_push', 'Push-ups', { mode: 'numeric' }), inp('t_plank', 'Plank (seconds)', { mode: 'numeric' })),
        h('div', null, h('button', { type: 'button', class: 'btn', onclick: guard(async () => {
          if (num('t_jump') == null && num('t_push') == null && num('t_plank') == null) return toast('Enter at least one test result.');
          if (await addEntry({ kind: 'strength', date: state.form.t_date || t, jump: num('t_jump'), pushups: num('t_push'), plank: num('t_plank') })) { clear('t_jump', 't_push', 't_plank'); toast('Test saved.'); } render(); }) }, 'Save test')),
        h('p', { class: 'small mid' }, 'Every 4 weeks. These are max-effort tests, separate from daily reps.')),
      h('section', { class: 'sec' }, h('h2', null, 'Height and weight'),
        h('div', { class: 'row' }, inp('b_date', 'Date', { type: 'date', def: t })),
        h('div', { class: 'row' }, inp('b_ft', 'Height, feet', { mode: 'numeric' }), inp('b_in', 'and inches'), inp('b_lb', 'Weight (lb)')),
        h('div', null, h('button', { type: 'button', class: 'btn', onclick: guard(async () => {
          const ft = num('b_ft'), inch = num('b_in'), lb = num('b_lb');
          const hIn = ft == null && inch == null ? null : (ft || 0) * 12 + (inch || 0);
          if (hIn == null && lb == null) return toast('Enter his height, weight, or both.');
          if (inch != null && inch >= 12) return toast('Inches should be under 12. Put whole feet in the feet box.');
          if (hIn != null && (hIn < 30 || hIn > 84)) return toast('That height looks off. Check feet and inches.');
          if (lb != null && (lb < 20 || lb > 300)) return toast('That weight looks off. Check it is in pounds.');
          if (await addEntry({ kind: 'body', date: state.form.b_date || t, heightIn: hIn, weightLb: lb })) { clear('b_ft', 'b_in', 'b_lb'); toast('Saved.'); } render(); }) }, 'Save height and weight')),
        h('p', { class: 'small mid' }, 'Once a month is plenty: same scale, shoes off, morning. Growth shows on the Progress screen.'))),
    h('section', { class: 'sec' }, h('h2', null, 'Recent entries'),
      recent.length ? recent.map(e => h('div', { class: 'entry' }, h('span', null, h('span', { class: 'mid num' }, fmtDate(e.date) + ': '), label(e)), delBtn(e))) : h('p', { class: 'mid' }, 'Nothing logged yet.')));
}
function delBtn(e) {
  const armed = state.confirmDel === e.id;
  return h('button', { type: 'button', class: 'btn sm ' + (armed ? 'del' : 'line'), onclick: async () => {
    if (!armed) { state.confirmDel = e.id; render(); return; }
    state.confirmDel = null;
    if (e.kind === 'session' && e.ts != null) for (const x of state.entries.filter(x => x.from === e.ts && x.id !== e.id)) await delEntry(x.id);
    await delEntry(e.id); render(); } }, armed ? 'Tap again to delete' : 'Delete');
}

/* ---------- Coach: Arm ---------- */
function viewArm() {
  const t = today(), a = L.armStatus(state.entries, t, state.settings.dailyMax), yr = a.outs12 / 240;
  const rows = [['1–20', 0], ['21–35', 1], ['36–50', 2], ['51–65', 3], ['66+', 4]];
  return page(strip(a.cleared ? 'Cleared to pitch' : 'Rest day', a.driver ? (a.driver.pitches + ' pitches on ' + fmtDate(a.driver.date) + ' needs ' + a.driver.rest + ' rest day' + (a.driver.rest === 1 ? '' : 's') + ', so he is cleared from ' + fmtDate(a.clearedOn) + '.') +
      (a.threeDay ? ' He also pitched the last two days, and three days in a row is not allowed.' : '') : 'No outings logged yet.'),
    h('section', { class: 'sec plain' }, h('div', { class: 'facts' },
        h('div', null, h('b', { class: 'bigv' }, a.last ? a.last.pitches : '–'), h('span', null, 'Pitches, last outing')),
        h('div', null, h('b', { class: 'bigv' }, L.fmtInnings(a.outs3)), h('span', null, 'Innings, last 3 days')),
        h('div', null, h('b', { class: 'bigv' }, L.fmtInnings(a.outs12)), h('span', null, 'Innings, last 12 months'))),
      a.over ? h('p', { class: 'note' }, a.over.pitches + ' pitches on ' + fmtDate(a.over.date) + ' was over the ' + state.settings.dailyMax + '-pitch daily limit for his age.') : null,
      !a.cleared ? h('p', { class: 'note' }, 'On rest days the plan swaps med ball throws for a no-throw drill. Hitting and leg work stay.') : null),
    h('div', { class: 'two even' },
      h('section', { class: 'sec' }, h('h2', null, 'Log an outing'),
        h('div', { class: 'row' }, inp('p_date', 'Date', { type: 'date', def: t }), inp('p_pitches', 'Pitches', { mode: 'numeric' })),
        h('div', { class: 'row' }, inp('p_inn', 'Full innings', { mode: 'numeric', def: 0 }), sel('p_outs', 'Extra outs', [['0', '0'], ['1', '1'], ['2', '2']], '0')),
        h('div', null, h('button', { type: 'button', class: 'btn', onclick: guard(async () => {
          if (num('p_pitches') == null) return toast('Enter the pitch count first.');
          if (await addEntry({ kind: 'pitch', date: state.form.p_date || t, pitches: num('p_pitches'), outs: Math.round((num('p_inn') || 0) * 3 + (parseInt(state.form.p_outs, 10) || 0)) })) { clear('p_pitches', 'p_inn', 'p_outs'); toast('Outing saved.'); } render(); }) }, 'Save outing'))),
      h('section', { class: 'sec' }, h('h2', null, 'Year total'),
        h('p', { class: 'num' }, L.fmtInnings(a.outs12) + ' of 80 innings in the last 12 months (' + Math.round(yr * 100) + '%)'),
        h('div', { class: 'bar', role: 'img', 'aria-label': Math.round(yr * 100) + ' percent of the yearly innings limit' }, h('i', { style: 'width:' + Math.min(100, yr * 100).toFixed(1) + '%' })),
        h('p', { class: 'math' }, a.outs12 + ' outs ÷ 3 = ' + (a.outs12 / 3).toFixed(1) + ' innings; ' + (a.outs12 / 3).toFixed(1) + ' ÷ 80 = ' + (yr * 100).toFixed(1) + '%'))),
    h('section', { class: 'sec' }, h('h2', null, 'Pitch speed'),
      h('div', { class: 'row' }, inp('v_date', 'Date', { type: 'date', def: t }), inp('v_avg', 'Average (mph)'), inp('v_max', 'Fastest (mph)'), inp('v_n', 'Pitches timed', { mode: 'numeric' }),
        sel('v_where', 'Where', [['bullpen', 'Practice'], ['game', 'Game']], 'bullpen')),
      h('div', null, h('button', { type: 'button', class: 'btn', onclick: guard(async () => {
        const av = num('v_avg'), mx = num('v_max');
        if (av == null && mx == null) return toast('Enter the average or the fastest pitch.');
        if ([av, mx].some(v => v != null && (v < 10 || v > 100))) return toast('That speed looks off. Check it is in miles per hour.');
        if (av != null && mx != null && mx < av) return toast('Fastest cannot be lower than the average.');
        if (num('v_n') != null && (num('v_n') < 1 || num('v_n') % 1)) return toast('Pitches timed should be a whole number.');
        if (await addEntry({ kind: 'velo', date: state.form.v_date || t, avg: av, max: mx, n: num('v_n'), where: state.form.v_where || 'bullpen' })) { clear('v_avg', 'v_max', 'v_n'); toast('Pitch speed saved.'); } render(); }) }, 'Save pitch speed')),
      h('p', { class: 'small mid' }, 'Use the radar from behind the catcher or the side, the same spot each time. Speed checks do not count toward his pitch limits, so log real pitch counts as an outing above. The chart is on the Progress screen.')),
    h('section', { class: 'sec' }, h('h2', null, 'The rules it follows'),
      h('div', { class: 'scroll' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'Pitches in a day'), h('th', { class: 'r' }, 'Rest days'))),
        h('tbody', null, rows.map(r => h('tr', null, h('td', { class: 'num' }, r[0]), h('td', { class: 'r' }, r[1])))))),
      h('p', { class: 'small' }, 'Daily limit at ages 9 to 10: 75 pitches. No pitching three days in a row. No more than 80 innings in 12 months.'),
      h('p', { class: 'small' }, 'USSSA counts innings instead: 3 or fewer in a day to pitch again the next day, 6 in one day, 8 across three days.'),
      h('p', { class: 'small mid' }, 'Sources: ', h('a', { href: 'https://www.mlb.com/pitch-smart/pitching-guidelines/ages-9-12' }, 'MLB Pitch Smart, ages 9 to 12'), ' and the ',
        h('a', { href: 'https://www.usssabaseball.org/images/2026_USSSA_National_By-Laws.pdf' }, 'USSSA by-laws, rule 7.05'), '.')));
}

/* ---------- Coach: Progress ---------- */
function viewProgress() {
  const t = today(), s = L.stats(state.entries, t), rt = L.retest(state.entries, t), p = plan(), R = p.tuned.rules;
  const sw = state.entries.filter(e => e.kind === 'swing').sort(L.byDate);
  const series = f => sw.map(e => ({ date: e.date, v: f(e) })).filter(x => L.isNum(x.v));
  const mach = state.entries.filter(e => e.kind === 'machine' && e.of > 0).sort(L.byDate).map(e => ({ date: e.date, v: e.made / e.of * 100 }));
  const tests = state.entries.filter(e => e.kind === 'strength').sort(L.byDate), f = tests[0], l = tests[tests.length - 1];
  const delta = (a, b, u) => (L.isNum(a) && L.isNum(b)) ? (b - a >= 0 ? '+' : '') + fix(b - a, 0) + ' ' + u : '–';
  const since = L.addDays(t, -28), r28 = L.totals(state.entries.filter(e => e.date > since)), all = L.totals(state.entries), last = checks()[0];
  const tile = (name, val, unit, pts, sub) => h('section', { class: 'sec' }, h('h3', null, name), h('b', { class: 'bigv' }, val), sub ? h('span', { class: 'math' }, sub) : null, spark(pts, unit));
  const rc = L.recapText(L.weekRecap(state.entries, t), who());
  return page(strip("This week's focus: " + L.FOCUS[p.pick.focus].name, p.pick.why),
    h('section', { class: 'sec plain' }, h('h2', null, 'Week so far'), h('ul', { class: 'plain' }, rc.slice(1).map(x => h('li', null, x))),
      h('p', { class: 'small mid' }, 'The same summary is sent to your phone every Sunday evening.')),
    h('div', { class: 'two even' },
      h('section', { class: 'sec' }, h('div', { class: 'row between' }, h('h2', null, '4-week re-test'),
          h('span', { class: 'status ' + (rt.first != null && rt.inDays > 0 ? 'ok' : 'wait') }, rt.first == null ? 'Not started' : rt.inDays <= 0 ? 'Due now' : 'Due ' + fmtDate(rt.due))),
        h('p', { class: 'small' }, rt.first == null ? 'The first test sets his starting line. Run it in test week, then log it on the Log screen.' : 'Same tests, same bat, same tee height, same time of day. Last test: ' + fmtDate(rt.last) + '.'),
        tests.length ? h('div', { class: 'scroll' }, h('table', null,
          h('thead', null, h('tr', null, h('th', null, 'Test'), h('th', { class: 'r' }, 'First'), h('th', { class: 'r' }, 'Latest'), h('th', { class: 'r' }, 'Change'))),
          h('tbody', null, [['Long jump', 'jump', 'in'], ['Push-ups', 'pushups', ''], ['Plank', 'plank', 'sec']].map(r =>
            h('tr', null, h('td', null, r[0]), h('td', { class: 'r' }, fix(f[r[1]], 0)), h('td', { class: 'r' }, fix(l[r[1]], 0)), h('td', { class: 'r' }, delta(f[r[1]], l[r[1]], r[2]))))))) : null),
      h('section', { class: 'sec' }, h('h2', null, 'Latest filmstrip note'),
        last ? [h('p', { class: 'say' }, str(last.fix && last.fix.title, 80) || 'No note'),             h('p', { class: 'small mid' }, fmtDate(last.date) + ', ' + (last.tag === 'game' ? 'game' : 'practice') + '. Points to: ' + ((L.FOCUS[last.fixArea] || {}).name || 'nothing specific') + '.')]
          : h('p', { class: 'mid' }, 'No filmstrips yet.'), h('p', null, h('a', { href: '#film' }, 'Open the film room'))),
      tile('Bat speed (mph)', fix(s.batRecent), 'mph', series(e => e.batSpeed), s.batTrend != null ? fix(s.batRecent) + ' − ' + fix(s.batPrior) + ' = ' + (s.batTrend >= 0 ? '+' : '') + fix(s.batTrend) + ' mph against the 4 weeks before' : 'Needs entries in both 4-week windows to show a change.'),
      tile('Exit speed, real balls (mph)', fix(s.exitRecent), 'mph', series(e => e.ball !== 'mini' ? e.exitVelo : null)),
      tile('Squared-up score', fix(s.squareRecent, 2), 'ratio', series(e => (e.ball !== 'mini' && L.isNum(e.batSpeed) && L.isNum(e.exitVelo) && e.batSpeed > 0) ? e.exitVelo / e.batSpeed : null), 'Exit speed ÷ bat speed. His best: ' + fix(s.squareBest, 2) + '.'),
      tile('Machine contact', pcs(s.contactRate), 'percent', mach, s.contactOf ? s.contactMade + ' ÷ ' + s.contactOf + ' = ' + pcs(s.contactRate) : null),
      (function () {
        const v = state.entries.filter(e => e.kind === 'velo').sort(L.byDate), top = e => L.isNum(e.max) ? e.max : e.avg;
        const pts = v.map(e => ({ date: e.date, v: top(e) })).filter(x => L.isNum(x.v)), a = pts[0], z = pts[pts.length - 1], best = L.records(state.entries).velo;
        return tile('Pitch speed, fastest (mph)', z ? fix(z.v) : '–', 'mph', pts,
          pts.length > 1 ? fix(z.v) + ' − ' + fix(a.v) + ' = ' + (z.v - a.v >= 0 ? '+' : '') + fix(z.v - a.v) + ' mph since ' + fmtDate(a.date) + '. Best ever: ' + fix(best.v) + ' mph.' : 'Log speeds on the Arm screen.');
      })(),
      (function () {
        const b = state.entries.filter(e => e.kind === 'body').sort(L.byDate);
        const ser = k => b.filter(e => L.isNum(e[k])).map(e => ({ date: e.date, v: e[k] }));
        const grow = (pts, show, u) => { if (pts.length < 2) return null; const a = pts[0], z = pts[pts.length - 1], d = z.v - a.v, days = (Date.parse(z.date) - Date.parse(a.date)) / 864e5;
          return show(z.v) + ' − ' + show(a.v) + ' = ' + (d >= 0 ? '+' : '') + fix(d) + ' ' + u + ' over ' + Math.round(days) + ' days' + (days >= 60 ? '; ' + fix(d) + ' ÷ ' + Math.round(days) + ' × 365 = ' + (d >= 0 ? '+' : '') + fix(d / days * 365) + ' ' + u + ' a year' : ''); };
        const hs = ser('heightIn'), ws = ser('weightLb'), hz = hs[hs.length - 1], wz = ws[ws.length - 1];
        return h('section', { class: 'sec' }, h('h2', null, 'Growth'),
          h('h3', null, 'Height'), h('b', { class: 'bigv' }, hz ? L.fmtHeight(hz.v) : '–'), grow(hs, x => fix(x) + ' in', 'in') ? h('span', { class: 'math' }, grow(hs, x => fix(x) + ' in', 'in')) : null, spark(hs, 'inches'),
          h('h3', null, 'Weight'), h('b', { class: 'bigv' }, wz ? fix(wz.v) + ' lb' : '–'), grow(ws, x => fix(x) + ' lb', 'lb') ? h('span', { class: 'math' }, grow(ws, x => fix(x) + ' lb', 'lb')) : null, spark(ws, 'pounds'),
          h('p', { class: 'small mid' }, 'Log on the Log screen. When he grows, recheck his bat length and weight on the Gear screen.'));
      })(),
      h('section', { class: 'sec' }, h('h2', null, 'Reps'),
        h('table', null, h('thead', null, h('tr', null, h('th', null, ''), h('th', { class: 'r' }, 'Last 28 days'), h('th', { class: 'r' }, 'All time'))),
          h('tbody', null, [['Swings', 'swings'], ['Push-ups', 'pushups'], ['Sit-ups', 'situps'], ['Squats', 'squats'], ['Sessions', 'sessions']].map(r =>
            h('tr', null, h('td', null, r[0]), h('td', { class: 'r' }, commas(r28[r[1]])), h('td', { class: 'r' }, commas(all[r[1]]))))))),
      h('section', { class: 'sec' }, h('h2', null, 'Games, last 28 days'),
        s.pa ? h('div', { class: 'facts' },
          h('div', null, h('b', { class: 'bigv' }, s.battingAvg == null ? '–' : s.battingAvg.toFixed(3).replace(/^0/, '')), h('span', null, 'Average (' + s.hits + ' ÷ ' + s.ab + ')')),
          h('div', null, h('b', { class: 'bigv' }, pcs(s.kRate)), h('span', null, 'Strikeouts (' + s.k + ' ÷ ' + s.pa + ' trips)')))
          : h('p', { class: 'mid' }, 'No game lines logged in the last 28 days.'))),
    h('section', { class: 'sec' }, h('h2', null, 'How the weekly focus is picked'),
      h('p', { class: 'small' }, 'The hub checks these in order and stops at the first one that is true. The cutoffs start as rules written for this hub, not published standards, and shift to his own numbers as data builds up.'),
      h('ol', { class: 'small' },
        h('li', null, 'Nothing logged yet: Test week.'),
        h('li', null, 'Machine contact at ' + pcs(R.contactGood) + ' or better, and strikeouts in ' + pcs(R.kHigh) + ' or more of at least ' + R.minPA + ' game trips: Timing.'),
        h('li', null, 'Machine contact under ' + pcs(R.contactLow) + ': Contact.'),
        h('li', null, 'Squared-up score under ' + pcs(R.squareDrop) + ' of his own best: Contact.'),
        h('li', null, 'Bat speed up less than ' + R.speedFlat.toFixed(1) + ' mph against the 4 weeks before: Bat speed.'),
        h('li', null, 'A filmstrip note from the last 14 days points somewhere: that focus.'),
        h('li', null, 'Otherwise: whichever of Swing path, Bat speed or Contact he has gone longest without.')),
      h('p', { class: 'small' }, 'No focus runs more than two weeks in a row. After two, the hub moves down the list.'),
      h('h3', null, p.tuned.tuned ? 'Tuned to his numbers' : 'Not enough of his data to tune yet'), p.tuned.notes.map(n => h('p', { class: 'small' }, n))));
}

/* ---------- Coach: Gear ---------- */
function viewGear() {
  if (!state.gearDraft) state.gearDraft = JSON.parse(JSON.stringify(state.settings));
  const d = state.gearDraft, g = parseFloat(d.gameBatOz);
  const tagOf = st => ({ match: ['ok', 'Game weight'], inrange: ['ok', 'In range'], heavy: ['wait', 'Heavy'], veryheavy: ['stop', 'Very heavy'], verylight: ['wait', 'Very light'], unknown: ['wait', 'Weigh it'] })[st];
  const setNum = (obj, k) => e => { const v = parseFloat(e.target.value); obj[k] = isFinite(v) ? v : null; };
  const fitCell = b => { const gg = parseFloat(d.gameBatOz), oz = b.id === 'game' ? gg : b.oz, p = L.pctVsGame(oz, gg), st = tagOf(L.fitStatus(p));
    return [h('span', { class: 'status ' + st[0] }, st[1]), p == null ? null : h('div', { class: 'math' }, '(' + oz + ' − ' + gg + ') ÷ ' + gg + ' = ' + (p >= 0 ? '+' : '') + p.toFixed(1) + '%')]; };
  const refreshFit = () => d.batList.forEach(b => { const c = document.getElementById('fit-' + b.id); if (c) c.replaceChildren(...fitCell(b).filter(Boolean)); });
  return page(strip('Gear', 'Every bat measured against his game bat.'),
    h('section', { class: 'sec plain' },
      h('p', { class: 'small mid' }, 'Common guidance keeps training bats within about 20% of the game bat. Weights marked "estimate" were worked out, not weighed.'),
      h('div', { class: 'scroll' }, h('table', null,
        h('thead', null, h('tr', null, h('th', null, 'Bat'), h('th', null, 'Ounces'), h('th', { class: 'r' }, 'Versus game bat'))),
        h('tbody', null, d.batList.map(b => {
          const oz = b.id === 'game' ? g : b.oz;
          return h('tr', null,
            h('td', null, b.name, h('div', { class: 'math' }, b.role + (b.est ? ', estimate' : ''))),
            h('td', null, h('input', { id: 'oz-' + b.id, type: 'number', inputmode: 'decimal', step: 'any', min: '0', 'aria-label': b.name + ' weight in ounces', value: oz == null || !isFinite(oz) ? '' : String(oz),
              oninput: e => { const v = parseFloat(e.target.value); if (b.id === 'game') d.gameBatOz = isFinite(v) ? v : null; b.oz = isFinite(v) ? v : null; b.est = false; refreshFit(); } })),
            h('td', { class: 'r', id: 'fit-' + b.id }, fitCell(b)));
        })))),
      h('p', { class: 'small mid' }, 'Heavy bats stay on the tee with a ' + L.HEAVY_CAP + '-swing limit per session. Change the game bat weight when he moves up and every row recalculates.')),
    h('div', { class: 'two even' },
      h('section', { class: 'sec' }, h('h2', null, 'Player'),
        h('div', { class: 'row' },
          h('label', { class: 'fld', for: 'g-player' }, h('span', null, 'First name'), h('input', { id: 'g-player', type: 'text', maxlength: '24', value: d.player || '', oninput: e => { d.player = e.target.value; } })),
          h('label', { class: 'fld', for: 'g-bats' }, h('span', null, 'Bats'), h('select', { id: 'g-bats', onchange: e => { d.bats = e.target.value; } }, [['left', 'Left-handed'], ['right', 'Right-handed']].map(o => h('option', { value: o[0], selected: d.bats === o[0] }, o[1])))),
          h('label', { class: 'fld', for: 'g-level' }, h('span', null, 'Strength step, 1 to 5'), h('input', { id: 'g-level', type: 'number', inputmode: 'numeric', min: '1', max: '5', step: '1', value: String(d.level || 1), oninput: e => { const v = parseInt(e.target.value, 10); d.level = isFinite(v) ? Math.max(1, Math.min(5, v)) : 1; } }))),
        h('div', { class: 'row' },
          h('label', { class: 'fld', for: 'g-tank' }, h('span', null, 'Tidal Tank fill (pounds)'), h('input', { id: 'g-tank', type: 'number', inputmode: 'decimal', min: '0', step: 'any', value: d.tankLb == null ? '' : String(d.tankLb), oninput: setNum(d, 'tankLb') })),
          h('label', { class: 'fld', for: 'g-med' }, h('span', null, 'Med ball (pounds)'), h('input', { id: 'g-med', type: 'number', inputmode: 'decimal', min: '0', step: 'any', value: d.medBallLb == null ? '' : String(d.medBallLb), oninput: setNum(d, 'medBallLb') }))),
        h('p', { class: 'small mid' }, 'Each strength step adds 2 reps per set and 5 seconds per hold. Move up one step after two weeks of clean form.'),
        h('div', null, h('button', { type: 'button', class: 'btn', onclick: () => { const n = JSON.parse(JSON.stringify(d)); n.pinHash = state.settings.pinHash || null; state.gearDraft = null; saveSettings(n); } }, 'Save'))),
      h('section', { class: 'sec' }, h('h2', null, 'This device'),
        h('p', null, 'This device is signed in with the family code. Sign it out if it is lost or no longer used for the hub.'),
        h('div', null, h('button', { type: 'button', class: 'btn ' + (state.confirmDel === 'signout' ? 'del' : 'line'), onclick: () => {
          if (state.confirmDel !== 'signout') { state.confirmDel = 'signout'; render(); return; }
          state.confirmDel = null; forgetKey(); try { localStorage.setItem('dugout-out', '1'); } catch (e) {} familyKey = ''; state.entries = []; state.media = {}; state.needKey = true; state.keyMsg = ''; state.keyNet = false; history.replaceState(null, '', location.pathname + '#today'); route(); render(); } },
          state.confirmDel === 'signout' ? 'Tap again to sign out' : 'Sign this device out'))),
      h('section', { class: 'sec' }, h('h2', null, 'Parent code'),
        h('p', null, state.settings.pinHash ? 'A parent code is set. The Coach side and deleting filmstrips ask for it, and it locks again when you switch to the Player side.' : 'No parent code yet. Set one so the Coach side stays with you.'),
        h('div', { class: 'row' }, h('label', { class: 'fld', for: 'pin-new', style: 'flex:0 1 220px' }, h('span', null, state.settings.pinHash ? 'New code, 4 to 6 digits' : 'Code, 4 to 6 digits'),
          h('input', { id: 'pin-new', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: '6' })),
          h('button', { type: 'button', class: 'btn', onclick: () => { const v = (document.getElementById('pin-new') || {}).value || '';
            if (!/^\d{4,6}$/.test(v.trim())) return toast('Use 4 to 6 digits.');
            const ph = pinHash(v.trim()); state.unlocked = ph; if (state.gearDraft) state.gearDraft.pinHash = ph;
            saveSettings(Object.assign({}, state.settings, { pinHash: ph })); } }, state.settings.pinHash ? 'Change code' : 'Set code'),
          state.settings.pinHash ? h('button', { type: 'button', class: 'btn line', onclick: () => { if (state.gearDraft) state.gearDraft.pinHash = null; saveSettings(Object.assign({}, state.settings, { pinHash: null })); } }, 'Remove code') : null)),
      h('section', { class: 'sec' }, h('h2', null, 'What each tool is for'),
        h('table', null, h('tbody', null, [
          ['Personal Pitcher, mini balls, skinny bat', 'Contact and timing'], ['Tee and net', 'Every drill, any day'], ['Practice bats 29/19', 'Game-weight speed swings'],
          ['CamWood trainer', 'Swing path, tee only'], ['SKLZ three-bat set', 'Bat speed, low volume'], ['Diamond Kinetics sensor', 'Bat speed'], ['TAG radar', 'Exit speed on real balls, pitch speed'],
          ['Tidal Tank Mini, med ball', 'Core and turning strength'], ['GameChanger', 'Game results and pitch counts'], ['Phone camera', 'Filmstrips in the film room']
        ].map(r => h('tr', null, h('td', null, r[0]), h('td', { class: 'mid' }, r[1]))))))));
}

/* ---------- shell ---------- */
const VIEWS = { today: viewToday, film: viewFilm, trophies: viewTrophies, log: viewLog, arm: viewArm, progress: viewProgress, gear: viewGear };
const TABS = { player: [['today', 'Today'], ['film', 'Film room'], ['trophies', 'Trophies']], coach: [['log', 'Log'], ['arm', 'Arm'], ['progress', 'Progress'], ['gear', 'Gear']] };
const modeOf = r => TABS.player.some(t => t[0] === r) ? 'player' : 'coach';
function route() { const r = (location.hash || '').replace('#', ''); state.route = VIEWS[r] ? r : 'today'; if (state.route !== 'gear') state.gearDraft = null; }
function render() {
  const keep = document.activeElement && document.activeElement.id, mode = state.needKey ? 'player' : modeOf(state.route);
  document.body.className = mode;
  const body = state.needKey ? viewSetup() : mode === 'coach' && locked() ? page(strip('Coach side', 'Enter the parent code to open it.'), unlockBox(null)) : VIEWS[state.route]();
  $view.replaceChildren(...body.flat(Infinity).filter(Boolean));
  $tabs.hidden = !!state.needKey; document.querySelector('.mode').hidden = !!state.needKey;
  $tabs.replaceChildren(...[...TABS[mode].map(t => h('a', { href: '#' + t[0], 'aria-current': state.route === t[0] ? 'page' : null }, t[1])),
    mode === 'coach' && state.settings.pinHash && !locked() ? h('button', { type: 'button', class: 'lockbtn', onclick: () => { relock(); location.hash = '#today'; } }, 'Lock') : null].filter(Boolean));
  document.querySelectorAll('.mode a').forEach(a => a.setAttribute('aria-current', String(a.dataset.m === mode)));
  renderCheer();
  if (keep && !state.cheer) { const el = document.getElementById(keep); if (el) { try { el.focus({ preventScroll: true }); } catch (e) {} } }
}
window.addEventListener('hashchange', () => { route(); state.confirmDel = null; state.pinMsg = ''; if (modeOf(state.route) === 'player') relock(); render(); window.scrollTo(0, 0); });
try { const s = JSON.parse(localStorage.getItem('dugout-ticks') || 'null'); if (s && s.t) { state.ticks = s.t; state.counts = s.c || {}; } } catch (e) {}
boot();
})();
