// Rezept-Werkstatt: Potenzial eines Rezepts (Höchstpunktzahl, bevor Gärung, Hygiene und Können mitreden),
// Maischverfahren, Reifung und das eigene Sortiment (gespeicherte Rezepte).
import { MALTS, HOPS, HOP_FORMS, STYLES, byId } from '../core/data.js';
import { compute } from '../core/brew.js';
import { STYLE_AROMA } from './config.js';
import { need, clamp, round2 } from './state.js';
import { isUnlocked } from './progress.js';

export const MASH_PROGRAMS = {
  kombi:     { name: 'Kombirast 66 °C', costPerL: 0,
               steps: [[66, 60, 'Kombirast'], [78, 5, 'Abmaischen']],
               text: 'Eine einzige Rast: einfach und schnell. Der Klassiker für Ales.' },
  stufen:    { name: 'Stufenmaische 63 / 72 / 78 °C', costPerL: 0,
               steps: [[63, 45, 'Maltoserast'], [72, 30, 'Verzuckerungsrast'], [78, 5, 'Abmaischen']],
               text: 'Maltose- und Verzuckerungsrast: gut steuerbar und sauber. Der deutsche Standard.' },
  ferula:    { name: 'Stufenmaische mit Ferulasäurerast 45 °C', costPerL: 0,
               steps: [[45, 15, 'Ferulasäurerast'], [63, 35, 'Maltoserast'], [72, 30, 'Verzuckerungsrast'], [78, 5, 'Abmaischen']],
               text: 'Eine kurze Rast bei 45 °C, damit die Weizenhefe später mehr Nelkenaroma bildet.' },
  dekoktion: { name: 'Dekoktion (Kochmaische)', costPerL: 0.12,
               steps: [[50, 15, 'Eiweißrast'], [63, 40, 'Maltoserast (1. Kochmaische)'], [72, 30, 'Verzuckerungsrast (2. Kochmaische)'], [78, 5, 'Abmaischen']],
               text: 'Ein Teil der Maische wird herausgenommen und gekocht. Das gibt Malztiefe und Farbe, kostet aber Zeit und Energie.' },
};

export const REIFUNG = {
  lagern:     { name: 'Kalte Lagerung', days: 14, costPerL: 0.05, text: 'Zwei Wochen bei 0–2 °C: Das Bier wird klar, rund und sauber.' },
  flasche:    { name: 'Flaschengärung', days: 10, costPerL: 0.08, text: 'Mit etwas Zucker und frischer Hefe in der Flasche nachgären: feine Perlage, mehr Tiefe.' },
  kalthopfen: { name: 'Kalthopfung', days: 4, costPerL: 0.35, text: 'Hopfen ins fertige Jungbier: frisches, intensives Aroma ohne zusätzliche Bittere.' },
  fass:       { name: 'Reifung im Holzfass', days: 28, costPerL: 0.4, text: 'Vier Wochen im gebrauchten Holzfass: Vanille, Holz, Tiefe.' },
};

const HOP_FAMILY = { hallertauer: 'de', tettnanger: 'de', saphir: 'de', tradition: 'de', perle: 'de', hersbruck: 'de', northern: 'uk',
  magnum: 'de', saaz: 'cz', cascade: 'us', citra: 'us', mosaic: 'us', fuggles: 'uk', goldings: 'uk' };
const FAMILY_NAME = { de: 'deutsche', cz: 'tschechische', us: 'amerikanische', uk: 'englische' };
const BASE_OF = { pilsner_boden: 'pilsner', muenchner_boden: 'muenchner', maris: 'pale' }; // Premium zählt wie sein Grundmalz

/** Anteil (%) einer oder mehrerer Malzsorten an der Schüttung (Premium-Varianten zählen mit). */
export function maltPct(recipe, ...ids) {
  const sum = recipe.malts.reduce((a, m) => a + Math.max(0, +m.share || 0), 0) || 1;
  return recipe.malts.filter(m => ids.includes(m.id) || ids.includes(BASE_OF[m.id])).reduce((a, m) => a + Math.max(0, +m.share || 0), 0) / sum * 100;
}
const lateHops = (r, maxTime = 15) => r.hops.filter(h => h.time <= maxTime && h.gPerL > 0);
const lateDose = (r, fams, maxTime = 15) => lateHops(r, maxTime).filter(h => fams.includes(HOP_FAMILY[h.id])).reduce((a, h) => a + h.gPerL, 0);

// Was zu jedem Stil passt. hops: typische Hopfen-Herkunft; yeast: ideal / ok; mash: ideal / ok; reif: passende Reifung;
// sig: typische Zutat (Prüfung + Text + Tipp für Unentdecktes).
const LAGER = { hops: ['de', 'cz'], yeast: { ideal: ['lager'] }, mash: { ideal: 'dekoktion', ok: ['stufen'] }, reif: 'lagern' };
const FIT = {
  pils:   { ...LAGER, sig: r => lateDose(r, ['de', 'cz']) >= 0.3, sigLabel: 'Feiner Aromahopfen zum Schluss', sigHint: 'Ein Pils lebt von edlem Hopfen, der spät in den Kessel kommt (Saaz, Tettnanger …).' },
  helles: { ...LAGER, sig: r => maltPct(r, 'wiener', 'muenchner') >= 5 && maltPct(r, 'wiener', 'muenchner') <= 25, sigLabel: 'Ein Hauch Wiener/Münchner', sigHint: 'Etwas Wiener oder Münchner Malz (5–25 %) macht das Helle runder.' },
  maerzen: { ...LAGER, sig: r => maltPct(r, 'muenchner') >= 40, sigLabel: 'Münchner Malz als Rückgrat', sigHint: 'Ein Märzen braucht viel Münchner Malz (40 %+).' },
  weizen: { hops: ['de'], yeast: { ideal: ['weizen'] }, mash: { ideal: 'ferula', ok: ['stufen'] }, reif: 'flasche',
            sig: r => maltPct(r, 'weizen') >= 50, sigLabel: 'Mindestens 50 % Weizenmalz', sigHint: 'Ohne genug Weizenmalz kein echtes Weizen.' },
  pale:   { hops: ['us', 'uk'], yeast: { ideal: ['ale'], ok: ['stout', 'koelsch'] }, mash: { ideal: 'kombi', ok: ['stufen'] }, reif: 'kalthopfen',
            sig: r => lateDose(r, ['us', 'uk']) >= 0.5, sigLabel: 'Fruchtiger Hopfen spät', sigHint: 'Pale Ale riecht nach Hopfen: späte Gaben mit Cascade & Co.' },
  ipa:    { hops: ['us'], yeast: { ideal: ['ale'], ok: ['stout'] }, mash: { ideal: 'kombi', ok: ['stufen'] }, reif: 'kalthopfen',
            sig: r => lateDose(r, ['us'], 5) >= 1, sigLabel: 'Hopfenbombe am Ende', sigHint: 'Viel US-Hopfen in den letzten Minuten (ab 1 g/L).' },
  stout:  { hops: ['uk', 'de'], yeast: { ideal: ['stout'], ok: ['ale'] }, mash: { ideal: 'kombi', ok: ['stufen'] }, reif: 'lagern',
            sig: r => maltPct(r, 'roest') >= 5 && maltPct(r, 'roest') <= 12, sigLabel: 'Röstgerste für Kaffee-Noten', sigHint: 'Ein Stout ohne 5–12 % Röstgerste ist keins.' },
  doppelbock: { ...LAGER, sig: r => maltPct(r, 'melanoidin') >= 3 || maltPct(r, 'muenchner') >= 50, sigLabel: 'Tiefe Malzigkeit', sigHint: 'Viel Münchner oder etwas Melanoidinmalz für die Brotkruste.' },
  koelsch: { hops: ['de'], yeast: { ideal: ['koelsch'] }, mash: { ideal: 'stufen', ok: ['kombi'] }, reif: 'lagern',
             sig: r => maltPct(r, 'weizen') >= 5 && maltPct(r, 'weizen') <= 20, sigLabel: 'Ein wenig Weizen', sigHint: 'Viele Kölsch-Brauer geben 5–20 % Weizenmalz dazu.' },
  dunkel: { ...LAGER, sig: r => maltPct(r, 'muenchner') >= 60, sigLabel: 'Münchner Malz satt', sigHint: 'Ein Dunkel ist vor allem Münchner Malz (60 %+).' },
  schwarzbier: { ...LAGER, sig: r => maltPct(r, 'carafa') >= maltPct(r, 'roest') && maltPct(r, 'carafa') > 0, sigLabel: 'Entspelztes Röstmalz', sigHint: 'Mild schwarz statt herb: mehr Carafa als Röstgerste.' },
  bock:   { ...LAGER, sig: r => maltPct(r, 'melanoidin') >= 3, sigLabel: 'Melanoidinmalz', sigHint: 'Etwas Melanoidinmalz gibt dem Bock Honig- und Brotnoten.' },
  alt:    { hops: ['de'], yeast: { ideal: ['koelsch'], ok: ['ale'] }, mash: { ideal: 'stufen', ok: ['kombi'] }, reif: 'lagern',
            sig: r => maltPct(r, 'muenchner') >= 40 && maltPct(r, 'caramuench') >= 5, sigLabel: 'Münchner + Karamell', sigHint: 'Kupferfarbe kommt von Münchner Malz (40 %+) und etwas Caramünch.' },
  rauch:  { ...LAGER, sig: r => maltPct(r, 'rauch') >= 50, sigLabel: 'Rauchmalz als Basis', sigHint: 'Bamberger Art heißt: mindestens die Hälfte Rauchmalz.' },
  porter: { hops: ['uk'], yeast: { ideal: ['stout'], ok: ['ale'] }, mash: { ideal: 'kombi', ok: ['stufen'] }, reif: 'lagern',
            sig: r => maltPct(r, 'carafa', 'roest') >= 3 && maltPct(r, 'caramuench') >= 4, sigLabel: 'Röst- und Karamellmalz', sigHint: 'Schokolade und Kaffee: Röstmalz plus etwas Caramünch.' },
  imperial: { hops: ['uk', 'us', 'de'], yeast: { ideal: ['stout'], ok: ['ale'] }, mash: { ideal: 'kombi', ok: ['stufen'] }, reif: 'fass',
              sig: r => maltPct(r, 'roest') >= 4 && maltPct(r, 'melanoidin', 'caramuench') >= 6, sigLabel: 'Vielschichtige Schüttung', sigHint: 'Röstgerste plus Melanoidin/Caramünch für Tiefe.' },
  dubbel: { hops: ['cz', 'uk', 'de'], yeast: { ideal: ['belgisch'] }, mash: { ideal: 'stufen', ok: ['kombi'] }, reif: 'flasche',
            sig: r => maltPct(r, 'kandis') >= 5 && maltPct(r, 'kandis') <= 20, sigLabel: 'Kandiszucker', sigHint: 'Belgische Abteien geben 5–20 % Kandis: trocken trotz Stärke.' },
  tripel: { hops: ['cz', 'uk', 'de'], yeast: { ideal: ['belgisch'] }, mash: { ideal: 'stufen', ok: ['kombi'] }, reif: 'flasche',
            sig: r => maltPct(r, 'kandis') >= 10 && maltPct(r, 'kandis') <= 25, sigLabel: 'Kandiszucker', sigHint: 'Ein Tripel braucht 10–25 % hellen Kandis, sonst wird es pappig.' },
  saison: { hops: ['cz', 'uk', 'de'], yeast: { ideal: ['saison'], ok: ['belgisch'] }, mash: { ideal: 'stufen', ok: ['kombi'] }, reif: 'flasche',
            sig: r => maltPct(r, 'roggen', 'weizen') >= 5 && maltPct(r, 'roggen', 'weizen') <= 25, sigLabel: 'Roggen oder Weizen', sigHint: 'Etwas Roggen oder Weizen (5–25 %) macht die Saison würzig.' },
  witbier: { hops: ['cz', 'de'], yeast: { ideal: ['belgisch'] }, mash: { ideal: 'kombi', ok: ['stufen'] }, reif: 'flasche',
             sig: r => maltPct(r, 'hafer') >= 5 && maltPct(r, 'weizen') >= 30, sigLabel: 'Weizen und Hafer', sigHint: 'Witbier: viel (Roh-)Weizen und etwas Hafer für die Cremigkeit.' },
  dunkelweizen: { hops: ['de'], yeast: { ideal: ['weizen'] }, mash: { ideal: 'ferula', ok: ['stufen'] }, reif: 'flasche',
                  sig: r => maltPct(r, 'weizendunkel') >= 40, sigLabel: 'Dunkles Weizenmalz', sigHint: 'Mindestens 40 % dunkles Weizenmalz.' },
  neipa:  { hops: ['us'], yeast: { ideal: ['ale'] }, mash: { ideal: 'kombi', ok: ['stufen'] }, reif: 'kalthopfen',
            sig: r => maltPct(r, 'hafer') >= 8, sigLabel: 'Hafer für den Saft', sigHint: 'Ohne Hafer (8 %+) kein trüb-saftiges Mundgefühl.' },
  berliner: { hops: ['cz', 'de'], yeast: { ideal: ['sauer'] }, mash: { ideal: 'kombi', ok: ['stufen'] }, reif: 'flasche',
              sig: r => maltPct(r, 'weizen') >= 40, sigLabel: 'Viel Weizen', sigHint: 'Berliner Weisse ist zur Hälfte Weizen.' },
};
export const styleFit = id => FIT[id];

/** Maischverfahren eines Rezepts (alte Rezepte: aus den Rasten ableiten). */
export function mashProgramOf(r) {
  if (r.mashProgram && MASH_PROGRAMS[r.mashProgram]) return r.mashProgram;
  if (r.mash?.some(m => m.temp <= 50)) return 'ferula';
  return (r.mash?.filter(m => m.temp < 78).length ?? 2) <= 1 ? 'kombi' : 'stufen';
}
export function setMashProgram(r, id) {
  need(MASH_PROGRAMS[id], 'Unbekanntes Maischverfahren.');
  r.mashProgram = id;
  r.mash = MASH_PROGRAMS[id].steps.map(([temp, min, label]) => ({ temp, min, label }));
}
export const reifungOf = r => (r.reifung ? REIFUNG[FIT[r.styleId]?.reif] ?? null : null);
/** Mehrkosten durch Maischverfahren und Reifung (€ für den ganzen Sud). */
export const optionCost = r => round2(r.batchL * ((MASH_PROGRAMS[mashProgramOf(r)]?.costPerL || 0) + (reifungOf(r)?.costPerL || 0)));

export const POTENTIAL_TIERS = [[92, 'Trappisten-Niveau', '⛪'], [82, 'Meisterbier', '🏅'], [70, 'richtig gut', '👍'], [55, 'solide', '🙂'], [0, 'Hausmannskost', '🥄']];
export const potentialTier = p => POTENTIAL_TIERS.find(([min]) => p >= min);

/** Aromapunkte (0–10): späte Gaben mit echtem Hopfen, je nach Form und Frische. */
export function aromaPoints(r) {
  const dose = r.hops.reduce((sum, h) => sum + (h.time <= 15 ? h.gPerL * HOP_FORMS[h.form || 'pellet'].aroma * (h.fresh ?? 1) : 0), 0);
  const need_ = STYLE_AROMA[r.styleId] ?? 0.1;
  return need_ <= 0.03 ? 10 : 10 * clamp(dose / need_, 0, 1);
}

/**
 * Potenzial eines Rezepts (0–100): Was dieses Rezept bei perfekter Gärung, Hygiene und Erfahrung erreichen kann.
 * Stiltreue 30 · Zutaten 20 · Aroma 10 · Feinschliff 40.
 */
export function recipePotential(r) {
  const style = byId(STYLES, r.styleId), fit = FIT[r.styleId];
  const c = compute(r);
  const parts = [], tricks = [];

  // Stiltreue (30): 4 Kennwerte à 7,5 Punkte
  let st = 0; const off = [];
  for (const [key, val, label] of [['plato', c.plato, 'Stammwürze'], ['abv', c.abv, 'Alkohol'], ['ibu', c.ibu, 'Bittere'], ['ebc', c.ebc, 'Farbe']]) {
    const [lo, hi] = style.ranges[key];
    const out = Math.max(0, lo - val, val - hi);
    st += 7.5 * Math.max(0, 1 - out / (hi - lo));
    if (out > 0) off.push(`${label} ${val < lo ? 'zu niedrig' : 'zu hoch'}`);
  }
  parts.push({ id: 'stil', label: 'Stiltreue', pts: st, max: 30, note: off.length ? off.join(', ') : 'alle Werte im Zielbereich' });

  // Zutaten (20): Hefe 8, Hopfen-Herkunft 7, Malzanteile 5
  const yIdeal = fit.yeast.ideal.includes(r.yeastId), yOk = fit.yeast.ok?.includes(r.yeastId);
  const yeastPts = yIdeal ? 8 : yOk ? 4 : 0;
  const hopG = r.hops.reduce((a, h) => a + h.gPerL, 0) || 1;
  const typical = r.hops.filter(h => fit.hops.includes(HOP_FAMILY[h.id]) || (h.id === 'magnum' && h.time >= 45)).reduce((a, h) => a + h.gPerL, 0);
  const hopPts = 7 * typical / hopG;
  const over = c.malts.filter(m => m.pct > m.maxPct + 0.05);
  const maltPts = Math.max(0, 5 - 2.5 * over.length);
  const zNotes = [];
  if (!yIdeal) zNotes.push(yOk ? 'Hefe geht, ist aber nicht die typische' : 'Hefe passt nicht zum Stil');
  if (hopPts < 6) zNotes.push(`typisch wären ${fit.hops.map(f => FAMILY_NAME[f]).join('/')} Hopfen`);
  if (over.length) zNotes.push(`zu viel ${over.map(m => m.name).join(', ')}`);
  parts.push({ id: 'zutaten', label: 'Passende Zutaten', pts: yeastPts + hopPts + maltPts, max: 20, note: zNotes.join(' · ') || 'Hefe, Hopfen und Malz passen' });

  // Aroma (10)
  const aroma = aromaPoints(r);
  parts.push({ id: 'aroma', label: 'Hopfenaroma', pts: aroma, max: 10, note: aroma >= 9.5 ? 'genau richtig' : 'mehr späte Gaben mit echtem Hopfen (nicht Extrakt)' });

  // Feinschliff (40): Kniffe, die ein gutes von einem großen Bier unterscheiden
  const trick = (id, label, max, pts, hint) => tricks.push({ id, label, max, pts, ok: pts >= max - 1e-9, hint });
  trick('premium', 'Edles Grundmalz', 8, maltPct(r, ...MALTS.filter(m => m.premium).map(m => m.id)) >= 25 ? 8 : 0,
    'Grundmalz aus Bodenmälzung oder Maris Otter (mind. 25 %): Das schmeckt man.');
  const mid = key => { const [lo, hi] = style.ranges[key]; return Math.abs((key === 'plato' ? c.plato : c.ibu) - (lo + hi) / 2) <= (hi - lo) / 4; };
  trick('mitte', 'Mitten im Stil', 5, mid('plato') && mid('ibu') ? 5 : 0, 'Stammwürze und Bittere genau in die Mitte des Zielbereichs legen.');
  const mp = mashProgramOf(r);
  trick('maische', `Maischverfahren: ${MASH_PROGRAMS[fit.mash.ideal].name}`, 7, mp === fit.mash.ideal ? 7 : fit.mash.ok?.includes(mp) ? 3 : 0,
    fit.mash.ideal === 'dekoktion' ? 'Die alten Brauer haben Teile der Maische gekocht …' : `Für diesen Stil ideal: ${MASH_PROGRAMS[fit.mash.ideal].name}.`);
  trick('signatur', fit.sigLabel, 7, fit.sig(r, c) ? 7 : 0, fit.sigHint);
  const reif = REIFUNG[fit.reif];
  trick('reifung', reif.name, 8, r.reifung ? 8 : 0, `${reif.text} (+${reif.days} Tage)`);
  const n = r.malts.filter(m => m.share > 0).length;
  trick('schlank', 'Klares Rezept (2–5 Malze)', 2, n >= 2 && n <= 5 ? 2 : 0, 'Nicht zu viele Zutaten: 2 bis 5 Malze reichen.');
  const late = lateHops(r);
  trick('dolden', 'Doldenhopfen für das Aroma', 3, late.length && late.every(h => h.form === 'whole') ? 3 : 0,
    'Späte Gaben als ganze Dolden: feiner und frischer als Pellets.');
  const fein = tricks.reduce((a, t) => a + t.pts, 0);
  parts.push({ id: 'feinschliff', label: 'Feinschliff', pts: fein, max: 40, note: `${tricks.filter(t => t.ok).length} von ${tricks.length} Kniffen` });

  const total = Math.round(clamp(parts.reduce((a, p) => a + p.pts, 0), 0, 100));
  const [, tier, icon] = potentialTier(total);
  return { total, tier, icon, parts: parts.map(p => ({ ...p, pts: round2(p.pts) })), tricks, calc: c, offStyle: off };
}

// ---------- Sortiment (gespeicherte Rezepte) ----------
const cleanRecipe = r => {
  const x = structuredClone(r);
  x.hops.forEach(h => { delete h.fresh; });
  return x;
};
export function saveRecipe(s, recipe) {
  const name = String(recipe.name || '').trim().slice(0, 40);
  need(name.length >= 2, 'Gib deinem Rezept einen Namen (mind. 2 Zeichen).');
  need(isUnlocked(s, recipe.styleId), 'Diesen Stil hast du noch nicht gelernt.');
  need(recipe.malts.some(m => m.share > 0), 'Ohne Malz kein Bier.');
  s.recipes ||= [];
  const r = cleanRecipe({ ...recipe, name });
  const i = s.recipes.findIndex(x => x.name.toLowerCase() === name.toLowerCase());
  if (i >= 0) s.recipes[i] = r; else s.recipes.push(r);
  return r;
}
export function deleteRecipe(s, name) {
  s.recipes = (s.recipes || []).filter(x => x.name !== name);
}
export const hopFamily = id => HOP_FAMILY[id];
export const isPremiumMalt = id => !!byId(MALTS, id)?.premium;
export const hopNote = id => byId(HOPS, id)?.note || '';
