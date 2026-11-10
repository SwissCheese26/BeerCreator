// Schritt 4: Standort, Technik, Präsentation (Flaschen, Gläser, Marke), Lohnbrauen und Brauerei-Übernahmen.
// Alles hier wirkt über kleine Faktoren auf Preis, Nachfrage, Kosten und Qualität.
import { STYLES, byId } from '../core/data.js';
import { BUNT_STYLES, ENERGY_PER_L, PACKAGING_PER_L } from './config.js';
import { need, log, rand, round2, clamp, spend, hasFeature } from './state.js';
import { COMPETITORS } from './league.js';
import { levelOf } from './progress.js';

// ---------- Standort ----------
export const LOCATIONS = {
  kesselbach: { name: 'Kesselbach', icon: '🌾', kind: 'Dorf in Franken',
    text: 'Bierland mit Tradition: viele Nachbarn kaufen ab Hof, Malz kommt aus der Mälzerei nebenan. Bunte Experimente kommen schlechter an.',
    demand: { hof: 1.25, gastro: 1, festival: 1, online: 1 }, price: 1, malt: 0.9, rent: 1,
    likes: ['helles', 'maerzen', 'dunkel', 'rauch', 'bock', 'pils', 'dunkelweizen'], buntMul: 0.9 },
  nordhafen: { name: 'Nordhafen', icon: '⚓', kind: 'Großstadt am Meer',
    text: 'Viele Kneipen und Bars, Craft-Szene, gute Preise – aber kaum Nachbarn für den Hofverkauf und teure Miete.',
    demand: { hof: 0.6, gastro: 1.5, festival: 1.2, online: 1.2 }, price: 1.12, malt: 1, rent: 1.6,
    likes: ['ipa', 'neipa', 'pale', 'stout', 'porter', 'saison', 'imperial'], buntMul: 1.05 },
  gipfelbrunn: { name: 'Gipfelbrunn', icon: '🏔️', kind: 'Ferienort in den Bergen',
    text: 'Touristen zahlen gut und lieben Feste. Weizen und Bock nach der Wanderung. Online ist man eher abgelegen.',
    demand: { hof: 1.1, gastro: 1.1, festival: 1.6, online: 0.85 }, price: 1.08, malt: 1.05, rent: 1.2,
    likes: ['weizen', 'helles', 'dunkelweizen', 'bock', 'doppelbock', 'maerzen'], buntMul: 1 },
  lindenberg: { name: 'Lindenberg', icon: '🎓', kind: 'Unistadt',
    text: 'Tausende Studierende: riesige Nachfrage, schmale Geldbeutel. Neues und Verrücktes wird gefeiert – eigene Stile werden schneller bekannt.',
    demand: { hof: 1.3, gastro: 1.3, festival: 1.3, online: 1 }, price: 0.88, malt: 1, rent: 0.9,
    likes: ['ipa', 'neipa', 'berliner', 'koelsch', 'witbier', 'pale'], buntMul: 1.08, fameMul: 1.5 },
};
export const locOf = s => LOCATIONS[s.location] || LOCATIONS.kesselbach;

// ---------- Technik ----------
export const TECH = {
  filter:    { name: 'Plattenfilter', icon: '🧻', cost: 600, level: 2,
    text: 'Filtriert Bier blank und haltbar. Pils, Kölsch & Co. werden klar, wie es sich gehört. Kostet 4 % Volumen.' },
  sensorik:  { name: 'Sensorik-Schulung', icon: '👃', cost: 900, level: 2,
    text: 'Du schmeckst Fehler früher und steuerst nach: Die Qualität schwankt nur noch halb so stark.' },
  hefelabor: { name: 'Hefe-Labor', icon: '🔬', cost: 1500, level: 3,
    text: 'Du führst deine Hefe selbst weiter: Hefekosten −70 % und immer die perfekte Anstellmenge.' },
  kryo:      { name: 'Kryo-Hopfen & Hopfenkanone', icon: '❄️', cost: 2200, level: 3,
    text: 'Hopfen-Konzentrat und Kalthopfen unter Druck: Pale Ale, IPA, NEIPA, Pils und Saison +3 Qualität.' },
  waerme:    { name: 'Wärmerückgewinnung', icon: '♻️', cost: 2500, level: 3,
    text: 'Die Abwärme der Würzekochung heizt das nächste Brauwasser: Energiekosten −40 %.' },
  abfueller: { name: 'Abfüllanlage mit CO₂-Vorspannung', icon: '🏭', cost: 3000, level: 4,
    text: 'Kaum Sauerstoff in der Flasche: +1 Qualität für jedes Bier, Verpackung −40 %.' },
  dosen:     { name: 'Dosenlinie', icon: '🥫', cost: 3500, level: 4,
    text: 'Bier in Dosen: lichtdicht, leicht, billig im Versand. Öffnet die Dose als Verpackung – der Onlineshop verkauft 15 % mehr.' },
  zentrifuge:{ name: 'Separator (Zentrifuge)', icon: '🌀', cost: 3800, level: 5, needs: 'filter',
    text: 'Klärt schonend und ohne Volumenverlust: filtrierte Biere +2 Qualität.' },
};
export const hasTech = (s, id) => s.mode === 'sandbox' || (s.tech || []).includes(id);
export function buyTech(s, id) {
  need(hasFeature(s, 'technik'), 'Die Technik-Abteilung ist noch gesperrt.');
  const t = TECH[id];
  need(t, 'Unbekannte Technik.');
  need(!hasTech(s, id), 'Hast du schon.');
  need(!t.needs || hasTech(s, t.needs), `Dafür brauchst du zuerst: ${TECH[t.needs]?.name}.`);
  if (s.mode === 'story') need(levelOf(s.skill.xp).lvl >= t.level, `Ab Level ${t.level}.`);
  spend(s, t.cost, t.name);
  (s.tech ||= []).push(id);
  log(s, `${t.icon} Neue Technik: ${t.name} (${t.cost} €). ${t.text}`, 'good');
}

/** Laufende Kosten eines Suds (Energie + Verpackung), mit Technik-Rabatten. */
export function runCostFor(s, liters) {
  const e = ENERGY_PER_L * (s && hasTech(s, 'waerme') ? 0.6 : 1);
  const p = PACKAGING_PER_L * (s && hasTech(s, 'abfueller') ? 0.6 : 1);
  return round2(liters * (e + p));
}

// Trüb oder filtriert?
export const FILTER_PREF = {
  pils: 'klar', koelsch: 'klar', alt: 'klar', schwarzbier: 'klar', tripel: 'klar', helles: 'klar', maerzen: 'klar',
  weizen: 'trueb', dunkelweizen: 'trueb', witbier: 'trueb', neipa: 'trueb', saison: 'trueb', berliner: 'trueb',
};
/** Qualitäts-Boni durch Technik und Klärung für ein Rezept (Liste für die Vorschau). */
export function techBonuses(s, r) {
  const out = [];
  const pref = FILTER_PREF[r.styleId];
  if (r.filter) {
    if (pref === 'klar') out.push({ label: 'Blank filtriert – wie es sich für den Stil gehört', pts: 3 });
    else if (pref === 'trueb') out.push({ label: `Filtriert, obwohl ${byId(STYLES, r.styleId).name} naturtrüb sein sollte`, pts: -4 });
    if (hasTech(s, 'zentrifuge')) out.push({ label: 'Separator: schonend geklärt', pts: 2 });
  } else if (pref === 'trueb') out.push({ label: 'Naturtrüb – genau richtig', pts: 1 });
  if (hasTech(s, 'kryo') && ['pale', 'ipa', 'neipa', 'pils', 'saison'].includes(r.styleId)) out.push({ label: 'Kryo-Hopfen', pts: 3 });
  if (hasTech(s, 'abfueller')) out.push({ label: 'Abfüllung mit CO₂-Vorspannung', pts: 1 });
  return out;
}
export const techQuality = (s, r) => techBonuses(s, r).reduce((a, b) => a + b.pts, 0);

// ---------- Präsentation: Flaschen, Gläser, Marke ----------
export const BOTTLES = {
  euro:       { name: 'Euroflasche 0,5 L', icon: '🍾', cost: 0, premium: 0,
    suits: ['pils', 'helles', 'maerzen', 'weizen', 'dunkel', 'schwarzbier', 'dunkelweizen', 'koelsch'],
    text: 'Die Mehrwegflasche, die jeder kennt. Günstig – aber eben Massenware.' },
  buegel:     { name: 'Bügelflasche 0,5 L', icon: '🫙', cost: 0.25, premium: 1,
    suits: ['helles', 'maerzen', 'dunkel', 'rauch', 'bock', 'pils', 'weizen'], text: 'Rustikal und wiederverschließbar – sieht nach Handwerk aus.' },
  steinie:    { name: 'Steinie 0,33 L', icon: '🟤', cost: 0.15, premium: 1,
    suits: ['rauch', 'bock', 'doppelbock', 'alt', 'koelsch', 'schwarzbier', 'porter'], text: 'Kurz und bauchig – der Klassiker für Spezialitäten.' },
  longneck:   { name: 'Longneck 0,33 L', icon: '🍺', cost: 0.15, premium: 1,
    suits: ['pale', 'ipa', 'neipa', 'saison', 'stout', 'berliner', 'witbier', 'porter'], text: 'Schlank und modern: die Craft-Flasche.' },
  champagner: { name: 'Belgische 0,75-L-Flasche mit Korken', icon: '🥂', cost: 0.9, premium: 3,
    suits: ['tripel', 'dubbel', 'saison', 'imperial', 'berliner'], text: 'Korken, Drahtkorb, schweres Glas – so verpackt man Kostbarkeiten.' },
  dose:       { name: 'Dose 0,44 L', icon: '🥫', cost: 0.05, premium: 0, tech: 'dosen',
    suits: ['ipa', 'neipa', 'pale', 'pils', 'helles', 'berliner'], text: 'Lichtdicht, leicht, gut für den Versand. Craft-Fans lieben sie.' },
  designer:   { name: 'Eigene Designerflasche', icon: '💎', cost: 0.5, premium: 2, order: 'flasche', suits: 'alle',
    text: 'Deine eigene Flaschenform, in der Glashütte gefertigt. Jeder erkennt sie im Regal.' },
};
export const GLASSES = {
  willi:  { name: 'Willibecher', icon: '🍺', suits: ['helles', 'dunkel', 'maerzen', 'rauch', 'schwarzbier'] },
  pokal:  { name: 'Pilstulpe', icon: '🍷', suits: ['pils'] },
  weizen: { name: 'Weizenglas', icon: '🥛', suits: ['weizen', 'dunkelweizen', 'witbier'] },
  stange: { name: 'Stange', icon: '🥃', suits: ['koelsch', 'alt', 'berliner'] },
  kelch:  { name: 'Belgischer Kelch', icon: '🏆', suits: ['dubbel', 'tripel', 'imperial', 'doppelbock', 'bock'] },
  teku:   { name: 'Teku-Verkostungsglas', icon: '🔮', suits: ['ipa', 'neipa', 'pale', 'saison', 'stout', 'porter'] },
  krug:   { name: 'Steinkrug', icon: '🫖', suits: ['maerzen', 'helles', 'dunkel', 'bock'] },
};
export const ORDERS = {
  logoglas: { name: 'Gläser mit deinem Logo', icon: '🍻', cost: 400, text: '200 Gläser mit Logo für Kneipen und Feste. Gastro und Festival +4 %, Verkostungen wirken stärker.' },
  kristall: { name: 'Eigene Glasform aus Kristall', icon: '💠', cost: 1500, text: 'Ein außergewöhnliches, mundgeblasenes Glas nur für dein Bier. Spitzenbiere (Qualität 80+) +6 % in Gastro und Festival, Kritiker sind beeindruckt.' },
  flasche:  { name: 'Eigene Flaschenform (Glashütte)', icon: '💎', cost: 2500, text: 'Werkzeug für deine eigene Flaschenform. Danach steht dir die „Designerflasche“ zur Verfügung.' },
  grafik:   { name: 'Etikett vom Grafikbüro', icon: '🖌️', cost: 350, text: 'Profis überarbeiten Logo und Etikett: Alles verkauft sich 4 % besser (außer an den Händler).' },
};
export const hasOrder = (s, id) => s.mode === 'sandbox' || !!s.brand?.orders?.includes(id);
export function placeOrder(s, id) {
  need(hasFeature(s, 'marke'), 'Marke & Design ist noch gesperrt.');
  const o = ORDERS[id];
  need(o, 'Unbekannter Auftrag.');
  need(!hasOrder(s, id), 'Schon erledigt.');
  if (id === 'kristall' || id === 'logoglas') need(brandOf(s).designed, 'Erst ein Logo im Icon-Creator gestalten.');
  spend(s, o.cost, o.name);
  brandOf(s).orders.push(id);
  log(s, `${o.icon} ${o.name} bestellt (${o.cost} €). ${o.text}`, 'good');
}

export const BRAND_SYMBOLS = ['🍺', '🌾', '🍃', '⚓', '🏔️', '🦌', '🐝', '🦉', '🐗', '🌙', '☀️', '⭐', '🔥', '❄️', '👑', '⚙️', '🛢️', '🌲', '🍂', '🐓', '🐟', '🎓', '⛪', '🗝️'];
export const BRAND_COLORS = ['#c97a10', '#7a3b12', '#1f4e79', '#2e6b3a', '#8b1e3f', '#2b2b2b', '#d9b44a', '#5b4b8a'];
export const BRAND_SHAPES = { kreis: 'Kreis', schild: 'Wappen', quadrat: 'Quadrat', raute: 'Raute' };
export const brandOf = s => (s.brand ||= { symbol: '🍺', color: '#c97a10', shape: 'kreis', text: '', designed: false, orders: [] });
export function setBrand(s, { symbol, color, shape, text }) {
  need(hasFeature(s, 'marke'), 'Marke & Design ist noch gesperrt.');
  need(BRAND_SYMBOLS.includes(symbol), 'Unbekanntes Symbol.');
  need(BRAND_COLORS.includes(color), 'Unbekannte Farbe.');
  need(BRAND_SHAPES[shape], 'Unbekannte Form.');
  const b = brandOf(s);
  const first = !b.designed;
  Object.assign(b, { symbol, color, shape, text: String(text || '').trim().slice(0, 4).toUpperCase(), designed: true });
  log(s, `🎨 ${first ? 'Dein erstes eigenes Logo' : 'Neues Logo'}: ${symbol} ${b.text}`.trim() + '.', 'good');
}

/** Flasche und Glas für ein Bier im Lager festlegen. */
export function setPackaging(s, beerId, { bottle, glass }) {
  need(hasFeature(s, 'marke'), 'Marke & Design ist noch gesperrt.');
  const b = s.beers.find(x => x.id === beerId);
  need(b, 'Dieses Bier gibt es nicht im Lager.');
  if (bottle !== undefined) {
    const d = BOTTLES[bottle];
    need(d, 'Unbekannte Flasche.');
    need(!d.tech || hasTech(s, d.tech), `Dafür brauchst du: ${TECH[d.tech]?.name}.`);
    need(!d.order || hasOrder(s, d.order), 'Erst die eigene Flaschenform bei der Glashütte bestellen.');
    b.bottle = bottle;
  }
  if (glass !== undefined) { need(GLASSES[glass], 'Unbekanntes Glas.'); b.glass = glass; }
}

const BOTTLE_CH = ['hof', 'online', 'abholen', 'schwarz'];
const GLASS_CH = ['gastro', 'festival'];
const LUXURY = ['tripel', 'dubbel', 'imperial', 'doppelbock'];
const suitsOf = (list, styleId) => list === 'alle' || list.includes(styleId);

/**
 * Präsentation: Wie Flasche, Glas, Etikett und Standort den Preis verändern.
 * Liefert { mul, bottleCost, notes } – bottleCost in €/L (nur bei Flaschenverkauf).
 */
export function presentation(s, b, ch) {
  const notes = [];
  let mul = 1, bottleCost = 0;
  const loc = locOf(s);
  mul *= loc.price;
  if (loc.likes.includes(b.styleId)) { mul *= 1.08; notes.push(`${loc.name} liebt diesen Stil (+8 %)`); }
  if (b.bunt || BUNT_STYLES.includes(b.styleId)) mul *= loc.buntMul;
  if (b.filtered && ['gastro', 'abholen'].includes(ch)) { mul *= 1.05; notes.push('filtriert: länger haltbar (+5 %)'); }
  if (ch === 'abholen') return { mul: round2(mul), bottleCost: 0, notes };
  const brand = s.brand;
  if (brand?.designed) mul *= hasOrder(s, 'grafik') ? 1.04 : 1.01;
  const exclusive = LUXURY.includes(b.styleId) || (b.barrel && b.barrel !== 'cuvee') || b.quality >= 85;
  if (BOTTLE_CH.includes(ch)) {
    const bt = BOTTLES[b.bottle || 'euro'];
    bottleCost = bt.cost;
    const fits = suitsOf(bt.suits, b.styleId);
    if (fits) { mul *= 1.04; notes.push(`${bt.name} passt (+4 %)`); }
    if (bt.premium >= 2 && b.quality < 70) { mul *= 0.9; notes.push('Luxusverpackung, aber Durchschnittsbier – die Leute fühlen sich veräppelt (−10 %)'); }
    else if (bt.premium >= 2 && exclusive) { mul *= bt.premium >= 3 && fits ? 1.2 : 1.1; notes.push(`edle Verpackung für ein edles Bier (+${bt.premium >= 3 && fits ? 20 : 10} %)`); }
    if (bt.premium === 0 && exclusive) { mul *= 0.88; notes.push('ein Exklusivbier in der Massenflasche wirkt billig (−12 %)'); }
    if (ch === 'online' && b.bottle === 'dose') mul *= 1.03;
  }
  if (GLASS_CH.includes(ch)) {
    const gl = GLASSES[b.glass || 'willi'];
    if (suitsOf(gl.suits, b.styleId)) { mul *= 1.05; notes.push(`im ${gl.name} serviert (+5 %)`); }
    else { mul *= 0.97; notes.push(`${gl.name} passt nicht zum Stil (−3 %)`); }
    if (hasOrder(s, 'logoglas')) mul *= 1.04;
    if (hasOrder(s, 'kristall') && b.quality >= 80) { mul *= 1.06; notes.push('eigenes Kristallglas (+6 %)'); }
  }
  return { mul: round2(mul), bottleCost, notes };
}
/** Punkte-Bonus bei Kritikern durch die Aufmachung. */
export function presentationReview(s, b) {
  let x = 0;
  const bt = BOTTLES[b.bottle || 'euro'], gl = GLASSES[b.glass || 'willi'];
  if (suitsOf(bt.suits, b.styleId)) x += 1;
  if (suitsOf(gl.suits, b.styleId)) x += 2; else x -= 1;
  if (hasOrder(s, 'kristall') && b.quality >= 80) x += 3;
  if (s.brand?.designed) x += hasOrder(s, 'grafik') ? 2 : 1;
  if (bt.premium === 0 && (LUXURY.includes(b.styleId) || b.quality >= 85)) x -= 2;
  return x;
}

// ---------- Lohnbrauen (industriell herstellen lassen) ----------
export const CONTRACT = { partner: 'Lohnbrauerei Stahlkessel AG', icon: '🏭', minL: 500, maxL: 5000, costPerL: 0.95, loss: 8, days: 21 };
export function contractBrew(s, recipeName, liters) {
  need(hasFeature(s, 'industrie'), 'Industrie & Übernahmen sind noch gesperrt.');
  need(s.mode === 'sandbox' || s.license, 'Lohnbrauen geht nur mit Gewerbe.');
  const r = (s.recipes || []).find(x => x.name === recipeName);
  need(r, 'Dieses Rezept ist nicht im Sortiment.');
  need(liters >= CONTRACT.minL && liters <= CONTRACT.maxL, `Die Lohnbrauerei nimmt Aufträge von ${CONTRACT.minL} bis ${CONTRACT.maxL} L.`);
  need(!(s.contracts || []).length, 'Es läuft schon ein Auftrag bei der Lohnbrauerei.');
  const cost = round2(liters * CONTRACT.costPerL);
  spend(s, cost, 'den Lohnbrau-Auftrag');
  s.contracts ||= [];
  s.contracts.push({ recipe: structuredClone(r), liters, readyDay: s.day + CONTRACT.days, cost });
  s.litersYear += liters;
  log(s, `${CONTRACT.icon} ${CONTRACT.partner} braut ${liters} L „${r.name}“ nach deinem Rezept (${cost} €). Lieferung in ${CONTRACT.days} Tagen. Industriell gebraut verliert es etwas an Charakter.`);
}
/** Täglich: Lohnbrau-Lieferungen ins Lager. potentialFn = recipePotential (gegen Kreisimporte hereingereicht). */
export function contractsDaily(s, potentialFn, computeFn) {
  if (!s.contracts?.length) return;
  for (const c of s.contracts.filter(x => x.readyDay <= s.day)) {
    const pot = potentialFn(c.recipe).total;
    const quality = Math.round(clamp(pot - CONTRACT.loss + (rand(s) * 6 - 4), 0, 100));
    const calc = computeFn(c.recipe);
    s.beers.push({ id: s.nextId++, name: c.recipe.name, styleId: c.recipe.styleId, custom: c.recipe.custom ? { id: c.recipe.custom.id, name: c.recipe.custom.name } : undefined,
      liters: c.liters, quality, flaws: [], notes: ['Industriell gebraut bei der Lohnbrauerei.'], plato: calc.plato, abv: calc.abv, ibu: calc.ibu, ebc: calc.ebc,
      industrial: true, filtered: true, finishedDay: s.day });
    log(s, `${CONTRACT.icon} Lieferung: ${c.liters} L „${c.recipe.name}“ aus der Lohnbrauerei, Qualität ${quality}.`, 'good');
  }
  s.contracts = s.contracts.filter(x => x.readyDay > s.day);
}

// ---------- Brauereien kaufen ----------
const BUYABLE = COMPETITORS.filter(c => c.pts <= 3600);
export const breweryPrice = c => Math.round(c.pts * 8 / 100) * 100;
export const breweryProfit = c => round2(c.pts * 0.11); // € pro Woche im Schnitt
export const forSale = s => BUYABLE.map(c => ({ ...c, price: breweryPrice(c), profit: breweryProfit(c), owned: (s.owned || []).includes(c.name) }));
export function buyBrewery(s, name) {
  need(hasFeature(s, 'industrie'), 'Industrie & Übernahmen sind noch gesperrt.');
  const c = BUYABLE.find(x => x.name === name);
  need(c, 'Diese Brauerei steht nicht zum Verkauf.');
  need(!(s.owned || []).includes(name), 'Gehört dir schon.');
  const price = breweryPrice(c);
  spend(s, price, name);
  (s.owned ||= []).push(name);
  s.reputation = round2(clamp(s.reputation + 2, 0, 100));
  log(s, `🤝 Du hast „${name}“ übernommen (${price} €)! Rund ${breweryProfit(c)} € Gewinn pro Woche – mal mehr, mal weniger. Ruf +2.`, 'good');
}
export function sellBrewery(s, name) {
  need((s.owned || []).includes(name), 'Diese Brauerei gehört dir nicht.');
  const c = BUYABLE.find(x => x.name === name);
  const price = Math.round(breweryPrice(c) * 0.8);
  s.owned = s.owned.filter(x => x !== name);
  if (s.mode !== 'sandbox') s.cash = round2(s.cash + price);
  log(s, `🤝 „${name}“ verkauft (${price} €).`);
}
/** Wöchentlich: Gewinne der übernommenen Brauereien. */
export function breweriesWeekly(s, seasonFn) {
  if (!s.owned?.length || s.mode !== 'story') return;
  let sum = 0;
  for (const name of s.owned) {
    const c = BUYABLE.find(x => x.name === name);
    if (c) sum += breweryProfit(c) * seasonFn(s.day) * (0.6 + rand(s) * 0.8);
  }
  sum = round2(sum);
  s.cash = round2(s.cash + sum);
  s.stats.breweryIncome = round2((s.stats.breweryIncome || 0) + sum);
  log(s, `🤝 Gewinn deiner ${s.owned.length === 1 ? 'Tochterbrauerei' : `${s.owned.length} Tochterbrauereien`}: +${sum} €.`);
}
export const ownedPoints = s => (s.owned || []).reduce((a, n) => a + (COMPETITORS.find(c => c.name === n)?.pts || 0), 0);
