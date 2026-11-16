// Referenzlösungen (Bots) für die Challenges – beweisen Lösbarkeit und kalibrieren die Sterne.
import * as g from '../src/game/index.js';
import { newRecipeFromStyle, compute } from '../src/core/brew.js';
import { MALTS } from '../src/core/data.js';
import { styleFit, setMashProgram } from '../src/game/recipe.js';

const PREMIUM = { pilsner: 'pilsner_boden', muenchner: 'muenchner_boden', pale: 'maris' };
/** Meister-Rezept: Startrezept + ideales Maischverfahren, Reifung, edles Grundmalz, Doldenhopfen spät (alle Kniffe des Potenzials). */
export function rec(styleId) {
  const r = newRecipeFromStyle(styleId);
  setMashProgram(r, styleFit(styleId).mash.ideal);
  r.reifung = true;
  const first = r.malts.slice().sort((a, b) => b.share - a.share)[0];
  if (PREMIUM[first.id] && MALTS.some(m => m.id === PREMIUM[first.id])) first.id = PREMIUM[first.id];
  r.hops.forEach(h => { if (h.time <= 15) h.form = 'whole'; });
  return r;
}

export const brew = (s, recipe) => { g.buyForRecipe(s, recipe); return g.startBatch(s, recipe); };
export const runUntilOver = (s, maxDays = 600) => { for (let i = 0; i < maxDays && !s.gameOver; i++) g.advanceDays(s, 1); };

function ibuOfHops(s, recipe) { return g.previewBatch(s, recipe).calc.ibu; }

export const REFS = {
  erster_sud: s => { brew(s, rec('helles')); runUntilOver(s); },
  extrakt_dilemma: s => {
    const r = rec('pils');
    r.hops = [{ id: 'tradition', gPerL: 0.05, time: 60, form: 'extract' }, { id: 'hallertauer', gPerL: 5, time: 15, form: 'whole' }];
    let lo = 0, hi = 1; // Extrakt so dosieren, dass die Gesamtbittere ≈ 35 IBU
    for (let i = 0; i < 40; i++) { const m = (lo + hi) / 2; r.hops[0].gPerL = m; ibuOfHops(s, r) < 35 ? lo = m : hi = m; }
    brew(s, r); runUntilOver(s);
  },
  sparbrauer: (s, variant = 'cheap') => {
    const r = newRecipeFromStyle('helles');
    r.reifung = true;
    if (variant === 'cheap') { r.plato = 11.0; r.malts = [{ id: 'pilsner', share: 88 }, { id: 'wiener', share: 12 }]; }
    for (let tries = 0; tries < 1 && !s.gameOver; tries++) {
      g.buyForRecipe(s, r);
      if (variant === 'cheap') { s.inventory.sanitizer = 0; s.inventory.yeast.lager -= 1; } // 1 Päckchen weniger, kein Desinfektionsmittel
      g.startBatch(s, r); g.advanceDays(s, 1);
      if (g.challengeStatus(s).current != null) break;
    }
    runUntilOver(s);
  },
  sommerhitze: s => { brew(s, rec('saison')); runUntilOver(s); },
  imperial_meister: s => {
    for (let k = 0; k < 6 && !s.gameOver; k++) {
      if (g.slotsOf(s) > s.batches.filter(b => b.status === 'gaerend').length) { try { brew(s, rec('imperial')); } catch (e) { if (!(e instanceof g.GameError)) throw e; } }
      g.advanceDays(s, 28);
    }
    runUntilOver(s);
  },
  kaufmann: s => {
    let brewed = 0;
    while (!s.gameOver) {
      if (s.cash > 40 && g.slotsOf(s) > s.batches.filter(b => b.status === 'gaerend').length) {
        const st = ['helles', 'pils', 'weizen', 'koelsch'].filter(x => s.unlocked.includes(x))[brewed++ % 4];
        try { brew(s, rec(st)); } catch (e) { if (!(e instanceof g.GameError)) throw e; }
      }
      for (const b of s.beers.filter(x => x.liters > 0.01)) { const room = Math.floor(g.channelRoom(s, g.defaultChannel(s))); if (room > 0) g.sell(s, b.id, Math.min(b.liters, room)); }
      g.advanceDays(s, 2);
    }
  },
  sommelier: s => {
    const order = ['helles', 'pils', 'weizen', 'koelsch', 'dunkel', 'maerzen', 'pale', 'alt', 'ipa'];
    for (let i = 0; i < order.length && !s.gameOver; i++) {
      for (let tries = 0; tries < 3; tries++) { try { brew(s, rec(order[i])); break; } catch (e) { if (!(e instanceof g.GameError)) throw e; g.advanceDays(s, 5); } }
      g.advanceDays(s, 25);
    }
    runUntilOver(s);
  },
};

// Karriere-Bot: brät Aufträge und Bestseller, liefert, verkauft, rüstet auf.
export function playCareer({ seed = 1, years = 5, difficulty = 'normal', idle = false } = {}) {
  const s = g.newGame({ mode: 'karriere', seed, years, difficulty });
  let n = 0;
  while (!s.gameOver) {
    if (!idle) {
      if (s.cash > 1400 && s.equipment.cooling === 'keine') g.buyGear(s, 'cooling', 'kuehlschrank');
      if (s.cash > 1900 && s.equipment.kettle === 'topf') g.buyGear(s, 'kettle', 'kessel50');
      if (s.cash > 1600 && s.equipment.fermenter === 'eimer') g.buyGear(s, 'fermenter', 'edelstahl');
      for (const st of ['maerzen', 'koelsch', 'dunkel', 'alt', 'pale']) {
        const m = g.STYLE_META[st];
        if (!s.unlocked.includes(st) && g.levelOf(s.skill.xp).lvl >= m.minLevel && s.cash > m.cost + 400) g.buyStyle(s, st);
      }
      const free = g.slotsOf(s) - s.batches.filter(b => b.status === 'gaerend').length;
      if (free > 0 && s.cash > 80) {
        const wanted = g.openContracts(s).filter(c => s.unlocked.includes(c.styleId) && !s.batches.some(b => b.status === 'gaerend' && b.styleId === c.styleId))[0];
        const pool = s.unlocked.filter(x => g.STYLE_META[x].difficulty <= 2);
        const style = wanted ? wanted.styleId : pool[n++ % pool.length];
        const r = rec(style); r.batchL = s.equipment.kettle === 'topf' ? 20 : 40;
        try { brew(s, r); } catch (e) { if (!(e instanceof g.GameError)) throw e; }
      }
      for (const b of s.beers.filter(x => x.liters > 0.01)) {
        for (const c of g.openContracts(s)) if (c.styleId === b.styleId && b.quality >= c.minQuality && b.liters > 0.01) g.fulfillContract(s, c.id, b.id);
        const room = Math.floor(g.channelRoom(s, g.defaultChannel(s)));
        if (b.liters > 0.01 && room > 0 && g.marketMultiplier(s, b.styleId) > 0.85) g.sell(s, b.id, Math.min(b.liters, room));
      }
    }
    g.advanceDays(s, 3);
  }
  return s;
}
