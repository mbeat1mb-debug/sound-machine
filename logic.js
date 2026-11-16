/*LOGIC-START*/
const HubLogic = (() => {
  const DAY = 86400000;
  const parse = s => { const p = String(s).split('-').map(Number); return new Date(Date.UTC(p[0], p[1] - 1, p[2])); };
  const iso = dt => dt.toISOString().slice(0, 10);
  const addDays = (s, n) => iso(new Date(parse(s).getTime() + n * DAY));
  const diffDays = (a, b) => Math.round((parse(a) - parse(b)) / DAY);
  const mondayOf = s => addDays(s, -((parse(s).getUTCDay() + 6) % 7));
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const byDate = (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.ts || 0) - (b.ts || 0);

  const pctVsGame = (oz, game) => (isNum(oz) && isNum(game) && game > 0) ? (oz - game) / game * 100 : null;
  const fitStatus = p => p == null ? 'unknown' : Math.abs(p) <= 3 ? 'match' : p < -20 ? 'verylight' : p <= 20 ? 'inrange' : p <= 50 ? 'heavy' : 'veryheavy';

  // MLB Pitch Smart, ages 7-14: rest days by pitches thrown in a day.
  const restDays = p => p <= 20 ? 0 : p <= 35 ? 1 : p <= 50 ? 2 : p <= 65 ? 3 : 4;
  // Accepts scorebook style (2.1 = 2 innings + 1 out) and decimals (2.33).
  const outsFromInnings = x => { if (!isNum(x) || x < 0) return 0; const f = x - Math.floor(x); return Math.floor(x) * 3 + ((f > 0.05 && f < 0.15) || (f >= 0.28 && f < 0.5) ? 1 : (f >= 0.15 && f < 0.28) || f >= 0.5 ? 2 : 0); };
  const fmtInnings = outs => Math.floor(outs / 3) + (outs % 3 ? ' ' + (outs % 3) + '/3' : '');

  function armStatus(entries, today, dailyMax) {
    const days = {};
    for (const e of entries) {
      if (e.kind !== 'pitch' || !e.date || e.date > today) continue;
      const d = days[e.date] || (days[e.date] = { pitches: 0, outs: 0 });
      d.pitches += e.pitches || 0; d.outs += e.outs || 0;
    }
    const dates = Object.keys(days).sort();
    let clearedOn = null, driver = null, outs12 = 0, over = null;
    const yearAgo = addDays(today, -365);
    for (const dt of dates) {
      const d = days[dt], c = addDays(dt, restDays(d.pitches) + 1);
      if (!clearedOn || c > clearedOn) { clearedOn = c; driver = { date: dt, pitches: d.pitches, rest: restDays(d.pitches) }; }
      if (dt > yearAgo) outs12 += d.outs;
      if (d.pitches > dailyMax && dt > addDays(today, -7)) over = { date: dt, pitches: d.pitches };
    }
    let threeDay = false;
    if (days[addDays(today, -1)] && days[addDays(today, -2)]) {
      threeDay = true;
      const t = addDays(today, 1);
      if (!clearedOn || t > clearedOn) clearedOn = t;
    }
    const outs3 = [0, 1, 2].reduce((s, n) => s + ((days[addDays(today, -n)] || {}).outs || 0), 0);
    const last = dates.length ? Object.assign({ date: dates[dates.length - 1] }, days[dates[dates.length - 1]]) : null;
    return { last, driver, clearedOn, cleared: !clearedOn || today >= clearedOn, threeDay, outs12, outs3, over };
  }

  function stats(entries, today) {
    const rStart = addDays(today, -28), pStart = addDays(today, -56);
    const inRecent = e => e.date > rStart && e.date <= today;
    const inPrior = e => e.date > pStart && e.date <= rStart;
    const sw = entries.filter(e => e.kind === 'swing');
    const bat = f => avg(sw.filter(f).map(e => e.batSpeed).filter(isNum));
    const batRecent = bat(inRecent), batPrior = bat(inPrior);
    const real = sw.filter(e => e.ball !== 'mini');
    const exitRecent = avg(real.filter(inRecent).map(e => e.exitVelo).filter(isNum));
    const ratio = e => (isNum(e.batSpeed) && isNum(e.exitVelo) && e.batSpeed > 0) ? e.exitVelo / e.batSpeed : null;
    const ratiosAll = real.map(ratio).filter(isNum);
    const squareRecent = avg(real.filter(inRecent).map(ratio).filter(isNum));
    const squareBest = ratiosAll.length ? Math.max.apply(null, ratiosAll) : null;
    const mach = entries.filter(e => e.kind === 'machine' && inRecent(e));
    const made = mach.reduce((s, e) => s + (e.made || 0), 0), of = mach.reduce((s, e) => s + (e.of || 0), 0);
    const games = entries.filter(e => e.kind === 'game' && inRecent(e));
    const sum = k => games.reduce((s, e) => s + (e[k] || 0), 0);
    const ab = sum('ab'), hits = sum('h'), k = sum('k'), bb = sum('bb'), pa = ab + bb;
    return {
      swingN: sw.filter(inRecent).length, batRecent, batPrior,
      batTrend: (batRecent != null && batPrior != null) ? batRecent - batPrior : null,
      exitRecent, squareRecent, squareBest,
      contactMade: made, contactOf: of, contactRate: of > 0 ? made / of : null,
      ab, hits, k, bb, pa, kRate: pa > 0 ? k / pa : null, battingAvg: ab > 0 ? hits / ab : null
    };
  }

  const pc = x => Math.round(x * 100) + '%';
  // Starting rules written for this hub, not published standards.
  const RULES = { contactGood: 0.70, contactLow: 0.60, kHigh: 0.30, minPA: 8, squareDrop: 0.90, speedFlat: 1 };

  function decideFocus(s, entries, today, rules) {
    const R = rules || RULES;
    if (s.swingN < 1 && s.contactOf < 10) return { focus: 'baseline', why: 'No bat speed or machine count in the last 4 weeks. This week measures where he stands.' };
    const prev = today ? [1, 2].map(k => weekInfo(entries, addDays(mondayOf(today), -7 * k)).lockedFocus) : [];
    const tired = f => prev.length === 2 && prev[0] === f && prev[1] === f;   // already ran the last two weeks
    const gameBad = s.pa >= R.minPA && s.kRate >= R.kHigh;
    if (s.contactRate != null && s.contactRate >= R.contactGood && gameBad && !tired('timing'))
      return { focus: 'timing', why: 'Machine contact is ' + pc(s.contactRate) + ' but he struck out in ' + pc(s.kRate) + ' of ' + s.pa + ' game trips. Practice is not carrying over.' };
    if (s.contactRate != null && s.contactRate < R.contactLow && !tired('contact'))
      return { focus: 'contact', why: 'Machine contact is ' + pc(s.contactRate) + ' (' + s.contactMade + ' of ' + s.contactOf + '). The target is ' + pc(R.contactGood) + '.' };
    if (gameBad && s.contactRate == null && !tired('contact'))
      return { focus: 'contact', why: 'He struck out in ' + pc(s.kRate) + ' of ' + s.pa + ' game trips and there is no machine count yet.' };
    if (s.squareRecent != null && s.squareBest != null && s.squareRecent < R.squareDrop * s.squareBest && !tired('contact'))
      return { focus: 'contact', why: 'Squared-up score is ' + s.squareRecent.toFixed(2) + ' against his best of ' + s.squareBest.toFixed(2) + '. The swing is fine but he is missing the middle of the bat.' };
    if (s.batTrend != null && s.batTrend < R.speedFlat && !tired('speed'))
      return { focus: 'speed', why: 'Bat speed moved ' + (s.batTrend >= 0 ? '+' : '') + s.batTrend.toFixed(1) + ' mph against the 4 weeks before. Contact is holding, so speed is next.' };
    const hintable = ['path', 'speed', 'contact', 'timing'];
    const hint = today ? entries.filter(e => e.kind === 'analysis' && hintable.indexOf(e.fixArea) >= 0 && e.date > addDays(today, -14) && e.date <= today).sort(byDate).pop() : null;
    if (hint && !tired(hint.fixArea)) return { focus: hint.fixArea, why: 'The numbers flag nothing, so the plan follows the latest filmstrip note: ' + String((hint.fix && hint.fix.title) || FOCUS[hint.fixArea].name).slice(0, 60) + '.' };
    const order = ['path', 'speed', 'contact'], lastUsed = {};
    for (const e of entries) if (e.kind === 'session' && order.indexOf(e.focus) >= 0 && (!lastUsed[e.focus] || e.date > lastUsed[e.focus])) lastUsed[e.focus] = e.date;
    const pick = order.slice().sort((a, b) => (lastUsed[a] || '') < (lastUsed[b] || '') ? -1 : (lastUsed[a] || '') > (lastUsed[b] || '') ? 1 : order.indexOf(a) - order.indexOf(b))[0];
    return { focus: pick, why: 'Nothing is flagged, so the plan rotates to the focus he has gone longest without.' };
  }

  function weekInfo(entries, today) {
    const mon = mondayOf(today);
    const ses = entries.filter(e => e.kind === 'session' && e.complete && mondayOf(e.date) === mon).sort((a, b) => (a.ts || 0) - (b.ts || 0));
    const done = {}; for (const e of ses) done[e.slot] = true;
    return { monday: mon, done, count: Object.keys(done).length, lockedFocus: ses.length ? ses[0].focus : null, lockedWhy: ses.length ? ses[0].why : null };
  }

  function weeksMap(entries) {
    const byWeek = {};
    for (const e of entries) if (e.kind === 'session' && e.complete) { const m = mondayOf(e.date); (byWeek[m] || (byWeek[m] = {}))[e.slot] = true; }
    return byWeek;
  }
  function streak(entries, today) {
    const w = weeksMap(entries), full = m => w[m] && w[m].A && w[m].B;
    let m = mondayOf(today), n = 0;
    if (!full(m)) m = addDays(m, -7);
    while (full(m)) { n++; m = addDays(m, -7); }
    return n;
  }
  function longestStreak(entries) {
    const w = weeksMap(entries), mons = Object.keys(w).filter(m => w[m].A && w[m].B).sort();
    let best = 0, run = 0, prev = null;
    for (const m of mons) { run = (prev && addDays(prev, 7) === m) ? run + 1 : 1; if (run > best) best = run; prev = m; }
    return best;
  }

  // Every tracked best, and how many times a best was beaten (the first value does not count).
  function records(entries) {
    const r = { bat: null, exit: null, contact: null, jump: null, pushups: null, plank: null, velo: null };
    let breaks = 0;
    const up = (k, v, e, extra) => { if (!isNum(v)) return; if (!r[k]) r[k] = Object.assign({ v, date: e.date }, extra); else if (v > r[k].v) { r[k] = Object.assign({ v, date: e.date }, extra); breaks++; } };
    for (const e of entries.slice().sort(byDate)) {
      if (e.kind === 'swing') { up('bat', e.batMax != null ? e.batMax : e.batSpeed, e); if (e.ball !== 'mini') up('exit', e.exitMax != null ? e.exitMax : e.exitVelo, e); }
      if (e.kind === 'machine' && e.of >= 10) up('contact', e.made / e.of, e, { made: e.made, of: e.of });
      if (e.kind === 'strength') { up('jump', e.jump, e); up('pushups', e.pushups, e); up('plank', e.plank, e); }
      if (e.kind === 'velo') up('velo', isNum(e.max) ? e.max : e.avg, e);
    }
    r.breaks = breaks;
    return r;
  }

  function totals(entries) {
    const t = { swings: 0, pushups: 0, situps: 0, squats: 0, sessions: 0 };
    for (const e of entries) {
      if (e.kind === 'reps') { t.swings += e.swings || 0; t.pushups += e.pushups || 0; t.situps += e.situps || 0; t.squats += e.squats || 0; }
      if (e.kind === 'session' && e.complete) t.sessions++;
    }
    return t;
  }

  const XP = { A: 100, B: 100, C: 50, record: 25, perLevel: 300 };
  const TITLES = ['Rookie', 'Starter', 'Slugger', 'All-Star', 'Captain', 'MVP', 'Legend'];
  function game(entries) {
    let xp = 0;
    for (const e of entries) if (e.kind === 'session' && e.complete) xp += XP[e.slot] || 0;
    const breaks = records(entries).breaks;
    xp += breaks * XP.record;
    const level = Math.floor(xp / XP.perLevel) + 1;
    const into = xp % XP.perLevel, base = Math.min(3, Math.floor(into / XP.perLevel * 4));
    return { xp, level, title: TITLES[Math.min(level, TITLES.length) - 1], into, need: XP.perLevel, breaks, frac: into / XP.perLevel,
      baseText: ['Heading to first base', 'Past first, heading to second', 'Past second, heading to third', 'Rounding third, heading home'][base] };
  }

  function badges(entries) {
    const t = totals(entries), w = weeksMap(entries), rec = records(entries);
    const fullWeek = Object.keys(w).some(m => w[m].A && w[m].B && w[m].C);
    const sharp = entries.some(e => e.kind === 'machine' && e.of >= 20 && e.made / e.of >= 0.8);
    const tested = entries.some(e => e.kind === 'strength');
    return [
      { id: 'first', name: 'First session', how: 'Finish any session.', icon: 'star', on: t.sessions >= 1 },
      { id: 'week', name: 'Full week', how: 'Finish A, B and C in one week.', icon: 'trophy', on: fullWeek },
      { id: 'streak3', name: 'Three in a row', how: 'Finish A and B three weeks straight.', icon: 'flame', on: longestStreak(entries) >= 3 },
      { id: 'tested', name: 'Starting line', how: 'Log your first strength test.', icon: 'flag', on: tested },
      { id: 'breaker', name: 'Record breaker', how: 'Beat one of your records.', icon: 'bolt', on: rec.breaks >= 1 },
      { id: 'sharp', name: 'Sharp eye', how: 'Get 16 solid hits out of 20 on the machine.', icon: 'target', on: sharp },
      { id: 'film', name: 'Film study', how: 'Save your first filmstrip.', icon: 'play', on: entries.some(e => e.kind === 'analysis') },
      { id: 'ten', name: '10 sessions', how: 'Finish 10 sessions.', icon: 'star', on: t.sessions >= 10 },
      { id: 'sw500', name: '500 swings', how: 'Log 500 swings.', icon: 'bat', on: t.swings >= 500 },
      { id: 'pu100', name: '100 push-ups', how: 'Log 100 push-ups.', icon: 'bolt', on: t.pushups >= 100 }
    ];
  }

  function retest(entries, today) {
    const t = entries.filter(e => e.kind === 'strength').map(e => e.date).sort();
    if (!t.length) return { due: today, inDays: 0, first: null, last: null };
    const due = addDays(t[t.length - 1], 28);
    return { due, inDays: diffDays(due, today), first: t[0], last: t[t.length - 1] };
  }

  const HEAVY_CAP = 10; // most heavy-bat swings in one session (a rule written for this hub)
  const FOCUS = {
    baseline: { name: 'Test week', kid: 'Show what you can do. These numbers are your starting line.', icon: 'flag' },
    contact: { name: 'Contact', kid: 'Hit it on the sweet spot, every time.', icon: 'target' },
    speed: { name: 'Bat speed', kid: 'Swing fast. Chase a new top speed.', icon: 'bolt' },
    path: { name: 'Swing path', kid: 'Smooth swing, straight to the ball.', icon: 'bat' },
    timing: { name: 'Timing', kid: 'Be on time for every pitch.', icon: 'clock' }
  };

  const I = (id, title, text, o) => Object.assign({ id, title, text }, o || {});
  function hitting(focus) {
    const tee3 = (id, min) => I(id, 'Tee: inside, middle, outside', 'Practice bat. 5 swings at each spot. Line drives into the net.', { min, sw: 15 });
    if (focus === 'contact') return [
      I('c1', 'Machine: 20 pitches', 'Skinny bat and mini balls on a slow setting. Two rounds of 10. Count your solid hits.', { min: 6, count: 20, sw: 20 }),
      tee3('c2', 4),
      I('c3', 'Machine: 10 more', 'Practice bat this time. Same swing as the tee.', { min: 2, sw: 10 })];
    if (focus === 'speed') return [
      I('s1', 'Tee: 15 fast swings', 'Practice bat with the sensor on. 3 sets of 5. Rest 30 seconds between sets.', { min: 5, sw: 15 }),
      I('s2', 'Light bat: 10 swings', 'SKLZ unloaded bat. 2 sets of 5, as fast as you can.', { min: 2, sw: 10 }),
      I('s3', 'Heavy bat: 5 swings', 'SKLZ hand-loaded bat on the tee. Dad films it.', { min: 2, heavy: 5, sw: 5 }),
      I('s4', 'Beat your best', 'Practice bat. 5 full-speed swings. Go for a new top speed.', { min: 3, sw: 5 })];
    if (focus === 'path') return [
      I('p1', 'CamWood: 10 smooth swings', 'On the tee. 2 sets of 5. Hands stay inside the ball. Dad films one set.', { min: 4, heavy: 10, sw: 10 }),
      tee3('p2', 5),
      I('p3', 'Machine: 10 pitches', 'Skinny bat. Count your solid hits.', { min: 3, count: 10, sw: 10 })];
    if (focus === 'timing') return [
      I('t1', 'Machine: slow, then fast', 'Skinny bat. 10 pitches slow, then 10 faster. Count your solid hits.', { min: 5, count: 20, sw: 20 }),
      I('t2', 'Machine: mystery pitch', '10 pitches. Dad switches between fastball and curve without telling you.', { min: 4, sw: 10 }),
      I('t3', 'Tee: go on the call', 'Practice bat. 10 swings. Start your load when Dad says go.', { min: 3, sw: 10 })];
    return [
      I('b1', 'Bat speed test', 'Sensor on the practice bat. 10 full swings off the tee.', { min: 4, sw: 10 }),
      I('b2', 'Exit speed test', 'Radar set up. 10 real baseballs off the tee into the net.', { min: 4, sw: 10 }),
      I('b3', 'Contact test', 'Machine, skinny bat, 20 pitches. Count your solid hits.', { min: 4, count: 20, sw: 20 })];
  }

  function buildWeek(focus, step, armRest) {
    const S = Math.max(1, Math.min(5, step || 1)), r = n => n + 2 * (S - 1), hold = 20 + 5 * (S - 1);
    const warm = { name: 'Warm-up', min: 3, items: [I('w1', 'Warm up', '10 arm circles each way, 10 leg swings each leg, 10 easy swings with no ball.')] };
    const log = { name: 'Wrap up', min: 2, items: [I('l1', 'Tell Dad your numbers', 'He logs them so you get credit.')] };
    const hit = { name: 'Hitting', min: 12, items: hitting(focus) };
    const bodyA = focus === 'baseline'
      ? { name: 'Strength test', min: 8, items: [
          I('x1', 'Long jump test', '3 tries from standing. Dad measures your best one.'),
          I('x2', 'Push-up test', 'As many as you can with a flat back. Stop when your form slips.'),
          I('x3', 'Plank test', 'Hold as long as you can with a flat back. Dad times it.')] }
      : { name: 'Strength', min: 8, items: [
          I('a1', 'Squats', '2 sets of ' + r(8) + '.', { sq: 2 * r(8) }),
          I('a2', 'Push-ups', '2 sets of ' + r(5) + ' with a flat back.', { pu: 2 * r(5) }),
          I('a3', 'Sit-ups', '2 sets of ' + r(8) + '.', { su: 2 * r(8) }),
          I('a4', 'Plank', '2 holds of ' + hold + ' seconds.')] };
    const bodyB = { name: 'Strength', min: 8, items: [
      I('k1', 'Tank twists', 'Tidal Tank. 2 sets of ' + r(6) + ' each side. Keep the water quiet.'),
      I('k2', 'Tank carry', 'Hold the Tidal Tank in front. 2 walks of 20 steps.'),
      I('k3', 'Lunges', 'Step back. 2 sets of ' + r(5) + ' each leg.'),
      armRest ? I('k4r', 'Tank shifts', 'Arm rest day, so no throws. Side to side, 2 sets of ' + r(6) + '.')
              : I('k4', 'Med ball throws', 'Side throws into the net. 2 sets of ' + r(5) + ' each side.')] };
    const bodyC = { name: 'Bodyweight', min: 10, items: [
      I('z1', 'Squats', '2 sets of ' + r(8) + '.', { sq: 2 * r(8) }),
      I('z2', 'Lunges', 'Step back. 2 sets of ' + r(5) + ' each leg.'),
      I('z3', 'Push-ups', '2 sets of ' + r(5) + '.', { pu: 2 * r(5) }),
      I('z4', 'Sit-ups', '2 sets of ' + r(8) + '.', { su: 2 * r(8) }),
      I('z5', 'Plank', '2 holds of ' + hold + ' seconds.'),
      I('z6', 'Big jumps', '5 big jumps. Stick every landing.')] };
    return {
      A: { title: 'Day 1', sub: 'Hitting + push-ups', min: 25, blocks: [warm, hit, bodyA, log] },
      // In test week only Day 1 runs the tests; Day 2 is a normal contact practice so he is not maxing out twice.
      B: { title: 'Day 2', sub: 'Hitting + Tidal Tank', min: 25, blocks: [warm, focus === 'baseline' ? { name: 'Hitting', min: 12, items: hitting('contact') } : hit, bodyB, log] },
      C: { title: 'Day 3', sub: 'Bodyweight only', min: 10, blocks: [bodyC] }
    };
  }

  // What a finished session credits automatically.
  function sessionReps(session) {
    const t = { swings: 0, pushups: 0, situps: 0, squats: 0 };
    for (const b of session.blocks) for (const i of b.items) { t.swings += i.sw || 0; t.pushups += i.pu || 0; t.situps += i.su || 0; t.squats += i.sq || 0; }
    return t;
  }

  // ---------- 5. rules that tune themselves to his numbers ----------
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  function tune(entries, today) {
    const rules = Object.assign({}, RULES), notes = [], lo = addDays(today, -112), hi = addDays(today, -28);
    const base = entries.filter(e => e.kind === 'machine' && e.date > lo && e.date <= hi);
    const made = base.reduce((s, e) => s + (e.made || 0), 0), of = base.reduce((s, e) => s + (e.of || 0), 0);
    if (of >= 40) {
      const r = made / of; rules.contactGood = clamp(r, 0.5, 0.9); rules.contactLow = clamp(r - 0.10, 0.4, 0.8);
      notes.push('Contact is tuned to him. His norm is ' + made + ' ÷ ' + of + ' = ' + pc(r) + ' (weeks 5 to 16 back). The hub flags contact under ' + pc(rules.contactLow) + ' and calls it good at ' + pc(rules.contactGood) + '.');
    } else notes.push('Contact is on the starting rule (flag under ' + pc(RULES.contactLow) + ', good at ' + pc(RULES.contactGood) + ') until he has 40 machine pitches older than 4 weeks. He has ' + of + '.');
    const sp = entries.filter(e => e.kind === 'swing' && isNum(e.batSpeed) && e.date > lo && e.date <= today).map(e => e.batSpeed);
    if (sp.length >= 6) {
      const m = avg(sp), sd = Math.sqrt(avg(sp.map(x => (x - m) * (x - m)))); rules.speedFlat = clamp(sd / 2, 0.5, 2);
      notes.push('Bat speed is tuned to him. His readings vary by ' + sd.toFixed(1) + ' mph, and ' + sd.toFixed(1) + ' ÷ 2 = ' + (sd / 2).toFixed(1) + ', so a gain under ' + rules.speedFlat.toFixed(1) + ' mph counts as flat' + (Math.abs(sd / 2 - rules.speedFlat) > 0.001 ? ' (held between 0.5 and 2.0)' : '') + '.');
    } else notes.push('Bat speed is on the starting rule (a gain under ' + RULES.speedFlat + ' mph counts as flat) until he has 6 bat speed entries. He has ' + sp.length + '.');
    return { rules, notes, tuned: of >= 40 || sp.length >= 6 };
  }

  // ---------- 2. how often the same fix keeps coming up ----------
  function fixRun(checksNewestFirst) {
    const last = checksNewestFirst.slice(0, 4), area = last.length ? last[0].fixArea : null;
    if (!area || area === 'none' || !FOCUS[area]) return null;
    return { area, name: FOCUS[area].name, count: last.filter(c => c.fixArea === area).length, of: last.length };
  }

  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const short = s => MON[parse(s).getUTCMonth()] + ' ' + parse(s).getUTCDate();
  const REC_NAMES = { bat: 'top bat speed', exit: 'top exit speed', contact: 'best machine round', jump: 'long jump', pushups: 'push-up test', plank: 'plank', velo: 'top pitch speed' };
  function weekRecap(entries, today) {
    const mon = mondayOf(today), sun = addDays(mon, 6), wk = entries.filter(e => e.date >= mon && e.date <= sun);
    const slots = {}; for (const e of wk) if (e.kind === 'session' && e.complete && ['A', 'B', 'C'].indexOf(e.slot) >= 0) slots[e.slot] = true;
    const m = wk.filter(e => e.kind === 'machine'), sw = wk.filter(e => e.kind === 'swing' && isNum(e.batSpeed));
    const g = wk.filter(e => e.kind === 'game'), pt = wk.filter(e => e.kind === 'pitch'), ck = wk.filter(e => e.kind === 'analysis').sort(byDate);
    const sum = (a, k) => a.reduce((s, e) => s + (isNum(e[k]) ? e[k] : 0), 0);
    const before = records(entries.filter(e => e.date < mon)), after = records(entries.filter(e => e.date <= sun));
    const nextMon = addDays(mon, 7);
    return {
      mon, sun, sessions: Object.keys(slots).sort(), reps: totals(wk),
      made: sum(m, 'made'), of: sum(m, 'of'),
      batN: sw.length, batAvg: avg(sw.map(e => e.batSpeed)), batBest: sw.length ? Math.max.apply(null, sw.map(e => isNum(e.batMax) ? e.batMax : e.batSpeed)) : null,
      games: { n: g.length, ab: sum(g, 'ab'), h: sum(g, 'h'), k: sum(g, 'k'), bb: sum(g, 'bb') },
      pitch: { n: pt.length, pitches: sum(pt, 'pitches'), outs: sum(pt, 'outs') },
      velo: (function () { const v = wk.filter(e => e.kind === 'velo'), a = v.filter(e => isNum(e.avg)).map(e => e.avg), m = v.map(e => isNum(e.max) ? e.max : e.avg).filter(isNum);
        return { n: v.length, avg: a.length ? avg(a) : null, aN: a.length, max: m.length ? Math.max.apply(null, m) : null }; })(),
      body: wk.filter(e => e.kind === 'body').sort(byDate).pop() || null,
      checks: ck.length, lastFix: ck.length && ck[ck.length - 1].fix && typeof ck[ck.length - 1].fix.title === 'string' ? ck[ck.length - 1].fix.title.slice(0, 60) : '',
      newRecords: Object.keys(REC_NAMES).filter(k => before[k] && after[k] && after[k].v > before[k].v).map(k => REC_NAMES[k]),
      next: decideFocus(stats(entries, nextMon), entries, nextMon, tune(entries, nextMon).rules)
    };
  }
  function fmtHeight(inches) { const f = Math.floor(inches / 12), i = Math.round((inches - f * 12) * 10) / 10; return f + ' ft ' + i + ' in'; }
  function recapText(r, name) {
    const out = [(name || 'Player') + ', week of ' + short(r.mon) + ' to ' + short(r.sun)];
    out.push('Sessions: ' + r.sessions.length + ' of 3' + (r.sessions.length ? ' (' + r.sessions.map(s => ({ A: 'Day 1', B: 'Day 2', C: 'Day 3' })[s] || s).join(', ') + ')' : ''));
    const parts = [[r.reps.swings, 'swings'], [r.reps.squats, 'squats'], [r.reps.pushups, 'push-ups'], [r.reps.situps, 'sit-ups']].filter(x => x[0] > 0).map(x => x[0] + ' ' + x[1]);
    out.push('Reps: ' + (parts.join(', ') || 'none logged'));
    if (r.of > 0) out.push('Machine contact: ' + r.made + ' ÷ ' + r.of + ' = ' + Math.round(r.made / r.of * 100) + '%');
    if (r.batN) out.push('Bat speed: average ' + r.batAvg.toFixed(1) + ' mph from ' + r.batN + (r.batN === 1 ? ' entry' : ' entries') + ', best ' + r.batBest.toFixed(1) + ' mph');
    if (r.games.n) out.push('Games: ' + r.games.h + ' for ' + r.games.ab + ', ' + r.games.k + (r.games.k === 1 ? ' strikeout, ' : ' strikeouts, ') + r.games.bb + (r.games.bb === 1 ? ' walk' : ' walks'));
    if (r.pitch.n) out.push('Pitching: ' + r.pitch.n + (r.pitch.n === 1 ? ' outing, ' : ' outings, ') + r.pitch.pitches + ' pitches, ' + fmtInnings(r.pitch.outs) + ' innings');
    if (r.velo && r.velo.n) out.push('Pitch speed: ' + (r.velo.avg != null ? 'average ' + r.velo.avg.toFixed(1) + ' mph from ' + r.velo.aN + (r.velo.aN === 1 ? ' check, ' : ' checks, ') : '') + 'fastest ' + r.velo.max.toFixed(1) + ' mph');
    if (r.body) out.push('Measured: ' + [isNum(r.body.heightIn) ? fmtHeight(r.body.heightIn) : null, isNum(r.body.weightLb) ? r.body.weightLb + ' lb' : null].filter(Boolean).join(', '));
    if (r.checks) out.push('Filmstrips: ' + r.checks + (r.lastFix ? '. Latest note: ' + r.lastFix : ''));
    if (r.newRecords.length) out.push('New records: ' + r.newRecords.join(', '));
    out.push('Likely focus next week: ' + FOCUS[r.next.focus].name + '. ' + r.next.why);
    return out;
  }

  return { parse, iso, addDays, diffDays, mondayOf, avg, isNum, byDate, pctVsGame, fitStatus, restDays, fmtInnings, outsFromInnings, armStatus, stats,
    decideFocus, weekInfo, streak, longestStreak, records, totals, game, badges, retest, buildWeek, hitting, sessionReps, tune, fixRun, weekRecap, recapText, fmtHeight, HEAVY_CAP, FOCUS, RULES, XP, TITLES };
})();
/*LOGIC-END*/
