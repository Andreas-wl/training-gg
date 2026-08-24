const STORAGE_KEY = 'sbsTrainerData_v1';
const MAIN_KEYS = ['squat', 'bench', 'deadlift', 'ohp'];

function defaultState() {
  const maxes = {};
  LIFT_ORDER.forEach((k) => { maxes[k] = null; });
  return {
    version: 1,
    settings: { ...DEFAULT_SETTINGS },
    maxes,
    thresholds: { ...DEFAULT_THRESHOLDS },
    currentWeek: 1,
    currentDayIndex: 0,
    accessoryPlan: {},
    accessoryLogs: {},
    favoriteBackExercise: '',
    logs: {},
  };
}

// Övningar man lagt till innan denna version sparades som {dayIndex: [{name,setsReps,weight}]}
// utan historik per vecka. Migreras in i den nya planen + en vecka-1-logg så inget tappas.
function migrateOldAccessories(parsed, base) {
  if (parsed.accessoryPlan) return { plan: parsed.accessoryPlan, logs: parsed.accessoryLogs || {} };
  const plan = {};
  const logs = {};
  Object.entries(parsed.accessories || {}).forEach(([dayIndex, rows]) => {
    plan[dayIndex] = rows.map((row) => {
      const id = makeId();
      if (row.setsReps || row.weight) {
        logs[`acc_${id}_w1`] = { name: row.name || '', setsReps: row.setsReps || '', weight: row.weight || '' };
      }
      return { id, name: row.name || '' };
    });
  });
  return { plan, logs };
}

function loadState() {
  const base = defaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    const { plan, logs: accLogs } = migrateOldAccessories(parsed, base);
    return {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...(parsed.settings || {}) },
      maxes: { ...base.maxes, ...(parsed.maxes || {}) },
      thresholds: { ...base.thresholds, ...(parsed.thresholds || {}) },
      accessoryPlan: plan,
      accessoryLogs: accLogs,
      logs: parsed.logs || {},
    };
  } catch (e) {
    console.error('Kunde inte läsa sparad data, återställer till standard.', e);
    return base;
  }
}

function makeId() {
  return `a${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

let state = loadState();
let currentView = 'today';

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function hasRequiredMaxes() {
  return MAIN_KEYS.every((k) => state.maxes[k]);
}

function roundTo(value, rounding) {
  if (value == null || !rounding) return value;
  return Math.round(value / rounding) * rounding;
}

function logKeyFor(liftKey, week) {
  return `${liftKey}_w${week}`;
}

function updateLog(liftKey, week, patch) {
  const key = logKeyFor(liftKey, week);
  const existing = state.logs[key] || {};
  const merged = { ...existing, ...patch };

  const max = state.maxes[liftKey];
  const pct = intensityFor(liftKey, week);
  const { reps, rir } = percentRow(pct);
  const effectiveMax = merged.testSingle
    ? merged.testSingle / state.settings.singleAt8Percent
    : max;
  merged.weightUsed = computeWeight(effectiveMax, pct, state.settings.rounding);
  merged.repsTarget = reps;
  merged.rirCutoff = rir;
  merged.pct = pct;

  state.logs[key] = merged;
  saveState();
}

function autoregSuggestion(liftKey, week) {
  const key = logKeyFor(liftKey, week);
  const log = state.logs[key];
  if (!log || log.setsCompleted == null || log.setsCompleted === '') return null;
  const sets = Number(log.setsCompleted);
  const { lower, upper, increasePct, decreasePct } = state.thresholds;
  const max = state.maxes[liftKey];
  if (!max) return null;

  if (sets < lower) {
    const newMax = roundTo(max * (1 + decreasePct), state.settings.rounding);
    return { direction: 'down', newMax, pct: decreasePct };
  }
  if (sets >= upper) {
    const newMax = roundTo(max * (1 + increasePct), state.settings.rounding);
    return { direction: 'up', newMax, pct: increasePct };
  }
  return null;
}

// ---------- Rendering ----------

function render() {
  const app = document.getElementById('app');
  app.innerHTML = '';

  if (!hasRequiredMaxes()) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `Sätt upp dina max för knäböj, bänkpress, marklyft och militärpress<br>innan du kan börja logga träning.<br><br>`;
    const btn = document.createElement('button');
    btn.className = 'primary-btn';
    btn.style.maxWidth = '260px';
    btn.style.margin = '0 auto';
    btn.textContent = 'Öppna inställningar';
    btn.addEventListener('click', openSettings);
    div.appendChild(btn);
    app.appendChild(div);
    return;
  }

  if (currentView === 'today') renderToday(app);
  else renderHistory(app);
}

function renderToday(app) {
  const freq = state.settings.frequency;
  const days = DAY_TEMPLATES[freq];
  if (state.currentDayIndex >= days.length) state.currentDayIndex = 0;

  // Week nav
  const nav = document.createElement('div');
  nav.className = 'week-nav';
  const bw = blockWaveLabel(state.currentWeek);
  const effWeek = effectiveWeek(state.currentWeek);
  const cycle = Math.floor((state.currentWeek - 1) / CYCLE_LENGTH) + 1;
  nav.innerHTML = `
    <button id="weekPrev">−</button>
    <div>
      <span class="week-label">Vecka ${effWeek} av ${CYCLE_LENGTH}</span>
      <span class="block-label">${bw.text}${cycle > 1 ? ` · Cykel ${cycle}` : ''}</span>
    </div>
    <button id="weekNext">+</button>
  `;
  app.appendChild(nav);
  nav.querySelector('#weekPrev').addEventListener('click', () => {
    state.currentWeek = Math.max(1, state.currentWeek - 1);
    saveState();
    render();
  });
  nav.querySelector('#weekNext').addEventListener('click', () => {
    state.currentWeek += 1;
    saveState();
    render();
  });

  // Day selector
  const daySel = document.createElement('div');
  daySel.className = 'day-selector';
  days.forEach((_, idx) => {
    const btn = document.createElement('button');
    btn.textContent = `Dag ${idx + 1}`;
    if (idx === state.currentDayIndex) btn.classList.add('active');
    btn.addEventListener('click', () => {
      state.currentDayIndex = idx;
      saveState();
      render();
    });
    daySel.appendChild(btn);
  });
  app.appendChild(daySel);

  // Lift cards
  const liftKeys = days[state.currentDayIndex];
  liftKeys.forEach((liftKey) => app.appendChild(buildLiftCard(liftKey)));

  // Accessories
  app.appendChild(buildAccessoriesBlock(state.currentDayIndex, state.currentWeek));
}

function buildLiftCard(liftKey) {
  const tpl = document.getElementById('tpl-lift-card');
  const node = tpl.content.firstElementChild.cloneNode(true);
  const lift = LIFTS[liftKey];
  const week = state.currentWeek;
  const key = logKeyFor(liftKey, week);
  const log = state.logs[key] || {};
  const max = state.maxes[liftKey];

  node.querySelector('.lift-name').textContent = lift.name;
  node.querySelector('.lift-badge').textContent = lift.isMain
    ? 'Huvudlyft'
    : `Variant · ${LIFTS[lift.group].name}`;

  const pct = intensityFor(liftKey, week);
  const { reps, rir } = percentRow(pct);
  const effectiveMax = log.testSingle ? log.testSingle / state.settings.singleAt8Percent : max;
  const weight = computeWeight(effectiveMax, pct, state.settings.rounding);

  node.querySelector('.weight-value').textContent = max
    ? `${weight} ${state.settings.unit}`
    : 'Sätt max';
  node.querySelector('.reps-value').textContent = reps;
  node.querySelector('.rir-value').textContent = rir;
  node.querySelector('.goal-value').textContent = `${state.thresholds.lower}-${state.thresholds.upper} set`;

  const tmInput = node.querySelector('.tm-test-input');
  tmInput.value = log.testSingle ?? '';
  const useMaxBtn = node.querySelector('.use-as-max-btn');
  useMaxBtn.disabled = !tmInput.value;

  tmInput.addEventListener('change', () => {
    const val = tmInput.value === '' ? null : Number(tmInput.value);
    updateLog(liftKey, week, { testSingle: val });
    render();
  });
  useMaxBtn.addEventListener('click', () => {
    const val = Number(tmInput.value);
    if (!val) return;
    const newMax = roundTo(val / state.settings.singleAt8Percent, state.settings.rounding);
    state.maxes[liftKey] = newMax;
    saveState();
    render();
  });

  const setsInput = node.querySelector('.sets-completed-input');
  setsInput.value = log.setsCompleted ?? '';
  setsInput.addEventListener('change', () => {
    const val = setsInput.value === '' ? null : Number(setsInput.value);
    updateLog(liftKey, week, { setsCompleted: val });
    render();
  });

  const notes = node.querySelector('.lift-notes');
  notes.value = log.notes || '';
  notes.addEventListener('blur', () => {
    updateLog(liftKey, week, { notes: notes.value });
  });

  const banner = node.querySelector('.autoreg-banner');
  const suggestion = autoregSuggestion(liftKey, week);
  if (suggestion) {
    banner.hidden = false;
    banner.classList.add(suggestion.direction === 'up' ? 'up' : 'down');
    const pctText = `${suggestion.pct > 0 ? '+' : ''}${Math.round(suggestion.pct * 100)}%`;
    banner.innerHTML = `<span>${suggestion.direction === 'up' ? '📈' : '📉'} Förslag: ${pctText} → ${suggestion.newMax} ${state.settings.unit}</span>`;
    const applyBtn = document.createElement('button');
    applyBtn.textContent = 'Använd';
    applyBtn.addEventListener('click', () => {
      state.maxes[liftKey] = suggestion.newMax;
      saveState();
      render();
    });
    banner.appendChild(applyBtn);
  } else {
    banner.hidden = true;
  }

  return node;
}

function accessoryLogKey(id, week) {
  return `acc_${id}_w${week}`;
}

function updateAccessoryLog(id, week, name, patch) {
  const key = accessoryLogKey(id, week);
  const existing = state.accessoryLogs[key] || {};
  state.accessoryLogs[key] = { ...existing, ...patch, name };
  saveState();
}

// Senaste loggade värdet för denna övning (tidigare vecka) - visas som förslag
// så man inte behöver skriva om samma vikt/reps varje vecka, men sparas inte
// förrän man själv bekräftar (blur) den veckans fält.
function previousAccessoryLog(id, week) {
  for (let w = week - 1; w >= 1; w -= 1) {
    const log = state.accessoryLogs[accessoryLogKey(id, w)];
    if (log) return log;
  }
  return null;
}

function buildAccessoriesBlock(dayIndex, week) {
  const wrap = document.createElement('div');
  wrap.className = 'accessories-block';
  wrap.innerHTML = '<h4>Övrigt / tillbehörsövningar</h4>';

  if (!state.accessoryPlan[dayIndex]) state.accessoryPlan[dayIndex] = [];
  const slots = state.accessoryPlan[dayIndex];

  const tpl = document.getElementById('tpl-accessory-row');
  slots.forEach((slot, idx) => {
    const node = tpl.content.firstElementChild.cloneNode(true);
    const nameInput = node.querySelector('.acc-name');
    const setsRepsInput = node.querySelector('.acc-sets-reps');
    const weightInput = node.querySelector('.acc-weight');

    const thisWeekLog = state.accessoryLogs[accessoryLogKey(slot.id, week)];
    const fallback = thisWeekLog || previousAccessoryLog(slot.id, week) || {};

    nameInput.value = slot.name || '';
    setsRepsInput.value = fallback.setsReps || '';
    weightInput.value = fallback.weight || '';

    nameInput.addEventListener('blur', () => { slot.name = nameInput.value; saveState(); });
    setsRepsInput.addEventListener('blur', () => {
      updateAccessoryLog(slot.id, week, slot.name, { setsReps: setsRepsInput.value });
    });
    weightInput.addEventListener('blur', () => {
      updateAccessoryLog(slot.id, week, slot.name, { weight: weightInput.value });
    });
    node.querySelector('.acc-remove').addEventListener('click', () => {
      slots.splice(idx, 1);
      saveState();
      render();
    });
    wrap.appendChild(node);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'btn-secondary add-accessory-btn';
  addBtn.textContent = '+ Lägg till övning';
  addBtn.addEventListener('click', () => {
    slots.push({ id: makeId(), name: '' });
    saveState();
    render();
  });
  wrap.appendChild(addBtn);

  if (state.favoriteBackExercise) {
    const favBtn = document.createElement('button');
    favBtn.className = 'btn-secondary';
    favBtn.style.marginLeft = '0.5rem';
    favBtn.textContent = `+ ${state.favoriteBackExercise}`;
    favBtn.addEventListener('click', () => {
      slots.push({ id: makeId(), name: state.favoriteBackExercise });
      saveState();
      render();
    });
    wrap.appendChild(favBtn);
  }

  return wrap;
}

function renderHistory(app) {
  const liftEntries = [];
  Object.entries(state.logs).forEach(([key, log]) => {
    const hasData = log.testSingle != null || log.setsCompleted != null || (log.notes && log.notes.trim());
    if (!hasData) return;
    const m = key.match(/^(.+)_w(\d+)$/);
    if (!m) return;
    liftEntries.push({ liftKey: m[1], week: Number(m[2]), log });
  });

  const accEntries = [];
  Object.entries(state.accessoryLogs).forEach(([key, log]) => {
    const hasData = (log.setsReps && log.setsReps.trim()) || (log.weight && String(log.weight).trim());
    if (!hasData) return;
    const m = key.match(/^acc_(.+)_w(\d+)$/);
    if (!m) return;
    accEntries.push({ week: Number(m[2]), log });
  });

  if (liftEntries.length === 0 && accEntries.length === 0) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.textContent = 'Ingen historik än. Logga ett set på Idag-fliken.';
    app.appendChild(div);
    return;
  }

  liftEntries.sort((a, b) => b.week - a.week || a.liftKey.localeCompare(b.liftKey));
  liftEntries.forEach(({ liftKey, week, log }) => {
    const lift = LIFTS[liftKey];
    if (!lift) return;
    const bw = blockWaveLabel(week);
    const div = document.createElement('div');
    div.className = 'history-entry';
    const weightText = log.weightUsed != null ? `${log.weightUsed} ${state.settings.unit}` : '–';
    div.innerHTML = `
      <div class="h-top"><span>${lift.name}</span><span>Vecka ${week}</span></div>
      <div class="h-meta">${bw.text} · ${weightText} × ${log.repsTarget ?? '–'} reps · RIR-cutoff ${log.rirCutoff ?? '–'}</div>
      <div class="h-meta">Set klara: ${log.setsCompleted ?? '–'}${log.testSingle ? ` · Testad singel: ${log.testSingle} ${state.settings.unit}` : ''}</div>
      ${log.notes ? `<div class="h-meta">"${log.notes}"</div>` : ''}
    `;
    app.appendChild(div);
  });

  accEntries.sort((a, b) => b.week - a.week || (a.log.name || '').localeCompare(b.log.name || ''));
  accEntries.forEach(({ week, log }) => {
    const bw = blockWaveLabel(week);
    const div = document.createElement('div');
    div.className = 'history-entry';
    div.innerHTML = `
      <div class="h-top"><span>${log.name || '(namnlös övning)'}</span><span>Vecka ${week}</span></div>
      <div class="h-meta">${bw.text} · Tillbehör</div>
      <div class="h-meta">${log.setsReps || '–'}${log.weight ? ` · ${log.weight} ${state.settings.unit}` : ''}</div>
    `;
    app.appendChild(div);
  });
}

// ---------- Settings overlay ----------

function openSettings() {
  document.getElementById('settingsOverlay').hidden = false;
  renderSettingsBody();
}
function closeSettings() {
  document.getElementById('settingsOverlay').hidden = true;
}

function renderSettingsBody() {
  const body = document.getElementById('settingsBody');
  body.innerHTML = '';

  const s = state.settings;
  const t = state.thresholds;

  body.appendChild(fieldGroupHeader('Grundinställningar'));
  const freqRow = fieldRow('Pass per vecka', selectEl('freqSel', [2, 3, 4, 5, 6], s.frequency));
  const roundRow = fieldRow('Avrundning', numberInput('roundInput', s.rounding, 0.5));
  const unitRow = fieldRow('Enhet (etikett)', textInput('unitInput', s.unit));
  const singleRow = fieldRow('Singel @RPE8 (% av 1RM)', numberInput('singleInput', s.singleAt8Percent, 0.01));
  [freqRow, roundRow, unitRow, singleRow].forEach((r) => body.appendChild(r));
  body.appendChild(hint('En singel med 2 reps kvar (RPE8) antas motsvara denna andel av ditt sanna 1RM.'));

  body.appendChild(fieldGroupHeader('Autoreglering (set/vecka)'));
  body.appendChild(fieldRow('Nedre tröskel', numberInput('lowerInput', t.lower, 1)));
  body.appendChild(fieldRow('Övre tröskel', numberInput('upperInput', t.upper, 1)));
  body.appendChild(fieldRow('Öka med (%)', numberInput('incInput', Math.round(t.increasePct * 100), 1)));
  body.appendChild(fieldRow('Minska med (%)', numberInput('decInput', Math.round(t.decreasePct * 100), 1)));
  body.appendChild(hint('Under nedre tröskeln → sänk max. Vid/över övre tröskeln → höj max. Standard: 4-6 set, +2%/−5%.'));

  body.appendChild(fieldGroupHeader('Max (huvudlyft)'));
  MAIN_KEYS.forEach((k) => body.appendChild(fieldRow(LIFTS[k].name, numberInput(`max_${k}`, state.maxes[k], 0.5))));

  body.appendChild(fieldGroupHeader('Max (varianter, valfritt)'));
  body.appendChild(hint('Känner du inte till ditt max? Gissa lågt till att börja med – du kan justera senare.'));
  LIFT_ORDER.filter((k) => !LIFTS[k].isMain).forEach((k) => {
    body.appendChild(fieldRow(LIFTS[k].name, numberInput(`max_${k}`, state.maxes[k], 0.5)));
  });

  body.appendChild(fieldGroupHeader('Favorit-ryggövning'));
  body.appendChild(fieldRow('Snabbval till tillbehör', selectEl('backSel', ['', ...BACK_EXERCISES], state.favoriteBackExercise)));

  const saveBtn = document.createElement('button');
  saveBtn.className = 'save-settings-btn';
  saveBtn.textContent = 'Spara inställningar';
  saveBtn.addEventListener('click', () => {
    s.frequency = Number(document.getElementById('freqSel').value);
    s.rounding = Number(document.getElementById('roundInput').value) || DEFAULT_SETTINGS.rounding;
    s.unit = document.getElementById('unitInput').value || 'kg';
    s.singleAt8Percent = Number(document.getElementById('singleInput').value) || DEFAULT_SETTINGS.singleAt8Percent;

    t.lower = Number(document.getElementById('lowerInput').value);
    t.upper = Number(document.getElementById('upperInput').value);
    t.increasePct = Number(document.getElementById('incInput').value) / 100;
    t.decreasePct = Number(document.getElementById('decInput').value) / 100;

    LIFT_ORDER.forEach((k) => {
      const el = document.getElementById(`max_${k}`);
      const v = el.value === '' ? null : Number(el.value);
      state.maxes[k] = v;
    });

    state.favoriteBackExercise = document.getElementById('backSel').value;
    state.currentDayIndex = 0;

    saveState();
    closeSettings();
    render();
  });
  body.appendChild(saveBtn);

  const resetBtn = document.createElement('button');
  resetBtn.className = 'btn-secondary';
  resetBtn.style.width = '100%';
  resetBtn.style.marginTop = '0.6rem';
  resetBtn.textContent = 'Återställ all data';
  resetBtn.addEventListener('click', () => {
    if (confirm('Radera all sparad träningsdata? Detta kan inte ångras.')) {
      localStorage.removeItem(STORAGE_KEY);
      state = defaultState();
      closeSettings();
      render();
    }
  });
  body.appendChild(resetBtn);
}

function fieldGroupHeader(text) {
  const h = document.createElement('h3');
  h.textContent = text;
  return h;
}
function fieldRow(labelText, inputEl) {
  const row = document.createElement('div');
  row.className = 'field-row';
  const label = document.createElement('label');
  label.textContent = labelText;
  row.appendChild(label);
  row.appendChild(inputEl);
  return row;
}
function hint(text) {
  const p = document.createElement('p');
  p.className = 'hint';
  p.textContent = text;
  return p;
}
function numberInput(id, value, step) {
  const el = document.createElement('input');
  el.type = 'number';
  el.step = step || 1;
  el.id = id;
  el.value = value ?? '';
  return el;
}
function textInput(id, value) {
  const el = document.createElement('input');
  el.type = 'text';
  el.id = id;
  el.value = value ?? '';
  return el;
}
function selectEl(id, options, selected) {
  const el = document.createElement('select');
  el.id = id;
  options.forEach((opt) => {
    const o = document.createElement('option');
    o.value = opt;
    o.textContent = opt === '' ? '(ingen)' : opt;
    if (String(opt) === String(selected)) o.selected = true;
    el.appendChild(o);
  });
  return el;
}

// ---------- Wiring ----------

document.querySelectorAll('.tab-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentView = btn.dataset.view;
    render();
  });
});

document.getElementById('settingsBtn').addEventListener('click', openSettings);
document.getElementById('closeSettings').addEventListener('click', closeSettings);
document.getElementById('settingsOverlay').addEventListener('click', (e) => {
  if (e.target.id === 'settingsOverlay') closeSettings();
});

if (!hasRequiredMaxes()) openSettings();
render();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((e) => console.error('SW-registrering misslyckades', e));
  });
}
