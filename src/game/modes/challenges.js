// Challenge-Modus: handgebaute Szenarien mit Regeln, Frist und 1–3 Sternen + tägliche Aufgabe.
import { STYLES, byId } from '../../core/data.js';
import { EQUIPMENT } from '../config.js';
import { STYLE_META, LEVELS } from '../progress.js';
import { log, need, rand } from '../state.js';

const setLevel = (s, lvl) => { s.skill.xp = LEVELS[lvl - 1].xp; };
const unlockAll = (s, maxLevel = 8) => { s.unlocked = STYLES.filter(x => STYLE_META[x.id].minLevel <= maxLevel).map(x => x.id); };
const finished = (s, f = () => true) => s.beers.filter(f);
const bestQuality = (s, f) => finished(s, f).reduce((a, b) => Math.max(a, b.quality), 0) || null;

// better: 'higher' | 'lower' · stars: Schwellen für ⭐, ⭐⭐, ⭐⭐⭐ · measure(s) → Zahl oder null
export const SCENARIOS = {
  erster_sud: {
    title: 'Der erste Sud', difficulty: 1, deadline: 70, better: 'higher', unit: 'Qualität', stars: [55, 75, 92],
    intro: 'Frühling, Garage, 120 € und ein Traum: Braue ein gutes Bier. Der Winter ist vorbei, die Temperaturen stimmen für Lager.',
    goal: 'Erreiche mit einem fertigen Bier möglichst hohe Qualität.',
    setup: s => { s.day = 100; s.cash = 120; },
    measure: s => bestQuality(s),
  },
  extrakt_dilemma: {
    title: 'Das Extrakt-Dilemma', difficulty: 3, deadline: 90, better: 'higher', unit: 'Qualität (Pils)', stars: [65, 80, 90],
    intro: 'Dein Liefervertrag erlaubt nur Hopfenextrakt – aber ein Pils ohne Aroma ist kein Pils. In der Garage liegen noch 150 g Doldenhopfen vom letzten Jahr.',
    goal: 'Braue ein Pils mit möglichst hoher Qualität. Du darfst nur Extrakt nachkaufen.',
    setup: s => { s.day = 90; s.cash = 160; s.flags.extrakt_vertrag = true; s.inventory.hops.push({ id: 'hallertauer', form: 'whole', g: 150, ageDays: 200 }); },
    measure: s => bestQuality(s, b => b.styleId === 'pils'),
  },
  sparbrauer: {
    title: 'Der Sparbrauer', difficulty: 2, deadline: 90, better: 'lower', unit: '€ pro Liter (Helles, Qualität ≥ 60)', stars: [2.3, 1.85, 1.6],
    intro: 'Die Kasse ist leer, der Durst groß. Braue ein ordentliches Helles so günstig wie möglich.',
    goal: 'Ein Helles mit Qualität ≥ 60 – je niedriger die Kosten pro Liter, desto mehr Sterne.',
    setup: s => { s.day = 80; s.cash = 150; setLevel(s, 2); },
    measure: s => { const c = finished(s, b => b.styleId === 'helles' && b.quality >= 60).map(b => b.costPerLiter); return c.length ? Math.min(...c) : null; },
  },
  sommerhitze: {
    title: 'Hitzewelle', difficulty: 3, deadline: 80, better: 'higher', unit: 'Qualität', stars: [60, 80, 90],
    intro: 'Hochsommer, 29 °C in der Garage, keine Kühlung. Die meisten Hefen drehen durch. Welche nicht?',
    goal: 'Braue trotz Hitze ein Bier mit möglichst hoher Qualität.',
    setup: s => { s.day = 185; s.cash = 400; s.weather = 6; setLevel(s, 5); unlockAll(s); },
    measure: s => bestQuality(s),
  },
  imperial_meister: {
    title: 'Die Meisterprüfung', difficulty: 5, deadline: 130, better: 'higher', unit: 'Qualität (Imperial Stout)', stars: [75, 90, 97],
    intro: 'Das Prüfungskomitee verlangt ein Imperial Stout. Hohe Stammwürze, viel Hefe, saubere Gärung – und mehrere Versuche brauchst du wohl.',
    goal: 'Braue ein Imperial Stout mit möglichst hoher Qualität.',
    setup: s => { s.day = 300; s.cash = 700; setLevel(s, 6); unlockAll(s); s.equipment = { kettle: 'kessel50', fermenter: 'edelstahl', cooling: 'kuehlschrank' }; },
    measure: s => bestQuality(s, b => b.styleId === 'imperial'),
  },
  kaufmann: {
    title: 'Der Kaufmann', difficulty: 3, deadline: 150, better: 'higher', unit: '€ Kapital', stars: [250, 450, 700],
    intro: 'Gewerbe läuft, Kasse fast leer: nur 100 €. Mach daraus in fünf Monaten ein kleines Vermögen.',
    goal: 'Erreiche möglichst viel Kapital. Biersteuer und Nachfrage begrenzen dich.',
    setup: s => { s.day = 60; s.cash = 100; s.license = true; setLevel(s, 3); s.unlocked = [...new Set([...s.unlocked, 'koelsch', 'maerzen'])]; },
    measure: s => s.cash,
  },
  sommelier: {
    title: 'Der Allrounder', difficulty: 4, deadline: 365, better: 'higher', unit: 'Stile mit Qualität ≥ 80', stars: [4, 6, 8],
    intro: 'Ein Jahr, ein Kühlschrank und ein Anspruch: Zeige, dass du viele Stile beherrschst – nicht nur einen.',
    goal: 'Braue möglichst viele verschiedene Stile mit Qualität ≥ 80.',
    setup: s => { s.day = 60; s.cash = 1500; setLevel(s, 4); unlockAll(s, 4); s.equipment = { kettle: 'kessel50', fermenter: 'edelstahl', cooling: 'kuehlschrank' }; },
    measure: s => new Set(finished(s, b => b.quality >= 80).map(b => b.styleId)).size || null,
  },
};

const starsFor = (sc, value) => value == null ? 0 : sc.stars.filter(t => sc.better === 'lower' ? value <= t : value >= t).length;

/** Tagesaufgabe aus Datum: gleiche Aufgabe für alle am selben Tag. */
export function dailyScenario(dateStr) {
  let h = 2166136261;
  for (const ch of dateStr) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const pick = (arr, k) => arr[(Math.imul(h, 2654435761) >>> (k * 5)) % arr.length];
  const style = pick(STYLES.filter(x => STYLE_META[x.id].minLevel <= 4), 1);
  const twist = pick(['frei', 'extrakt', 'hitze', 'budget'], 3);
  const twistText = { frei: 'Keine Besonderheit – zeige dein Können.', extrakt: 'Dein Liefervertrag erlaubt nur Hopfenextrakt.',
    hitze: 'Hitzewelle: Hochsommer ohne Kühlung.', budget: 'Budget: höchstens 2,40 € pro Liter Fertigbier.' }[twist];
  return {
    id: `daily-${dateStr}`, title: `Tagesaufgabe ${dateStr}: ${style.name}`, difficulty: STYLE_META[style.id].difficulty, deadline: 100, daily: true, seed: h,
    better: 'higher', unit: `Qualität (${style.name})`, stars: [60, 78, 90],
    intro: `Heute gesucht: ${style.name}. ${twistText}`, goal: `Braue ein ${style.name} mit möglichst hoher Qualität. ${twistText}`,
    setup: s => {
      s.day = twist === 'hitze' ? 185 : 100; s.cash = 400; setLevel(s, 4); unlockAll(s, 4);
      s.equipment = { kettle: 'kessel50', fermenter: 'edelstahl', cooling: twist === 'hitze' ? 'keine' : 'kuehlschrank' };
      if (twist === 'extrakt') { s.flags.extrakt_vertrag = true; s.inventory.hops.push({ id: 'hallertauer', form: 'whole', g: 150, ageDays: 200 }); }
      if (twist === 'hitze') s.weather = 6;
    },
    measure: s => bestQuality(s, b => b.styleId === style.id && (twist !== 'budget' || b.costPerLiter <= 2.4)),
  };
}

export const challengeList = () => Object.entries(SCENARIOS).map(([id, c]) => ({ id, title: c.title, difficulty: c.difficulty, deadline: c.deadline, goal: c.goal }));

export function initChallenge(s, id, scenario = null) {
  const sc = scenario || SCENARIOS[id];
  need(sc, 'Unbekannte Challenge.');
  s.license = false; s.stage = 'garage';
  s.cash = 200; s.reputation = 0; s.equipment = { kettle: 'topf', fermenter: 'eimer', cooling: 'keine' };
  sc.setup(s);
  s.challenge = { id: sc.id || id, title: sc.title, startDay: s.day, deadline: s.day + sc.deadline, status: 'laufend', best: null, stars: 0, daily: !!sc.daily };
  if (sc.daily) s.challenge.scenarioDate = (sc.id || '').slice(6);
  log(s, `${sc.title}\n${sc.intro}\nZiel: ${sc.goal} Frist: ${sc.deadline} Tage.`, 'story');
}

const scenarioOf = s => s.challenge.daily ? dailyScenario(s.challenge.scenarioDate) : SCENARIOS[s.challenge.id];

export function challengeStatus(s) {
  if (!s.challenge) return null;
  const sc = scenarioOf(s);
  const value = sc.measure(s);
  const best = value == null ? s.challenge.best : s.challenge.best == null ? value : (sc.better === 'lower' ? Math.min(value, s.challenge.best) : Math.max(value, s.challenge.best));
  return { ...s.challenge, goal: sc.goal, unit: sc.unit, thresholds: sc.stars, better: sc.better, current: value, best, stars: starsFor(sc, best), daysLeft: s.challenge.deadline - s.day };
}

/** Abgeben: beendet die Challenge mit dem bisher besten Ergebnis. */
export function finishChallenge(s) {
  need(s.challenge && s.challenge.status === 'laufend', 'Keine laufende Challenge.');
  const st = challengeStatus(s);
  s.challenge.best = st.best; s.challenge.stars = st.stars;
  s.challenge.status = st.stars > 0 ? 'bestanden' : 'gescheitert';
  s.gameOver = { reason: s.challenge.status, stars: st.stars, best: st.best, score: st.stars * 100 + Math.round(Math.max(0, st.daysLeft)), day: s.day };
  log(s, `${s.challenge.title}: ${st.stars > 0 ? '⭐'.repeat(st.stars) + ' bestanden' : 'nicht geschafft'} (Ergebnis ${st.best ?? '–'} ${st.unit}).`, st.stars > 0 ? 'good' : 'bad');
  return st;
}

export function challengeTick(s) {
  if (!s.challenge || s.challenge.status !== 'laufend') return;
  const st = challengeStatus(s);
  s.challenge.best = st.best;
  if (st.stars >= 3 || s.day >= s.challenge.deadline) finishChallenge(s);
}
