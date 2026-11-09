// Einfacher Spielbot: spielt die Story durch (zum Testen von Machbarkeit und Balance).
import * as g from '../src/game/index.js';
import { newRecipeFromStyle } from '../src/core/brew.js';

const CHOICES = { opa_brief: 'buch', fest_einladung: 'zusagen', gewerbe: 'anmelden', keller_angebot: 'annehmen', wettbewerb: 'teilnehmen', lieferant: 'bauer' };
const STYLE_CYCLE = ['helles', 'pils', 'weizen', 'maerzen', 'pale'];

export function playStory({ seed = 1, maxDays = 1500, verbose = false } = {}) {
  const s = g.newGame({ mode: 'story', seed });
  let brewed = 0;
  while (!s.ended && s.day < START + maxDays) {
    if (s.event) { g.resolveEvent(s, CHOICES[s.event.id]); continue; }

    // Ausrüstung im Kapitel „Keller“
    const ch = g.CHAPTERS[s.chapter]?.id;
    if (ch === 'keller' || s.chapter > 3) {
      if (s.equipment.cooling === 'keine' && s.cash >= 280) g.buyGear(s, 'cooling', 'kuehlschrank');
      if (s.equipment.kettle === 'topf' && s.cash >= 450 + 60) g.buyGear(s, 'kettle', 'kessel50');
      if (s.chapter > 3 && s.equipment.fermenter === 'eimer' && s.cash >= 260 + 100) g.buyGear(s, 'fermenter', 'edelstahl');
    }

    // Brauen, solange Platz ist (Garage im Winter Lager, im Sommer Ale)
    const slots = g.slotsOf(s) - s.batches.filter(b => b.status === 'gaerend').length;
    if (slots > 0 && s.cash > 60) {
      const style = s.stats.styles.length < 3 || brewed % 4 === 0 ? STYLE_CYCLE[brewed % STYLE_CYCLE.length] : 'helles';
      const r = newRecipeFromStyle(style);
      r.batchL = s.equipment.kettle === 'topf' ? 20 : 40;
      try { g.buyForRecipe(s, r); g.startBatch(s, r); brewed++; } catch (e) { if (!(e instanceof g.GameError)) throw e; }
    }

    // Bier abgeben
    for (const beer of s.beers.filter(b => b.liters > 0.01)) {
      if (g.CHAPTERS[s.chapter]?.id === 'fest') g.give(s, beer.id, Math.min(beer.liters, 10));
      else if (s.license || s.flags.schwarz) {
        const room = Math.floor(g.marketDemand(s) - s.soldWeek);
        if (room > 0) g.sell(s, beer.id, Math.min(beer.liters, room));
      }
    }
    // Wettbewerb nur anbieten, wenn ein gutes Bier da ist (Story prüft das selbst)
    if (s.event) continue;
    g.advanceDays(s, 3);
  }
  if (verbose) console.log(s.log.filter(l => l.kind === 'story').map(l => `[Tag ${l.day}] ${l.text}`).join('\n'));
  return s;
}
const START = g.START_DAY;
