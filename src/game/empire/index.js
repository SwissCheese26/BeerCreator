// Braukonzern-Modus: vom Regionalbrauer zur Weltgruppe. Monatliche Simulation mit Ausland, Zukäufen, Finanzen und Weltrangliste.
import { STYLES, byId } from '../../core/data.js';
import { START_DAY } from '../config.js';
import { rand, log, need, clamp, round2 } from '../state.js';
import { COUNTRIES, HOME, TARGETS, HQ_LEVELS, RIVALS, EVENTS, countryOf, targetOf } from './data.js';
export * from './data.js';

export const MARKETING = [{ name: 'aus', pct: 0 }, { name: 'lokal', pct: 0.02 }, { name: 'regional', pct: 0.05 }, { name: 'Kampagne', pct: 0.09 }];
const BASE_VAR = 48;      // € Herstellkosten je hl (vor Länderfaktor)
const FIXED_PER_HL = 9;   // € Fixkosten je hl Kapazität und Jahr
const DEPR_PER_HL = 6;    // € Abschreibung je hl Kapazität und Jahr
const MAX_UTIL = 0.95;
export const RATINGS = [[1.5, 'AA', 0], [3, 'A', 0.015], [4.5, 'BBB', 0.03], [6, 'BB', 0.05], [Infinity, 'B', 0.08]];
export const MAX_QUALITY = 95;

const month = s => s.empire.month;
const activeMods = s => s.empire.mods.filter(m => m.until >= month(s));
const modProd = (s, key, country) => activeMods(s).filter(m => !m.country || m.country === country).reduce((a, m) => a * (m[key] ?? 1), 1);

export function initEmpire(s, { years = 30, name = 'Heinrichs Brau-Gruppe' } = {}) {
  s.license = true; s.stage = 'konzern';
  s.cash = Math.round(5000000 * ({ entspannt: 1.4, normal: 1, hardcore: 0.7 }[s.difficulty] || 1));
  s.empire = {
    name, years, month: 0, hqLevel: 1, debt: 0, nextId: 1, negMonths: 0, brands: [], mods: [], acquired: [],
    offices: { [HOME]: { marketing: 1, since: 0 } },
    mkt: Object.fromEntries(COUNTRIES.map(c => [c.id, c.marketKhl])),
    rivals: RIVALS.map(r => ({ ...r })),
    breweries: [], history: [], last: { revenue: 0, ebitda: 0, vol: 0 },
  };
  s.empire.breweries.push({ id: s.empire.nextId++, country: HOME, name: 'Heinrichs Hausbrauerei', capKhl: 200, tech: 2, quality: 58, brand: 34, style: 'helles',
    status: 'betrieb', readyMonth: 0, integration: 0 });
  log(s, `Braukonzern-Modus: Aus Opas Garage ist die „${name}“ geworden – eine Regionalbrauerei (200.000 hl) und ${(s.cash / 1e6).toFixed(1)} Mio. € Kapital. ` +
    `Baue sie in ${years} Jahren zur Weltgruppe aus: neue Länder, Zukäufe, Neubauten, Marken – und behalte die Schulden im Blick.`, 'story');
}

// ---------- Modell ----------
export const effectiveBrand = (s, b) => {
  const c = countryOf(b.country);
  const global = s.empire.brands.filter(x => (c.styles[x.style] ?? 0.4) >= 0.5);
  const g = global.length ? global.reduce((a, x) => a + x.power, 0) / global.length : 0;
  return b.brand * (global.length ? 0.6 : 1) + g * (global.length ? 0.4 : 0);
};

/** Monatskennzahlen einer Brauerei (auch für Zielbrauereien zur Preisfindung nutzbar). */
export function figures(s, b, opts = {}) {
  const c = countryOf(b.country), e = s.empire;
  const mktLevel = opts.marketing ?? e.offices[b.country]?.marketing ?? 0;
  const fit = c.styles[b.style] ?? 0.4;
  const share = clamp(0.0009 * Math.sqrt(b.capKhl) * (b.quality / 60) ** 2 * (0.6 + effectiveBrand(s, b) / 100) * fit * (1 + 0.25 * mktLevel) / (0.4 + c.comp), 0, 0.3);
  const demand = e.mkt[b.country] * share * modProd(s, 'demand', b.country);
  const operating = b.status === 'betrieb';
  const volKhl = operating ? Math.min(b.capKhl * MAX_UTIL / 12, demand / 12) : 0;
  const price = c.price * modProd(s, 'price', b.country) * (0.7 + b.quality / 150) * (0.9 + effectiveBrand(s, b) / 500);
  const revenue = volKhl * 1000 * price;
  const integ = b.integration > 0 ? 1.05 : b.targetId ? 0.97 : 1; // Integration kostet, danach Synergien
  const unit = BASE_VAR * c.cost * modProd(s, 'cost', b.country) * (1.25 - 0.07 * b.tech) * (1 - 0.02 * (e.hqLevel - 1)) * (1 - 0.01 * Math.min(15, e.breweries.length - 1)) * integ; // Einkaufsmacht: Größe lohnt
  const varCost = volKhl * 1000 * unit;
  const fixed = b.capKhl * 1000 * FIXED_PER_HL * c.cost / 12;
  const marketing = revenue * MARKETING[mktLevel].pct;
  const excise = revenue * c.excise / 100;
  const ebitda = revenue - varCost - fixed - marketing - excise;
  return { volKhl, share: operating ? Math.min(share, volKhl * 12 / Math.max(1, e.mkt[b.country])) : 0, revenue, varCost, fixed, marketing, excise, ebitda, price, demandKhl: demand };
}

/** Kennzahlen des gesamten Konzerns (Monat). */
export function groupFigures(s) {
  const e = s.empire;
  const per = e.breweries.map(b => ({ b, f: figures(s, b) }));
  const revenue = per.reduce((a, x) => a + x.f.revenue, 0), ebitda = per.reduce((a, x) => a + x.f.ebitda, 0), volKhl = per.reduce((a, x) => a + x.f.volKhl, 0);
  const countries = Object.keys(e.offices);
  const hq = revenue * 0.012 + HQ_LEVELS[e.hqLevel - 1].monthly + 10000 * Math.max(0, countries.length - 1);
  const byCountry = {};
  for (const { b, f } of per) {
    const c = countryOf(b.country), x = (byCountry[b.country] ||= { ebitda: 0, cap: 0, vol: 0 });
    x.ebitda += f.ebitda; x.cap += b.capKhl; x.vol += f.volKhl;
  }
  let tax = 0;
  for (const [id, x] of Object.entries(byCountry)) tax += Math.max(0, x.ebitda - x.cap * 1000 * DEPR_PER_HL / 12) * countryOf(id).tax / 100;
  const annualEbitda = (e.last.ebitda || ebitda - hq) * 12;
  const netDebt = e.debt - s.cash;
  const lev = annualEbitda > 0 ? netDebt / annualEbitda : (netDebt > 0 ? 99 : 0);
  const [, rating, spread] = RATINGS.find(r => lev <= r[0]);
  const interest = e.debt * (0.03 + spread) / 12;
  return { per, revenue, ebitda, volKhl, hq, tax, interest, cashflow: ebitda - hq - tax - interest, annualEbitda, netDebt, leverage: lev, rating, spread,
    maxDebt: Math.max(3000000, annualEbitda * 6), byCountry };
}

export function valuation(s) {
  const g = groupFigures(s), e = s.empire;
  const growth = e.breweries.length ? e.breweries.reduce((a, b) => a + countryOf(b.country).growth * b.capKhl, 0) / e.breweries.reduce((a, b) => a + b.capKhl, 0) : 0;
  const risk = e.breweries.length ? e.breweries.reduce((a, b) => a + countryOf(b.country).risk * b.capKhl, 0) / e.breweries.reduce((a, b) => a + b.capKhl, 0) : 0;
  const mult = clamp(9 + growth * 0.3 - risk * 3 + (g.rating === 'AA' ? 1 : g.rating === 'B' ? -1.5 : 0), 6, 14);
  const ev = Math.max(0, g.annualEbitda) * mult;
  return { multiple: round2(mult), ev, equity: ev - e.debt + s.cash };
}

export function ranking(s) {
  const e = s.empire, mine = groupFigures(s).volKhl * 12 / 1000;
  const list = [...e.rivals.map(r => ({ name: r.name, mhl: r.mhl, you: false })), { name: e.name, mhl: mine, you: true }].sort((a, b) => b.mhl - a.mhl);
  return list.map((x, i) => ({ ...x, rank: i + 1, mhl: round2(x.mhl) }));
}
export const rankOf = s => ranking(s).find(x => x.you).rank;

export function scoreOf(s) {
  const v = valuation(s), r = rankOf(s), vol = groupFigures(s).volKhl * 12 / 1000;
  return Math.round(Math.max(0, v.equity) / 1e6 + (RIVALS.length + 1 - r) * 400 + vol * 25);
}
export const TITLES = [[0, 'Brauereibesitzer'], [1500, 'Regionalbrauer'], [5000, 'Brauunternehmer'], [12000, 'Konzernchef'], [25000, 'Brauerei-Magnat'], [40000, 'Biertitan']];
export const titleOf = score => [...TITLES].reverse().find(([m]) => score >= m)[1];

// ---------- Aktionen ----------
const own = (s, id) => { const b = s.empire.breweries.find(x => x.id === id); need(b, 'Diese Brauerei gehört nicht zu deinem Konzern.'); return b; };
const money = (s, amount, what) => { need(s.cash >= amount - 1e-6, `Zu wenig Kapital für ${what}: ${fmt(amount)} nötig, ${fmt(s.cash)} vorhanden.`); s.cash = round2(s.cash - amount); };
export const fmt = x => Math.abs(x) >= 1e9 ? `${(x / 1e9).toFixed(2)} Mrd. €` : Math.abs(x) >= 1e6 ? `${(x / 1e6).toFixed(1)} Mio. €` : `${Math.round(x / 1000)} Tsd. €`;
const hq = s => HQ_LEVELS[s.empire.hqLevel - 1];

export function enterCountry(s, id) {
  const c = countryOf(id), e = s.empire;
  need(c, 'Unbekanntes Land.'); need(!e.offices[id], `In ${c.name} hast du schon ein Büro.`);
  need(Object.keys(e.offices).length < hq(s).maxCountries, `Deine Zentrale („${hq(s).name}“) betreut höchstens ${hq(s).maxCountries} Länder. Baue die Zentrale aus.`);
  money(s, c.entry, `das Büro in ${c.name}`);
  e.offices[id] = { marketing: 1, since: month(s) };
  log(s, `${c.flag} Neues Büro in ${c.name} (${fmt(c.entry)}). Jetzt kannst du dort bauen oder Brauereien übernehmen.`, 'good');
}

const ownedShareKhl = (s, country, extra = 0) => s.empire.breweries.filter(b => b.country === country).reduce((a, b) => a + figures(s, b).volKhl * 12, 0) + extra;

export function targetPrice(s, t) {
  const c = countryOf(t.country);
  const f = figures(s, { ...t, status: 'betrieb', integration: 0 }, { marketing: 1 });
  const annual = f.ebitda * 12;
  const mult = clamp(5 + c.open * 2.5 - c.risk * 3 + c.growth * 0.25, 4, 10);
  return Math.round(Math.max(annual * mult, t.capKhl * 1000 * 30) * 1.05 * (1 + (1 - c.open) * 0.5));
}
export function listTargets(s, countryId) {
  return TARGETS.filter(t => t.country === countryId).map(t => {
    const f = figures(s, { ...t, status: 'betrieb', integration: 0 }, { marketing: 1 });
    const after = (ownedShareKhl(s, t.country, f.volKhl * 12)) / s.empire.mkt[t.country];
    return { ...t, sold: s.empire.acquired.includes(t.id), price: targetPrice(s, t), ebitda: Math.round(f.ebitda * 12), volKhl: Math.round(f.volKhl * 12), antitrust: after > 0.35, shareAfter: round2(after) };
  });
}

export function acquireBrewery(s, targetId) {
  const e = s.empire, t = targetOf(targetId), c = t && countryOf(t.country);
  need(t, 'Unbekannte Brauerei.'); need(!e.acquired.includes(t.id), `${t.name} gehört schon dir.`);
  need(e.offices[t.country], `Du brauchst erst ein Büro in ${c.name}.`);
  need(e.breweries.length < hq(s).maxBreweries, `Deine Zentrale verwaltet höchstens ${hq(s).maxBreweries} Brauereien. Baue die Zentrale aus.`);
  const f = figures(s, { ...t, status: 'betrieb', integration: 0 }, { marketing: 1 });
  need(ownedShareKhl(s, t.country, f.volKhl * 12) / e.mkt[t.country] <= 0.35, `Das Kartellamt in ${c.name} untersagt die Übernahme: Du würdest über 35 % des Marktes kontrollieren.`);
  const price = targetPrice(s, t);
  money(s, price, `die Übernahme von ${t.name}`);
  e.acquired.push(t.id);
  e.breweries.push({ id: e.nextId++, country: t.country, name: t.name, targetId: t.id, capKhl: t.capKhl, tech: t.tech, quality: t.quality, brand: t.brand, style: t.style,
    status: 'betrieb', readyMonth: 0, integration: 6 });
  log(s, `🤝 ${t.name} (${c.flag} ${c.name}) übernommen für ${fmt(price)}. Sechs Monate Integration: höhere Kosten, danach Synergien.`, 'good');
}

export function buildBrewery(s, countryId, capKhl, styleId) {
  const e = s.empire, c = countryOf(countryId);
  need(c && e.offices[countryId], `Du brauchst erst ein Büro in ${c?.name || 'diesem Land'}.`);
  need(byId(STYLES, styleId), 'Unbekannter Bierstil.');
  need(capKhl >= 10 && capKhl <= 5000, 'Kapazität: 10 bis 5000 Tausend hl.');
  need(e.breweries.length < hq(s).maxBreweries, `Deine Zentrale verwaltet höchstens ${hq(s).maxBreweries} Brauereien. Baue die Zentrale aus.`);
  const cost = buildCost(countryId, capKhl);
  money(s, cost, `den Neubau in ${c.name}`);
  const months = buildMonths(capKhl);
  const nth = e.breweries.filter(b => b.country === countryId).length + 1;
  e.breweries.push({ id: e.nextId++, country: countryId, name: `${e.name} ${c.name} ${nth}`, capKhl, tech: 3, quality: 58, brand: 22, style: styleId, status: 'bau', readyMonth: month(s) + months, integration: 0 });
  log(s, `🏗️ Neubau in ${c.name}: ${capKhl} Tsd. hl, ${fmt(cost)}, fertig in ${months} Monaten.`, 'good');
}

export const buildCost = (countryId, capKhl) => Math.round(capKhl * 1000 * 95 * countryOf(countryId).cost);
export const buildMonths = capKhl => 6 + Math.min(12, Math.floor(capKhl / 100));
/** Kosten und Wirkung eines Ausbaus (für Anzeigen). */
export function upgradeCost(b, what) {
  const c = countryOf(b.country);
  if (what === 'kapazitaet') { const add = Math.max(10, Math.round(b.capKhl * 0.25 / 5) * 5); return { cost: Math.round(add * 1000 * 85 * c.cost), add }; }
  if (what === 'technik') return { cost: b.tech >= 5 ? null : Math.round(b.capKhl * 1000 * 8 * b.tech * c.cost) };
  if (what === 'qualitaet') return { cost: b.quality >= MAX_QUALITY ? null : Math.round(b.capKhl * 1000 * (3 + b.quality / 10) * c.cost) };
  return { cost: null };
}

export function upgradeBrewery(s, id, what) {
  const b = own(s, id), c = countryOf(b.country);
  need(b.status === 'betrieb', 'Die Brauerei ist gerade nicht im Betrieb.');
  if (what === 'kapazitaet') {
    const { add, cost } = upgradeCost(b, what);
    money(s, cost, 'den Kapazitätsausbau'); b.capKhl += add; log(s, `${b.name}: +${add} Tsd. hl Kapazität (${fmt(cost)}).`, 'good');
  } else if (what === 'technik') {
    need(b.tech < 5, 'Höchste Technikstufe erreicht.');
    const { cost } = upgradeCost(b, what);
    money(s, cost, 'die Modernisierung'); b.tech++; b.quality = Math.min(MAX_QUALITY, b.quality + 3); log(s, `${b.name}: Technikstufe ${b.tech} (${fmt(cost)}). Geringere Kosten, bessere Qualität.`, 'good');
  } else if (what === 'qualitaet') {
    need(b.quality < MAX_QUALITY, 'Mehr Qualität geht nicht.');
    const { cost } = upgradeCost(b, what);
    money(s, cost, 'das Qualitätsprogramm'); b.quality = Math.min(MAX_QUALITY, b.quality + 4); log(s, `${b.name}: Qualität auf ${b.quality} (${fmt(cost)}).`, 'good');
  } else need(false, 'Ausbau: kapazitaet | technik | qualitaet');
}

export function setFocus(s, id, styleId) {
  const b = own(s, id); need(byId(STYLES, styleId), 'Unbekannter Bierstil.');
  b.style = styleId; b.integration = Math.max(b.integration, 2); log(s, `${b.name} braut jetzt vor allem ${byId(STYLES, styleId).name}. Zwei Monate Umstellung.`);
}
export function setMarketing(s, countryId, level) {
  need(s.empire.offices[countryId], 'Dort hast du kein Büro.'); need([0, 1, 2, 3].includes(level), 'Stufen 0–3.');
  s.empire.offices[countryId].marketing = level; log(s, `Marketing in ${countryOf(countryId).name}: ${MARKETING[level].name} (${MARKETING[level].pct * 100} % vom Erlös).`);
}
export function launchBrand(s, styleId, name) {
  const e = s.empire; need(byId(STYLES, styleId), 'Unbekannter Bierstil.'); need(e.brands.length < 5, 'Mehr als fünf Konzernmarken sind zu viel.');
  const cost = 3000000 * (1 + e.brands.length) * (1 + e.hqLevel * 0.4);
  money(s, cost, 'die neue Marke');
  e.brands.push({ id: e.nextId++, style: styleId, name: name || `${e.name.split(' ')[0]} ${byId(STYLES, styleId).name}`, power: 20 });
  log(s, `✨ Neue Konzernmarke „${e.brands.at(-1).name}“ (${fmt(cost)}). Sie wächst, solange du in den Märkten Marketing machst.`, 'good');
}
export function sellBrewery(s, id) {
  const e = s.empire, b = own(s, id); need(e.breweries.length > 1, 'Die letzte Brauerei kannst du nicht verkaufen.');
  const f = figures(s, b), price = Math.round(Math.max(f.ebitda * 12 * 6.5, b.capKhl * 1000 * 25));
  s.cash = round2(s.cash + price); e.breweries = e.breweries.filter(x => x.id !== id);
  log(s, `${b.name} verkauft für ${fmt(price)}.`);
}
export function upgradeHq(s) {
  const e = s.empire, next = HQ_LEVELS[e.hqLevel]; need(next, 'Die Zentrale ist schon der Weltkonzern.');
  money(s, next.cost, `die Zentrale „${next.name}“`); e.hqLevel++;
  log(s, `🏢 Zentrale ausgebaut: „${next.name}“ – bis zu ${next.maxBreweries} Brauereien in ${next.maxCountries} Ländern (laufend ${fmt(next.monthly)} im Monat).`, 'good');
}
export function takeLoan(s, amount) {
  const g = groupFigures(s), e = s.empire; need(amount > 0, 'Betrag fehlt.');
  need(e.debt + amount <= g.maxDebt + 1e-6, `Die Banken geben dir höchstens ${fmt(g.maxDebt)} Schulden (6× Jahres-EBITDA). Bisher ${fmt(e.debt)}.`);
  e.debt = round2(e.debt + amount); s.cash = round2(s.cash + amount);
  log(s, `Kredit über ${fmt(amount)} aufgenommen. Zinsen: ${((0.03 + g.spread) * 100).toFixed(1)} % (Rating ${g.rating}).`);
}
export function repayLoan(s, amount) {
  const e = s.empire; amount = Math.min(amount, e.debt); need(amount > 0, 'Keine Schulden zu tilgen.');
  money(s, amount, 'die Tilgung'); e.debt = round2(e.debt - amount); log(s, `${fmt(amount)} Schulden getilgt.`);
}

// ---------- Monatslauf ----------
function rollEvent(s) {
  const e = s.empire;
  if (rand(s) > 0.3) return;
  const pool = EVENTS.filter(x => !x.rare || rand(s) < 0.25);
  const ev = pool[Math.floor(rand(s) * pool.length)];
  let country, label = ev.label;
  if (ev.scope === 'land') {
    const ids = Object.keys(e.offices); country = ids[Math.floor(rand(s) * ids.length)];
    label = label.replace('{land}', countryOf(country).name);
  }
  e.mods.push({ id: ev.id, label, country, until: month(s) + ev.months, ...(ev.demand && { demand: ev.demand }), ...(ev.price && { price: ev.price }), ...(ev.cost && { cost: ev.cost }) });
  if (!country) e.mods[e.mods.length - 1].country = undefined;
  log(s, `📰 ${label}`, ev.demand < 1 || ev.cost > 1 || ev.price < 1 ? 'bad' : 'story');
}

function gameOver(s, reason, text) {
  const score = scoreOf(s);
  s.gameOver = { reason, score, rank: titleOf(score), place: rankOf(s), month: month(s) };
  log(s, `${text}\nPunktzahl ${score} – ${titleOf(score)}, Platz ${rankOf(s)} der Welt.`, 'story');
}

export function empireTick(s) {
  const e = s.empire;
  if (!e || s.gameOver || s.day <= START_DAY || (s.day - START_DAY) % 30 !== 0) return;
  e.month++;
  const g = groupFigures(s);
  s.cash = round2(s.cash + g.cashflow);
  e.last = { revenue: g.revenue, ebitda: g.ebitda - g.hq, vol: g.volKhl };
  e.history.push({ month: e.month, revenue: Math.round(g.revenue), ebitda: Math.round(g.ebitda - g.hq), volMhl: round2(g.volKhl * 12 / 1000), cash: Math.round(s.cash), debt: Math.round(e.debt) });
  if (e.history.length > 400) e.history.shift();
  if (e.month % 12 === 0) log(s, `📊 Jahr ${e.month / 12}: Umsatz ${fmt(g.revenue * 12)}, EBITDA ${fmt((g.ebitda - g.hq) * 12)}, ${round2(g.volKhl * 12 / 1000)} Mio. hl, Rating ${g.rating}, Platz ${rankOf(s)}.`, 'story');
  for (const b of e.breweries) { // Wachstum von Marke, Integration, Bau
    const lvl = e.offices[b.country]?.marketing ?? 0;
    b.brand = clamp(b.brand + lvl * 0.15 - (lvl === 0 ? 0.08 : 0), 15, 90);
    if (b.integration > 0) { b.integration--; if (b.integration === 0 && b.targetId) { b.tech = Math.min(5, b.tech); b.quality = Math.min(MAX_QUALITY, b.quality + 1); } }
    if (b.status === 'bau' && b.readyMonth <= e.month) { b.status = 'betrieb'; log(s, `🏭 ${b.name} ist fertig und produziert.`, 'good'); }
    if (b.status === 'ausfall' && b.readyMonth <= e.month) { b.status = 'betrieb'; log(s, `${b.name} läuft wieder.`, 'good'); }
  }
  for (const br of e.brands) br.power = clamp(br.power + 0.35 * Math.min(3, Object.values(e.offices).filter(o => o.marketing > 0).length / 3), 0, 90);
  for (const id of Object.keys(e.mkt)) e.mkt[id] *= Math.pow(1 + countryOf(id).growth / 100, 1 / 12);
  for (const r of e.rivals) r.mhl *= 1 + (r.growth / 100) / 12 * (0.7 + rand(s) * 0.6);
  // Zufälle
  rollEvent(s);
  for (const b of e.breweries) {
    const c = countryOf(b.country);
    if (b.status === 'betrieb' && rand(s) < 0.004) { b.status = 'ausfall'; b.readyMonth = e.month + 2; log(s, `🔥 Schaden in ${b.name}: Zwei Monate Produktionsausfall.`, 'bad'); }
    else if (rand(s) < 0.004 + c.risk * 0.004) { b.quality = Math.max(30, b.quality - 8); b.brand = Math.max(15, b.brand - 10); log(s, `Skandal bei ${b.name}: Qualität −8, Marke −10.`, 'bad'); }
    else if (rand(s) < 0.003) { b.brand = Math.min(90, b.brand + 8); log(s, `🏅 ${b.name} gewinnt einen internationalen Preis: Marke +8.`, 'good'); }
  }
  e.mods = e.mods.filter(m => m.until >= e.month);
  // Ende
  s.cash < 0 ? e.negMonths++ : (e.negMonths = 0);
  if (e.negMonths >= 3) return gameOver(s, 'insolvenz', 'INSOLVENZ: Drei Monate ohne Liquidität – die Gläubiger übernehmen den Konzern.');
  if (rankOf(s) === 1 && e.month > 24) return gameOver(s, 'weltmarktfuehrer', 'WELTMARKTFÜHRER! Kein Konzern der Welt braut mehr Bier als deiner.');
  if (e.years && e.month >= e.years * 12) return gameOver(s, 'zeit', `Nach ${e.years} Jahren endet deine Zeit an der Spitze.`);
}

/** Übersicht für Anzeigen. */
export function empireReport(s) {
  const e = s.empire, g = groupFigures(s), v = valuation(s);
  return {
    name: e.name, month: e.month, year: Math.floor(e.month / 12) + 1, years: e.years, cash: s.cash, debt: e.debt, netDebt: g.netDebt, leverage: round2(g.leverage), rating: g.rating,
    interestPct: round2((0.03 + g.spread) * 100), maxDebt: g.maxDebt, revenueYear: g.revenue * 12, ebitdaYear: (g.ebitda - g.hq) * 12, volMhl: round2(g.volKhl * 12 / 1000),
    equity: v.equity, multiple: v.multiple, rank: rankOf(s), score: scoreOf(s), hq: hq(s), nextHq: HQ_LEVELS[e.hqLevel] ?? null,
    countries: Object.entries(e.offices).map(([id, o]) => ({ id, name: countryOf(id).name, marketing: o.marketing, brewer: e.breweries.filter(b => b.country === id).length,
      share: round2((g.byCountry[id]?.vol ?? 0) * 12 / e.mkt[id] * 100) })),
    breweries: g.per.map(({ b, f }) => ({ id: b.id, name: b.name, country: b.country, status: b.status, capKhl: b.capKhl, tech: b.tech, quality: b.quality, brand: Math.round(b.brand), style: b.style,
      volKhlYear: Math.round(f.volKhl * 12), ebitdaYear: Math.round(f.ebitda * 12), integration: b.integration, readyMonth: b.readyMonth })),
    brands: e.brands, mods: activeMods(s).map(m => m.label),
  };
}
