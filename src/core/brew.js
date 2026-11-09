// Reine Brau-Logik (keine DOM-Abhängigkeit, daher testbar).
import { MALTS, HOPS, YEASTS, STYLES, byId } from './data.js';

export const platoToSG = p => 1 + p / (258.6 - (p / 258.2) * 227.1);
export const sgToPlato = sg => -616.868 + 1111.14 * sg - 630.272 * sg ** 2 + 135.997 * sg ** 3;

const HOT_SHRINK = 0.96;       // Würze ist heiß ~4 % voluminöser
const GRAIN_ABSORB = 1.1;      // L Wasser, die 1 kg Schrot bindet
const MASH_RATIO = 3.5;        // L Hauptguss pro kg Schüttung
const HIGH_GRAVITY_START = 14; // ab hier sinkt der Vergärungsgrad

/** Neues Rezept aus einem Stil-Startrezept erzeugen. */
export function newRecipeFromStyle(styleId) {
  const style = byId(STYLES, styleId);
  const s = style.start;
  const recipe = {
    name: `Mein ${style.name}`,
    styleId,
    batchL: 20,
    plato: s.plato,
    efficiency: 75,
    evapPct: 8,
    boilMin: s.boilMin,
    yeastId: s.yeast,
    attenuation: null, // null = Wert der Hefe verwenden
    malts: s.malts.map(([id, share]) => ({ id, share })),
    hops: s.hops.map(([id, w, time]) => ({ id, gPerL: w * 0.01, time, form: 'pellet' })),
    mash: s.mash.map(([temp, min, label]) => ({ temp, min, label })),
  };
  setIbu(recipe, s.ibu);
  return recipe;
}

/** Alle Hopfengaben proportional skalieren, sodass die Bittere `targetIbu` erreicht. */
export function setIbu(recipe, targetIbu) {
  const cur = compute(recipe).ibu;
  if (cur <= 0) return false;
  const k = targetIbu / cur;
  recipe.hops.forEach(h => { h.gPerL *= k; });
  return true;
}

/** Tinseth-Ausbeute (Anteil der Alphasäure, der isomerisiert und gelöst wird). */
export function hopUtilization(boilGravitySG, minutes) {
  const bigness = 1.65 * Math.pow(0.000125, boilGravitySG - 1);
  const timeFactor = (1 - Math.exp(-0.04 * minutes)) / 4.15;
  return bigness * timeFactor;
}

/** EBC-Wert (Morey, über SRM) für eine Malzmischung. */
export function colorEBC(items, litres) {
  const lb = kg => kg * 2.20462;
  const gal = litres * 0.264172;
  const mcu = items.reduce((s, it) => s + (it.ebc * 0.508) * lb(it.kg), 0) / gal;
  const srm = 1.4922 * Math.pow(mcu, 0.6859);
  return mcu > 0 ? srm * 1.97 : 0;
}

export function compute(recipe) {
  const V = recipe.batchL;
  const P = recipe.plato;
  const yeast = byId(YEASTS, recipe.yeastId) || YEASTS[0];
  const og = platoToSG(P);

  // --- Schüttung: Extraktbedarf -> Malzmenge
  const extractKg = V * og * P / 100;
  const shareSum = recipe.malts.reduce((s, m) => s + Math.max(0, m.share), 0) || 1;
  const maltInfo = recipe.malts.map(m => ({ ...byId(MALTS, m.id), pct: Math.max(0, m.share) / shareSum * 100 }));
  const avgYield = maltInfo.reduce((s, m) => s + (m.pct / 100) * m.extract / 100, 0);
  const grainKg = extractKg / (avgYield * recipe.efficiency / 100);
  const malts = maltInfo.map(m => ({ id: m.id, name: m.name, pct: m.pct, kg: grainKg * m.pct / 100, ebc: m.ebc, maxPct: m.maxPct }));

  // --- Wasser
  const coldPre = V / (1 - recipe.evapPct / 100);
  const totalWater = coldPre + grainKg * GRAIN_ABSORB;
  const mashWater = Math.min(grainKg * MASH_RATIO, totalWater);
  const water = {
    mash: mashWater,
    sparge: totalWater - mashWater,
    total: totalWater,
    preBoilHot: coldPre / HOT_SHRINK,
    mashThickness: mashWater / grainKg,
  };

  // --- Bittere
  const preSG = 1 + (og - 1) * (1 - recipe.evapPct / 100);
  const boilSG = (preSG + og) / 2;
  const hops = recipe.hops.map(h => {
    const info = byId(HOPS, h.id);
    const g = h.gPerL * V;
    const mgPerL = (info.alpha / 100) * g * 1000 / V;
    const ibu = hopUtilization(boilSG, h.time) * mgPerL * (h.form === 'pellet' ? 1.1 : 1);
    return { id: h.id, name: info.name, alpha: info.alpha, time: h.time, g, ibu };
  });
  const ibu = hops.reduce((s, h) => s + h.ibu, 0);

  // --- Vergärung (Hochstammwürze drückt den Vergärungsgrad)
  const baseAtt = recipe.attenuation ?? yeast.attenuation;
  const gravityPenalty = recipe.attenuation == null ? Math.max(0, P - HIGH_GRAVITY_START) * 0.6 : 0;
  const attenuation = Math.max(40, baseAtt - gravityPenalty);
  const fgP = P * (1 - attenuation / 100);
  const fg = platoToSG(fgP);
  const realExtract = 0.1808 * P + 0.8192 * fgP;
  const abw = (P - realExtract) / (2.0665 - 0.010665 * P);
  const abv = abw * fg / 0.7907;

  // --- Farbe, Kalorien, Hefe
  const ebc = colorEBC(malts, V);
  const kcalPer100ml = (6.9 * abw + 4 * (realExtract - 0.1)) * fg;
  const cells = yeast.rate * V * P; // Milliarden Zellen
  const yeastInfo = { cellsBillion: cells, dryGrams: cells / 14, rate: yeast.rate };

  const bugu = ibu / ((og - 1) * 1000);

  return {
    og, plato: P, fg, fgP, attenuation, gravityPenalty, realExtract, abv, abw, ibu, ebc,
    kcalPer100ml, kcalPerHalfLitre: kcalPer100ml * 5, bugu,
    grainKg, malts, hops, water, yeast: yeastInfo, extractKg,
    warnings: warnings({ P, abv, malts, water, gravityPenalty, grainKg, V, recipe, ibu, bugu }),
  };
}

function warnings({ P, malts, water, gravityPenalty, grainKg, V, ibu, bugu }) {
  const w = [];
  if (P > 16) w.push({ level: 'warn', text: 'Sehr hohe Stammwürze: mehr Hefe, mehr Sauerstoff und längere Gärung/Reifung einplanen.' });
  if (gravityPenalty > 0.5) w.push({ level: 'info', text: `Hochstammwürze senkt den Vergärungsgrad um ca. ${gravityPenalty.toFixed(1).replace(".", ",")} Prozentpunkte – das Bier bleibt süßer.` });
  if (P < 7) w.push({ level: 'info', text: 'Sehr niedrige Stammwürze – Schankbier/Leichtbier, wenig Körper.' });
  malts.filter(m => m.pct > m.maxPct + 0.05).forEach(m =>
    w.push({ level: 'warn', text: `${m.name}: ${m.pct.toFixed(0)} % liegt über der empfohlenen Obergrenze von ${m.maxPct} %.` }));
  if (grainKg / V > 0.32) w.push({ level: 'warn', text: 'Sehr große Schüttung für die Menge – prüfe, ob dein Maischegefäß ausreicht.' });
  if (water.sparge < 0.5) w.push({ level: 'info', text: 'Kaum Nachguss nötig – die Maische ist sehr dick.' });
  if (bugu > 1.0) w.push({ level: 'info', text: 'BU:GU über 1,0 – das Bier wirkt deutlich bitter.' });
  if (bugu < 0.3 && ibu > 0) w.push({ level: 'info', text: 'BU:GU unter 0,3 – das Bier wirkt malzbetont/süß.' });
  return w;
}

/** Vergleich mit Stilbereich: 'low' | 'ok' | 'high' */
export function rangeStatus(value, [lo, hi]) {
  return value < lo ? 'low' : value > hi ? 'high' : 'ok';
}

const EBC_COLORS = [[2,'#FFE699'],[4,'#FFD878'],[6,'#FFCA5A'],[8,'#FFBF42'],[12,'#FBB123'],[16,'#F8A600'],[20,'#F39C00'],
  [26,'#EA8F00'],[33,'#E58500'],[39,'#DE7C00'],[47,'#D77200'],[57,'#CF6900'],[69,'#CB6200'],[79,'#C35900'],[98,'#BB5100'],
  [118,'#B54C00'],[138,'#B04500'],[158,'#A63E00'],[177,'#A13700'],[197,'#9B3200'],[236,'#8E2900'],[276,'#701C00'],
  [315,'#600D00'],[394,'#3D0708'],[1000,'#1A0000']];

export function ebcToHex(ebc) {
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  if (ebc <= EBC_COLORS[0][0]) return EBC_COLORS[0][1];
  for (let i = 1; i < EBC_COLORS.length; i++) {
    const [e1, c1] = EBC_COLORS[i];
    if (ebc <= e1) {
      const [e0, c0] = EBC_COLORS[i - 1];
      const t = (ebc - e0) / (e1 - e0);
      const a = hex(c0), b = hex(c1);
      return '#' + a.map((v, k) => Math.round(v + (b[k] - v) * t).toString(16).padStart(2, '0')).join('');
    }
  }
  return EBC_COLORS.at(-1)[1];
}
