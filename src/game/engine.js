// Spiel-Engine: Zeit, Verkauf, Verschenken, Story-Fortschritt, Sandbox.
import { byId, STYLES } from '../core/data.js';
import { newRecipeFromStyle } from '../core/brew.js';
import { START_DAY, YEAR_DAYS, HOBBY_LIMIT_L, TAX_PER_HL_PLATO, TAX_SMALL_FACTOR, CELLAR_RENT, EQUIPMENT, TIER_ORDER } from './config.js';
import { GameError, rand, log, need, clamp, round2 } from './state.js';
import { CHAPTERS, EVENTS, ENDINGS } from './story.js';
import { qualityLabel } from './batch.js';

export function newGame({ mode = 'story', seed = 42 } = {}) {
  const sandbox = mode === 'sandbox';
  const s = {
    version: 1, mode, rng: seed >>> 0, day: START_DAY, cash: sandbox ? 1e9 : 250, reputation: 0,
    stage: sandbox ? 'brauerei' : 'garage', hygiene: 0.35, license: sandbox,
    equipment: sandbox ? { kettle: 'kessel100', fermenter: 'konisch', cooling: 'profi' } : { kettle: 'topf', fermenter: 'eimer', cooling: 'keine' },
    inventory: { malts: {}, hops: [], yeast: {}, sanitizer: 0 },
    batches: [], beers: [], nextId: 1, chapter: 0, chapterStarted: false, ended: false, event: null, flags: {},
    litersYear: 0, yearStart: START_DAY, soldWeek: 0,
    stats: { batches: 0, bestQuality: 0, styles: [], givenL: 0, soldL: 0, revenue: 0, taxPaid: 0, medals: [] },
    log: [],
  };
  if (sandbox) log(s, 'Sandbox-Modus: unbegrenztes Geld und Zutaten, volle Ausrüstung. Die Qualitäts-Simulation läuft trotzdem.');
  else {
    s.inventory.hops.push({ id: 'hallertauer', form: 'whole', g: 200, ageDays: 1200 }); // Opas Hopfenglas
    checkStory(s);
  }
  return s;
}

/** Sandbox: Ausrüstung frei wechseln (z. B. um Garage ohne Kühlung zu testen). */
export function setEquipment(s, slot, tier) {
  need(s.mode === 'sandbox', 'Nur im Sandbox-Modus möglich.');
  need(EQUIPMENT[slot]?.[tier], 'Unbekannte Ausrüstung.');
  s.equipment[slot] = tier;
}

// ---------- Story ----------
function eventView(id) {
  const d = EVENTS[id];
  return { id, title: d.title, text: d.text, choices: d.choices.map(c => ({ id: c.id, label: c.label })) };
}

export function checkStory(s) {
  if (s.mode !== 'story' || s.ended) return;
  for (let guard = 0; guard < 20; guard++) {
    const ch = CHAPTERS[s.chapter];
    if (!ch) { s.ended = true; return; }
    if (!s.chapterStarted) { s.chapterStarted = true; log(s, ch.title + '\n' + ch.intro, 'story'); ch.onEnter?.(s); }
    if (s.event) return;
    for (const ev of ch.events) {
      if (s.flags['done_' + ev.id]) continue;
      if ((s.flags['retry_' + ev.id] || 0) > s.day) continue;
      if (ev.when(s)) { s.event = eventView(ev.id); return; }
    }
    if (!ch.objectives.every(o => o.done(s))) return;
    log(s, ch.outro, 'story');
    if (ch.ending) { s.ended = true; s.stage = 'brauerei'; log(s, ENDINGS[ch.ending], 'story'); return; }
    s.chapter++; s.chapterStarted = false;
  }
}

export function resolveEvent(s, choiceId) {
  need(s.event, 'Es gibt gerade keine Entscheidung.');
  const def = EVENTS[s.event.id];
  const choice = def.choices.find(c => c.id === choiceId);
  need(choice, 'Unbekannte Option.');
  need(!choice.enabled || choice.enabled(s), 'Diese Option ist gerade nicht verfügbar (Geld oder Voraussetzung fehlt).');
  const text = choice.apply(s);
  log(s, text, 'story');
  if (choice.done !== false) s.flags['done_' + s.event.id] = true;
  s.event = null;
  checkStory(s);
  return text;
}

export function objectives(s) {
  const ch = CHAPTERS[s.chapter];
  return ch ? ch.objectives.map(o => ({ id: o.id, text: o.text, done: o.done(s) })) : [];
}

// ---------- Zeit ----------
function finishBatches(s) {
  for (const b of s.batches) {
    if (b.status !== 'gaerend' || b.readyDay > s.day) continue;
    b.status = 'fertig';
    s.beers.push({ id: b.id, name: b.name, styleId: b.styleId, liters: b.liters, quality: b.quality, flaws: b.flaws, notes: b.notes,
      plato: b.calc.plato, abv: b.calc.abv, ibu: b.calc.ibu, ebc: b.calc.ebc, finishedDay: s.day });
    s.stats.bestQuality = Math.max(s.stats.bestQuality, b.quality);
    log(s, `„${b.name}“ ist fertig: Qualität ${b.quality}/100 (${qualityLabel(b.quality)}).` +
      (b.notes.length ? ' ' + b.notes.join(' ') : ''), b.quality >= 50 ? 'good' : 'bad');
  }
}

export function advanceDays(s, n = 1) {
  need(!s.event, 'Triff zuerst die offene Entscheidung.');
  for (let i = 0; i < n; i++) {
    s.day++;
    s.inventory.hops.forEach(h => { h.ageDays++; });
    finishBatches(s);
    if ((s.day - START_DAY) % 7 === 0) s.soldWeek = 0;
    if (s.mode === 'story') {
      if (s.flags.miete && (s.day - START_DAY) % 30 === 0) {
        if (s.cash >= CELLAR_RENT) { s.cash = round2(s.cash - CELLAR_RENT); log(s, `Miete für Gerdas Keller: ${CELLAR_RENT} €.`); }
        else { s.cash = 0; s.reputation = Math.max(0, s.reputation - 2); log(s, 'Du konntest die Kellermiete nicht zahlen – Gerda ist enttäuscht (Ruf −2).', 'bad'); }
      }
      if (s.day - s.yearStart >= YEAR_DAYS) {
        if (!s.license && s.litersYear > HOBBY_LIMIT_L) {
          s.cash = Math.max(0, s.cash - 300); s.reputation = Math.max(0, s.reputation - 3);
          log(s, `Das Zollamt meldet sich: ${Math.round(s.litersYear)} L statt der erlaubten ${HOBBY_LIMIT_L} L Hobbymenge. Bußgeld 300 €, Ruf −3.`, 'bad');
        }
        s.litersYear = 0; s.yearStart = s.day;
      }
    }
    checkStory(s);
    if (s.event) break; // Zeit bleibt stehen, bis entschieden wurde
  }
}

// ---------- Bier abgeben ----------
const beerOf = (s, id) => { const b = s.beers.find(x => x.id === id); need(b, 'Dieses Bier gibt es nicht im Lager.'); return b; };

export function give(s, beerId, liters) {
  const b = beerOf(s, beerId);
  need(liters > 0 && liters <= b.liters + 1e-9, `Nur ${b.liters} L von „${b.name}“ im Lager.`);
  b.liters = round2(b.liters - liters);
  s.stats.givenL = round2(s.stats.givenL + liters);
  if (s.mode === 'story') {
    let gain = (b.quality - 45) / 12 * (liters / 10);
    if (gain > 0 && s.flags.fest && s.stats.givenL - liters < 20) gain *= 1.5;
    s.reputation = round2(clamp(s.reputation + gain, 0, 100));
    log(s, `${liters} L „${b.name}“ verschenkt. Ruf ${gain >= 0 ? '+' : ''}${gain.toFixed(1)}.`, gain >= 0 ? 'good' : 'bad');
  } else log(s, `${liters} L „${b.name}“ verschenkt.`);
  checkStory(s);
}

export const marketDemand = s => s.mode === 'sandbox' ? Infinity : 20 + s.reputation * 1.5;
export const pricePerLiter = (s, b) => (1.8 + b.quality / 100 * 4.2) * (1 + s.reputation / 200);

export function sell(s, beerId, liters) {
  const b = beerOf(s, beerId);
  const sandbox = s.mode === 'sandbox';
  need(sandbox || s.license || s.flags.schwarz, 'Verkaufen ohne Gewerbe ist verboten. Verschenken geht.');
  need(liters > 0 && liters <= b.liters + 1e-9, `Nur ${b.liters} L von „${b.name}“ im Lager.`);
  const room = marketDemand(s) - s.soldWeek;
  need(liters <= room + 1e-9, `Diese Woche kaufen die Leute höchstens noch ${Math.max(0, Math.floor(room))} L.`);
  b.liters = round2(b.liters - liters);
  s.soldWeek += liters;

  if (s.flags.schwarz && !s.license && rand(s) < 0.12) {
    s.cash = Math.max(0, s.cash - 300); s.reputation = Math.max(0, s.reputation - 10);
    log(s, 'KONTROLLE! Das Zollamt beschlagnahmt die Ware und verhängt 300 € Strafe. Ruf −10.', 'bad');
    return { revenue: 0, tax: 0, raided: true };
  }
  const revenue = round2(pricePerLiter(s, b) * liters);
  const tax = s.license && !sandbox ? round2(liters * b.plato * TAX_PER_HL_PLATO / 100 * TAX_SMALL_FACTOR) : 0;
  s.cash = round2(s.cash + revenue - tax);
  s.stats.soldL = round2(s.stats.soldL + liters); s.stats.revenue = round2(s.stats.revenue + revenue); s.stats.taxPaid = round2(s.stats.taxPaid + tax);
  if (!sandbox) s.reputation = round2(clamp(s.reputation + (b.quality - 55) / 40 * (liters / 10), 0, 100));
  log(s, `${liters} L „${b.name}“ verkauft: ${revenue} € (Biersteuer ${tax} €).`, 'good');
  checkStory(s);
  return { revenue, tax, raided: false };
}

/** Kompakte Statuszeile für CLI/UI. */
export function summary(s) {
  return {
    day: s.day, cash: s.cash, reputation: s.reputation, stage: s.stage, chapter: CHAPTERS[s.chapter]?.title ?? 'Ende',
    equipment: s.equipment, bestQuality: s.stats.bestQuality, gaerend: s.batches.filter(b => b.status === 'gaerend').length,
  };
}
export { GameError, qualityLabel };
export { newRecipeFromStyle, byId, STYLES, TIER_ORDER };
