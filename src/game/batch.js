// Sud starten, Qualität bewerten, Fehlaromen auswürfeln.
import { HOP_FORMS, YEASTS, STYLES, byId } from '../core/data.js';
import { compute, rangeStatus, setIbu } from '../core/brew.js';
import { EQUIPMENT, YEAST_PACK_CELLS, BOTTLING_LOSS, STYLE_AROMA, FERMENT_DAYS, ambientTemp, MALT_PRICE, YEAST_PRICE, SANITIZER_PRICE, ENERGY_PER_L } from './config.js';
import { STYLE_META, levelOf, isUnlocked } from './progress.js';
import { hopKey, hopPrice, buyMalt, buyHop, buyYeast, buySanitizer } from './shop.js';
import { need, rand, log, clamp, round2 } from './state.js';

export const skillLevel = s => levelOf(s.skill.xp).lvl;
export const hygieneOf = (s, sanitized) =>
  clamp(s.hygiene + Math.min(0.14, (skillLevel(s) - 1) * 0.02) + EQUIPMENT.fermenter[s.equipment.fermenter].hygiene + (sanitized ? 0.25 : 0), 0, 1);
export const slotsOf = s => EQUIPMENT.fermenter[s.equipment.fermenter].slots + (s.flags.keller ? 1 : 0);

/** Zutaten aus dem Lager „simulieren“: Mengen prüfen und Frische je Hopfengabe bestimmen (ohne Verbrauch). */
function plan(s, recipe) {
  const sandbox = s.mode === 'sandbox';
  const calcBase = compute(recipe);
  const hops = JSON.parse(JSON.stringify(s.inventory.hops)); // Arbeitskopie
  const missing = [], used = { malts: {}, hops: hops.map(h => ({ ...h, g: 0 })) };
  const freshness = recipe.hops.map(() => 1);

  calcBase.malts.forEach(m => {
    if (sandbox) return;
    const have = s.inventory.malts[m.id] || 0;
    if (have + 1e-9 < m.kg) missing.push(`${(m.kg - have).toFixed(2)} kg ${m.name}`);
    used.malts[m.id] = m.kg;
  });

  calcBase.hops.forEach((h, i) => {
    const f = recipe.hops[i].form || 'pellet';
    const key = hopKey(h.id, f);
    let left = h.g, wsum = 0;
    const pool = hops.map((x, idx) => ({ x, idx })).filter(p => hopKey(p.x.id, p.x.form) === key)
      .sort((a, b) => b.x.ageDays - a.x.ageDays); // älteste zuerst verbrauchen
    for (const { x, idx } of pool) {
      if (left <= 1e-9) break;
      const take = Math.min(x.g, left);
      x.g -= take; left -= take; used.hops[idx].g += take;
      wsum += take * Math.exp(-HOP_FORMS[f].decay * x.ageDays);
    }
    if (sandbox) { freshness[i] = 1; return; }
    if (left > 1e-9) missing.push(`${left.toFixed(0)} g ${f === 'extract' ? 'Hopfenextrakt' : h.name + ' (' + HOP_FORMS[f].name + ')'}`);
    freshness[i] = h.g > 0 ? wsum / (h.g - left || 1) : 1;
  });
  return { calcBase, missing, used, freshness };
}

/** Vorschau: tatsächliche Werte mit Frische der Lagerhopfen, fehlende Zutaten, Hefebedarf. */
export function previewBatch(s, recipe) {
  const { missing, freshness, used } = plan(s, recipe);
  const r = { ...recipe, hops: recipe.hops.map((h, i) => ({ ...h, fresh: freshness[i] })) };
  const calc = compute(r);
  const packsNeeded = Math.ceil(calc.yeast.cellsBillion / YEAST_PACK_CELLS);
  const packsHave = s.mode === 'sandbox' ? packsNeeded : (s.inventory.yeast[recipe.yeastId] || 0);
  if (packsHave < 1) missing.push(`1+ Päckchen ${byId(YEASTS, recipe.yeastId).name}`);
  return { calc, recipe: r, freshness, missing, used, packsNeeded, packsHave, pitchRatio: Math.min(1, packsHave * YEAST_PACK_CELLS / calc.yeast.cellsBillion) };
}

export function startBatch(s, recipe, { name } = {}) {
  const meta = STYLE_META[recipe.styleId];
  need(meta, 'Unbekannter Bierstil.');
  need(isUnlocked(s, recipe.styleId), `Den Stil „${byId(STYLES, recipe.styleId).name}“ hast du noch nicht gelernt. Belege den Kurs (Level ${meta.minLevel}, ${meta.cost} €).`);
  const maxL = EQUIPMENT.kettle[s.equipment.kettle].maxBatchL;
  need(recipe.batchL <= maxL, `Dein ${EQUIPMENT.kettle[s.equipment.kettle].name} fasst höchstens ${maxL} L Ausschlag.`);
  need(s.batches.filter(b => b.status === 'gaerend').length < slotsOf(s), 'Alle Gärplätze sind belegt – warte auf einen fertigen Sud oder kaufe einen größeren Gärtank.');
  const pv = previewBatch(s, recipe);
  need(pv.missing.length === 0, `Es fehlt: ${pv.missing.join(', ')}.`);

  const sandbox = s.mode === 'sandbox';
  if (!sandbox) { // Verbrauch
    Object.entries(pv.used.malts).forEach(([id, kg]) => { s.inventory.malts[id] = round2(s.inventory.malts[id] - kg); });
    pv.used.hops.forEach((u, i) => { s.inventory.hops[i].g -= u.g; });
    s.inventory.hops = s.inventory.hops.filter(h => h.g > 0.01);
    s.inventory.yeast[recipe.yeastId] -= Math.min(pv.packsNeeded, pv.packsHave);
  }
  const sanitized = s.inventory.sanitizer > 0 || sandbox;
  if (sanitized && !sandbox) s.inventory.sanitizer--;

  const style = byId(STYLES, recipe.styleId), yeast = byId(YEASTS, recipe.yeastId);
  const c = pv.calc;
  const flaws = [], notes = [];
  const pts = { style: 0, aroma: 0, temp: 0, pitch: 0, hygiene: 0 };

  // Stil (40): 4 Kennwerte à 10 Punkte
  for (const [key, val] of [['plato', c.plato], ['abv', c.abv], ['ibu', c.ibu], ['ebc', c.ebc]]) {
    const [lo, hi] = style.ranges[key];
    const out = Math.max(0, lo - val, val - hi);
    pts.style += 10 * Math.max(0, 1 - out / (hi - lo));
    const st = rangeStatus(val, [lo, hi]);
    if (st !== 'ok') notes.push(`${{ plato: 'Stammwürze', abv: 'Alkohol', ibu: 'Bittere', ebc: 'Farbe' }[key]} ${st === 'low' ? 'zu niedrig' : 'zu hoch'} für ${style.name}.`);
  }

  // Aroma (10): späte Gaben, Extrakt liefert nichts
  const lateDose = pv.recipe.hops.reduce((sum, h, i) =>
    sum + (h.time <= 15 ? h.gPerL * HOP_FORMS[h.form || 'pellet'].aroma * pv.freshness[i] : 0), 0);
  const aromaNeed = STYLE_AROMA[recipe.styleId] ?? 0.1;
  pts.aroma = aromaNeed <= 0.03 ? 10 : 10 * clamp(lateDose / aromaNeed, 0, 1);
  if (pts.aroma < 6) { flaws.push('flach'); notes.push('Zu wenig Hopfenaroma – späte Gaben mit echtem Hopfen helfen (Extrakt hat kein Aroma).'); }

  // Gärtemperatur (20)
  const control = EQUIPMENT.cooling[s.equipment.cooling].control;
  const mid = (yeast.tMin + yeast.tMax) / 2;
  const readyIn = Math.round((FERMENT_DAYS[yeast.id] ?? 14) + Math.max(0, c.plato - 14) * 1.5);
  const ambient = ambientTemp(s.day + readyIn / 2, !!s.flags.keller);
  const fermTemp = control === 0 ? ambient : control === 1 ? mid + (rand(s) * 3 - 1.5) : mid;
  const dev = Math.max(0, yeast.tMin - fermTemp, fermTemp - yeast.tMax);
  pts.temp = 20 * Math.max(0, 1 - dev / 6);
  if (fermTemp > yeast.tMax + 2) { flaws.push('ester'); notes.push(`Gärung zu warm (${fermTemp.toFixed(1)} °C): Fuselalkohole und Lösungsmittel-Ester.`); }
  else if (fermTemp < yeast.tMin - 2) { flaws.push('traege'); notes.push(`Gärung zu kalt (${fermTemp.toFixed(1)} °C): träge, dünn, evtl. steckengeblieben.`); }

  // Hefe (10)
  pts.pitch = 10 * clamp((pv.pitchRatio - 0.4) / 0.6, 0, 1);
  if (pv.pitchRatio < 0.75) { flaws.push('unterhefung'); notes.push('Zu wenig Hefe angestellt: Stress, Schwefel, Fruchtester.'); }

  // Hygiene (20): Infektionswurf
  const hyg = hygieneOf(s, sanitized);
  const infected = rand(s) < Math.pow(1 - hyg, 2) * 0.6;
  pts.hygiene = infected ? -25 : 20;
  if (infected) { flaws.push('infektion'); notes.push('Infektion! Das Bier ist sauer/butterig – die Hygiene hat nicht gereicht.'); }

  // Hopfenqualität
  const gTotal = c.hops.reduce((a, h) => a + h.g, 0) || 1;
  const stale = pv.recipe.hops.reduce((a, h, i) => a + (pv.freshness[i] < 0.6 ? c.hops[i]?.g || 0 : 0), 0) / gTotal;
  let extra = 0;
  if (flaws.includes('ester')) extra -= 10;
  if (flaws.includes('traege')) extra -= 8;
  if (stale > 0.3) { flaws.push('oxidiert'); extra -= 8; notes.push('Alter Hopfen: käsig/muffig. Die Bittere ist zudem geringer als gerechnet.'); }
  const extractIbu = c.hops.reduce((a, h) => a + (h.form === 'extract' ? h.ibu : 0), 0);
  if (c.ibu > 0 && extractIbu / c.ibu > 0.7) { flaws.push('hart'); extra -= 8; notes.push('Bittere fast nur aus Extrakt: hart und kratzig, ohne Hopfenkomplexität.'); }

  // Können: fehlende Erfahrung bei schwierigen Stilen und Ungenauigkeit bei niedrigem Level
  const lvl = skillLevel(s);
  const complexity = Math.max(0, meta.difficulty - lvl * 0.8) * 3;
  const swing = (rand(s) * 2 - 1) * Math.max(0, 10 - lvl * 1.2);
  if (complexity > 2) notes.push(`Dir fehlt Erfahrung für diesen Stil (Schwierigkeit ${meta.difficulty}, du bist Level ${lvl}): Abzug ${complexity.toFixed(0)} Punkte.`);
  const counts = (s.stats.styleCount ||= {});
  const tries = counts[recipe.styleId] || 0;
  const practice = Math.max(0, 3 - tries) * meta.difficulty * 1.5 * Math.max(0.3, 1 - 0.1 * lvl);
  if (practice > 2) notes.push(tries === 0 ? 'Der erste Sud dieses Stils: Dir fehlt noch die Übung mit den Besonderheiten.' : 'Du übst diesen Stil noch – mit jedem Sud wird es besser.');
  extra += swing - complexity - practice;
  counts[recipe.styleId] = tries + 1;

  const quality = Math.round(clamp(Object.values(pts).reduce((a, b) => a + b, 0) + extra, 0, 100));

  // Kosten des Suds (zu aktuellen Preisen)
  const maltCost = c.malts.reduce((a, m) => a + MALT_PRICE[m.id] * m.kg, 0);
  const hopCost = c.hops.reduce((a, h) => a + hopPrice(s, h.id, h.form) * h.g, 0);
  const yeastCost = Math.min(pv.packsNeeded, pv.packsHave) * YEAST_PRICE[recipe.yeastId];
  const energyCost = ENERGY_PER_L * recipe.batchL + (sanitized ? SANITIZER_PRICE : 0);
  const cost = { malt: round2(maltCost), hops: round2(hopCost), yeast: round2(yeastCost), energy: round2(energyCost),
    total: round2(maltCost + hopCost + yeastCost + energyCost) };
  const batch = {
    id: s.nextId++, name: name || recipe.name, styleId: recipe.styleId, status: 'gaerend', startDay: s.day, readyDay: s.day + readyIn,
    liters: round2(recipe.batchL * BOTTLING_LOSS), quality, flaws, notes, points: pts, fermTemp: round2(fermTemp), pitchRatio: round2(pv.pitchRatio),
    calc: { plato: c.plato, abv: c.abv, ibu: c.ibu, ebc: c.ebc, fgP: c.fgP },
    cost, costPerLiter: round2(cost.total / (recipe.batchL * BOTTLING_LOSS)),
  };
  s.batches.push(batch);
  s.stats.batches++;
  if (!s.stats.styles.includes(recipe.styleId)) s.stats.styles.push(recipe.styleId);
  s.litersYear += recipe.batchL;
  s.hygiene = Math.min(0.6, s.hygiene + 0.02); // Übung macht sauberer
  log(s, `Sud „${batch.name}“ angesetzt – fertig in ${readyIn} Tagen. Ergebnis erst nach der Reifung.`);
  return batch;
}

export function qualityLabel(q) {
  return q < 30 ? 'Ausguss' : q < 50 ? 'gerade noch trinkbar' : q < 70 ? 'solide' : q < 85 ? 'richtig gut' : 'preisverdächtig';
}

/** Komfort: fehlende Zutaten für ein Rezept einkaufen (inkl. 1 Dosis Desinfektionsmittel). */
export function buyForRecipe(s, recipe) {
  need(isUnlocked(s, recipe.styleId), `Den Stil „${byId(STYLES, recipe.styleId).name}“ hast du noch nicht gelernt – erst den Kurs belegen.`);
  const c = compute(recipe);
  c.malts.forEach(m => {
    const lack = m.kg - (s.inventory.malts[m.id] || 0);
    if (lack > 1e-9) buyMalt(s, m.id, Math.ceil(lack * 10) / 10);
  });
  const have = {};
  s.inventory.hops.forEach(h => { const k = hopKey(h.id, h.form); have[k] = (have[k] || 0) + h.g; });
  c.hops.forEach(h => {
    const k = hopKey(h.id, h.form);
    const lack = h.g - (have[k] || 0);
    if (lack > 1e-9) { buyHop(s, h.id, h.form, Math.ceil(lack)); have[k] = (have[k] || 0) + Math.ceil(lack); }
    have[k] -= h.g;
  });
  const packs = Math.ceil(c.yeast.cellsBillion / YEAST_PACK_CELLS) - (s.inventory.yeast[recipe.yeastId] || 0);
  if (packs > 0) buyYeast(s, recipe.yeastId, packs);
  if (s.inventory.sanitizer < 1) buySanitizer(s, 1);
}

/** Hopfenform für alle Gaben wechseln und die Bittere dabei halten (Extrakt braucht viel weniger Gramm). */
export function setHopForm(recipe, form) {
  const ibu = compute(recipe).ibu;
  recipe.hops.forEach(h => { h.form = form; });
  setIbu(recipe, ibu);
}
