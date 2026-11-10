// Einfacher Spielbot: spielt die Story durch (zum Testen von Machbarkeit und Balance).
import * as g from '../src/game/index.js';
import { newRecipeFromStyle } from '../src/core/brew.js';

const CHOICES = {
  opa_brief: () => 'buch', fest_einladung: () => 'zusagen', keller_angebot: () => 'annehmen', wettbewerb: () => 'teilnehmen',
  lieferant: () => 'bauer', kenner: () => 'absicht', zollinger: () => 'sorgfaeltig',
  gewerbe: s => (s.cash >= g.LICENSE_COST ? 'anmelden' : 'hobby'),
  heizluefter: s => (s.cash >= 25 ? 'kaufen' : 'decken'),
  kursleiter: s => (s.cash >= 60 ? 'kurs' : 'bier'),
  abtei_besuch: () => 'zusagen', abtei_sud: () => 'siegel',
};
const WISH = ['helles', 'pils', 'weizen', 'maerzen', 'pale', 'koelsch'];

/** Spielt das Tutorial mit den richtigen Eingaben durch. */
export function playTutorial(s) {
  const input = { maischen: 67, gaeren: 'warm' };
  while (!s.tutorial.done) g.tutorialAct(s, input[g.TUTORIAL_STEPS[s.tutorial.step].id]);
}

export function playStory({ seed = 1, maxDays = 1500, verbose = false } = {}) {
  const s = g.newGame({ mode: 'story', seed });
  playTutorial(s);
  let brewed = 0;
  while (!s.ended && s.day < START + maxDays) {
    if (s.event) { g.resolveEvent(s, CHOICES[s.event.id](s)); continue; }

    // Ausrüstung ab dem Kapitel „Keller“
    const ch = g.CHAPTERS[s.chapter]?.id;
    if (ch === 'keller' || s.chapter > 4) {
      if (s.equipment.cooling === 'keine' && s.cash >= 280) g.buyGear(s, 'cooling', 'kuehlschrank');
      if (s.equipment.kettle === 'topf' && s.cash >= 450 + 60) g.buyGear(s, 'kettle', 'kessel50');
      if (s.chapter > 4 && s.equipment.fermenter === 'eimer' && s.cash >= 260 + 100) g.buyGear(s, 'fermenter', 'edelstahl');
    }

    // Brauen, solange Platz ist
    const slots = g.slotsOf(s) - s.batches.filter(b => b.status === 'gaerend').length;
    if (slots > 0 && s.cash > 60) {
      for (const w of WISH) { // Kurse belegen, sobald Level und Geld reichen
        const m = g.STYLE_META[w];
        if (!s.unlocked.includes(w) && g.levelOf(s.skill.xp).lvl >= m.minLevel && s.cash > m.cost + 250) g.buyStyle(s, w);
      }
      const cycle = WISH.filter(w => s.unlocked.includes(w));
      const style = s.stats.styles.length < 3 || brewed % 4 === 0 ? cycle[brewed % cycle.length] : 'helles';
      const r = newRecipeFromStyle(style);
      r.batchL = s.equipment.kettle === 'topf' ? 20 : 40;
      try { g.buyForRecipe(s, r); g.startBatch(s, r); brewed++; } catch (e) { if (!(e instanceof g.GameError)) throw e; }
    }

    // Bier abgeben: im Fest-Kapitel verschenken, sonst über die offenen Absatzwege verkaufen
    for (const beer of s.beers.filter(b => b.liters > 0.01)) {
      if (ch === 'fest') { g.give(s, beer.id, Math.min(beer.liters, 10)); continue; }
      for (const c of ['gastro', 'hof', 'festival', 'schwarz']) {
        if (!g.channelState(s, c).open || (c === 'festival' && beer.liters < 25) || (c === 'schwarz' && s.license)) continue;
        const room = Math.floor(g.channelRoom(s, c));
        const l = Math.min(Math.floor(beer.liters), room);
        if (l > 0) { try { g.sell(s, beer.id, l, c); } catch (e) { if (!(e instanceof g.GameError)) throw e; } }
        if (s.event) break;
      }
      if (s.event) break;
    }
    if (s.event) continue;
    g.advanceDays(s, 3);
  }
  if (verbose) console.log(s.log.filter(l => l.kind === 'story').map(l => `[Tag ${l.day}] ${l.text}`).join('\n'));
  return s;
}
const START = g.START_DAY;
