import { MALTS, HOPS, YEASTS, STYLES, byId } from '../core/data.js';
import { compute, newRecipeFromStyle, setIbu, rangeStatus, ebcToHex, platoToSG } from '../core/brew.js';

const STORE = 'beercreator.recipe.v1';
const $ = id => document.getElementById(id);
const nf = (d = 1) => new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const f0 = nf(0), f1 = nf(1), f2 = nf(2), f3 = nf(3);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let recipe = load() || newRecipeFromStyle('pils');
let baseline = compute(recipe); // Vergleichswert für die Pfeile (Δ)

function load() {
  try { const r = JSON.parse(localStorage.getItem(STORE)); return r && r.malts && r.hops ? r : null; } catch { return null; }
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(recipe)); } catch {} }

// ---------- Slider-Definitionen ----------
const SLIDERS = [
  { key: 'plato', label: 'Stammwürze', unit: '°P', min: 5, max: 24, step: 0.1, dec: 1,
    hint: 'Mehr Zucker in der Würze → mehr Malz, mehr Alkohol, mehr Körper, mehr Hefe nötig.',
    get: () => recipe.plato, set: v => { recipe.plato = v; } },
  { key: 'ibu', label: 'Bittere', unit: 'IBU', min: 0, max: 120, step: 1, dec: 0,
    hint: 'Skaliert alle Hopfengaben. Bei höherer Stammwürze löst sich weniger Bittere.',
    get: r => r.ibu, set: v => { setIbu(recipe, v); } },
  { key: 'batchL', label: 'Ausschlagmenge', unit: 'L', min: 5, max: 100, step: 1, dec: 0,
    hint: 'Alle Zutatenmengen wachsen proportional, die Bierwerte bleiben gleich.',
    get: () => recipe.batchL, set: v => { recipe.batchL = v; } },
  { key: 'efficiency', label: 'Sudhausausbeute', unit: '%', min: 55, max: 90, step: 1, dec: 0,
    hint: 'Schlechtere Ausbeute → mehr Malz für dieselbe Stammwürze.',
    get: () => recipe.efficiency, set: v => { recipe.efficiency = v; } },
  { key: 'attenuation', label: 'Vergärungsgrad', unit: '%', min: 55, max: 90, step: 1, dec: 0,
    hint: 'Mehr Vergärung → trockener, mehr Alkohol, weniger Kalorien.',
    get: (r) => r.attenuation, set: v => { recipe.attenuation = v; } },
  { key: 'evapPct', label: 'Verdampfung', unit: '%', min: 4, max: 15, step: 0.5, dec: 1,
    hint: 'Stärkeres Kochen → mehr Anfangswasser nötig, Würze konzentriert sich.',
    get: () => recipe.evapPct, set: v => { recipe.evapPct = v; } },
];

// ---------- Initialer Aufbau ----------
function buildStatic() {
  $('styleList').innerHTML = STYLES.map(s =>
    `<button class="style-item" data-style="${s.id}"><b>${s.name}</b><small>${s.desc}</small></button>`).join('');

  $('sliders').innerHTML = SLIDERS.map(s => `
    <div class="row col-row">
      <div class="row-top"><span class="row-label">${s.label}</span>
        <span class="row-value"><span id="v-${s.key}"></span><span class="unit">${s.unit}</span></span></div>
      <div class="slider-line">
        <button class="step" data-step="${s.key}" data-dir="-1" aria-label="${s.label} verringern">−</button>
        <input type="range" id="r-${s.key}" data-slider="${s.key}" min="${s.min}" max="${s.max}" step="${s.step}" aria-label="${s.label}">
        <button class="step" data-step="${s.key}" data-dir="1" aria-label="${s.label} erhöhen">+</button>
      </div>
      <div class="row-hint">${s.hint}</div>
    </div>`).join('');

  $('stats').innerHTML = [
    ['abv', 'Alkohol'], ['plato', 'Stammwürze'], ['fg', 'Restextrakt'], ['ibu', 'Bittere'], ['ebc', 'Farbe'], ['kcal', 'Energie'],
  ].map(([k, l]) => `<div class="stat"><div class="stat-label">${l}</div>
      <div class="stat-value" id="s-${k}"></div><div class="stat-sub" id="d-${k}"></div>${k === 'ebc' ? '<span class="swatch" id="swatch"></span>' : ''}</div>`).join('');

  $('yeastBox').innerHTML = `
    <div class="row"><span class="row-label grow">Hefe</span>
      <select id="yeastSel">${YEASTS.map(y => `<option value="${y.id}">${y.name}</option>`).join('')}</select></div>
    <div class="row col-row" id="yeastInfo"></div>`;
}

// ---------- Listen (Malz / Hopfen) ----------
function renderMalts() {
  $('maltList').innerHTML = recipe.malts.length ? recipe.malts.map((m, i) => `
    <div class="row col-row">
      <div class="row-top">
        <select data-malt-sel="${i}">${MALTS.map(x => `<option value="${x.id}" ${x.id === m.id ? 'selected' : ''}>${x.name}</option>`).join('')}</select>
        <span class="row-value"><span data-malt-kg="${i}"></span><span class="unit">kg</span>
          <button class="x" data-malt-del="${i}" aria-label="Entfernen">×</button></span>
      </div>
      <div class="slider-line">
        <input type="range" min="0" max="100" step="1" value="${m.share}" data-malt-share="${i}" aria-label="Anteil">
        <span class="right" data-malt-pct="${i}"></span>
      </div>
    </div>`).join('') : '<div class="row empty">Keine Schüttung – füge ein Malz hinzu.</div>';
  paintRanges($('maltList'));
}
function renderHops() {
  $('hopList').innerHTML = recipe.hops.length ? recipe.hops.map((h, i) => `
    <div class="row">
      <div class="grow">
        <select data-hop-sel="${i}">${HOPS.map(x => `<option value="${x.id}" ${x.id === h.id ? 'selected' : ''}>${x.name} (${f1.format(x.alpha)} % α)</option>`).join('')}</select>
        <div class="sub" data-hop-ibu="${i}"></div>
      </div>
      <label class="sub">g <input type="number" min="0" step="1" data-hop-g="${i}"></label>
      <label class="sub">min <input type="number" min="0" max="120" step="1" value="${h.time}" data-hop-time="${i}"></label>
      <button class="x" data-hop-del="${i}" aria-label="Entfernen">×</button>
    </div>`).join('') : '<div class="row empty">Kein Hopfen – das Bier wird sehr süß.</div>';
}
function paintRanges(root) {
  root.querySelectorAll('input[type=range]').forEach(r => {
    r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%');
  });
}

// ---------- Ergebnis-Update ----------
function delta(cur, base, dec, unit = '') {
  const d = cur - base;
  if (Math.abs(d) < Math.pow(10, -dec) / 2) return '';
  const fmt = nf(dec).format(Math.abs(d));
  return `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${fmt}${unit}</span>`;
}
function setSlider(key, value) {
  const r = $('r-' + key);
  const def = SLIDERS.find(s => s.key === key);
  $('v-' + key).textContent = nf(def.dec).format(value);
  if (document.activeElement !== r) r.value = value;
  r.style.setProperty('--p', ((value - r.min) / (r.max - r.min) * 100) + '%');
}

function update() {
  const c = compute(recipe), b = baseline;
  const style = byId(STYLES, recipe.styleId);

  // Statistik-Kacheln
  const stat = (k, html, sub) => { $('s-' + k).innerHTML = html; $('d-' + k).innerHTML = sub; };
  stat('abv', `${f1.format(c.abv)}<small>% vol</small>`, delta(c.abv, b.abv, 1));
  stat('plato', `${f1.format(c.plato)}<small>°P</small>`, `SG ${f3.format(c.og)} ${delta(c.plato, b.plato, 1)}`);
  stat('fg', `${f1.format(c.fgP)}<small>°P</small>`, `EVG ${f0.format(c.attenuation)} % ${delta(c.fgP, b.fgP, 1)}`);
  stat('ibu', `${f0.format(c.ibu)}<small>IBU</small>`, `BU:GU ${f2.format(c.bugu)} ${delta(c.ibu, b.ibu, 0)}`);
  stat('ebc', `${f0.format(c.ebc)}<small>EBC</small>`, delta(c.ebc, b.ebc, 0));
  stat('kcal', `${f0.format(c.kcalPerHalfLitre)}<small>kcal / 0,5 L</small>`, delta(c.kcalPerHalfLitre, b.kcalPerHalfLitre, 0));
  $('swatch').style.background = ebcToHex(c.ebc);

  // Slider synchronisieren
  SLIDERS.forEach(s => setSlider(s.key, s.key === 'ibu' ? c.ibu : s.key === 'attenuation' ? c.attenuation : s.get(c)));

  // Malz-Zeilen
  c.malts.forEach((m, i) => {
    const kg = document.querySelector(`[data-malt-kg="${i}"]`); if (!kg) return;
    kg.textContent = f2.format(m.kg);
    document.querySelector(`[data-malt-pct="${i}"]`).textContent = f0.format(m.pct) + ' %';
    document.querySelector(`[data-malt-pct="${i}"]`).style.color = m.pct > m.maxPct + 0.05 ? 'var(--orange)' : '';
  });
  // Hopfen-Zeilen
  c.hops.forEach((h, i) => {
    const g = document.querySelector(`[data-hop-g="${i}"]`); if (!g) return;
    if (document.activeElement !== g) g.value = Math.round(h.g * 10) / 10;
    document.querySelector(`[data-hop-ibu="${i}"]`).textContent = `${f1.format(h.ibu)} IBU · ${h.time === 0 ? 'Whirlpool / Stopfen' : h.time + ' min Kochzeit'}`;
  });

  // Hefe
  $('yeastSel').value = recipe.yeastId;
  $('yeastInfo').innerHTML = `
    <div class="row-top"><span class="muted">Gärtemperatur</span><b>${byId(YEASTS, recipe.yeastId).temp}</b></div>
    <div class="row-top"><span class="muted">Benötigte Zellen</span><b>${f0.format(c.yeast.cellsBillion)} Mrd.</b></div>
    <div class="row-top"><span class="muted">Trockenhefe (ca.)</span><b>${f1.format(c.yeast.dryGrams)} g</b></div>
    <div class="row-hint">Pitchrate ${f2.format(c.yeast.rate)} Mio. Zellen / ml / °P – steigt mit der Stammwürze.</div>`;

  // Stil-Check
  const metrics = [
    ['Stammwürze', c.plato, style.ranges.plato, '°P', f1],
    ['Alkohol', c.abv, style.ranges.abv, '% vol', f1],
    ['Bittere', c.ibu, style.ranges.ibu, 'IBU', f0],
    ['Farbe', c.ebc, style.ranges.ebc, 'EBC', f0],
  ];
  $('fit').innerHTML = metrics.map(([label, v, rng, unit, fmt]) => {
    const st = rangeStatus(Math.round(v * 10) / 10, rng);
    const lo = rng[0] - (rng[1] - rng[0]) * 1.2, hi = rng[1] + (rng[1] - rng[0]) * 1.2;
    const pos = x => Math.min(100, Math.max(0, (x - lo) / (hi - lo) * 100));
    const text = { ok: 'im Stil', low: 'zu niedrig', high: 'zu hoch' }[st];
    return `<div class="row col-row"><div class="row-top"><span class="row-label">${label}</span>
      <span><span class="badge ${st}">${text}</span> <span class="sub">${fmt.format(rng[0])}–${fmt.format(rng[1])} ${unit}</span></span></div>
      <div class="fit-bar"><div class="fit-band" style="left:${pos(rng[0])}%;width:${pos(rng[1]) - pos(rng[0])}%"></div>
      <div class="fit-dot" style="left:${pos(v)}%"></div></div></div>`;
  }).join('');

  // Hinweise
  $('notes').innerHTML = c.warnings.length ? c.warnings.map(w =>
    `<div class="row note ${w.level}"><span class="dot"></span><span>${esc(w.text)}</span></div>`).join('')
    : '<div class="row empty">Alles im grünen Bereich.</div>';

  // Wasser
  const kv = (l, v, s = '') => `<div class="row"><span class="grow">${l}${s ? `<div class="sub">${s}</div>` : ''}</span><b>${v}</b></div>`;
  $('waterBox').innerHTML =
    kv('Hauptguss', `${f1.format(c.water.mash)} L`, `${f1.format(c.water.mashThickness)} L je kg Schüttung`) +
    kv('Nachguss', `${f1.format(c.water.sparge)} L`) +
    kv('Gesamtwasser', `${f1.format(c.water.total)} L`) +
    kv('Pfanne voll (heiß)', `${f1.format(c.water.preBoilHot)} L`, `Kochzeit ${recipe.boilMin} min`) +
    kv('Gesamtschüttung', `${f2.format(c.grainKg)} kg`);

  // Maischplan
  $('mashBox').innerHTML = recipe.mash.map(m =>
    `<div class="row"><b style="min-width:56px">${m.temp} °C</b><span class="grow">${esc(m.label)}</span><span class="muted">${m.min} min</span></div>`).join('');

  $('styleDesc').textContent = `${style.name} · ${style.desc}`;
  document.querySelectorAll('.style-item').forEach(e => e.classList.toggle('active', e.dataset.style === recipe.styleId));
  save();
}

// ---------- Events ----------
function applySlider(key, value) {
  const def = SLIDERS.find(s => s.key === key);
  value = Math.min(def.max, Math.max(def.min, Math.round(value / def.step) * def.step));
  def.set(value);
  update();
}

function resetRecipe(styleId) {
  recipe = newRecipeFromStyle(styleId);
  baseline = compute(recipe);
  $('recipeName').value = recipe.name;
  renderMalts(); renderHops(); update();
}

function init() {
  buildStatic();
  $('recipeName').value = recipe.name;
  renderMalts(); renderHops(); update();

  $('styleList').addEventListener('click', e => { const b = e.target.closest('[data-style]'); if (b) resetRecipe(b.dataset.style); });
  $('btnReset').addEventListener('click', () => resetRecipe(recipe.styleId));
  $('recipeName').addEventListener('input', e => { recipe.name = e.target.value; save(); });

  $('sliders').addEventListener('input', e => {
    const k = e.target.dataset.slider; if (k) applySlider(k, parseFloat(e.target.value));
  });
  $('sliders').addEventListener('click', e => {
    const b = e.target.closest('[data-step]'); if (!b) return;
    const def = SLIDERS.find(s => s.key === b.dataset.step);
    const cur = parseFloat($('r-' + def.key).value) || 0;
    const live = compute(recipe);
    const now = def.key === 'ibu' ? live.ibu : def.key === 'attenuation' ? live.attenuation : def.get(live);
    applySlider(def.key, now + def.step * Number(b.dataset.dir));
  });

  $('maltList').addEventListener('input', e => {
    const i = e.target.dataset.maltShare; if (i === undefined) return;
    recipe.malts[i].share = parseFloat(e.target.value); paintRanges($('maltList')); update();
  });
  $('maltList').addEventListener('change', e => {
    const i = e.target.dataset.maltSel; if (i === undefined) return;
    recipe.malts[i].id = e.target.value; update();
  });
  $('maltList').addEventListener('click', e => {
    const b = e.target.closest('[data-malt-del]'); if (!b) return;
    recipe.malts.splice(+b.dataset.maltDel, 1); renderMalts(); update();
  });
  $('addMalt').addEventListener('click', () => {
    const used = new Set(recipe.malts.map(m => m.id));
    const next = MALTS.find(m => !used.has(m.id)) || MALTS[0];
    recipe.malts.push({ id: next.id, share: 5 }); renderMalts(); update();
  });

  $('hopList').addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.hopG !== undefined) { recipe.hops[t.dataset.hopG].gPerL = Math.max(0, parseFloat(t.value) || 0) / recipe.batchL; update(); }
    if (t.dataset.hopTime !== undefined) { recipe.hops[t.dataset.hopTime].time = Math.max(0, parseFloat(t.value) || 0); update(); }
  });
  $('hopList').addEventListener('change', e => {
    const i = e.target.dataset.hopSel; if (i === undefined) return;
    recipe.hops[i].id = e.target.value; update();
  });
  $('hopList').addEventListener('click', e => {
    const b = e.target.closest('[data-hop-del]'); if (!b) return;
    recipe.hops.splice(+b.dataset.hopDel, 1); renderHops(); update();
  });
  $('addHop').addEventListener('click', () => {
    recipe.hops.push({ id: 'hallertauer', gPerL: 1 / recipe.batchL * 10, time: 10, form: 'pellet' }); renderHops(); update();
  });

  $('yeastBox').addEventListener('change', e => {
    if (e.target.id !== 'yeastSel') return;
    recipe.yeastId = e.target.value; recipe.attenuation = null; update();
  });

  $('btnExport').addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(recipe, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: `${recipe.name || 'rezept'}.json` });
    a.click(); URL.revokeObjectURL(url);
  });
  $('btnImport').addEventListener('click', () => $('fileImport').click());
  $('fileImport').addEventListener('change', async e => {
    const file = e.target.files[0]; if (!file) return;
    try {
      const r = JSON.parse(await file.text());
      if (!Array.isArray(r.malts) || !Array.isArray(r.hops) || !byId(STYLES, r.styleId)) throw new Error();
      recipe = r; baseline = compute(recipe); $('recipeName').value = recipe.name;
      renderMalts(); renderHops(); update();
    } catch { alert('Diese Datei ist kein gültiges Rezept.'); }
    e.target.value = '';
  });
}
init();
