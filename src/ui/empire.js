// Oberfläche des Braukonzern-Modus: Weltkarte, Länder, Brauereien, Finanzen, Rangliste, Lage.
import * as g from '../game/index.js';
import { STYLES, byId } from '../core/data.js';

const E = g.empire;
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nf = d => new Intl.NumberFormat('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const f0 = nf(0), f1 = nf(1), f2 = nf(2);
const KEY = 'beercreator.game.konzern.v2';

let s = null, tab = 'map', sel = 'DE', onExit = () => {}, overlay = null, toastTimer;
const forms = { build: { cap: 100, style: 'pils' }, loan: 5000000, brand: 'pils' };

export function loadEmpire() {
  try { const x = JSON.parse(localStorage.getItem(KEY)); return x && x.empire ? x : null; } catch { return null; }
}
export function saveEmpireState(state) { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} }
const save = () => saveEmpireState(s);

export function openEmpire(fresh, exit, name, difficulty = 'normal', state = null) {
  onExit = exit;
  s = state || (!fresh && loadEmpire()) || g.newGame({ mode: 'konzern', seed: Date.now() % 100000, breweryName: name || undefined, difficulty, years: 30 });
  tab = 'map'; sel = 'DE'; overlay = null;
  save(); render();
}

function toast(msg, kind = '') {
  const t = $('toast'); t.textContent = msg; t.className = 'toast ' + kind; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 4500);
}
function act(fn) {
  const before = s.log.length;
  try { fn(); const fresh = s.log.slice(before).filter(l => l.kind === 'good' || l.kind === 'bad'); if (fresh.length) toast(fresh.at(-1).text.split('\n')[0], fresh.at(-1).kind); }
  catch (e) { if (e instanceof g.GameError) toast(e.message, 'bad'); else { console.error(e); toast('Unerwarteter Fehler: ' + e.message, 'bad'); } }
  save(); render();
}
function advance(months) {
  act(() => { for (let i = 0; i < months * 30 && !s.gameOver; i++) g.advanceDays(s, 1); if (s.gameOver) overlay = 'over'; });
}

// ---------- Karte ----------
const LAND = { // grobe Umrisse (lon, lat) – nur zur Orientierung
  na: [[-168, 66], [-141, 70], [-110, 72], [-85, 70], [-75, 62], [-62, 58], [-56, 50], [-66, 44], [-75, 39], [-81, 31], [-80, 25], [-90, 30], [-97, 27], [-97, 19], [-88, 16], [-83, 10], [-78, 8], [-85, 10], [-92, 14], [-105, 20], [-110, 24], [-115, 30], [-124, 40], [-125, 48], [-135, 58], [-152, 60], [-165, 62]],
  gr: [[-55, 60], [-20, 70], [-20, 82], [-60, 82], [-70, 76]],
  sa: [[-78, 8], [-72, 12], [-62, 10], [-52, 5], [-35, -5], [-39, -15], [-48, -26], [-58, -36], [-65, -42], [-68, -52], [-74, -50], [-72, -35], [-71, -18], [-81, -5], [-79, 2]],
  eu: [[-10, 36], [-9, 43], [-2, 48], [2, 51], [8, 54], [10, 58], [5, 62], [15, 69], [28, 71], [45, 68], [70, 73], [100, 77], [140, 72], [170, 70], [180, 66], [160, 60], [140, 52], [135, 43], [127, 38], [122, 31], [120, 22], [108, 18], [105, 10], [100, 13], [98, 8], [104, 1], [98, 16], [92, 22], [80, 15], [77, 8], [72, 20], [67, 25], [57, 25], [51, 25], [44, 13], [35, 28], [32, 31], [27, 37], [12, 38], [3, 43]],
  af: [[-17, 21], [-10, 30], [-6, 36], [10, 37], [22, 33], [32, 31], [35, 28], [43, 12], [51, 12], [40, -3], [40, -15], [33, -26], [20, -35], [12, -17], [9, -1], [8, 4], [-8, 4], [-17, 14]],
  au: [[114, -22], [122, -18], [131, -12], [142, -11], [146, -19], [153, -26], [150, -37], [140, -38], [130, -32], [115, -34]],
  uk: [[-6, 50], [1, 51], [-2, 56], [-5, 58], [-6, 55]], jp: [[130, 32], [135, 34], [141, 36], [142, 43], [140, 41]],
};
const VIEWS_MAP = {
  world:  { lon0: -170, lon1: 180, lat0: -60, lat1: 80, W: 1000, H: 480, r: m => 6 + Math.sqrt(m / 1000) * 1.15, only: c => !c.region.startsWith('Europa') },
  europe: { lon0: -12, lon1: 48, lat0: 33, lat1: 62, W: 600, H: 290, r: m => 9 + Math.sqrt(m / 1000) * 1.4, only: c => c.region.startsWith('Europa') },
};

function mapSvg(rep, which) {
  const v = VIEWS_MAP[which];
  const px = lon => (lon - v.lon0) / (v.lon1 - v.lon0) * v.W, py = lat => (v.lat1 - lat) / (v.lat1 - v.lat0) * v.H;
  const owned = Object.fromEntries(rep.countries.map(c => [c.id, c]));
  const land = Object.values(LAND).map(p => `<polygon class="land" points="${p.map(([lo, la]) => `${px(lo).toFixed(1)},${py(la).toFixed(1)}`).join(' ')}"/>`).join('');
  const step = which === 'world' ? 30 : 10;
  const grid = Array.from({ length: Math.ceil((v.lat1 - v.lat0) / step) + 1 }, (_, i) => Math.ceil(v.lat0 / step) * step + i * step).filter(la => la < v.lat1).map(la => `<line class="grid" x1="0" x2="${v.W}" y1="${py(la)}" y2="${py(la)}"/>`).join('') +
    Array.from({ length: Math.ceil((v.lon1 - v.lon0) / step) + 1 }, (_, i) => Math.ceil(v.lon0 / step) * step + i * step).filter(lo => lo < v.lon1).map(lo => `<line class="grid" y1="0" y2="${v.H}" x1="${px(lo)}" x2="${px(lo)}"/>`).join('');
  const dots = E.COUNTRIES.filter(v.only).map(c => {
    const o = owned[c.id], r = v.r(c.marketKhl), cls = o?.brewer ? 'own' : o ? 'office' : 'none';
    return `<g class="mapdot ${cls} ${sel === c.id ? 'sel' : ''}" data-country="${c.id}" tabindex="0" role="button" aria-label="${esc(c.name)}">
      <circle cx="${px(c.lon).toFixed(1)}" cy="${py(c.lat).toFixed(1)}" r="${r.toFixed(1)}"/><text x="${px(c.lon).toFixed(1)}" y="${(py(c.lat) + 3.5).toFixed(1)}">${c.id}</text>
      <title>${esc(c.name)} – Markt ${f0.format(c.marketKhl / 1000)} Mio. hl${o ? `, Marktanteil ${o.share} %` : ''}</title></g>`;
  }).join('');
  const frame = which === 'world' ? (() => { const e = VIEWS_MAP.europe; return `<rect class="inset" x="${px(e.lon0)}" y="${py(e.lat1)}" width="${px(e.lon1) - px(e.lon0)}" height="${py(e.lat0) - py(e.lat1)}"/><text class="inset-label" x="${px(e.lon0) + 4}" y="${py(e.lat1) - 6}">Europa → Ausschnitt rechts</text>`; })() : '';
  return `<svg class="worldmap" viewBox="0 0 ${v.W} ${v.H}" role="img" aria-label="${which === 'world' ? 'Weltkarte' : 'Europakarte'} der Märkte">${grid}${land}${frame}${dots}</svg>`;
}
const legend = '<div class="map-legend"><span><i class="lg own"></i>Brauerei</span><span><i class="lg office"></i>Büro</span><span><i class="lg none"></i>nicht erschlossen</span><span class="sub">Größe = Markt</span></div>';

// ---------- Ansichten ----------
const panel = (icon, title, sub, body) => `<div class="panel-head"><span class="panel-icon">${icon}</span><div><h1 class="page-title">${title}</h1><p class="subtitle">${sub}</p></div></div>${body}`;
const group = (title, inner, extra = '') => `<h2>${title}${extra}</h2><div class="group">${inner}</div>`;
const fmt = E.fmt;

function countryPanel(rep) {
  const c = E.countryOf(sel), e = s.empire, office = e.offices[sel];
  const info = g.getInfo('land', sel);
  const fit = Object.entries(c.styles).sort((a, b) => b[1] - a[1]).map(([id, v]) => `${esc(byId(STYLES, id).name)} ${Math.round(v * 100)} %`).join(' · ');
  let html = `<div class="group country"><div class="row col-row"><div class="row-top"><span class="row-label">${c.flag} ${esc(c.name)}</span><span class="badge">${esc(c.region)}</span></div>
    <div class="sub">${esc(c.note)}</div>
    <div class="kv"><span>Markt</span><b>${f0.format(e.mkt[c.id] / 1000)} Mio. hl</b><span>Erlös</span><b>${c.price} €/hl</b><span>Biersteuer</span><b>${c.excise} %</b><span>Gewinnsteuer</span><b>${c.tax} %</b>
      <span>Wachstum</span><b>${c.growth} %/Jahr</b><span>Konkurrenz</span><b>${f2.format(c.comp)}</b><span>Kosten</span><b>×${c.cost}</b><span>Risiko</span><b>${'●'.repeat(Math.max(1, Math.round(c.risk * 10)))}</b></div>
    <div class="sub">Beliebt: ${fit}</div></div>`;
  if (!office) {
    const full = Object.keys(e.offices).length >= rep.hq.maxCountries;
    html += `<div class="row"><span class="grow row-label">Büro eröffnen</span><span class="sub">${c.entry ? fmt(c.entry) : ''}</span>
      <button class="btn primary" data-act="office" data-c="${c.id}" ${full || s.cash < c.entry ? 'disabled' : ''} title="${full ? 'Zentrale ausbauen: Länder-Limit erreicht' : s.cash < c.entry ? 'Zu wenig Kapital' : ''}">Büro eröffnen</button></div></div>`;
    html += `<div class="sub pad">Ohne Büro kannst du hier weder bauen noch Brauereien übernehmen.${full ? ' Deine Zentrale betreut schon so viele Länder, wie sie kann.' : ''}</div>`;
    return html;
  }
  html += `<div class="row"><span class="grow row-label">Marketing</span><div class="seg">${E.MARKETING.map((m, i) => `<button class="seg-btn ${office.marketing === i ? 'on' : ''}" data-act="mkt" data-c="${c.id}" data-l="${i}" title="${m.pct * 100} % vom Erlös">${esc(m.name)}</button>`).join('')}</div></div>`;
  html += `</div>`;
  // Übernahmen
  const targets = E.listTargets(s, c.id);
  const full = e.breweries.length >= rep.hq.maxBreweries;
  html += group('🤝 Brauereien zum Verkauf', targets.map(t => {
    const why = t.sold ? '' : full ? 'Zentrale ausbauen: Brauerei-Limit erreicht' : t.antitrust ? 'Kartellamt: über 35 % Marktanteil' : s.cash < t.price ? 'Zu wenig Kapital' : '';
    return `<div class="row"><span class="grow"><span class="row-label">${esc(t.name)}</span> <span class="badge ${t.tier === 'Marktführer' ? 'high' : ''}">${t.tier}</span>
      <div class="sub">${f0.format(t.volKhl)} Tsd. hl · Q${t.quality} · Marke ${t.brand} · ${esc(byId(STYLES, t.style).name)} · EBITDA ${fmt(t.ebitda)}${t.antitrust && !t.sold ? ' · ⛔ Kartell' : ''}</div></span>
      ${t.sold ? '<span class="badge ok">gehört dir</span>' : `<button class="btn primary" data-act="buy" data-t="${t.id}" ${why ? 'disabled' : ''} title="${esc(why)}">${fmt(t.price)}</button>`}</div>`;
  }).join(''));
  // Neubau
  const cap = forms.build.cap, bcost = E.buildCost(c.id, cap);
  const styleOpts = [...Object.keys(c.styles), ...STYLES.map(x => x.id).filter(x => !(x in c.styles))].map(id => `<option value="${id}" ${forms.build.style === id ? 'selected' : ''}>${esc(byId(STYLES, id).name)}${c.styles[id] ? ` (${Math.round(c.styles[id] * 100)} %)` : ''}</option>`).join('');
  html += group('🏗️ Neubau', `<div class="row-top inline pad-row"><label class="sub">Kapazität <input type="number" id="bCap" min="10" max="5000" step="10" value="${cap}"> Tsd. hl</label>
    <select id="bStyle" aria-label="Bierstil">${styleOpts}</select>
    <span class="sub">${fmt(bcost)} · ${E.buildMonths(cap)} Monate</span>
    <button class="btn primary" data-act="build" data-c="${c.id}" ${s.cash < bcost || full ? 'disabled' : ''}>Bauen</button></div>`);
  return html;
}

function mapView(rep) {
  return panel('🌍', 'Weltkarte', `${rep.countries.length} Länder · ${rep.breweries.length} Brauereien · ${f1.format(rep.volMhl)} Mio. hl`, `<div class="maps"><div class="map-wrap">${mapSvg(rep, 'world')}</div><div class="map-wrap">${mapSvg(rep, 'europe')}</div></div>${legend}
    <div class="chips-row">${E.COUNTRIES.map(c => `<button class="chip ${sel === c.id ? 'on' : ''} ${rep.countries.some(x => x.id === c.id) ? 'has' : ''}" data-country="${c.id}">${c.flag} ${c.id}</button>`).join('')}</div>
    ${countryPanel(rep)}`);
}

const STATUS = { betrieb: '', bau: 'im Bau', ausfall: '🔥 Ausfall' };
function breweriesView(rep) {
  const rows = rep.breweries.map(b => {
    const c = E.countryOf(b.country), br = s.empire.breweries.find(x => x.id === b.id);
    const can = b.status === 'betrieb';
    const up = w => E.upgradeCost(br, w);
    const btn = (w, label) => { const u = up(w); return `<button class="btn" data-act="up" data-b="${b.id}" data-w="${w}" ${!can || u.cost == null || s.cash < u.cost ? 'disabled' : ''} title="${u.cost == null ? 'Maximum erreicht' : ''}">${label}${u.cost != null ? ` · ${fmt(u.cost)}` : ' ✔'}</button>`; };
    const styles = [...new Set([...Object.keys(c.styles), b.style])].map(id => `<option value="${id}" ${b.style === id ? 'selected' : ''}>${esc(byId(STYLES, id).name)}${c.styles[id] ? ` ${Math.round(c.styles[id] * 100)} %` : ''}</option>`).join('');
    return `<div class="row col-row brew-row"><div class="row-top"><span class="row-label">${c.flag} ${esc(b.name)}</span>
      <span>${b.status !== 'betrieb' ? `<span class="badge high">${STATUS[b.status]}${b.status === 'bau' ? ` bis Monat ${b.readyMonth}` : ''}</span>` : ''}${b.integration ? ` <span class="badge">Integration ${b.integration} Mon.</span>` : ''}</span></div>
      <div class="kv"><span>Kapazität</span><b>${f0.format(b.capKhl)} Tsd. hl</b><span>Ausstoß</span><b>${f0.format(b.volKhlYear)} Tsd. hl</b><span>Qualität</span><b>${b.quality}</b><span>Marke</span><b>${b.brand}</b>
        <span>Technik</span><b>Stufe ${b.tech}</b><span>EBITDA</span><b>${fmt(b.ebitdaYear)}/Jahr</b></div>
      <div class="row-top inline"><select data-act="focus" data-b="${b.id}" aria-label="Haupt-Bierstil" ${can ? '' : 'disabled'}>${styles}</select>
        ${btn('kapazitaet', '＋ Kapazität')}${btn('technik', '⚙️ Technik')}${btn('qualitaet', '⭐ Qualität')}
        <button class="btn" data-act="sell" data-b="${b.id}" ${rep.breweries.length < 2 ? 'disabled' : ''}>Verkaufen</button></div></div>`;
  }).join('');
  return panel('🏭', 'Brauereien', `${rep.breweries.length} von ${rep.hq.maxBreweries} möglichen Standorten`, `<div class="group">${rows}</div>`);
}

function chart(history, key, color, label) {
  if (history.length < 2) return '';
  const data = history.map(h => h[key]), max = Math.max(...data, 1), min = Math.min(...data, 0);
  const pts = data.map((v, i) => `${(i / (data.length - 1) * 300).toFixed(1)},${(70 - (v - min) / (max - min || 1) * 64).toFixed(1)}`).join(' ');
  return `<div class="chart"><small>${label}</small><svg viewBox="0 0 300 74" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke"/></svg><small class="muted">${key === 'volMhl' ? f1.format(data.at(-1)) + ' Mio. hl' : fmt(data.at(-1))}</small></div>`;
}
function financeView(rep) {
  const e = s.empire, nh = rep.nextHq;
  const hist = e.history.slice(-120);
  return panel('💶', 'Finanzen & Zentrale', `Rating ${rep.rating} · Zins ${rep.interestPct} % · ${rep.leverage < 0 ? `Netto-Kasse ${f1.format(-rep.leverage)}× EBITDA` : `Nettoverschuldung ${rep.leverage}× EBITDA`}`,
    group('📈 Entwicklung', `<div class="charts">${chart(hist, 'revenue', '#0a84ff', 'Umsatz/Monat')}${chart(hist, 'ebitda', '#34c759', 'EBITDA/Monat')}${chart(hist, 'volMhl', '#ff9f0a', 'Ausstoß/Jahr')}${chart(hist, 'debt', '#ff453a', 'Schulden')}</div>
      ${hist.length < 2 ? '<div class="row sub">Spule ein paar Monate vor, dann erscheint der Verlauf.</div>' : ''}`) +
    group('🏦 Kredite', `<div class="row"><span class="grow sub">Schulden ${fmt(rep.debt)} von höchstens ${fmt(rep.maxDebt)} (6× Jahres-EBITDA). Ein hoher Verschuldungsgrad verteuert Zinsen und gefährdet die Liquidität.</span></div>
      <div class="row-top inline pad-row"><label class="sub">Betrag <input type="number" id="loanAmt" min="100000" step="500000" value="${forms.loan}"> €</label>
      <button class="btn primary" data-act="loan">Kredit aufnehmen</button><button class="btn" data-act="repay" ${rep.debt <= 0 ? 'disabled' : ''}>Tilgen</button></div>`) +
    group('🏢 Konzernzentrale', `<div class="row"><span class="grow"><span class="row-label">${esc(rep.hq.name)}</span><div class="sub">bis ${rep.hq.maxBreweries} Brauereien in ${rep.hq.maxCountries} Ländern · laufend ${fmt(rep.hq.monthly)}/Monat · Einkaufsvorteil −${(rep.hq.lvl - 1) * 2} %</div></span>
      ${nh ? `<button class="btn primary" data-act="hq" ${s.cash < nh.cost ? 'disabled' : ''}>${esc(nh.name)} · ${fmt(nh.cost)}</button>` : '<span class="badge ok">Höchste Stufe</span>'}</div>`) +
    group('✨ Konzernmarken', `${e.brands.length ? e.brands.map(b => `<div class="row"><span class="grow row-label">${esc(b.name)}</span><span class="sub">${esc(byId(STYLES, b.style).name)}</span><b>${f0.format(b.power)}</b></div>`).join('') : '<div class="row sub">Noch keine. Eine Marke stärkt alle Brauereien in Ländern, wo ihr Stil beliebt ist.</div>'}
      <div class="row-top inline pad-row"><select id="brandStyle" aria-label="Stil der Marke">${STYLES.map(x => `<option value="${x.id}" ${forms.brand === x.id ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>
      <button class="btn primary" data-act="brand" ${e.brands.length >= 5 ? 'disabled' : ''}>Neue Marke starten</button></div>`));
}

function rankView(rep) {
  const list = E.ranking(s), max = Math.max(...list.map(x => x.mhl));
  return panel('🏆', 'Weltrangliste', `Du bist Platz ${rep.rank} von ${list.length} – Platz 1 nach über 2 Jahren beendet das Spiel als Weltmarktführer`,
    `<div class="group">${list.map(x => `<div class="row ${x.you ? 'me' : ''}"><span class="rank">${x.rank}</span><span class="grow"><span class="row-label">${esc(x.name)}${x.you ? ' · du' : ''}</span>
      <div class="bar"><i style="width:${Math.max(1, x.mhl / max * 100)}%"></i></div></span><b>${f1.format(x.mhl)} Mio. hl</b></div>`).join('')}</div>
      <p class="sub pad">Gemessen am Jahresausstoß. Alle Konkurrenten sind erfunden und wachsen mit.</p>`);
}

function eventsView(rep) {
  const logs = s.log.slice(-60).reverse();
  return panel('📰', 'Weltlage & Tagebuch', rep.mods.length ? `${rep.mods.length} aktive Ereignisse` : 'Ruhige Zeiten',
    (rep.mods.length ? group('Gerade aktiv', rep.mods.map(m => `<div class="row sub">${esc(m)}</div>`).join('')) : '') +
    group('Tagebuch', logs.map(l => `<div class="row log ${l.kind}"><span class="sub">${esc(g.dayLabel(l.day))}</span><span class="grow">${esc(l.text.split('\n')[0])}</span></div>`).join('')));
}

const TABS = [['map', '🌍 Karte'], ['breweries', '🏭 Brauereien'], ['finance', '💶 Finanzen'], ['rank', '🏆 Rangliste'], ['events', '📰 Lage']];
function render() {
  const rep = E.empireReport(s);
  const chip = (icon, label, value, title = '') => `<div class="chip-stat" title="${esc(title)}"><span>${icon}</span><b>${value}</b><small>${label}</small></div>`;
  $('eName').textContent = s.empire.name;
  $('eSub').textContent = `Jahr ${rep.year}${rep.years ? ' von ' + rep.years : ''} · ${rep.hq.name}${s.legacy ? ' · ' + ({ handwerk: 'Handwerk', industrie: 'Industrie', genossenschaft: 'Genossenschaft', uebernahme: 'Übernahme' }[s.legacy.ending]) : ''}`;
  $('eStats').innerHTML = [
    chip('💶', 'Kapital', fmt(rep.cash), 'Verfügbares Geld'),
    chip('🏦', `Schulden · ${rep.rating}`, fmt(rep.debt), `Rating ${rep.rating}, Zins ${rep.interestPct} %`),
    chip('📊', 'EBITDA/Jahr', fmt(rep.ebitdaYear), 'Betriebsgewinn nach Zentrale-Kosten'),
    chip('🍺', 'Ausstoß', `${f1.format(rep.volMhl)} Mio. hl`),
    chip('🏆', 'Weltrang', `${rep.rank}.`, 'Platz in der Weltrangliste'),
    chip('⭐', 'Punkte', f0.format(rep.score)),
  ].join('');
  $('eTabs').innerHTML = TABS.map(([id, label]) => `<button class="tab ${tab === id ? 'on' : ''}" data-tab="${id}">${label}</button>`).join('');
  $('eBody').innerHTML = ({ map: mapView, breweries: breweriesView, finance: financeView, rank: rankView, events: eventsView }[tab])(rep);
  const m = $('gModal');
  if (overlay === 'over' && s.gameOver) {
    const o = s.gameOver;
    m.hidden = false;
    $('gModalBox').innerHTML = `<div class="unlock-big">${o.reason === 'insolvenz' ? '📉' : '🏆'}</div><h2 class="modal-title center">${o.reason === 'insolvenz' ? 'Insolvenz' : o.reason === 'weltmarktfuehrer' ? 'Weltmarktführer!' : 'Spielende'}</h2>
      <p class="modal-text center">${esc(s.log.at(-1).text.split('\n')[0])}</p>
      <div class="taste-grid"><div><small>Punkte</small><b>${f0.format(o.score)}</b></div><div><small>Titel</small><b>${esc(o.rank)}</b></div><div><small>Weltrang</small><b>${o.place}.</b></div></div>
      <div class="btn-row center"><button class="btn" data-eclose>Weiter ansehen</button><button class="btn primary" data-eexit>Zum Hauptmenü</button></div>`;
  } else if (overlay === 'intro') {
    m.hidden = false;
    $('gModalBox').innerHTML = `<div class="unlock-big">🌍</div><h2 class="modal-title center">Willkommen im Konzern</h2>
      <p class="modal-text center">${esc(s.log[0].text.replace(/\n/g, ' '))}</p>
      <ul class="intro-list"><li>🌍 Eröffne <b>Büros</b> in neuen Ländern, dann kannst du <b>Brauereien kaufen</b> oder neu bauen.</li><li>🏦 Kredite beschleunigen – aber Schulden verteuern Zinsen.</li><li>⏩ Spule oben <b>Monate</b> vor und beobachte Markt, Ereignisse und Rangliste.</li></ul>
      <button class="btn primary big wide" data-eclose>Los geht's</button>`;
  } else m.hidden = true;
}

export function initEmpireUi() {
  $('eBack').addEventListener('click', () => { save(); onExit(); });
  $('eWait').addEventListener('click', e => { const b = e.target.closest('[data-months]'); if (b) advance(+b.dataset.months); });
  $('eTabs').addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) { tab = b.dataset.tab; render(); $('eBody').scrollTop = 0; } });
  const body = $('eBody');
  const pick = id => { sel = id; render(); };
  body.addEventListener('click', e => {
    const c = e.target.closest('[data-country]'); if (c) { pick(c.dataset.country); return; }
    const b = e.target.closest('[data-act]'); if (!b || b.disabled || b.tagName === 'SELECT') return;
    const d = b.dataset;
    switch (d.act) {
      case 'office': act(() => E.enterCountry(s, d.c)); break;
      case 'mkt': act(() => E.setMarketing(s, d.c, +d.l)); break;
      case 'buy': { const t = E.targetOf(d.t); if (confirm(`${t.name} für ${fmt(E.targetPrice(s, t))} übernehmen?`)) act(() => E.acquireBrewery(s, d.t)); break; }
      case 'build': act(() => E.buildBrewery(s, d.c, forms.build.cap, forms.build.style)); break;
      case 'up': act(() => E.upgradeBrewery(s, +d.b, d.w)); break;
      case 'sell': if (confirm('Diese Brauerei wirklich verkaufen?')) act(() => E.sellBrewery(s, +d.b)); break;
      case 'loan': act(() => E.takeLoan(s, Math.round(forms.loan))); break;
      case 'repay': act(() => E.repayLoan(s, Math.round(forms.loan))); break;
      case 'hq': act(() => E.upgradeHq(s)); break;
      case 'brand': act(() => E.launchBrand(s, forms.brand)); break;
    }
  });
  body.addEventListener('keydown', e => { const c = e.target.closest?.('[data-country]'); if (c && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sel = c.dataset.country; render(); } });
  body.addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'bCap') { forms.build.cap = Math.max(10, Math.min(5000, +t.value || 100)); render(); }
    else if (t.id === 'bStyle') forms.build.style = t.value;
    else if (t.id === 'loanAmt') { forms.loan = Math.max(100000, +t.value || 0); }
    else if (t.id === 'brandStyle') forms.brand = t.value;
    else if (t.dataset.act === 'focus') act(() => E.setFocus(s, +t.dataset.b, t.value));
  });
  $('gModal').addEventListener('click', e => {
    if (!$('empireView') || $('empireView').hidden) return;
    if (e.target.closest('[data-eclose]')) { overlay = null; render(); }
    if (e.target.closest('[data-eexit]')) { overlay = null; save(); onExit(); }
  });
}
export function showIntro() { overlay = 'intro'; render(); }
