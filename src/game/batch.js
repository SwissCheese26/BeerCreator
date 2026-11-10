// Sud starten, Qualität bewerten, Fehlaromen auswürfeln.
import { HOP_FORMS, YEASTS, STYLES, byId } from '../core/data.js';
import { compute, rangeStatus, setIbu } from '../core/brew.js';
import { EQUIPMENT, YEAST_PACK_CELLS, BOTTLING_LOSS, FERMENT_DAYS, ambientTemp, MALT_PRICE, YEAST_PRICE, SANITIZER_PRICE, ENERGY_PER_L, PACKAGING_PER_L } from './config.js';
import { STYLE_META, levelOf, isUnlocked } from './progress.js';
import { hopKey, hopPrice, buyMalt, buyHop, buyYeast, buySanitizer } from './shop.js';
import { need, rand, log, clamp, round2, spend } from './state.js';
import { recipePotential, aromaPoints, reifungOf, optionCost } from './recipe.js';
import { styleView } from './styles.js';
import { BUNT_STYLES } from './config.js';
import { runCostFor, hasTech, techBonuses } from './business.js';

/** Laufende Kosten eines Suds, die beim Ansetzen bezahlt werden: Energie/Wasser und Flaschen/Kronkorken/Etiketten. */
export const runCost = liters => round2(liters * (ENERGY_PER_L + PACKAGING_PER_L));

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

/** Gärtemperatur, Dauer und Können – gemeinsam für Sud und Vorschau. rnd = Zufall (bei der Vorschau: null → Erwartungswert). */
function execution(s, recipe, pv, { fixedTemp = null, rnd = null } = {}) {
  const meta = STYLE_META[recipe.styleId];
  const yeast = byId(YEASTS, recipe.yeastId), c = pv.calc;
  const reif = reifungOf(recipe);
  const fermentDays = Math.round((FERMENT_DAYS[yeast.id] ?? 14) + Math.max(0, c.plato - 14) * 1.5);
  const readyIn = fermentDays + (reif?.days || 0);
  const control = EQUIPMENT.cooling[s.equipment.cooling].control;
  const mid = (yeast.tMin + yeast.tMax) / 2;
  const ambient = ambientTemp(s.day + fermentDays / 2, !!s.flags.keller);
  const fermTemp = fixedTemp ?? (control === 0 ? ambient : control === 1 ? mid + (rnd ? rnd() * 3 - 1.5 : 0) : mid);
  const dev = Math.max(0, yeast.tMin - fermTemp, fermTemp - yeast.tMax);
  const temp = 20 * Math.max(0, 1 - dev / 6);
  const pitch = hasTech(s, 'hefelabor') ? 10 : 10 * clamp((pv.pitchRatio - 0.4) / 0.6, 0, 1);
  const lvl = skillLevel(s);
  const complexity = Math.max(0, meta.difficulty - lvl * 0.8) * 3;
  const tries = s.stats.styleCount?.[recipe.styleId] || 0;
  const practice = Math.max(0, 3 - tries) * meta.difficulty * 1.5 * Math.max(0.3, 1 - 0.1 * lvl);
  const swingAmp = Math.max(0, 10 - lvl * 1.2) * (hasTech(s, 'sensorik') ? 0.5 : 1);
  return { yeast, readyIn, fermTemp, dev, temp, pitch, lvl, complexity, tries, practice, swingAmp, meta };
}

/** Vorschau fürs Brauen: Potenzial des Rezepts und was Gärung, Hefe und Erfahrung voraussichtlich abziehen. */
export function forecast(s, recipe) {
  const pv = previewBatch(s, recipe);
  const pot = recipePotential(pv.recipe);
  const ex = execution(s, recipe, pv);
  const ded = [];
  if (ex.temp < 19.5) ded.push({ label: `Gärtemperatur ca. ${ex.fermTemp.toFixed(0)} °C (die Hefe mag ${ex.yeast.temp})`,
    pts: 20 - ex.temp + (ex.fermTemp > ex.yeast.tMax + 2 ? 10 : ex.fermTemp < ex.yeast.tMin - 2 ? 8 : 0) });
  if (ex.pitch < 9.5) ded.push({ label: 'Zu wenig Hefe', pts: 10 - ex.pitch });
  if (ex.complexity + ex.practice > 0.5) ded.push({ label: ex.tries === 0 ? 'Erster Sud dieses Stils / Erfahrung' : 'Übung und Erfahrung', pts: ex.complexity + ex.practice });
  const bonus = techBonuses(s, recipe);
  const sure = pot.total - ded.reduce((a, d) => a + d.pts, 0) + bonus.reduce((a, b) => a + b.pts, 0);
  const infection = Math.pow(1 - hygieneOf(s, true), 2) * 0.6;
  return { potential: pot, deductions: ded.map(d => ({ ...d, pts: round2(d.pts) })), bonuses: bonus,
    low: Math.round(clamp(sure - ex.swingAmp, 0, 100)), high: Math.round(clamp(sure + ex.swingAmp, 0, 100)),
    infection, readyIn: ex.readyIn, preview: pv };
}

export function startBatch(s, recipe, { name, tutorial = false, fermTemp: fixedTemp = null } = {}) {
  const meta = STYLE_META[recipe.styleId];
  need(meta, 'Unbekannter Bierstil.');
  need(isUnlocked(s, recipe.styleId), `Den Stil „${byId(STYLES, recipe.styleId).name}“ hast du noch nicht gelernt. Belege den Kurs (Level ${meta.minLevel}, ${meta.cost} €).`);
  const maxL = EQUIPMENT.kettle[s.equipment.kettle].maxBatchL;
  need(recipe.batchL <= maxL, `Dein ${EQUIPMENT.kettle[s.equipment.kettle].name} fasst höchstens ${maxL} L Ausschlag.`);
  need(recipe.batchL >= 5, 'Mindestens 5 L pro Sud.');
  need(s.batches.filter(b => b.status === 'gaerend').length < slotsOf(s), 'Alle Gärplätze sind belegt – warte auf einen fertigen Sud oder kaufe einen größeren Gärtank.');
  const pv = previewBatch(s, recipe);
  need(pv.calc.grainKg > 0, 'Ohne Malz kein Bier – füge mindestens ein Malz hinzu.');
  need(!recipe.filter || hasTech(s, 'filter'), 'Zum Filtrieren brauchst du einen Plattenfilter (Technik).');
  need(pv.missing.length === 0, `Es fehlt: ${pv.missing.join(', ')}.`);

  const sandbox = s.mode === 'sandbox';
  const running = round2(runCostFor(s, recipe.batchL) + optionCost(recipe));
  need(sandbox || s.cash >= running - 1e-9, `Für Energie, Wasser und Flaschen fehlen dir ${round2(running - s.cash)} € (${running} € nötig).`);
  if (!sandbox) { // Verbrauch
    spend(s, running, 'Energie und Flaschen');
    Object.entries(pv.used.malts).forEach(([id, kg]) => { s.inventory.malts[id] = round2(s.inventory.malts[id] - kg); });
    pv.used.hops.forEach((u, i) => { s.inventory.hops[i].g -= u.g; });
    s.inventory.hops = s.inventory.hops.filter(h => h.g > 0.01);
    s.inventory.yeast[recipe.yeastId] -= Math.min(pv.packsNeeded, pv.packsHave);
  }
  const sanitized = s.inventory.sanitizer > 0 || sandbox;
  if (sanitized && !sandbox) s.inventory.sanitizer--;

  const style = styleView(recipe);
  const c = pv.calc;
  const flaws = [], notes = [];
  // Potenzial des Rezepts (mit der echten Frische der Lagerhopfen)
  const pot = recipePotential(pv.recipe);
  for (const [key, val] of [['plato', c.plato], ['abv', c.abv], ['ibu', c.ibu], ['ebc', c.ebc]]) {
    const st = rangeStatus(val, style.ranges[key]);
    if (st !== 'ok') notes.push(`${{ plato: 'Stammwürze', abv: 'Alkohol', ibu: 'Bittere', ebc: 'Farbe' }[key]} ${st === 'low' ? 'zu niedrig' : 'zu hoch'} für ${style.name}.`);
  }
  if (aromaPoints(pv.recipe) < 6) { flaws.push('flach'); notes.push('Zu wenig Hopfenaroma – späte Gaben mit echtem Hopfen helfen (Extrakt hat kein Aroma).'); }

  const ex = execution(s, recipe, pv, { fixedTemp, rnd: () => rand(s) });
  const { fermTemp, readyIn, lvl, complexity, practice, tries } = ex;
  const pts = { potential: pot.total, temp: ex.temp, pitch: ex.pitch, hygiene: 0 };
  if (fermTemp > ex.yeast.tMax + 2) { flaws.push('ester'); notes.push(`Gärung zu warm (${fermTemp.toFixed(1)} °C): Fuselalkohole und Lösungsmittel-Ester.`); }
  else if (fermTemp < ex.yeast.tMin - 2) { flaws.push('traege'); notes.push(`Gärung zu kalt (${fermTemp.toFixed(1)} °C): träge, dünn, evtl. steckengeblieben.`); }
  if (pv.pitchRatio < 0.75) { flaws.push('unterhefung'); notes.push('Zu wenig Hefe angestellt: Stress, Schwefel, Fruchtester.'); }

  // Hygiene: Infektionswurf
  const hyg = hygieneOf(s, sanitized);
  const infected = !tutorial && rand(s) < Math.pow(1 - hyg, 2) * 0.6;
  if (infected) { pts.hygiene = -45; flaws.push('infektion'); notes.push('Infektion! Das Bier ist sauer/butterig – die Hygiene hat nicht gereicht.'); }

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
  const swing = (rand(s) * 2 - 1) * ex.swingAmp;
  if (complexity > 2) notes.push(`Dir fehlt Erfahrung für diesen Stil (Schwierigkeit ${meta.difficulty}, du bist Level ${lvl}): Abzug ${complexity.toFixed(0)} Punkte.`);
  if (practice > 2) notes.push(tries === 0 ? 'Der erste Sud dieses Stils: Dir fehlt noch die Übung mit den Besonderheiten.' : 'Du übst diesen Stil noch – mit jedem Sud wird es besser.');
  extra += swing - complexity - practice;
  (s.stats.styleCount ||= {})[recipe.styleId] = tries + 1;

  const tq = techBonuses(s, recipe);
  tq.forEach(t => { if (t.pts < 0) notes.push(t.label + '.'); });
  extra += tq.reduce((a, t) => a + t.pts, 0);
  let quality = Math.round(clamp(pot.total - (20 - ex.temp) - (10 - ex.pitch) + pts.hygiene + extra, 0, 100));
  if (tutorial) quality = Math.round(clamp(quality, 55, 72)); // Das erste, geführte Bier gelingt ordentlich – mit Luft nach oben

  // Kosten des Suds (zu aktuellen Preisen)
  const maltCost = c.malts.reduce((a, m) => a + MALT_PRICE[m.id] * m.kg, 0);
  const hopCost = c.hops.reduce((a, h) => a + hopPrice(s, h.id, h.form) * h.g, 0);
  const yeastCost = Math.min(pv.packsNeeded, pv.packsHave) * YEAST_PRICE[recipe.yeastId];
  const energyCost = ENERGY_PER_L * recipe.batchL * (hasTech(s, 'waerme') ? 0.6 : 1) + (sanitized ? SANITIZER_PRICE : 0) + optionCost(recipe);
  const packCost = PACKAGING_PER_L * recipe.batchL * (hasTech(s, 'abfueller') ? 0.6 : 1);
  const cost = { malt: round2(maltCost), hops: round2(hopCost), yeast: round2(yeastCost), energy: round2(energyCost), packaging: round2(packCost),
    total: round2(maltCost + hopCost + yeastCost + energyCost + packCost) };
  const batch = {
    id: s.nextId++, name: name || recipe.name, styleId: recipe.styleId, status: 'gaerend',
    custom: recipe.custom ? { id: recipe.custom.id, name: recipe.custom.name } : undefined,
    bunt: BUNT_STYLES.includes(recipe.styleId) || !!recipe.custom?.bunt, startDay: s.day, readyDay: s.day + readyIn,
    liters: round2(recipe.batchL * BOTTLING_LOSS * (recipe.filter && !hasTech(s, 'zentrifuge') ? 0.96 : 1)), quality, filtered: !!recipe.filter, potential: pot.total, flaws, notes, points: pts, fermTemp: round2(fermTemp), pitchRatio: round2(pv.pitchRatio),
    calc: { plato: c.plato, abv: c.abv, ibu: c.ibu, ebc: c.ebc, fgP: c.fgP },
    cost, costPerLiter: round2(cost.total / (recipe.batchL * BOTTLING_LOSS)), tutorial,
  };
  s.batches.push(batch);
  s.stats.batches++;
  if (!s.stats.styles.includes(recipe.styleId)) s.stats.styles.push(recipe.styleId);
  s.litersYear += recipe.batchL;
  s.hygiene = Math.min(0.6, s.hygiene + 0.02); // Übung macht sauberer
  log(s, `Sud „${batch.name}“ angesetzt (Potenzial ${pot.total}) – fertig in ${readyIn} Tagen. Ergebnis erst nach der Reifung.`);
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
