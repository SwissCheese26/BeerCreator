// Grafische Oberfläche für Story- und Sandbox-Modus: Dashboard mit Kacheln, Tutorial, Panels.
import * as g from '../game/index.js';
import { MALTS, HOPS, HOP_FORMS, YEASTS, STYLES, byId } from '../core/data.js';
import { newRecipeFromStyle, ebcToHex } from '../core/brew.js';

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
  { id: 'diary',   icon: '📔', name: 'Tagebuch',        feature: 'tagebuch' },
  { id: 'sudbuch', icon: '📖', name: 'Sudbuch',         feature: 'sudbuch' },
];
const LOCK_HINT = { brauen: 'Kapitel 1', einkauf: 'Kapitel 1', verschenken: 'Kapitel 2', bierliga: 'Kapitel 2', verkauf: 'Kapitel 3',
  spenden: 'Kapitel 3', ausruestung: 'Kapitel 4', kurse: 'Kapitel 4' };
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
const brewForm = { styleId: null, form: 'pellet', liters: 20 };
const wiki = { kind: 'style', q: '' };
const has = f => g.hasFeature(s, f);

export function loadGame(mode) {
  try { const x = JSON.parse(localStorage.getItem(KEY(mode))); return x && x.version >= 2 ? x : null; } catch { return null; }
}
function save() { try { localStorage.setItem(KEY(s.mode), JSON.stringify(s)); } catch {} }

export function openGame(mode, fresh, exit, breweryName) {
  onExit = exit;
  s = (!fresh && loadGame(mode)) || g.newGame({ mode, seed: Date.now() % 100000, breweryName });
  view = 'home'; overlay = null; brewForm.styleId = null;
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

function currentRecipe() {
  const avail = STYLES.filter(x => g.isUnlocked(s, x.id));
  if (!brewForm.styleId || !g.isUnlocked(s, brewForm.styleId)) brewForm.styleId = avail[0].id;
  const r = newRecipeFromStyle(brewForm.styleId);
  r.batchL = brewForm.liters;
  g.setHopForm(r, brewForm.form);
  return { r, avail };
}

function brewView() {
  const maxL = g.EQUIPMENT.kettle[s.equipment.kettle].maxBatchL;
  brewForm.liters = Math.min(Math.max(5, brewForm.liters), maxL);
  const { r, avail } = currentRecipe();
  const now = g.previewBatch(s, r);
  let pv = now, buyCost = 0, buyError = '';
  if (s.mode !== 'sandbox' && now.missing.length) { // Vorschau, als wäre das Fehlende schon gekauft
    const sim = structuredClone(s);
    try { g.buyForRecipe(sim, r); pv = g.previewBatch(sim, r); buyCost = s.cash - sim.cash; } catch (e) { buyError = e.message; }
  }
  const run = s.mode === 'sandbox' ? 0 : g.runCost(r.batchL);
  const st = byId(STYLES, r.styleId);
  const info = g.getInfo('style', r.styleId);
  const free = g.slotsOf(s) - s.batches.filter(b => b.status === 'gaerend').length;
  const c = pv.calc;

  let html = `<div class="style-picker">${avail.map(x => `<button class="style-chip ${x.id === r.styleId ? 'on' : ''}" data-style-pick="${x.id}">
      <span class="dot" style="background:${ebcToHex((x.ranges.ebc[0] + x.ranges.ebc[1]) / 2)}"></span>${esc(x.name)}</button>`).join('')}
      ${has('kurse') ? '<button class="style-chip more" data-go="courses">🎓 mehr Stile …</button>' : ''}</div>`;
  html += group('Dein Sud', `
    <div class="row"><span class="grow"><span class="row-label">${esc(st.name)}</span><div class="sub">${esc(info?.text || st.desc)}</div></span></div>
    <div class="row"><span class="grow row-label">🌿 Hopfenform<div class="sub">${esc(g.getInfo('form', brewForm.form)?.text || '')}</div></span>
      <select id="bForm">${Object.values(HOP_FORMS).map(f => `<option value="${f.id}" ${f.id === brewForm.form ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></div>
    <div class="row"><span class="grow row-label">🪣 Menge<div class="sub">${esc(g.EQUIPMENT.kettle[s.equipment.kettle].name)}: max. ${maxL} L</div></span>
      <label class="sub"><input type="number" id="bLiters" min="5" max="${maxL}" step="1" value="${brewForm.liters}"> L</label></div>`);
  html += group('So wird es (erwartet)', `<div class="kv-grid">
      <div><small>Alkohol</small><b>${f1.format(c.abv)} %</b></div>
      <div><small>Stammwürze</small><b>${f1.format(c.plato)} °P</b></div>
      <div><small>Bittere</small><b>${f0.format(c.ibu)} IBU</b></div>
      <div><small>Farbe</small><b><span class="swatch-inline" style="background:${ebcToHex(c.ebc)}"></span>${f0.format(c.ebc)} EBC</b></div>
      <div><small>Hefe</small><b>${f0.format(pv.pitchRatio * 100)} %</b></div>
    </div>
    <div class="row"><span class="sub">Zielbereich ${esc(st.name)}: ${st.ranges.plato.join('–')} °P · ${st.ranges.ibu.join('–')} IBU · ${st.ranges.ebc.join('–')} EBC.</span></div>`);
  html += group('Kosten', (now.missing.length && s.mode !== 'sandbox'
    ? `<div class="row"><span class="grow">🛒 Fehlende Zutaten (${esc(now.missing.join(', '))})</span><b>${buyError ? '–' : eur(buyCost)}</b></div>` : '') +
    (s.mode !== 'sandbox' ? `<div class="row"><span class="grow">⚡ Energie, Wasser, Flaschen &amp; Kronkorken</span><b>${eur(run)}</b></div>
      <div class="row"><span class="grow row-label">Zusammen</span><b>${eur((buyError ? 0 : buyCost) + run)}</b></div>` : '<div class="row empty">Sandbox: alles gratis.</div>'));
  const blocked = free <= 0 ? 'Alle Gärplätze sind belegt – warte, bis ein Sud fertig ist.' : buyError ? 'Zu wenig Geld für die Zutaten.'
    : s.mode !== 'sandbox' && s.cash < buyCost + run ? 'Zu wenig Geld für diesen Sud.' : '';
  html += `<div class="actions">${blocked ? `<span class="warn-text">${blocked}</span>` : ''}
    <button class="btn primary big" data-action="brew" ${blocked ? 'disabled' : ''}>🍺 Sud ansetzen</button></div>`;
  return panel('🍺', 'Brauen', 'Stil wählen, Hopfenform und Menge festlegen, ansetzen', html);
}

function fermentView() {
  const fer = s.batches.filter(b => b.status === 'gaerend');
  let html = group('Gärt gerade', fer.length ? fer.map(b => {
    const total = b.readyDay - b.startDay, done = Math.min(total, s.day - b.startDay);
    return `<div class="row col-row"><div class="row-top"><span class="row-label">🫧 ${esc(b.name)}</span><span class="sub">noch ${b.readyDay - s.day} Tage · fertig am ${g.dayLabel(b.readyDay)}</span></div>
      <div class="glassbar"><div style="width:${done / total * 100}%"></div></div><div class="sub">Gärtemperatur ${f1.format(b.fermTemp)} °C</div></div>`;
  }).join('') : empty('Gerade gärt nichts.'));
  const done = s.batches.filter(b => b.status === 'fertig').slice(-10).reverse();
  html += group('Zuletzt fertig', done.length ? done.map(b => `<div class="row"><span class="grow">${esc(b.name)}<div class="sub">${esc(byId(STYLES, b.styleId)?.name)} · ${eur(b.costPerLiter)}/L Kosten</div></span>
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
        <small>${st.open ? (sandbox ? 'unbegrenzt' : `noch ${f0.format(room)} L diese Woche`) : '🔒 ' + esc(st.reason)}</small>
        ${!c.legal && st.open ? `<small class="risk">🚨 Risiko bei 10 L: ${f0.format(g.blackRisk(s, 10) * 100)} %${s.license ? ' (Betriebsprüfung)' : ''}</small>` : ''}
        <small class="muted">${esc(c.text)}</small></div>`;
    }).join('')}</div>`;
  } else html += `<p class="sub pad">🔒 Verkaufen wird in Kapitel 3 freigeschaltet. ${has('verschenken') ? 'Verschenken geht schon – das bringt Ruf.' : ''}</p>`;

  html += group('Fertiges Bier', beers.length ? beers.map(b => {
    const openCh = has('verkauf') ? chans.filter(([id]) => g.channelState(s, id).open) : [];
    return `<div class="row col-row beer-row">
      <div class="row-top"><span class="row-label"><span class="swatch-inline" style="background:${ebcToHex(b.ebc)}"></span>${esc(b.name)}</span>
        <span class="badge ${b.quality >= 70 ? 'ok' : b.quality >= 50 ? '' : 'low'}">Qualität ${b.quality} · ${esc(g.qualityLabel(b.quality))}</span></div>
      <div class="sub">${f2.format(b.liters)} L · ${f1.format(b.abv)} % vol · ${f0.format(b.ibu)} IBU · ${f0.format(b.ebc)} EBC</div>
      <div class="row-top inline">
        <label class="sub"><input type="number" id="liters-${b.id}" min="0.5" step="0.5" max="${b.liters}" value="${Math.min(Math.floor(b.liters) || b.liters, 10)}"> L</label>
        <span class="btn-row">
          ${has('verschenken') ? `<button class="btn" data-action="give" data-beer="${b.id}">🎁 Verschenken</button>` : ''}
          ${openCh.length ? `<select id="ch-${b.id}">${openCh.map(([id, c]) => `<option value="${id}">${c.icon} ${esc(c.name)} · ${eur(g.priceFor(s, b, id))}/L</option>`).join('')}</select>
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
  ['🍺', 'Brauen', 'Wähle einen Bierstil, die Hopfenform und die Menge. Die Vorschau zeigt, wie das Bier wird und was es kostet.'],
  ['🫧', 'Gären', 'Je nach Hefe 2–4 Wochen. Die Temperatur ist entscheidend: Ohne Kühlung ist die Garage im Sommer zu warm und im Winter zu kalt.'],
  ['⏩', 'Zeit', 'Mit den Knöpfen oben spulst du Tage vor. Bei wichtigen Ereignissen hält die Zeit an und du entscheidest.'],
  ['📦', 'Lager & Verkauf', 'Fertiges Bier verschenkst du (Ruf) oder verkaufst es über Absatzwege. Ohne Gewerbe ist Verkaufen verboten – oder riskant.'],
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

const VIEWS = { home, brew: brewView, ferment: fermentView, shop: shopView, gear: gearView, courses: coursesView, cellar: cellarView,
  donate: donateView, league: leagueView, diary: diaryView, sudbuch: sudbuchView };

// ---------- Events ----------
const num = id => parseFloat($(id).value);

function brewNow() {
  const { r } = currentRecipe();
  if (s.mode !== 'sandbox') g.buyForRecipe(s, r);
  const b = g.startBatch(s, r);
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
    if (e.target.id !== 'wikiQ') return;
    wiki.q = e.target.value; render();
    const i = $('wikiQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length);
  });
  body.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'bForm') { brewForm.form = t.value; render(); }
    else if (t.id === 'bLiters') { brewForm.liters = Math.round(+t.value || 20); render(); }
    else if (t.id === 'sLevel') act(() => g.setSandboxLevel(s, +t.value));
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
    if (pick) { brewForm.styleId = pick.dataset.stylePick; render(); return; }
    const b = e.target.closest('[data-action]'); if (!b || b.disabled) return;
    const d = b.dataset;
    switch (d.action) {
      case 'brew': act(brewNow); break;
      case 'gear': act(() => g.buyGear(s, d.slot, d.tier)); break;
      case 'setup': act(() => g.setEquipment(s, d.slot, d.tier)); break;
      case 'buyMalt': act(() => g.buyMalt(s, $('kMalt').value, num('kMaltKg'))); break;
      case 'buyHop': act(() => g.buyHop(s, $('kHop').value, $('kHopForm').value, num('kHopG'))); break;
      case 'buyYeast': act(() => g.buyYeast(s, $('kYeast').value, Math.round(num('kYeastN')))); break;
      case 'buySan': act(() => g.buySanitizer(s, Math.round(num('kSanN')))); break;
      case 'course': act(() => g.buyStyle(s, d.style)); break;
      case 'license': act(() => g.registerBusiness(s)); break;
      case 'give': act(() => g.give(s, +d.beer, num('liters-' + d.beer))); break;
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
