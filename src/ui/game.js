// Grafische Oberfläche für Story- und Sandbox-Modus: Dashboard mit Kacheln, Tutorial, Panels.
import * as g from '../game/index.js';
import { MALTS, HOPS, HOP_FORMS, YEASTS, STYLES, byId } from '../core/data.js';
import { newRecipeFromStyle, ebcToHex, rangeStatus } from '../core/brew.js';

const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nf = d => new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const f0 = nf(0), f1 = nf(1), f2 = nf(2);
const eur = x => f2.format(x) + ' €';

const KEY = mode => `beercreator.game.${mode}.v2`;
const STAGES = { garage: 'Opas Garage', keller: 'Gerdas Keller', brauerei: 'Eigene Brauerei' };
const SLOTS = { kettle: 'Sudkessel', fermenter: 'Gärtank', cooling: 'Kühlung' };
const PEOPLE = {
  opa: ['📜', 'Opa Heinrich'], gerda: ['👵', 'Gerda'], klaus: ['🧔', 'Klaus'], zoll: ['🏛️', 'Frau Zollinger'],
  ottokar: ['👨‍🍳', 'Ottokar Würzig'], jury: ['🏅', 'Dr. Sabine Stammwürze'], toni: ['🌿', 'Toni Dolde'], anselm: ['📿', 'Bruder Anselm'],
};
// Kacheln auf dem Dashboard. feature = welcher Bereich freigeschaltet sein muss.
const TILES = [
  { id: 'brew',    icon: '🍺', name: 'Brauen',          feature: 'brauen' },
  { id: 'shop',    icon: '🛒', name: 'Einkauf',         feature: 'einkauf' },
  { id: 'ferment', icon: '🫧', name: 'Gärkeller',       feature: 'gaerkeller' },
  { id: 'cellar',  icon: '📦', name: 'Lager & Verkauf', feature: 'lager' },
  { id: 'donate',  icon: '🙏', name: 'Spenden',         feature: 'spenden' },
  { id: 'league',  icon: '🏆', name: 'Bierliga',        feature: 'bierliga' },
  { id: 'gear',    icon: '🔧', name: 'Ausrüstung',      feature: 'ausruestung' },
  { id: 'courses', icon: '🎓', name: 'Kurse',           feature: 'kurse' },
  { id: 'barrel',  icon: '🛢️', name: 'Fasskeller & Cuvée', feature: 'fasskeller' },
  { id: 'styles',  icon: '🧪', name: 'Stil-Labor',      feature: 'stilwerkstatt' },
  { id: 'production', icon: '⚙️', name: 'Produktion',   feature: 'produktion' },
  { id: 'diary',   icon: '📔', name: 'Tagebuch',        feature: 'tagebuch' },
  { id: 'sudbuch', icon: '📖', name: 'Sudbuch',         feature: 'sudbuch' },
];
const LOCK_HINT = { brauen: 'Kapitel 1', einkauf: 'Kapitel 1', verschenken: 'Kapitel 2', bierliga: 'Kapitel 2', verkauf: 'Kapitel 3',
  spenden: 'Kapitel 3', ausruestung: 'Kapitel 4', kurse: 'Kapitel 4', fasskeller: 'Kapitel 4', produktion: 'Kapitel 5', stilwerkstatt: 'Kapitel 5' };
const GOAL_TILE = { brew2: 'brew', q50: 'brew', give20: 'cellar', rep8: 'cellar', sell50: 'cellar', gear: 'gear', styles3: 'brew', q65: 'brew',
  medal: 'cellar', rep50: 'cellar', cash4000: 'cellar' };
const GOAL_HINT = {
  brew2: 'Wähle unter „Brauen“ einen Stil und setz ihn an. Fehlende Zutaten werden automatisch gekauft.',
  q50: 'Lager mögen es kühl, Ales etwas wärmer. Im Winter klappen untergärige Biere in der Garage besser.',
  give20: 'Im Lager kannst du Bier verschenken. Gutes Bier bringt Ruf, schlechtes kostet welchen.',
  rep8: 'Verschenk dein bestes Bier – je höher die Qualität, desto mehr Ruf.',
  sell50: 'Unter „Lager & Verkauf“ wählst du einen Absatzweg: Hofverkauf, Gastro, Festival …',
  gear: 'Unter „Ausrüstung“ gibt es Kessel, Gärtanks und Kühlung.',
  styles3: 'Probier einen neuen Stil – Kurse schalten weitere frei.',
  q65: 'Mit Gärkühlschrank, Desinfektion und frischem Hopfen gelingt fast alles besser.',
  medal: 'Sobald ein Bier mit Qualität 55+ im Lager ist, kommt die Einladung zur Meisterschaft.',
  rep50: 'Ruf wächst durch gute Qualität, Medaillen und Spenden – nicht durch Masse.',
  cash4000: 'Verkaufe über mehrere Absatzwege. Festivals im Sommer bringen am meisten pro Liter.',
};
const WIKI_KINDS = { style: 'Bierstile', malt: 'Malze', hop: 'Hopfen', form: 'Hopfenformen', yeast: 'Hefen', gear: 'Ausrüstung', metric: 'Begriffe', flaw: 'Fehlaromen' };

let s = null, view = 'home', onExit = () => {}, overlay = null, mashTemp = 60;
const brewForm = { recipe: null }; // Rezept, das gerade in der Werkstatt bearbeitet wird
const wiki = { kind: 'style', q: '' };
const has = f => g.hasFeature(s, f);

export function loadGame(mode) {
  try { const x = JSON.parse(localStorage.getItem(KEY(mode))); return x && x.version >= 2 ? g.migrate(x) : null; } catch { return null; }
}
function save() { try { localStorage.setItem(KEY(s.mode), JSON.stringify(s)); } catch {} }

export function openGame(mode, fresh, exit, breweryName) {
  onExit = exit;
  s = (!fresh && loadGame(mode)) || g.newGame({ mode, seed: Date.now() % 100000, breweryName });
  view = 'home'; overlay = null; brewForm.recipe = null;
  save(); render();
}

let toastTimer;
function toast(msg, kind = '') {
  const t = $('toast');
  t.textContent = msg; t.className = 'toast ' + kind; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4500);
}

/** Aktion ausführen, Spielfehler als Hinweis zeigen, speichern, neu zeichnen. Neue Freischaltungen werden gefeiert. */
function act(fn) {
  const before = s.log.length;
  try { const r = fn(); afterAct(before); return r; }
  catch (e) {
    if (e instanceof g.GameError) toast(e.message, 'bad'); else { console.error(e); toast('Unerwarteter Fehler: ' + e.message, 'bad'); }
    save(); render();
  }
}
function afterAct(before) {
  const fresh = s.log.slice(before);
  const unlocked = fresh.filter(l => l.kind === 'unlock').map(l => l.text.replace('🔓 Neu freigeschaltet: ', ''));
  if (unlocked.length && !overlay && !s.event) overlay = { kind: 'unlock', items: unlocked };
  save(); render();
}
const go = v => { view = v; render(); $('gBody').scrollTop = 0; window.scrollTo(0, 0); };

// ---------- Rahmen ----------
function render() {
  const sum = g.summary(s), lv = sum.level, sandbox = s.mode === 'sandbox';
  $('gName').textContent = s.breweryName;
  $('gChapter').textContent = sandbox ? 'Sandbox' : s.tutorial.done ? sum.chapter : 'Prolog – Opas Sudbuch';
  const chip = (icon, label, value, title = '') => `<div class="chip-stat" title="${esc(title)}"><span>${icon}</span><b>${value}</b><small>${label}</small></div>`;
  $('gStats').innerHTML = [
    chip('📅', 'Datum', g.dayLabel(s.day).replace(/, Jahr (\d+)/, ' · J$1')),
    chip('💶', 'Geld', sandbox ? '∞' : eur(s.cash)),
    !sandbox ? chip('⭐', 'Ruf', f0.format(s.reputation), 'Ruf: wie bekannt und beliebt dein Bier ist') : '',
    !sandbox ? chip('🙏', 'Ansehen', f0.format(s.honor), 'Ansehen: Vertrauen durch Spenden und ehrliches, stabiles Bier') : '',
    has('bierliga') && !sandbox ? chip('🏆', 'Bierliga', `${sum.rank}.`, `Platz ${sum.rank} von ${sum.rankOf}`) : '',
    chip('🎓', `Level ${lv.lvl}`, esc(lv.name)),
  ].join('');
  $('gWait').hidden = !has('zeit');
  $('gHome').hidden = view === 'home';
  $('gBody').innerHTML = (VIEWS[view] || home)();
  if (view === 'tutorial-mash' || (view === 'home' && g.tutorialView(s)?.kind === 'mash')) paintMash();

  // Dialoge: Story-Ereignis > eigene Overlays
  const ev = s.event;
  const m = $('gModal');
  if (ev) {
    const [icon, name] = PEOPLE[ev.who] || ['📣', ''];
    m.hidden = false;
    $('gModalBox').innerHTML = `<div class="speaker"><span class="avatar">${icon}</span><div><small>${esc(name)}</small><h2 class="modal-title">${esc(ev.title)}</h2></div></div>
      <p class="modal-text">${esc(ev.text)}</p>
      <div class="modal-choices">${ev.choices.map(c => `<button class="btn choice" data-choice="${esc(c.id)}">${esc(c.label)}</button>`).join('')}</div>`;
  } else if (overlay) {
    m.hidden = false;
    $('gModalBox').innerHTML = overlayHtml(overlay);
  } else m.hidden = true;
}

function overlayHtml(o) {
  if (o.kind === 'unlock') return `<div class="unlock-big">🔓</div><h2 class="modal-title center">Neu freigeschaltet!</h2>
    <div class="unlock-list">${o.items.map(x => `<span>✨ ${esc(x)}</span>`).join('')}</div>
    <button class="btn primary big wide" data-close>Super!</button>`;
  if (o.kind === 'taste') {
    const b = o.beer;
    return `<div class="taste-glass" style="--beer:${ebcToHex(b.ebc)}"><div class="foam"></div></div>
      <h2 class="modal-title center">Prost! „${esc(b.name)}“</h2>
      <div class="taste-grid">
        <div><small>Qualität</small><b>${b.quality}/100</b><span>${esc(g.qualityLabel(b.quality))}</span></div>
        <div><small>Alkohol</small><b>${f1.format(b.abv)} %</b></div>
        <div><small>Bittere</small><b>${f0.format(b.ibu)} IBU</b></div>
        <div><small>Farbe</small><b>${f0.format(b.ebc)} EBC</b></div>
      </div>
      <p class="modal-text center">${esc(o.text || '')}</p>
      <button class="btn primary big wide" data-close>Weiter</button>`;
  }
  return '';
}

// ---------- Dashboard ----------
function home() {
  let html = '';
  const tut = g.tutorialView(s);
  if (tut) html += tutorialCard(tut);
  else if (s.mode === 'story') html += goalCard();
  html += `<div class="tiles">${TILES.map(tileHtml).join('')}</div>`;
  return html;
}

function tileSub(t) {
  const fer = s.batches.filter(b => b.status === 'gaerend');
  const stock = s.beers.reduce((a, b) => a + b.liters, 0);
  switch (t.id) {
    case 'brew': return `${Math.max(0, g.slotsOf(s) - fer.length)} Gärplatz frei`;
    case 'shop': return 'Malz, Hopfen, Hefe';
    case 'ferment': return fer.length ? `${fer.length} Sud gärt · ${Math.min(...fer.map(b => b.readyDay - s.day))} T.` : 'leer';
    case 'cellar': return `${f0.format(stock)} L Bier`;
    case 'donate': return `Ansehen ${f0.format(s.honor)}`;
    case 'league': return `Platz ${g.ranking(s).myRank} von 20`;
    case 'gear': return esc(g.EQUIPMENT.kettle[s.equipment.kettle].name);
    case 'courses': return `${s.unlocked.length} Stile gelernt`;
    case 'diary': return `${s.log.length} Einträge`;
    case 'sudbuch': return 'Anleitung & Wissen';
    case 'barrel': { const full = (s.barrels || []).filter(b => b.fill).length; return s.barrels?.length ? `${full} von ${s.barrels.length} Fässern belegt` : 'Fassreifung, Cuvée'; }
    case 'styles': return s.customStyles?.length ? `${s.customStyles.length} eigene Stile` : 'Eigene Biersorten';
    case 'production': return s.auto?.helper ? `👷 läuft · ${s.auto.plan.length} Sorten im Plan` : 'Brauhelfer & Plan';
  }
  return '';
}
function tileHtml(t) {
  if (!has(t.feature)) return `<div class="tile locked" title="Wird später freigeschaltet"><span class="tile-icon">${t.icon}</span><span class="lock">🔒</span>
    <b>${t.name}</b><small>${LOCK_HINT[t.feature] ? 'ab ' + LOCK_HINT[t.feature] : 'kommt im Tutorial'}</small></div>`;
  return `<button class="tile" data-go="${t.id}"><span class="tile-icon">${t.icon}</span><b>${t.name}</b><small>${tileSub(t)}</small></button>`;
}

const bubble = (who, text) => {
  const [icon, name] = PEOPLE[who] || ['💬', ''];
  return `<div class="bubble ${who}"><span class="avatar">${icon}</span><div><small>${esc(name)}</small><p>${esc(text)}</p></div></div>`;
};

function tutorialCard(t) {
  let action = '';
  if (t.kind === 'mash') action = `<div class="mash">
      <div class="mash-scale"><div class="mash-zone"></div><input type="range" id="mashT" min="50" max="78" step="1" value="${mashTemp}" aria-label="Maischtemperatur"></div>
      <div class="mash-val"><b id="mashV">${mashTemp} °C</b><small id="mashHint"></small></div>
      <button class="btn primary big" data-tut="mash">${esc(t.button)}</button></div>`;
  else if (t.kind === 'choice') action = `<div class="tut-choices">${t.choices.map(c => `<button class="btn big" data-tut="${c.id}">${esc(c.label)}</button>`).join('')}</div>`;
  else action = `<button class="btn primary big" data-tut="go">${esc(t.button)}</button>`;
  return `<section class="tut-card">
    <div class="tut-head"><span class="tut-icon">${t.icon}</span><div><small>Schritt ${t.index + 1} von ${t.total}</small><h2>${esc(t.title)}</h2></div>
      <button class="link skip" data-skip>Tutorial überspringen</button></div>
    <div class="tut-dots">${Array.from({ length: t.total }, (_, i) => `<span class="${i < t.index ? 'done' : i === t.index ? 'now' : ''}"></span>`).join('')}</div>
    <div class="bubbles">${t.lines.map(([w, x]) => bubble(w, x)).join('')}</div>
    <div class="tut-action">${action}</div>
  </section>`;
}
function paintMash() {
  const r = $('mashT'); if (!r) return;
  const t = +r.value; mashTemp = t;
  $('mashV').textContent = `${t} °C`;
  const ok = t >= 65 && t <= 68;
  $('mashHint').textContent = ok ? 'Perfekt – genau richtig!' : t < 65 ? 'zu kalt' : 'zu heiß';
  $('mashV').className = ok ? 'ok' : 'off';
  r.style.setProperty('--p', ((t - 50) / 28 * 100) + '%');
}

function goalCard() {
  if (s.ended) return `<section class="goal-card">${bubble('opa', `Geschafft! „${s.breweryName}“ ist eine echte Brauerei. Braue weiter, spende, klettere in der Bierliga – die Karrierewege kommen als Nächstes.`)}</section>`;
  const obj = g.objectives(s);
  const next = obj.find(o => !o.done);
  return `<section class="goal-card">
    <div class="goal-head"><small>Aktuelles Kapitel</small><h2>${esc(g.summary(s).chapter)}</h2></div>
    <div class="goal-list">${obj.map(o => `<div class="goal ${o.done ? 'done' : ''}"><span class="check">${o.done ? '✓' : ''}</span><span class="grow">${esc(o.text)}</span>
      ${!o.done && o === next && GOAL_TILE[o.id] && has(TILES.find(t => t.id === GOAL_TILE[o.id]).feature) ? `<button class="btn primary" data-go="${GOAL_TILE[o.id]}">Los →</button>` : ''}</div>`).join('')}</div>
    ${next && GOAL_HINT[next.id] ? bubble('opa', GOAL_HINT[next.id]) : ''}
  </section>`;
}

// ---------- Panels ----------
const panel = (icon, title, sub, body) => `<div class="panel-head"><span class="panel-icon">${icon}</span><div><h1 class="page-title">${title}</h1><p class="subtitle">${sub}</p></div></div>${body}`;
const group = (title, inner, extra = '') => `<h2>${title}${extra}</h2><div class="group">${inner}</div>`;
const empty = t => `<div class="row empty">${t}</div>`;

function freshRecipe(styleId) {
  const r = newRecipeFromStyle(styleId);
  r.batchL = brewForm.recipe?.batchL || 20;
  r.mashProgram = g.mashProgramOf(r);
  r.reifung = false;
  return r;
}
function currentRecipe() {
  const avail = STYLES.filter(x => g.isUnlocked(s, x.id));
  if (!brewForm.recipe || !g.isUnlocked(s, brewForm.recipe.styleId)) brewForm.recipe = freshRecipe(avail[0].id);
  const maxL = g.EQUIPMENT.kettle[s.equipment.kettle].maxBatchL;
  const r = brewForm.recipe;
  r.batchL = Math.min(Math.max(5, Math.round(+r.batchL || 20)), maxL);
  return { r, avail };
}

const HOP_TIMES = [90, 75, 60, 45, 30, 20, 15, 10, 5, 0];
const opt = (v, label, sel) => `<option value="${esc(v)}" ${sel ? 'selected' : ''}>${esc(label)}</option>`;
const rangeCls = (v, rg) => ({ ok: 'ok', low: 'low', high: 'high' }[rangeStatus(v, rg)]);

function brewView() {
  const sandbox = s.mode === 'sandbox';
  const maxL = g.EQUIPMENT.kettle[s.equipment.kettle].maxBatchL;
  const { r, avail } = currentRecipe();
  const now = g.previewBatch(s, r);
  let sim = s, buyCost = 0, buyError = '';
  if (!sandbox && now.missing.length) { // Vorschau, als wäre das Fehlende schon gekauft
    sim = structuredClone(s);
    try { g.buyForRecipe(sim, r); buyCost = s.cash - sim.cash; } catch (e) { buyError = e.message; sim = s; }
  }
  const fc = g.forecast(sim, r);
  const pot = fc.potential, c = fc.preview.calc;
  const st = g.styleView(r), fit = g.styleFit(r.styleId);
  const run = sandbox ? 0 : g.runCost(r.batchL) + g.optionCost(r);
  const free = g.slotsOf(s) - s.batches.filter(b => b.status === 'gaerend').length;
  const reif = g.REIFUNG[fit.reif];
  const recipes = s.recipes || [];

  // Rezepte & Stile
  let html = recipes.length ? `<h2>📒 Dein Sortiment</h2><div class="style-picker">${recipes.map(x => {
      const sx = g.styleView(x);
      return `<span class="recipe-chip ${x.name === r.name && x.styleId === r.styleId ? 'on' : ''}"><button class="style-chip" data-load-recipe="${esc(x.name)}">
        <span class="dot" style="background:${ebcToHex((sx.ranges.ebc[0] + sx.ranges.ebc[1]) / 2)}"></span>${esc(x.name)}<small>${esc(sx.name)}</small></button>
        <button class="chip-x" data-action="delRecipe" data-name="${esc(x.name)}" title="Rezept löschen" aria-label="Rezept ${esc(x.name)} löschen">✕</button></span>`;
    }).join('')}</div>` : '';
  html += `<h2>Neues Rezept aus Bierstil</h2><div class="style-picker">${avail.map(x => `<button class="style-chip ${x.id === r.styleId && !r.custom ? 'on' : ''}" data-style-pick="${x.id}">
      <span class="dot" style="background:${ebcToHex((x.ranges.ebc[0] + x.ranges.ebc[1]) / 2)}"></span>${esc(x.name)}</button>`).join('')}
      ${(s.customStyles || []).filter(cs => g.isUnlocked(s, cs.base)).map(cs => `<button class="style-chip custom ${r.custom?.id === cs.id ? 'on' : ''}" data-custom-pick="${cs.id}">
      <span class="dot" style="background:${ebcToHex((cs.ranges.ebc[0] + cs.ranges.ebc[1]) / 2)}"></span>🧪 ${esc(cs.name)}</button>`).join('')}
      ${has('kurse') ? '<button class="style-chip more" data-go="courses">🎓 mehr Stile …</button>' : ''}
      ${has('stilwerkstatt') ? '<button class="style-chip more" data-go="styles">🧪 eigener Stil …</button>' : ''}</div>`;

  // Linke Spalte: Rezept bearbeiten
  const idealY = r.custom ? [r.custom.yeastId] : fit.yeast.ideal;
  const yeastOpts = YEASTS.map(y => opt(y.id, `${y.name}${idealY.includes(y.id) ? ' ★ typisch' : fit.yeast.ok?.includes(y.id) ? ' (geht)' : ''}`, y.id === r.yeastId)).join('');
  let left = group('📝 Rezept', `
    <div class="row"><span class="grow row-label">Name<div class="sub">So heißt das Bier im Lager und beim Verkauf.</div></span>
      <input type="text" id="bName" class="text-input" maxlength="40" value="${esc(r.name)}" placeholder="z. B. Diplom Pils"></div>
    <div class="row"><span class="grow row-label">${esc(st.name)}<div class="sub">${esc(st.desc)} · Ziel: ${st.ranges.plato.join('–')} °P · ${st.ranges.ibu.join('–')} IBU · ${st.ranges.ebc.join('–')} EBC</div></span></div>
    <div class="row"><span class="grow row-label">🪣 Menge<div class="sub">${esc(g.EQUIPMENT.kettle[s.equipment.kettle].name)}: max. ${maxL} L</div></span>
      <label class="sub"><input type="number" id="bLiters" min="5" max="${maxL}" step="1" value="${r.batchL}"> L</label></div>
    <div class="row"><span class="grow row-label">🍯 Stammwürze<div class="sub">Wie viel Malzzucker in der Würze steckt – bestimmt Alkohol und Körper.</div></span>
      <label class="sub"><input type="number" id="bPlato" min="4" max="30" step="0.1" value="${f1.format(r.plato).replace(',', '.')}"> °P</label></div>
    <div class="row"><span class="grow row-label">🧫 Hefe<div class="sub">${esc(byId(YEASTS, r.yeastId).temp)} · Endvergärung ca. ${byId(YEASTS, r.yeastId).attenuation} %</div></span>
      <select id="bYeast">${yeastOpts}</select></div>
    <div class="row"><span class="grow row-label">🌡️ Maischverfahren<div class="sub">${esc(g.MASH_PROGRAMS[g.mashProgramOf(r)].text)}${g.MASH_PROGRAMS[g.mashProgramOf(r)].costPerL ? ` (+${eur(g.MASH_PROGRAMS[g.mashProgramOf(r)].costPerL * r.batchL)} Energie)` : ''}</div></span>
      <select id="bMash">${Object.entries(g.MASH_PROGRAMS).map(([id, m]) => opt(id, m.name, id === g.mashProgramOf(r))).join('')}</select></div>
    <label class="row check-row"><input type="checkbox" id="bReif" ${r.reifung ? 'checked' : ''}><span class="grow row-label">⏳ ${esc(reif.name)}<div class="sub">${esc(reif.text)} +${reif.days} Tage im Gärtank, +${eur(reif.costPerL * r.batchL)}.</div></span></label>`);

  const maltRows = r.malts.map((m, i) => {
    const info = byId(MALTS, m.id), cm = c.malts[i];
    return `<div class="row ing-row"><span class="dot big" style="background:${ebcToHex(info.ebc * 2)}"></span>
      <select data-malt="${i}" class="grow">${MALTS.map(x => opt(x.id, `${x.premium ? '✨ ' : ''}${x.name} · ${f2.format(g.MALT_PRICE[x.id])} €/kg`, x.id === m.id)).join('')}</select>
      <label class="sub"><input type="number" data-share="${i}" min="0" max="100" step="1" value="${Math.round(m.share)}"> %</label>
      <span class="sub kg ${cm && cm.pct > cm.maxPct + 0.05 ? 'warn-text' : ''}">${cm ? f2.format(cm.kg) + ' kg' : ''}</span>
      <button class="icon-btn" data-action="delMalt" data-i="${i}" title="Malz entfernen" aria-label="Malz entfernen">✕</button></div>`;
  }).join('');
  left += group('🌾 Malz', maltRows + `<div class="row"><button class="btn" data-action="addMalt">＋ Malz</button>
    <span class="sub grow">Anteile werden automatisch auf 100 % gerechnet · ✨ = edles Grundmalz</span></div>`);

  const hopRows = r.hops.map((h, i) => {
    const ch = c.hops[i];
    return `<div class="row ing-row wrap">
      <select data-hop="${i}" class="grow">${HOPS.map(x => opt(x.id, `${x.name} · ${x.note}`, x.id === h.id)).join('')}</select>
      <select data-hform="${i}">${Object.values(HOP_FORMS).map(f => opt(f.id, f.name, f.id === (h.form || 'pellet'))).join('')}</select>
      <select data-htime="${i}">${HOP_TIMES.map(t => opt(t, t === 0 ? 'Whirlpool' : `${t} min`, t === h.time)).join('')}</select>
      <label class="sub"><input type="number" data-hg="${i}" min="0" step="1" value="${Math.round(h.gPerL * r.batchL)}"> g</label>
      <span class="sub kg">${ch ? f0.format(ch.ibu) + ' IBU' : ''}</span>
      <button class="icon-btn" data-action="delHop" data-i="${i}" title="Hopfengabe entfernen" aria-label="Hopfengabe entfernen">✕</button></div>`;
  }).join('');
  left += group('🌿 Hopfen', hopRows + `<div class="row"><button class="btn" data-action="addHop">＋ Hopfengabe</button>
    <span class="sub grow">Lange Kochzeit = Bittere, kurz/Whirlpool = Aroma. Extrakt bittert nur.</span></div>`);

  const kv = (label, val, rg, txt) => `<div><small>${label}</small><b class="${rg ? 'rv-' + rangeCls(val, rg) : ''}">${txt}</b>${rg ? `<span class="rg">${rg.join('–')}</span>` : ''}</div>`;
  left += group('🔬 So wird es', `<div class="kv-grid">
      ${kv('Stammwürze', c.plato, st.ranges.plato, f1.format(c.plato) + ' °P')}
      ${kv('Alkohol', c.abv, st.ranges.abv, f1.format(c.abv) + ' %')}
      ${kv('Bittere', c.ibu, st.ranges.ibu, f0.format(c.ibu) + ' IBU')}
      ${kv('Farbe', c.ebc, st.ranges.ebc, `<span class="swatch-inline" style="background:${ebcToHex(c.ebc)}"></span>${f0.format(c.ebc)} EBC`)}
      ${kv('Hefe', 0, null, f0.format(fc.preview.pitchRatio * 100) + ' %')}
    </div>${c.warnings.length ? c.warnings.map(w => `<div class="row sub">⚠️ ${esc(w.text)}</div>`).join('') : ''}`);

  // Rechte Spalte: Potenzial, Erwartung, Kosten
  const pct = (p, m) => Math.round(p / m * 100);
  let right = `<section class="pot-card">
    <div class="pot-head"><div><small>Potenzial dieses Rezepts</small><div class="pot-num">${pot.total}<span>/100</span></div></div>
      <div class="pot-tier"><span>${pot.icon}</span>${esc(pot.tier)}</div></div>
    <div class="glassbar"><div style="width:${pot.total}%"></div></div>
    <div class="pot-parts">${pot.parts.map(p => `<div class="pot-part"><div class="row-top"><span>${esc(p.label)}</span><b>${f0.format(p.pts)}/${p.max}</b></div>
      <div class="minibar"><div style="width:${pct(p.pts, p.max)}%"></div></div><small>${esc(p.note)}</small></div>`).join('')}</div>
    <h3>✨ Kniffe für den Feinschliff</h3>
    <div class="tricks">${pot.tricks.map(t => `<div class="trick ${t.ok ? 'ok' : t.pts > 0 ? 'half' : ''}"><span class="check">${t.ok ? '✓' : t.pts > 0 ? '½' : ''}</span>
      <div class="grow"><b>${esc(t.label)}</b>${t.ok ? '' : `<small>${esc(t.hint)}</small>`}</div><span class="pts">+${t.max}</span></div>`).join('')}</div>
    <div class="expect"><small>Erwartete Qualität</small><b>${fc.low === fc.high ? fc.low : `${fc.low}–${fc.high}`}</b>
      ${fc.deductions.length ? `<ul>${fc.deductions.map(d => `<li>−${f0.format(d.pts)} ${esc(d.label)}</li>`).join('')}</ul>` : '<p class="sub">Keine Abzüge erwartet – Brauerglück entscheidet den Rest.</p>'}
      <p class="sub">🦠 Infektionsrisiko ca. ${f0.format(fc.infection * 100)} % · ⏱️ fertig in ${fc.readyIn} Tagen</p></div>
  </section>`;
  right += group('💶 Kosten', !sandbox ? (now.missing.length ? `<div class="row"><span class="grow">🛒 Fehlende Zutaten<div class="sub">${esc(now.missing.join(', '))}</div></span><b>${buyError ? '–' : eur(buyCost)}</b></div>` : '<div class="row"><span class="grow">🛒 Zutaten aus dem Lager</span><b>0,00 €</b></div>') +
    `<div class="row"><span class="grow">⚡ Energie, Wasser, Flaschen${g.optionCost(r) ? ', Verfahren' : ''}</span><b>${eur(run)}</b></div>
     <div class="row"><span class="grow row-label">Zusammen</span><b>${eur((buyError ? 0 : buyCost) + run)}</b></div>` : '<div class="row empty">Sandbox: alles gratis.</div>');
  const blocked = free <= 0 ? 'Alle Gärplätze sind belegt – warte, bis ein Sud fertig ist.' : buyError ? 'Zu wenig Geld für die Zutaten.'
    : !c.grainKg ? 'Ohne Malz kein Bier.' : !sandbox && s.cash < buyCost + run ? 'Zu wenig Geld für diesen Sud.' : '';
  right += `<div class="actions col">${blocked ? `<span class="warn-text">${blocked}</span>` : ''}
    <button class="btn primary big wide" data-action="brew" ${blocked ? 'disabled' : ''}>🍺 Sud ansetzen</button>
    <button class="btn wide" data-action="saveRecipe">💾 Rezept ins Sortiment</button></div>`;

  html += `<div class="brew-grid"><div class="brew-main">${left}</div><aside class="brew-side">${right}</aside></div>`;
  return panel('🍺', 'Brauen', 'Dein Rezept: Malz, Hopfen, Hefe und Verfahren – die Vorschau zeigt, was drin steckt', html);
}

function fermentView() {
  const fer = s.batches.filter(b => b.status === 'gaerend');
  let html = group('Gärt gerade', fer.length ? fer.map(b => {
    const total = b.readyDay - b.startDay, done = Math.min(total, s.day - b.startDay);
    return `<div class="row col-row"><div class="row-top"><span class="row-label">🫧 ${esc(b.name)}</span><span class="sub">noch ${b.readyDay - s.day} Tage · fertig am ${g.dayLabel(b.readyDay)}</span></div>
      <div class="glassbar"><div style="width:${done / total * 100}%"></div></div><div class="sub">Gärtemperatur ${f1.format(b.fermTemp)} °C</div></div>`;
  }).join('') : empty('Gerade gärt nichts.'));
  const done = s.batches.filter(b => b.status === 'fertig').slice(-10).reverse();
  html += group('Zuletzt fertig', done.length ? done.map(b => `<div class="row"><span class="grow">${esc(b.name)}<div class="sub">${esc(b.custom?.name ?? byId(STYLES, b.styleId)?.name)}${b.potential ? ` · Potenzial ${b.potential}` : ''} · ${eur(b.costPerLiter)}/L Kosten</div></span>
    <span class="badge ${b.quality >= 70 ? 'ok' : b.quality >= 50 ? '' : 'low'}">${b.quality} · ${esc(g.qualityLabel(b.quality))}</span></div>`).join('') : empty('Noch nichts.'));
  return panel('🫧', 'Gärkeller', `${g.slotsOf(s)} Gärplätze`, html);
}

function shopView() {
  let html = group('Zutaten kaufen', `
    <div class="row"><span class="ico">🌾</span><select id="kMalt" class="grow">${MALTS.map(m => `<option value="${m.id}">${esc(m.name)} · ${f2.format(g.MALT_PRICE[m.id])} €/kg</option>`).join('')}</select>
      <label class="sub"><input type="number" id="kMaltKg" min="0.1" step="0.5" value="5"> kg</label>
      <button class="btn" data-action="buyMalt">Kaufen</button></div>
    <div class="row"><span class="sub pad-left">💡 Ab ${g.MALT_BULK_KG} kg (ein Sack) gibt es 25 % Rabatt.</span></div>
    <div class="row"><span class="ico">🌿</span><select id="kHop" class="grow">${HOPS.map(h => `<option value="${h.id}">${esc(h.name)} (${f1.format(h.alpha)} % α)</option>`).join('')}</select>
      <select id="kHopForm">${Object.values(HOP_FORMS).map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}</select>
      <label class="sub"><input type="number" id="kHopG" min="1" step="10" value="100"> g</label>
      <button class="btn" data-action="buyHop">Kaufen</button></div>
    <div class="row"><span class="ico">🧫</span><select id="kYeast" class="grow">${YEASTS.map(y => `<option value="${y.id}">${esc(y.name)} · ${f2.format(g.YEAST_PRICE[y.id])} €</option>`).join('')}</select>
      <label class="sub"><input type="number" id="kYeastN" min="1" step="1" value="1"> Stk.</label>
      <button class="btn" data-action="buyYeast">Kaufen</button></div>
    <div class="row"><span class="ico">🧴</span><span class="grow">Desinfektionsmittel · ${f2.format(g.SANITIZER_PRICE)} € je Sud<div class="sub">Senkt das Infektionsrisiko deutlich.</div></span>
      <label class="sub"><input type="number" id="kSanN" min="1" step="1" value="1"> Stk.</label>
      <button class="btn" data-action="buySan">Kaufen</button></div>`);
  if (s.mode !== 'sandbox') {
    const inv = s.inventory;
    const malts = Object.entries(inv.malts).filter(([, v]) => v > 0.005);
    html += group('Im Lagerregal', `
      <div class="row"><span class="grow row-label">🌾 Malz</span><span class="sub right-text">${malts.map(([k, v]) => `${esc(byId(MALTS, k)?.name || k)} ${f2.format(v)} kg`).join('<br>') || '–'}</span></div>
      <div class="row"><span class="grow row-label">🌿 Hopfen</span><span class="sub right-text">${inv.hops.filter(h => h.g >= 0.5).map(h => `${h.form === 'extract' ? 'Hopfenextrakt' : esc(byId(HOPS, h.id)?.name || h.id) + ' (' + esc(HOP_FORMS[h.form].name) + ')'} ${f0.format(h.g)} g · ${h.ageDays} Tage alt`).join('<br>') || '–'}</span></div>
      <div class="row"><span class="grow row-label">🧫 Hefe</span><span class="sub right-text">${Object.entries(inv.yeast).filter(([, v]) => v > 0).map(([k, v]) => `${esc(byId(YEASTS, k)?.name || k)} × ${v}`).join('<br>') || '–'}</span></div>
      <div class="row"><span class="grow row-label">🧴 Desinfektion</span><span class="sub">${inv.sanitizer}</span></div>`);
  }
  return panel('🛒', 'Einkauf', 'Zutaten einzeln kaufen – beim Brauen wird Fehlendes auch automatisch besorgt', html);
}

function gearView() {
  const sandbox = s.mode === 'sandbox';
  let gear = '';
  for (const slot of Object.keys(SLOTS)) {
    const cur = s.equipment[slot], tiers = g.TIER_ORDER[slot];
    gear += `<div class="row col-row"><div class="row-top"><span class="row-label">${SLOTS[slot]}</span><span class="sub">${esc(g.EQUIPMENT[slot][cur].name)}</span></div>
      <div class="chips">${tiers.map(t => {
        const e = g.EQUIPMENT[slot][t], have = tiers.indexOf(t) <= tiers.indexOf(cur);
        if (sandbox) return `<button class="chip ${t === cur ? 'on' : ''}" data-action="setup" data-slot="${slot}" data-tier="${t}">${esc(e.name)}</button>`;
        return have ? `<span class="chip ${t === cur ? 'on' : 'off'}">${esc(e.name)}${t === cur ? ' ✓' : ''}</span>`
          : `<button class="chip buy" data-action="gear" data-slot="${slot}" data-tier="${t}" title="${esc(g.getInfo('gear', slot + ':' + t)?.text || '')}">${esc(e.name)} · ${f0.format(e.cost)} €</button>`;
      }).join('')}</div><div class="sub">${esc(g.getInfo('gear', slot + ':' + cur)?.text || '')}</div></div>`;
  }
  let html = group('Deine Ausrüstung', gear);
  if (sandbox) html += group('Können (nur Sandbox)', `<div class="row"><span class="grow row-label">Level<div class="sub">Höheres Level = weniger Ungenauigkeit und Infektionsrisiko</div></span>
    <select id="sLevel">${g.LEVELS.map(l => `<option value="${l.lvl}" ${l.lvl === g.skillLevel(s) ? 'selected' : ''}>${l.lvl} – ${esc(l.name)}</option>`).join('')}</select></div>`);
  return panel('🔧', 'Ausrüstung', 'Größere Kessel, mehr Gärplätze, bessere Kühlung', html);
}

function coursesView() {
  const lvl = g.skillLevel(s);
  const rows = STYLES.map(x => {
    const m = g.STYLE_META[x.id], ok = g.isUnlocked(s, x.id);
    const btn = ok ? '<span class="badge ok">gelernt</span>'
      : lvl < m.minLevel ? `<span class="badge low">🔒 ab Level ${m.minLevel}</span>`
      : `<button class="btn" data-action="course" data-style="${x.id}">Kurs · ${m.cost ? f0.format(m.cost) + ' €' : 'gratis'}</button>`;
    return `<div class="row"><span class="dot big" style="background:${ebcToHex((x.ranges.ebc[0] + x.ranges.ebc[1]) / 2)}"></span>
      <span class="grow"><span class="row-label">${esc(x.name)}</span> <span class="stars">${'★'.repeat(m.difficulty)}<span>${'★'.repeat(5 - m.difficulty)}</span></span>
      <div class="sub">${esc(x.desc)}</div></span>${btn}</div>`;
  }).join('');
  return panel('🎓', 'Kurse', s.mode === 'sandbox' ? 'In der Sandbox sind alle Stile frei.' : 'Ohne Kurs kein Sud – höhere Level schalten schwierigere Stile frei.', group('Bierstile', rows));
}

function cellarView() {
  const sandbox = s.mode === 'sandbox';
  const beers = s.beers.filter(b => b.liters > 0.01);
  const chans = Object.entries(g.CHANNELS).filter(([id]) => !sandbox || g.CHANNELS[id].legal);
  let html = '';
  if (has('verkauf') && !sandbox && !s.license) {
    html += `<div class="license-card"><span class="channel-icon">🧾</span><div class="grow"><b>Gewerbe anmelden · ${f0.format(g.LICENSE_COST)} €</b>
      <small>Gewerbe, Steuerlager und Lebensmittelamt: Dann verkaufst du legal über Hofverkauf, Gastro und Festivals – mit Biersteuer und 15 € Versicherung im Monat.${s.flags.schwarz ? ' Unter der Hand geht danach weiterhin – aber riskanter, weil der Zoll deine Bücher prüft.' : ''}</small></div>
      <button class="btn primary" data-action="license">Jetzt anmelden</button></div>`;
  }
  if (has('verkauf')) {
    html += `<div class="channels">${chans.map(([id, c]) => {
      const st = g.channelState(s, id);
      const room = st.open ? g.channelRoom(s, id) : 0;
      return `<div class="channel ${st.open ? '' : 'closed'} ${c.legal ? '' : 'shady'}"><span class="channel-icon">${c.icon}</span><b>${esc(c.name)}</b>
        <small>${st.open ? (sandbox || c.unlimited ? 'nimmt jede Menge' : room > 0 ? `noch ${f0.format(room)} von ${f0.format(g.channelDemand(s, id))} L diese Woche` : 'diese Woche ausverkauft') : '🔒 ' + esc(st.reason)}</small>
        ${!c.legal && st.open ? `<small class="risk">🚨 Risiko bei 10 L: ${f0.format(g.blackRisk(s, 10) * 100)} %${s.license ? ' (Betriebsprüfung)' : ''}</small>` : ''}
        <small class="muted">${esc(c.text)}</small></div>`;
    }).join('')}</div>`;
  } else html += `<p class="sub pad">🔒 Verkaufen wird in Kapitel 3 freigeschaltet. ${has('verschenken') ? 'Verschenken geht schon – das bringt Ruf.' : ''}</p>`;

  html += group('Fertiges Bier', beers.length ? beers.map(b => {
    const openCh = has('verkauf') ? chans.filter(([id]) => g.channelState(s, id).open) : [];
    return `<div class="row col-row beer-row">
      <div class="row-top"><span class="row-label"><span class="swatch-inline" style="background:${ebcToHex(b.ebc)}"></span>${esc(b.name)}${b.barrel && b.barrel !== 'cuvee' ? ' <span class="tag">🛢️ Fass</span>' : ''}${b.blend ? ' <span class="tag">🍷 Cuvée</span>' : ''}${b.custom ? ` <span class="tag">🧪 ${esc(b.custom.name)}</span>` : ''}</span>
        <span class="badge ${b.quality >= 70 ? 'ok' : b.quality >= 50 ? '' : 'low'}">Qualität ${b.quality} · ${esc(g.qualityLabel(b.quality))}</span></div>
      <div class="sub">${f2.format(b.liters)} L · ${f1.format(b.abv)} % vol · ${f0.format(b.ibu)} IBU · ${f0.format(b.ebc)} EBC</div>
      <div class="row-top inline">
        <label class="sub"><input type="number" id="liters-${b.id}" min="0.5" step="0.5" max="${b.liters}" value="${Math.min(Math.floor(b.liters) || b.liters, 10)}"> L</label>
        <span class="btn-row">
          ${has('verschenken') ? `<button class="btn" data-action="give" data-beer="${b.id}">🎁 Verschenken</button>` : ''}
          ${openCh.length ? `<select id="ch-${b.id}">${openCh.map(([id, c]) => `<option value="${id}">${c.icon} ${esc(c.name)} · ${eur(g.priceFor(s, b, id))}/L</option>`).join('')}</select>
          <button class="btn" data-action="sellMax" data-beer="${b.id}" title="So viel wie möglich über den gewählten Absatzweg">Max</button>
          <button class="btn primary" data-action="sell" data-beer="${b.id}">💶 Verkaufen</button>` : ''}
        </span></div>
    </div>`;
  }).join('') : empty('Noch kein fertiges Bier. Ein Sud braucht je nach Hefe 2–4 Wochen.'));
  if (!sandbox && has('verkauf')) html += group('Bilanz', `<div class="kv-grid">
      <div><small>Verkauft</small><b>${f0.format(s.stats.soldL)} L</b></div>
      <div><small>Verschenkt</small><b>${f0.format(s.stats.givenL)} L</b></div>
      <div><small>Umsatz</small><b>${eur(s.stats.revenue)}</b></div>
      <div><small>Biersteuer</small><b>${eur(s.stats.taxPaid)}</b></div>
      <div><small>Spenden</small><b>${eur(s.stats.donated)}</b></div>
    </div>`);
  return panel('📦', 'Lager & Verkauf', s.license ? 'Mit Gewerbe: Biersteuer wird automatisch abgeführt.' : 'Ohne Gewerbe: Hobby – oder heimlich …', html);
}

function donateView() {
  const beers = s.beers.filter(b => b.liters > 0.01);
  let html = `<div class="honor-meter"><div class="honor-top"><span>🙏 Ansehen</span><b>${f0.format(s.honor)} / 100</b></div><div class="glassbar honor"><div style="width:${s.honor}%"></div></div>
    <small>Spenden, stabile Qualität und ehrliche Geschäfte steigern dein Ansehen. Mehrere kleine Spenden über die Wochen wirken stärker als eine riesige.</small></div>`;
  html += `<div class="donate-grid">${Object.entries(g.DONATION_TARGETS).filter(([id]) => g.donationOpen(s, id)).map(([id, t]) => `
    <div class="donate-card"><span class="tile-icon">${t.icon}</span><b>${esc(t.name)}</b><small>${esc(t.text)}</small>
      <div class="btn-row">${[10, 50, 100].map(v => `<button class="btn" data-action="donate" data-target="${id}" data-eur="${v}">${v} €</button>`).join('')}</div></div>`).join('')}</div>`;
  html += group('🚒 Freibier für das Feuerwehrfest', beers.length ? beers.map(b => `<div class="row"><span class="grow">${esc(b.name)} <span class="sub">· Qualität ${b.quality} · ${f1.format(b.liters)} L</span></span>
      <button class="btn" data-action="freibier" data-beer="${b.id}">10 L spenden</button></div>`).join('') : empty('Kein Bier im Lager.'));
  if (!s.flags.abtei) {
    const p = g.abbeyProgress(s);
    html += `<section class="abbey"><div class="abbey-head"><span>⛪</span><div><b>Gerüchte über die Abtei St. Gambrin</b><small>gegründet 1253</small></div></div>
      <p>Man erzählt sich, dass die Mönche von St. Gambrin einen Brauer suchen. Keinen lauten, keinen bunten – einen verlässlichen.</p>
      <div class="goal-list">${p.map(x => `<div class="goal ${x.done ? 'done' : ''}"><span class="check">${x.done ? '✓' : ''}</span><span class="grow">${esc(x.text)}</span><small>${esc(x.have)}</small></div>`).join('')}</div></section>`;
  } else html += `<section class="abbey"><div class="abbey-head"><span>⛪</span><div><b>Abtei St. Gambrin</b><small>gegründet 1253</small></div></div>
      <p>${s.flags.gambrin ? 'Deine Dubbel und Tripel tragen das Siegel der Abtei: 40 % höherer Preis, 30 % des Erlöses gehen an die Abtei.' : 'Bruder Anselm wartet auf ein Dubbel mit Qualität 72 oder mehr.'}
      Bisher an die Abtei: <b>${eur(s.stats.donatedAbtei || 0)}</b></p></section>`;
  return panel('🙏', 'Spenden', 'Gutes tun – und dafür Ansehen bekommen', html);
}

function leagueView() {
  const r = g.ranking(s);
  const comp = Object.fromEntries(g.COMPETITORS.map(c => [c.name, c]));
  const html = `<div class="group league">${r.list.map((x, i) => `<div class="row ${x.me ? 'me' : ''}"><span class="rank">${i + 1}</span><span class="ico">${x.icon}</span>
    <span class="grow"><span class="row-label">${esc(x.name)}</span><div class="sub">${esc(x.me ? 'Das bist du!' : comp[x.name]?.text)}</div></span><b>${f0.format(x.points)}</b></div>`).join('')}</div>
    <p class="sub pad">Punkte aus Ruf, Ansehen, Medaillen, verkauften und verschenkten Litern und deiner besten Qualität. Alle Konkurrenten sind erfunden.</p>`;
  return panel('🏆', 'Bierliga', `Du bist auf Platz ${r.myRank} von ${r.list.length}`, html);
}

function diaryView() {
  const logs = s.log.slice(-100).reverse();
  return panel('📔', 'Tagebuch', 'Alles, was passiert ist', group('Einträge', logs.map(l =>
    `<div class="row log ${l.kind}"><span class="log-day">${g.dayLabel(l.day).replace(/, Jahr \d+/, '')}</span><span class="grow log-text">${esc(l.text)}</span></div>`).join('') || empty('Noch keine Einträge.')));
}

const GUIDE = [
  ['🛒', 'Einkaufen', 'Malz, Hopfen und Hefe kaufst du im Einkauf. Beim Brauen wird Fehlendes automatisch besorgt.'],
  ['🍺', 'Brauen', 'Wähle einen Bierstil und bau dein Rezept: Malze, Hopfen (Sorte, Form, Zeitpunkt, Gramm), Hefe, Maischverfahren und Reifung. Das Potenzial zeigt, wie gut das Rezept höchstens werden kann – Kniffe wie edles Grundmalz oder Dekoktion heben es.'],
  ['📒', 'Sortiment', 'Gib deinem Rezept einen Namen (z. B. „Diplom Pils“) und speichere es. So braust du deine Sorten mit einem Klick wieder.'],
  ['🫧', 'Gären', 'Je nach Hefe 2–4 Wochen. Die Temperatur ist entscheidend: Ohne Kühlung ist die Garage im Sommer zu warm und im Winter zu kalt.'],
  ['⏩', 'Zeit', 'Mit den Knöpfen oben spulst du Tage vor. Bei wichtigen Ereignissen hält die Zeit an und du entscheidest.'],
  ['📦', 'Lager & Verkauf', 'Fertiges Bier verschenkst du (Ruf) oder verkaufst es über Absatzwege. Ohne Gewerbe ist Verkaufen verboten – oder riskant.'],
  ['🛢️', 'Fasskeller & Cuvée', 'Starkes, dunkles Bier reift im Bourbon-, Whisky-, Rotwein- oder Cognacfass zu einem teuren Schatz – am besten 4–6 Monate. Oder verschneide zwei Biere zu einer eigenen Cuvée.'],
  ['🧪', 'Stil-Labor', 'Erfinde eigene Biersorten mit eigenen Zielwerten. Anfangs kennt sie niemand – gutes, verkauftes Bier macht sie bekannt und teurer.'],
  ['⚙️', 'Produktion', 'Ein Brauhelfer braut die Rezepte aus deinem Plan automatisch, sobald ein Tank frei ist, und verkauft nach deinen Regeln. Kostet Lohn.'],
  ['⭐', 'Ruf', 'Wie beliebt dein Bier ist. Wächst durch Qualität, Medaillen und Spenden – nicht durch Masse.'],
  ['🙏', 'Ansehen', 'Wie sehr man dir vertraut: Spenden und stabil gutes, klassisches Bier. Wer weiß, wer darauf aufmerksam wird …'],
  ['🎓', 'Level & Kurse', 'Jeder fertige Sud gibt Erfahrung. Höhere Level schalten Kurse für schwierigere Stile frei.'],
  ['🏆', 'Bierliga', 'Die Rangliste aller (erfundenen) Brauereien. Du startest ganz unten.'],
];
function sudbuchView() {
  const q = wiki.q.trim().toLowerCase();
  const items = g.infoIds(wiki.kind).map(id => g.getInfo(wiki.kind, id)).filter(e => !q || (e.title + ' ' + e.text).toLowerCase().includes(q));
  const html = `<h2>So funktioniert's</h2><div class="guide">${GUIDE.map(([i, t, x]) => `<div class="guide-item"><span>${i}</span><div><b>${t}</b><p>${x}</p></div></div>`).join('')}</div>
    <h2>Wissen</h2>
    <div class="chips pad">${Object.entries(WIKI_KINDS).map(([k, l]) => `<button class="chip ${k === wiki.kind ? 'on' : ''}" data-action="wikiKind" data-kind="${k}">${l}</button>`).join('')}</div>
    <input class="search" id="wikiQ" placeholder="Suchen …" value="${esc(wiki.q)}">
    <div class="group">${items.map(e => `<div class="row col-row"><span class="row-label">${esc(e.title)}</span><span class="sub">${esc(e.text)}</span></div>`).join('') || empty('Nichts gefunden.')}</div>
    <p class="sub pad disclaimer">ℹ️ Steuer- und Rechtsregeln sind für das Spiel vereinfacht (Stand ${esc(g.LAW_STAND)}). Keine Rechts- oder Steuerberatung – verbindlich ist der Zoll (zoll.de).
    Alle Brauereien, Personen und die Abtei St. Gambrin sind erfunden. Bier ist ein Genussmittel: verantwortungsvoll genießen, kein Alkohol an Kinder und Jugendliche.</p>`;
  return panel('📖', 'Opas Sudbuch', 'Anleitung und Wissen', html);
}

// ---------- Fasskeller & Cuvée ----------
const blendForm = { a: null, la: 10, b: null, lb: 10, name: '' };
function barrelView() {
  const beers = s.beers.filter(b => b.liters >= 1);
  const barrels = s.barrels || [];
  let html = group('🛢️ Deine Fässer', barrels.length ? barrels.map(br => {
    const def = g.BARRELS[br.type], st = g.barrelStatus(s, br);
    const wear = br.uses ? ` · ${br.uses}× benutzt${br.uses >= 3 ? ' (fast ausgelaugt)' : ''}` : ' · neu';
    if (st) {
      const f = br.fill;
      const mood = st.over ? '⚠️ zu lange – das Holz wird kratzig' : st.peak ? '⭐ Höhepunkt – jetzt abfüllen!' : st.ready ? 'kann abgefüllt werden, wird aber noch besser' : `noch ${g.BARREL_MIN_DAYS - st.days} Tage bis zum Abfüllen`;
      return `<div class="row col-row"><div class="row-top"><span class="row-label">${def.icon} ${esc(def.name)}<span class="sub">${wear}</span></span>
          <span class="badge ${st.gain > 0 ? 'ok' : 'low'}">${st.gain >= 0 ? '+' : ''}${f1.format(st.gain)} Qualität</span></div>
        <div class="sub">„${esc(f.beer.name)}“ · ${f1.format(f.liters)} L · seit ${st.days} Tagen · ${mood}${!st.fits && st.gain <= 0 ? ' · passt nicht zu diesem Fass' : ''}</div>
        <div class="glassbar"><div style="width:${Math.min(100, st.days / 2)}%"></div></div>
        <div class="row-top inline"><span class="sub">${esc(def.aroma)}</span>
          <button class="btn primary" data-action="emptyBarrel" data-id="${br.id}" ${st.ready ? '' : 'disabled'}>🍾 Abfüllen</button></div></div>`;
    }
    const cand = beers.filter(b => !b.barrel);
    return `<div class="row col-row"><div class="row-top"><span class="row-label">${def.icon} ${esc(def.name)}<span class="sub">${wear} · leer</span></span></div>
      <div class="sub">${esc(def.aroma)} · passt zu: ${def.suits.map(id => esc(byId(STYLES, id).name)).join(', ')}</div>
      ${cand.length ? `<div class="row-top inline"><select id="bf-beer-${br.id}" class="grow">${cand.map(b => opt(b.id, `${b.name} · Q ${b.quality} · ${f1.format(b.liters)} L`)).join('')}</select>
        <label class="sub"><input type="number" id="bf-l-${br.id}" min="5" max="${g.BARREL_L}" step="1" value="${Math.min(g.BARREL_L, Math.floor(cand[0].liters))}"> L</label>
        <button class="btn primary" data-action="fillBarrel" data-id="${br.id}">Einlagern</button></div>` : '<div class="sub">Kein passendes Bier im Lager.</div>'}</div>`;
  }).join('') : empty('Noch kein Fass. Starke, dunkle Biere (Imperial Stout, Doppelbock, Dubbel …) werden im Holz zu Schätzen.'));
  html += group('🛒 Fass kaufen', `<div class="donate-grid">${Object.entries(g.BARRELS).map(([id, d]) => `<div class="donate-card"><span class="tile-icon">${d.icon}</span>
    <b>${esc(d.name)}</b><small>${esc(d.aroma)}</small><small>Passt zu: ${d.suits.map(x => esc(byId(STYLES, x).name)).join(', ')}</small>
    <div class="btn-row"><button class="btn" data-action="buyBarrel" data-type="${id}">${s.mode === 'sandbox' ? 'Nehmen' : eur(d.cost)}</button></div></div>`).join('')}</div>
    <div class="row sub">Ein Fass fasst ${g.BARREL_L} L. Ab ${g.BARREL_MIN_DAYS} Tagen abfüllbar, am besten nach 4–6 Monaten. Pro Monat verdunsten ca. 2 % („Engelsanteil“). Jede Füllung laugt das Holz weiter aus.</div>`);

  // Cuvée
  if (beers.length >= 2) {
    if (!beers.some(b => b.id === blendForm.a)) blendForm.a = beers[0].id;
    if (!beers.some(b => b.id === blendForm.b) || blendForm.b === blendForm.a) blendForm.b = beers.find(b => b.id !== blendForm.a).id;
    let pv = null, err = '';
    try { pv = g.blendPreview(s, [{ beerId: blendForm.a, liters: blendForm.la }, { beerId: blendForm.b, liters: blendForm.lb }]); } catch (e) { err = e.message; }
    const sel = (key, lkey) => `<div class="row ing-row"><select data-blend="${key}" class="grow">${beers.map(b => opt(b.id, `${b.name} · Q ${b.quality} · ${f1.format(b.liters)} L`, b.id === blendForm[key])).join('')}</select>
      <label class="sub"><input type="number" data-blendl="${lkey}" min="1" step="1" value="${blendForm[lkey]}"> L</label></div>`;
    html += group('🍷 Cuvée mischen', `${sel('a', 'la')}${sel('b', 'lb')}
      <div class="row"><span class="grow row-label">Name der Cuvée</span><input type="text" id="blendName" class="text-input" maxlength="60" value="${esc(blendForm.name)}" placeholder="z. B. Cuvée Nachtschatten"></div>
      ${pv ? `<div class="kv-grid"><div><small>Menge</small><b>${f1.format(pv.liters)} L</b></div><div><small>Qualität</small><b>${pv.quality}</b></div>
        <div><small>Alkohol</small><b>${f1.format(pv.abv)} %</b></div><div><small>Bittere</small><b>${f0.format(pv.ibu)} IBU</b></div>
        <div><small>Farbe</small><b><span class="swatch-inline" style="background:${ebcToHex(pv.ebc)}"></span>${f0.format(pv.ebc)} EBC</b></div></div>
        ${pv.notes.map(n => `<div class="row sub">${esc(n)}</div>`).join('')}` : `<div class="row warn-text">${esc(err)}</div>`}
      <div class="row"><span class="grow sub">Fassbier + frisches Bier ergibt eine klassische Cuvée. Sehr verschiedene Farben oder Bitterkeit beißen sich.</span>
        <button class="btn primary" data-action="blend" ${pv ? '' : 'disabled'}>🍷 Verschneiden</button></div>`);
  } else html += group('🍷 Cuvée mischen', empty('Für eine Cuvée brauchst du mindestens zwei Biere im Lager.'));
  return panel('🛢️', 'Fasskeller & Cuvée', 'Bier im Holzfass reifen lassen und Biere zu eigenen Cuvées verschneiden', html);
}

// ---------- Stil-Labor ----------
const styleForm = { name: '', base: null, yeastId: null, ranges: null };
function stylesView() {
  const avail = STYLES.filter(x => g.isUnlocked(s, x.id));
  if (!styleForm.base || !g.isUnlocked(s, styleForm.base)) setStyleBase(avail[0].id);
  const base = byId(STYLES, styleForm.base);
  const lvl = g.skillLevel(s), story = s.mode === 'story';
  const locked = story && lvl < g.CUSTOM_STYLE_LEVEL;
  const bunt = g.isExperimental(styleForm.base, styleForm.ranges);
  const rangeRow = k => {
    const [label, unit] = g.RANGE_KEYS[k], [lo, hi] = styleForm.ranges[k];
    const step = k === 'plato' || k === 'abv' ? 0.1 : 1;
    return `<div class="row"><span class="grow row-label">${label}<div class="sub">${esc(base.name)}: ${base.ranges[k].join('–')} ${unit}</div></span>
      <label class="sub"><input type="number" data-srange="${k}" data-pos="0" step="${step}" value="${lo}"> –</label>
      <label class="sub"><input type="number" data-srange="${k}" data-pos="1" step="${step}" value="${hi}"> ${unit}</label></div>`;
  };
  let html = `<p class="sub pad">Erfinde deine eigene Biersorte: Du legst Namen und Zielwerte fest, der Basis-Stil gibt die Braulogik vor (passender Hopfen, Maischverfahren, Reifung). Neue Stile kennt anfangs niemand – erst mit gutem, verkauftem Bier werden sie bekannt und teurer.</p>`;
  html += group('🧪 Neuer Stil', `
    <div class="row"><span class="grow row-label">Name</span><input type="text" id="sName" class="text-input" maxlength="40" value="${esc(styleForm.name)}" placeholder="z. B. Garagengold Kellerbier"></div>
    <div class="row"><span class="grow row-label">Basis-Stil<div class="sub">${esc(base.desc)}</div></span><select id="sBase">${avail.map(x => opt(x.id, x.name, x.id === styleForm.base)).join('')}</select></div>
    <div class="row"><span class="grow row-label">Hefe</span><select id="sYeast">${YEASTS.map(y => opt(y.id, y.name, y.id === styleForm.yeastId)).join('')}</select></div>
    ${Object.keys(g.RANGE_KEYS).map(rangeRow).join('')}
    ${bunt ? '<div class="row warn-text">🌈 Weit weg vom Basis-Stil: Das gilt als experimentell („bunt“) – spannend, aber die Abtei mag so etwas nicht.</div>' : ''}
    <div class="row"><span class="grow sub">${locked ? `🔒 Ab Level ${g.CUSTOM_STYLE_LEVEL} (du bist Level ${lvl}).` : story ? `Entwicklung (Probesude, Verkostung): ${eur(g.CUSTOM_STYLE_COST)}` : 'Sandbox: gratis'}</span>
      <button class="btn primary" data-action="createStyle" ${locked ? 'disabled' : ''}>🧪 Stil anlegen</button></div>`);
  const mine = s.customStyles || [];
  html += group('📒 Deine Stile', mine.length ? mine.map(cs => `<div class="row col-row"><div class="row-top"><span class="row-label">🧪 ${esc(cs.name)}${cs.bunt ? ' 🌈' : ''}
      <span class="sub">auf Basis ${esc(byId(STYLES, cs.base).name)} · ${esc(byId(YEASTS, cs.yeastId).name)}</span></span>
      <span class="btn-row"><button class="btn primary" data-action="brewCustom" data-id="${cs.id}">🍺 Rezept anlegen</button>
      <button class="icon-btn" data-action="delStyle" data-id="${cs.id}" title="Stil löschen" aria-label="Stil ${esc(cs.name)} löschen">✕</button></span></div>
    <div class="sub">${Object.entries(g.RANGE_KEYS).map(([k, [l, u]]) => `${l} ${cs.ranges[k].join('–')} ${u}`).join(' · ')}</div>
    <div class="row-top inline"><span class="sub">Bekanntheit ${f0.format(cs.fame)} / 100 · Preis ×${f2.format(g.customPriceFactor(cs))}</span></div>
    <div class="glassbar"><div style="width:${cs.fame}%"></div></div></div>`).join('') : empty('Noch keine eigenen Stile.'));
  return panel('🧪', 'Stil-Labor', 'Eigene Biersorten erfinden', html);
}
function setStyleBase(id) {
  const b = byId(STYLES, id);
  styleForm.base = id; styleForm.yeastId = b.start.yeast; styleForm.ranges = structuredClone(b.ranges);
}

// ---------- Produktion ----------
function productionView() {
  const a = g.autoOf(s), story = s.mode === 'story';
  const recipes = s.recipes || [];
  const free = g.slotsOf(s) - s.batches.filter(b => b.status === 'gaerend').length;
  let html = `<div class="license-card"><span class="channel-icon">👷</span><div class="grow">
      <b>${a.helper ? (story ? 'Dein Brauhelfer arbeitet' : 'Automatik läuft') : (story ? `Brauhelfer einstellen · ${eur(g.HELPER_WAGE)} im Monat` : 'Automatik einschalten')}</b>
      <small>${a.helper ? `Er setzt die Rezepte aus dem Plan reihum an, sobald ein Gärtank frei wird (gerade ${Math.max(0, free)} frei), und verkauft nach deinen Regeln – nie unter der Hand.`
        : 'Ein Helfer braut deine Sortiments-Rezepte automatisch, sobald ein Tank frei ist, und verkauft fertiges Bier nach deinen Regeln. Fehlende Zutaten kauft er selbst.'}</small></div>
      <button class="btn ${a.helper ? '' : 'primary'}" data-action="${a.helper ? 'fireHelper' : 'hireHelper'}">${a.helper ? (story ? 'Entlassen' : 'Ausschalten') : (story ? 'Einstellen' : 'Einschalten')}</button></div>`;
  html += group('📋 Produktionsplan', recipes.length ? recipes.map(r => {
    const on = a.plan.includes(r.name), pot = g.recipePotential(r).total, sv = g.styleView(r);
    return `<label class="row check-row"><input type="checkbox" data-plan="${esc(r.name)}" ${on ? 'checked' : ''}>
      <span class="grow"><span class="row-label">${esc(r.name)}</span><div class="sub">${esc(sv.name)} · ${r.batchL} L · Potenzial ${pot}</div></span>
      <select data-sellrule="${esc(r.name)}" title="Verkaufsregel">${Object.entries(g.SELL_RULES).map(([id, t]) => opt(id, t, (a.sell[r.name] || 'selbst') === id)).join('')}</select></label>`;
  }).join('') : empty('Noch keine Rezepte im Sortiment. Unter „Brauen“ ein Rezept bauen und „Rezept ins Sortiment“ drücken.'));
  html += `<p class="sub pad">✔ = wird gebraut (reihum). Die Verkaufsregel gilt für Bier mit genau diesem Namen. „Markt + Rest an den Händler“ macht das Lager jede Woche leer – wenig Geld pro Liter, aber kein Bier wird alt.</p>`;
  const recent = s.log.filter(l => /👷|angesetzt|verkauft/.test(l.text)).slice(-8).reverse();
  html += group('🕑 Zuletzt', recent.length ? recent.map(l => `<div class="row log ${l.kind}"><span class="log-day">${g.dayLabel(l.day).replace(/, Jahr \d+/, '')}</span><span class="grow log-text">${esc(l.text)}</span></div>`).join('') : empty('Noch nichts.'));
  return panel('⚙️', 'Produktion', 'Mehrere Sorten nebeneinander fahren – automatisch', html);
}

const VIEWS = { barrel: barrelView, styles: stylesView, production: productionView, home, brew: brewView, ferment: fermentView, shop: shopView, gear: gearView, courses: coursesView, cellar: cellarView,
  donate: donateView, league: leagueView, diary: diaryView, sudbuch: sudbuchView };

// ---------- Events ----------
const num = id => parseFloat($(id).value);

/** Eingabe in der Rezept-Werkstatt übernehmen. true = war ein Rezeptfeld. */
function editRecipe(t) {
  const r = brewForm.recipe; if (!r) return false;
  const d = t.dataset, v = t.value, n = parseFloat(v);
  const ok = x => Number.isFinite(x);
  if (t.id === 'bName') r.name = v;
  else if (t.id === 'bLiters') { if (ok(n)) r.batchL = Math.round(n); }
  else if (t.id === 'bPlato') { if (ok(n)) r.plato = Math.min(30, Math.max(4, n)); }
  else if (t.id === 'bYeast') r.yeastId = v;
  else if (t.id === 'bMash') g.setMashProgram(r, v);
  else if (t.id === 'bReif') r.reifung = t.checked;
  else if ('malt' in d) r.malts[+d.malt].id = v;
  else if ('share' in d) { if (ok(n)) r.malts[+d.share].share = Math.min(100, Math.max(0, n)); }
  else if ('hop' in d) r.hops[+d.hop].id = v;
  else if ('hform' in d) r.hops[+d.hform].form = v;
  else if ('htime' in d) r.hops[+d.htime].time = +v;
  else if ('hg' in d) { if (ok(n)) r.hops[+d.hg].gPerL = Math.max(0, n) / r.batchL; }
  else return false;
  return true;
}

function brewNow() {
  const { r } = currentRecipe();
  if (s.mode !== 'sandbox') g.buyForRecipe(s, r);
  const b = g.startBatch(s, structuredClone(r));
  view = 'home';
  toast(`🫧 „${b.name}“ gärt. Kosten ${eur(b.cost.total)} (${eur(b.costPerLiter)}/L). Fertig am ${g.dayLabel(b.readyDay)}.`, 'good');
}

function tutorialDo(input) {
  const t = g.tutorialView(s);
  const before = s.log.length;
  try {
    const msg = g.tutorialAct(s, input);
    if (t.id === 'probieren') {
      const b = s.beers[0];
      if (b) overlay = { kind: 'taste', beer: b, text: msg };
    } else if (msg) toast(msg, 'good');
    afterAct(before);
  } catch (e) {
    if (e instanceof g.GameError) toast(e.message, 'bad'); else { console.error(e); toast(e.message, 'bad'); }
  }
}

export function initGameUi() {
  $('gBack').addEventListener('click', () => { save(); onExit(); });
  $('gHome').addEventListener('click', () => go('home'));
  $('gWait').addEventListener('click', e => {
    const b = e.target.closest('[data-wait]'); if (!b) return;
    const before = s.log.length;
    act(() => g.advanceDays(s, +b.dataset.wait));
    const fresh = s.log.slice(before).filter(l => l.kind === 'good' || l.kind === 'bad');
    if (fresh.length && !s.event) toast(fresh.at(-1).text.split('\n')[0], fresh.at(-1).kind);
  });
  $('gModal').addEventListener('click', e => {
    const c = e.target.closest('[data-choice]');
    if (c) { act(() => g.resolveEvent(s, c.dataset.choice)); return; }
    if (e.target.closest('[data-close]')) { overlay = null; render(); }
  });

  const body = $('gBody');
  body.addEventListener('input', e => {
    if (e.target.id === 'mashT') { paintMash(); return; }
    if (e.target.id === 'bName') { brewForm.recipe.name = e.target.value; return; }
    if (e.target.id === 'blendName') { blendForm.name = e.target.value; return; }
    if (e.target.id === 'sName') { styleForm.name = e.target.value; return; }
    if (e.target.id !== 'wikiQ') return;
    wiki.q = e.target.value; render();
    const i = $('wikiQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length);
  });
  body.addEventListener('change', e => {
    const t = e.target;
    if (editRecipe(t)) { render(); return; }
    const td = t.dataset;
    if ('blend' in td) { blendForm[td.blend] = +t.value; render(); return; }
    if ('blendl' in td) { blendForm[td.blendl] = Math.max(0, +t.value || 0); render(); return; }
    if (t.id === 'sBase') { setStyleBase(t.value); render(); return; }
    if (t.id === 'sYeast') { styleForm.yeastId = t.value; return; }
    if ('srange' in td) { const x = parseFloat(t.value); if (Number.isFinite(x)) styleForm.ranges[td.srange][+td.pos] = x; render(); return; }
    if ('plan' in td) { act(() => g.setPlan(s, td.plan, t.checked)); return; }
    if ('sellrule' in td) { act(() => g.setSellRule(s, td.sellrule, t.value)); return; }
    if (t.id === 'sLevel') act(() => g.setSandboxLevel(s, +t.value));
  });
  body.addEventListener('click', e => {
    const goBtn = e.target.closest('[data-go]');
    if (goBtn) { go(goBtn.dataset.go); return; }
    const tut = e.target.closest('[data-tut]');
    if (tut) { const v = tut.dataset.tut; tutorialDo(v === 'mash' ? mashTemp : v === 'go' ? undefined : v); return; }
    if (e.target.closest('[data-skip]')) {
      if (confirm('Tutorial überspringen? Du startest direkt in Kapitel 1 – ohne dein erstes geführtes Bier.')) act(() => g.skipTutorial(s));
      return;
    }
    const pick = e.target.closest('[data-style-pick]');
    if (pick) { brewForm.recipe = freshRecipe(pick.dataset.stylePick); render(); return; }
    const cpick = e.target.closest('[data-custom-pick]');
    if (cpick) { const cs = g.customOf(s, cpick.dataset.customPick); if (cs) { brewForm.recipe = { ...g.recipeFromCustom(cs), batchL: brewForm.recipe?.batchL || 20, mashProgram: null, reifung: false }; brewForm.recipe.mashProgram = g.mashProgramOf(brewForm.recipe); render(); } return; }
    const load = e.target.closest('[data-load-recipe]');
    if (load) {
      const x = (s.recipes || []).find(y => y.name === load.dataset.loadRecipe);
      if (x) { brewForm.recipe = structuredClone(x); render(); }
      return;
    }
    const b = e.target.closest('[data-action]'); if (!b || b.disabled) return;
    const d = b.dataset;
    switch (d.action) {
      case 'brew': act(brewNow); break;
      case 'saveRecipe': act(() => { const x = g.saveRecipe(s, brewForm.recipe); brewForm.recipe.name = x.name; toast(`💾 „${x.name}“ ist jetzt in deinem Sortiment.`, 'good'); }); break;
      case 'delRecipe': if (confirm(`Rezept „${d.name}“ aus dem Sortiment löschen?`)) act(() => g.deleteRecipe(s, d.name)); break;
      case 'buyBarrel': act(() => g.buyBarrel(s, d.type)); break;
      case 'fillBarrel': act(() => g.fillBarrel(s, +d.id, +$('bf-beer-' + d.id).value, num('bf-l-' + d.id))); break;
      case 'emptyBarrel': act(() => { const b = g.emptyBarrel(s, +d.id); overlay = { kind: 'taste', beer: b, text: b.notes.join(' ') }; }); break;
      case 'blend': act(() => { const b = g.blendBeers(s, [{ beerId: blendForm.a, liters: blendForm.la }, { beerId: blendForm.b, liters: blendForm.lb }], blendForm.name);
        blendForm.name = ''; overlay = { kind: 'taste', beer: b, text: b.notes.join(' ') }; }); break;
      case 'createStyle': act(() => { const cs = g.createStyle(s, { name: styleForm.name, base: styleForm.base, ranges: styleForm.ranges, yeastId: styleForm.yeastId });
        styleForm.name = ''; toast(`🧪 „${cs.name}“ ist geboren. Jetzt ein Rezept dafür bauen!`, 'good'); }); break;
      case 'delStyle': if (confirm('Diesen Stil löschen? Gespeicherte Rezepte und Bier im Lager bleiben erhalten.')) act(() => g.deleteStyle(s, d.id)); break;
      case 'brewCustom': { const cs = g.customOf(s, d.id); if (cs) { brewForm.recipe = { ...g.recipeFromCustom(cs), batchL: brewForm.recipe?.batchL || 20, reifung: false }; brewForm.recipe.mashProgram = g.mashProgramOf(brewForm.recipe); go('brew'); } break; }
      case 'hireHelper': act(() => g.hireHelper(s)); break;
      case 'fireHelper': act(() => g.fireHelper(s)); break;
      case 'addMalt': {
        const r = brewForm.recipe, used = new Set(r.malts.map(m => m.id));
        r.malts.push({ id: ['carapils', 'wiener', 'muenchner', 'melanoidin'].find(id => !used.has(id)) || 'pilsner', share: 5 }); render(); break;
      }
      case 'delMalt': brewForm.recipe.malts.splice(+d.i, 1); render(); break;
      case 'addHop': brewForm.recipe.hops.push({ id: 'hallertauer', gPerL: 1, time: 10, form: 'pellet' }); render(); break;
      case 'delHop': brewForm.recipe.hops.splice(+d.i, 1); render(); break;
      case 'gear': act(() => g.buyGear(s, d.slot, d.tier)); break;
      case 'setup': act(() => g.setEquipment(s, d.slot, d.tier)); break;
      case 'buyMalt': act(() => g.buyMalt(s, $('kMalt').value, num('kMaltKg'))); break;
      case 'buyHop': act(() => g.buyHop(s, $('kHop').value, $('kHopForm').value, num('kHopG'))); break;
      case 'buyYeast': act(() => g.buyYeast(s, $('kYeast').value, Math.round(num('kYeastN')))); break;
      case 'buySan': act(() => g.buySanitizer(s, Math.round(num('kSanN')))); break;
      case 'course': act(() => g.buyStyle(s, d.style)); break;
      case 'license': act(() => g.registerBusiness(s)); break;
      case 'give': act(() => g.give(s, +d.beer, num('liters-' + d.beer))); break;
      case 'sellMax': {
        const b = s.beers.find(x => x.id === +d.beer), room = g.channelRoom(s, $('ch-' + d.beer).value);
        $('liters-' + d.beer).value = Math.max(0, Math.min(b.liters, Math.floor(room)));
        break;
      }
      case 'sell': act(() => {
        const r = g.sell(s, +d.beer, num('liters-' + d.beer), $('ch-' + d.beer).value);
        if (r.raided) toast('🚨 Kontrolle! Ware beschlagnahmt, Strafe fällig – siehe Tagebuch.', 'bad');
        else toast(`💶 Verkauft: ${eur(r.revenue)}${r.tax ? ` (Biersteuer ${eur(r.tax)})` : ''}${r.toAbbey ? ` · ${eur(r.toAbbey)} an die Abtei` : ''}.`, 'good');
      }); break;
      case 'donate': act(() => { const gain = g.donate(s, d.target, +d.eur); toast(`🙏 Danke! Ansehen +${f1.format(gain)}`, 'good'); }); break;
      case 'freibier': act(() => g.donateBeer(s, +d.beer, Math.min(10, s.beers.find(x => x.id === +d.beer).liters), 'feuerwehr')); break;
      case 'wikiKind': wiki.kind = d.kind; render(); break;
    }
  });
}
