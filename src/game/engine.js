// Spiel-Engine: Zeit, Absatz, Spenden, Steuer, Story-Fortschritt, Sandbox.
import { byId, STYLES } from '../core/data.js';
import { newRecipeFromStyle } from '../core/brew.js';
import { START_DAY, YEAR_DAYS, HOBBY_LIMIT_L, LICENSE_COST, CELLAR_RENT, INSURANCE_MONTH, EQUIPMENT, TIER_ORDER,
  CHANNELS, DONATION_TARGETS, beerTax, season } from './config.js';
import { GameError, rand, log, need, clamp, round2, spend, unlock, FEATURES, hasFeature } from './state.js';
import { CHAPTERS, EVENTS, ENDINGS, GLOBAL_EVENTS } from './story.js';
import { LEVELS, freeStyles, addXp, brewXp, levelInfo } from './progress.js';
import { qualityLabel } from './batch.js';
import { ranking } from './league.js';

export const DEFAULT_BREWERY = 'Heinrichs Hausbrauerei';
export const JOB_BUDGET = 80; // € pro 30 Tage, die du vom Gehalt fürs Brauen abzweigst
export const TUTORIAL_FEATURES = ['sudbuch', 'lager', 'gaerkeller', 'zeit', 'tagebuch'];

export function newGame({ mode = 'story', seed = 42, breweryName = DEFAULT_BREWERY, skipTutorial = false } = {}) {
  const sandbox = mode === 'sandbox';
  const s = {
    version: 2, mode, rng: seed >>> 0, day: START_DAY, cash: sandbox ? 1e9 : 250, reputation: 0, honor: 0,
    breweryName: String(breweryName || DEFAULT_BREWERY).trim().slice(0, 40) || DEFAULT_BREWERY,
    stage: sandbox ? 'brauerei' : 'garage', hygiene: 0.35, license: sandbox,
    equipment: sandbox ? { kettle: 'kessel100', fermenter: 'konisch', cooling: 'profi' } : { kettle: 'topf', fermenter: 'eimer', cooling: 'keine' },
    inventory: { malts: {}, hops: [], yeast: {}, sanitizer: 0 },
    batches: [], beers: [], nextId: 1, chapter: 0, chapterStarted: false, ended: false, event: null, flags: {},
    features: sandbox ? Object.keys(FEATURES) : [], tutorial: { step: 0, done: sandbox },
    skill: { xp: sandbox ? LEVELS.at(-1).xp : 0 }, unlocked: sandbox ? STYLES.map(x => x.id) : freeStyles(),
    litersYear: 0, taxedLYear: 0, yearStart: START_DAY,
    week: { sold: {}, rep: 0, donated: 0, festival: false },
    stats: { batches: 0, bestQuality: 0, styles: [], styleCount: {}, completedStyles: [], givenL: 0, soldL: 0, revenue: 0, taxPaid: 0,
      medals: [], donated: 0, donatedAbtei: 0, recentQ: [], recentStyles: [], raids: 0 },
    log: [],
  };
  if (sandbox) log(s, 'Sandbox-Modus: unbegrenztes Geld und Zutaten, volle Ausrüstung. Die Qualitäts-Simulation läuft trotzdem.');
  else {
    s.inventory.hops.push({ id: 'hallertauer', form: 'whole', g: 200, ageDays: 1200 }); // Opas Hopfenglas
    if (skipTutorial) finishTutorial(s, true);
    checkStory(s);
  }
  return s;
}

/** Tutorial abschließen (oder überspringen): Grundbereiche freischalten. */
export function finishTutorial(s, skipped = false) {
  s.tutorial = { step: s.tutorial?.step ?? 0, done: true, skipped };
  unlock(s, ...TUTORIAL_FEATURES);
}

/** Sandbox: Ausrüstung frei wechseln (z. B. um Garage ohne Kühlung zu testen). */
export function setEquipment(s, slot, tier) {
  need(s.mode === 'sandbox', 'Nur im Sandbox-Modus möglich.');
  need(EQUIPMENT[slot]?.[tier], 'Unbekannte Ausrüstung.');
  s.equipment[slot] = tier;
}

export function setBreweryName(s, name) {
  const n = String(name || '').trim().slice(0, 40);
  need(n.length >= 2, 'Der Name braucht mindestens 2 Zeichen.');
  s.breweryName = n;
}

// ---------- Story ----------
function eventView(id) {
  const d = EVENTS[id];
  return { id, title: d.title, who: d.who || null, text: d.text, choices: d.choices.map(c => ({ id: c.id, label: c.label })) };
}
const eventDue = (s, ev) => !s.flags['done_' + ev.id] && !((s.flags['retry_' + ev.id] || 0) > s.day) && ev.when(s);

export function checkStory(s) {
  if (s.mode !== 'story') return;
  for (let guard = 0; guard < 20; guard++) {
    if (s.event) return;
    if (s.tutorial.done) { // Nebengeschichten (z. B. die Abtei) laufen kapitelunabhängig
      const g = GLOBAL_EVENTS.find(ev => eventDue(s, ev));
      if (g) { s.event = eventView(g.id); return; }
    }
    if (s.ended) return;
    const ch = CHAPTERS[s.chapter];
    if (!ch) { s.ended = true; return; }
    if (!s.chapterStarted) { s.chapterStarted = true; log(s, ch.title + '\n' + ch.intro, 'story'); ch.onEnter?.(s); }
    const ev = ch.events.find(e => eventDue(s, e));
    if (ev) { s.event = eventView(ev.id); return; }
    if (!ch.objectives.every(o => o.done(s))) return;
    log(s, ch.outro.replace('{name}', s.breweryName), 'story');
    if (ch.ending) { s.ended = true; s.stage = 'brauerei'; log(s, ENDINGS[ch.ending].replace('{name}', s.breweryName), 'story'); return; }
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
  return ch && !s.ended ? ch.objectives.map(o => ({ id: o.id, text: o.text, done: o.done(s) })) : [];
}

// ---------- Zeit ----------
function finishBatches(s) {
  for (const b of s.batches) {
    if (b.status !== 'gaerend' || b.readyDay > s.day) continue;
    b.status = 'fertig';
    s.beers.push({ id: b.id, name: b.name, styleId: b.styleId, liters: b.liters, quality: b.quality, flaws: b.flaws, notes: b.notes,
      plato: b.calc.plato, abv: b.calc.abv, ibu: b.calc.ibu, ebc: b.calc.ebc, finishedDay: s.day });
    s.stats.bestQuality = Math.max(s.stats.bestQuality, b.quality);
    s.stats.recentQ = [...(s.stats.recentQ || []), b.quality].slice(-6);
    s.stats.recentStyles = [...(s.stats.recentStyles || []), b.styleId].slice(-6);
    addXp(s, brewXp(s, b), 'Sud ' + b.name);
    if (!s.stats.completedStyles.includes(b.styleId)) s.stats.completedStyles.push(b.styleId);
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
    const since = s.day - START_DAY;
    if (since % 7 === 0) s.week = { sold: {}, rep: 0, donated: 0, festival: false };
    if (s.mode === 'story') {
      if (since % 30 === 0) monthlyCosts(s);
      if (s.day - s.yearStart >= YEAR_DAYS) yearEnd(s);
    }
    checkStory(s);
    if (s.event) break; // Zeit bleibt stehen, bis entschieden wurde
  }
}

function monthlyCosts(s) {
  if (!s.ended && s.chapter < CHAPTERS.length - 1) { // bis zur eigenen Brauerei hast du noch deinen Job
    s.cash = round2(s.cash + JOB_BUDGET);
    log(s, `💼 Hobby-Budget aus deinem Job: +${JOB_BUDGET} €.`);
  }
  const bills = [];
  if (s.flags.miete) bills.push(['Miete für Gerdas Keller', CELLAR_RENT]);
  if (s.license) bills.push(['Betriebshaftpflicht', INSURANCE_MONTH]);
  for (const [what, eur] of bills) {
    if (s.cash >= eur) { s.cash = round2(s.cash - eur); log(s, `${what}: ${eur} €.`); }
    else { s.cash = 0; s.reputation = Math.max(0, s.reputation - 2); s.honor = Math.max(0, s.honor - 2); log(s, `${what} (${eur} €) konnte nicht bezahlt werden – Ruf −2, Ansehen −2.`, 'bad'); }
  }
}

function yearEnd(s) {
  if (!s.license && s.litersYear > HOBBY_LIMIT_L) {
    const over = s.litersYear - HOBBY_LIMIT_L;
    const tax = round2(beerTax(over, 12, 0) / 0.5); // nachträglich zum vollen Regelsatz
    const total = round2(tax + 100);
    s.cash = Math.max(0, round2(s.cash - total)); s.reputation = Math.max(0, s.reputation - 3);
    log(s, `Post vom Hauptzollamt: ${Math.round(s.litersYear)} L gebraut, aber nur ${HOBBY_LIMIT_L} L sind als Hobby steuerfrei. ` +
      `Nachzahlung Biersteuer ${tax} € plus 100 € Verspätungszuschlag. Ruf −3.`, 'bad');
  }
  s.litersYear = 0; s.taxedLYear = 0; s.yearStart = s.day;
}

// ---------- Bier abgeben ----------
const beerOf = (s, id) => { const b = s.beers.find(x => x.id === id); need(b, 'Dieses Bier gibt es nicht im Lager.'); return b; };
const takeLiters = (b, liters) => {
  need(liters > 0 && liters <= b.liters + 1e-9, `Nur ${b.liters} L von „${b.name}“ im Lager.`);
  b.liters = round2(Math.max(0, b.liters - liters));
};

/** Biersteuer, sobald Bier eine angemeldete Brauerei (Steuerlager) verlässt – auch verschenktes. */
function taxFor(s, b, liters) {
  if (!s.license || s.mode === 'sandbox') return 0;
  const tax = round2(beerTax(liters, b.plato, s.taxedLYear / 100));
  s.taxedLYear += liters;
  return tax;
}

export function give(s, beerId, liters) {
  const b = beerOf(s, beerId);
  const tax = s.license && s.mode !== 'sandbox' ? round2(beerTax(liters, b.plato, s.taxedLYear / 100)) : 0;
  need(s.cash >= tax - 1e-9, `Für ${liters} L fallen ${tax} € Biersteuer an – so viel Geld hast du nicht.`);
  takeLiters(b, liters);
  taxFor(s, b, liters);
  if (tax) { s.cash = round2(s.cash - tax); s.stats.taxPaid = round2(s.stats.taxPaid + tax); }
  s.stats.givenL = round2(s.stats.givenL + liters);
  if (s.mode === 'story') {
    let gain = (b.quality - 45) / 12 * (liters / 10);
    if (gain > 0 && s.flags.fest && s.stats.givenL - liters < 20) gain *= 1.5;
    s.reputation = round2(clamp(s.reputation + gain, 0, 100));
    log(s, `${liters} L „${b.name}“ verschenkt. Ruf ${gain >= 0 ? '+' : ''}${gain.toFixed(1)}${tax ? ` (Biersteuer ${tax} €)` : ''}.`, gain >= 0 ? 'good' : 'bad');
  } else log(s, `${liters} L „${b.name}“ verschenkt.`);
  checkStory(s);
}

const isSummer = day => { const d = ((day - 1) % YEAR_DAYS) + 1; return d >= 121 && d <= 273; };
const gambrinBeer = (s, b) => !!s.flags.gambrin && ['dubbel', 'tripel'].includes(b.styleId);

/** Gewerbe jederzeit (nach-)anmelden – auch wenn man vorher heimlich verkauft hat. */
export function registerBusiness(s) {
  need(s.mode === 'story', 'Nur im Story-Modus nötig.');
  need(hasFeature(s, 'verkauf'), 'Das Gewerbe wird erst in Kapitel 3 interessant.');
  need(!s.license, 'Du hast bereits ein Gewerbe.');
  spend(s, LICENSE_COST, 'die Anmeldungen');
  const wasBlack = !!s.flags.schwarz;
  s.license = true; s.flags.done_gewerbe = true;
  s.honor = round2(clamp(s.honor + 3, 0, 100));
  log(s, `🧾 Gewerbe, Steuerlager und Lebensmittelamt angemeldet (${LICENSE_COST} €). Ab jetzt verkaufst du legal – mit Biersteuer.` +
    (wasBlack ? ' Unter der Hand geht weiterhin – aber jetzt prüft der Zoll deine Bücher.' : '') + ' Ansehen +3.', 'good');
  checkStory(s);
}

/** Ist der Absatzweg offen? Liefert { open, reason }. */
export function channelState(s, ch) {
  const c = CHANNELS[ch];
  if (!c) return { open: false, reason: 'Unbekannter Absatzweg.' };
  if (s.mode === 'sandbox') return c.legal ? { open: true } : { open: false, reason: 'In der Sandbox gibt es keinen Schwarzmarkt.' };
  if (!hasFeature(s, 'verkauf')) return { open: false, reason: 'Verkaufen ist noch gesperrt – erst einmal verschenken und Erfahrung sammeln.' };
  if (c.legal && !s.license) return { open: false, reason: 'Verkaufen ohne Gewerbe ist verboten. Verschenken geht.' };
  if (s.reputation < c.minRep) return { open: false, reason: `Braucht ${c.minRep} Ruf.` };
  if (c.summer && !isSummer(s.day)) return { open: false, reason: 'Festivals gibt es nur von Mai bis September.' };
  return { open: true };
}
/** Wochen-Nachfrage in Litern für einen Absatzweg. */
export function channelDemand(s, ch) {
  if (s.mode === 'sandbox') return Infinity;
  const c = CHANNELS[ch];
  return Math.floor(c.base * (0.5 + s.reputation / 100) * season(s.day));
}
export const channelRoom = (s, ch) => Math.max(0, channelDemand(s, ch) - (s.week.sold[ch] || 0));
/** Preis €/L ab Brauerei: Referenzpreis × Qualität × Ruf (× Klosterbonus). */
export function priceFor(s, b, ch = 'hof') {
  const c = CHANNELS[ch];
  return round2(c.ref * (0.6 + b.quality / 125) * (1 + s.reputation / 400) * (gambrinBeer(s, b) ? 1.4 : 1));
}
/** Wahrscheinlichkeit, beim Schwarzverkauf erwischt zu werden (mit Gewerbe höher). */
export const blackRisk = (s, liters) => s.license ? Math.min(0.5, 0.07 + liters / 250) : Math.min(0.4, 0.04 + liters / 400);
export const defaultChannel = s => (s.license || s.mode === 'sandbox' ? 'hof' : 'schwarz');

export function sell(s, beerId, liters, channel = defaultChannel(s)) {
  const b = beerOf(s, beerId);
  const sandbox = s.mode === 'sandbox';
  const st = channelState(s, channel);
  need(st.open, st.reason);
  need(liters > 0 && liters <= b.liters + 1e-9, `Nur ${b.liters} L von „${b.name}“ im Lager.`);
  const room = channelRoom(s, channel);
  need(liters <= room + 1e-9, `${CHANNELS[channel].name}: Diese Woche kaufen die Leute höchstens noch ${Math.floor(room)} L.`);
  const c = CHANNELS[channel];
  if (c.fee && !sandbox && !s.week.festival) { spend(s, c.fee, 'die Standgebühr'); s.week.festival = true; }
  takeLiters(b, liters);
  s.week.sold[channel] = (s.week.sold[channel] || 0) + liters;

  if (channel === 'schwarz') {
    s.stats.blackL = round2((s.stats.blackL || 0) + liters);
    // Mit Gewerbe führt der Zoll Buch über dein Steuerlager – fehlende Liter fallen bei Prüfungen eher auf.
    if (rand(s) < blackRisk(s, liters)) {
      const evaded = round2(beerTax(s.stats.blackL, b.plato, 0) / 0.5);
      const fine = Math.max(s.license ? 1000 : 500, Math.round(evaded * (s.license ? 15 : 10)));
      const due = round2(evaded + fine);
      s.cash = Math.max(0, round2(s.cash - due));
      s.reputation = Math.max(0, s.reputation - (s.license ? 15 : 10)); s.honor = Math.max(0, s.honor - 20);
      s.stats.raids++; s.stats.blackL = 0; s.flags.vorbestraft = true;
      log(s, `${s.license ? 'BETRIEBSPRÜFUNG! In deinem Steuerlager fehlen Liter.' : 'KONTROLLE!'} Der Zoll beschlagnahmt ${liters} L. ` +
        `Steuer-Nachzahlung ${evaded} € plus Strafe ${fine} €. Ruf −${s.license ? 15 : 10}, Ansehen −20.`, 'bad');
      checkStory(s);
      return { revenue: 0, tax: 0, raided: true };
    }
  }
  let revenue = round2(priceFor(s, b, channel) * liters);
  const tax = c.legal ? taxFor(s, b, liters) : 0;
  let toAbbey = 0;
  if (gambrinBeer(s, b)) { toAbbey = round2(revenue * 0.3); s.stats.donatedAbtei = round2((s.stats.donatedAbtei || 0) + toAbbey); s.honor = round2(clamp(s.honor + toAbbey / 100, 0, 100)); }
  s.cash = round2(s.cash + revenue - tax - toAbbey);
  s.stats.soldL = round2(s.stats.soldL + liters); s.stats.revenue = round2(s.stats.revenue + revenue); s.stats.taxPaid = round2(s.stats.taxPaid + tax);
  if (!sandbox) { // Ruf entsteht durch Qualität, nicht durch Masse
    let gain = liters / 10 * (b.quality - 65) / 30;
    if (gain > 0) gain = Math.min(gain, 1.5 - s.week.rep);
    s.week.rep += Math.max(0, gain);
    s.reputation = round2(clamp(s.reputation + gain, 0, 100));
  }
  log(s, `${c.icon} ${liters} L „${b.name}“ verkauft (${c.name}): ${revenue} €` +
    (tax ? `, Biersteuer ${tax} €` : '') + (toAbbey ? `, ${toAbbey} € gehen an die Abtei St. Gambrin` : '') + '.', 'good');
  checkStory(s);
  return { revenue, tax, toAbbey, raided: false };
}

// ---------- Spenden ----------
const honorGain = (s, euros, mult) => mult * 4 * (Math.log1p((s.week.donated + euros) / 50) - Math.log1p(s.week.donated / 50));
function applyDonation(s, target, euroValue) {
  const t = DONATION_TARGETS[target];
  const gain = round2(honorGain(s, euroValue, t.mult));
  s.week.donated += euroValue;
  s.honor = round2(clamp(s.honor + gain, 0, 100));
  s.reputation = round2(clamp(s.reputation + gain / 4, 0, 100));
  if (target === 'abtei') s.stats.donatedAbtei = round2((s.stats.donatedAbtei || 0) + euroValue);
  return gain;
}
export const donationOpen = (s, target) => { const t = DONATION_TARGETS[target]; return !!t && (!t.needs || !!s.flags[t.needs]); };

export function donate(s, target, euros) {
  need(s.mode === 'story', 'Spenden gibt es nur im Story-Modus.');
  need(donationOpen(s, target), 'Diese Spende ist (noch) nicht möglich.');
  need(euros >= 5, 'Mindestens 5 €.');
  spend(s, euros, 'die Spende');
  s.stats.donated = round2(s.stats.donated + euros);
  const gain = applyDonation(s, target, euros);
  log(s, `${DONATION_TARGETS[target].icon} ${euros} € an ${DONATION_TARGETS[target].name} gespendet. Ansehen +${gain.toFixed(1)}.`, 'good');
  checkStory(s);
  return gain;
}

export function donateBeer(s, beerId, liters, target = 'feuerwehr') {
  need(s.mode === 'story', 'Spenden gibt es nur im Story-Modus.');
  const t = DONATION_TARGETS[target];
  need(t?.beer && donationOpen(s, target), 'Hier kann man kein Bier spenden.');
  const b = beerOf(s, beerId);
  const tax = s.license ? round2(beerTax(liters, b.plato, s.taxedLYear / 100)) : 0;
  need(s.cash >= tax - 1e-9, `Auch Freibier kostet Biersteuer (${tax} €) – so viel Geld hast du nicht.`);
  takeLiters(b, liters); taxFor(s, b, liters);
  if (tax) { s.cash = round2(s.cash - tax); s.stats.taxPaid = round2(s.stats.taxPaid + tax); }
  s.stats.givenL = round2(s.stats.givenL + liters);
  if (b.quality < 40) {
    s.honor = Math.max(0, s.honor - 2); s.reputation = Math.max(0, s.reputation - 1);
    log(s, `${t.icon} Das Freibier „${b.name}“ war leider kaum trinkbar. Ansehen −2, Ruf −1.`, 'bad');
    return -2;
  }
  const gain = applyDonation(s, target, liters * 5 * (b.quality / 70));
  log(s, `${t.icon} ${liters} L „${b.name}“ als Freibier an ${t.name}. Ansehen +${gain.toFixed(1)}.`, 'good');
  checkStory(s);
  return gain;
}

/** Konstanz der letzten Sude (0–100) – null, solange es weniger als 4 fertige Sude gibt. */
export function consistency(s) {
  const q = (s.stats.recentQ || []).slice(-5);
  if (q.length < 4) return null;
  const mean = q.reduce((a, b) => a + b, 0) / q.length;
  const sd = Math.sqrt(q.reduce((a, b) => a + (b - mean) ** 2, 0) / q.length);
  return { score: Math.round(clamp(100 - sd * 5, 0, 100)), mean: Math.round(mean) };
}

/** Kompakte Statuszeile für CLI/UI. */
export function summary(s) {
  const r = ranking(s);
  return {
    day: s.day, cash: s.cash, reputation: s.reputation, honor: s.honor, stage: s.stage, chapter: s.ended ? 'Ende' : CHAPTERS[s.chapter]?.title ?? 'Ende',
    level: levelInfo(s), equipment: s.equipment, bestQuality: s.stats.bestQuality, gaerend: s.batches.filter(b => b.status === 'gaerend').length,
    rank: r.myRank, rankOf: r.list.length, breweryName: s.breweryName,
  };
}
export { GameError, qualityLabel };
export { newRecipeFromStyle, byId, STYLES, TIER_ORDER };
