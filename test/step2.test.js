import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../src/game/index.js';
import { newRecipeFromStyle } from '../src/core/brew.js';

/** Story-Spielstand ohne Story-Ereignisse, mit Gewerbe und Bier im Lager. */
function game({ beers = [], cash = 3000, xp = 1200 } = {}) {
  const s = g.newGame({ skipTutorial: true, seed: 7 });
  s.event = null; s.ended = true; s.license = true; s.reputation = 40; s.cash = cash; s.day = 150; s.skill.xp = xp;
  g.unlock(s, 'verkauf', 'spenden', 'fasskeller', 'produktion', 'stilwerkstatt');
  for (const b of beers) s.beers.push({ flaws: [], notes: [], plato: 12, abv: 5, ibu: 25, ebc: 10, finishedDay: s.day, ...b, id: s.nextId++ });
  return s;
}

test('Stil-Labor: eigener Stil mit eigenen Zielwerten, Level und Kosten, bunt wenn weit weg vom Basis-Stil', () => {
  const low = game({ xp: 0 });
  assert.throws(() => g.createStyle(low, { name: 'Kellergold', base: 'helles', ranges: g.STYLES[1].ranges, yeastId: 'lager' }), /Level/);
  const s = game();
  const ranges = { plato: [12, 13.5], abv: [5, 5.8], ibu: [20, 28], ebc: [8, 14] };
  const cash = s.cash;
  const cs = g.createStyle(s, { name: 'Kellergold', base: 'helles', ranges, yeastId: 'lager' });
  assert.equal(s.cash, cash - g.CUSTOM_STYLE_COST);
  assert.equal(cs.bunt, false);
  assert.throws(() => g.createStyle(s, { name: 'kellergold', base: 'helles', ranges, yeastId: 'lager' }), /schon/);
  assert.throws(() => g.createStyle(s, { name: 'Zu eng', base: 'helles', ranges: { ...ranges, ibu: [20, 22] }, yeastId: 'lager' }), /breit/);
  const wild = g.createStyle(s, { name: 'Hopfenhelles', base: 'helles', ranges: { ...ranges, plato: [15, 17], ibu: [50, 70] }, yeastId: 'ale' });
  assert.equal(wild.bunt, true);
  // Rezept wird an den eigenen Zielwerten gemessen
  const r = g.recipeFromCustom(cs);
  const p = g.recipePotential(r);
  assert.ok(p.parts.find(x => x.id === 'stil').pts > 25, JSON.stringify(p.parts));
  assert.equal(g.styleView(r).name, 'Kellergold');
  g.buyForRecipe(s, r);
  const b = g.startBatch(s, r);
  assert.equal(b.custom.name, 'Kellergold');
  // Bekanntheit wächst mit gutem verkauftem Bier und hebt den Preis
  s.beers.push({ id: 999, name: 'Kellergold', styleId: 'helles', custom: { id: cs.id, name: cs.name }, liters: 400, quality: 85, flaws: [], notes: [], plato: 12.5, abv: 5.4, ibu: 24, ebc: 12 });
  const p0 = g.priceFor(s, s.beers.at(-1), 'gastro');
  for (let w = 0; w < 6; w++) { s.week = { sold: {}, rep: 0, donated: 0, festival: false }; g.sell(s, 999, 60, 'gastro'); }
  assert.ok(cs.fame > 5 && g.priceFor(s, s.beers.at(-1), 'gastro') > p0, `fame ${cs.fame}`);
});

test('Fasskeller: starkes dunkles Bier gewinnt im Bourbonfass, helles leidet; Fass nutzt sich ab', () => {
  const s = game({ beers: [{ name: 'Imperial', styleId: 'imperial', liters: 60, quality: 70, abv: 9.5, ebc: 120 },
                           { name: 'Hell', styleId: 'helles', liters: 40, quality: 70, abv: 5 }] });
  const [imp, hell] = s.beers;
  g.buyBarrel(s, 'bourbon'); g.buyBarrel(s, 'bourbon');
  const [b1, b2] = s.barrels;
  g.fillBarrel(s, b1.id, imp.id, 30);
  g.fillBarrel(s, b2.id, hell.id, 30);
  assert.equal(imp.liters, 30);
  assert.throws(() => g.emptyBarrel(s, b1.id), /30 Tagen/);
  s.day += 150;
  const st = g.barrelStatus(s, b1);
  assert.ok(st.peak && st.gain > 10, JSON.stringify(st));
  const aged = g.emptyBarrel(s, b1.id);
  assert.ok(aged.barrel === 'bourbon' && aged.priceMul > 1.5 && aged.liters < 30);
  if (!aged.flaws.includes('infektion')) assert.ok(aged.quality > 75, `${aged.quality}`);
  assert.ok(g.priceFor(s, aged, 'hof') > g.priceFor(s, imp, 'hof') * 1.5);
  assert.ok(g.barrelStatus(s, b2).gain < 0, 'Helles wird vom Holz erschlagen');
  assert.equal(b1.uses, 1);
  assert.ok(g.barrelGain(b1, imp, 150) < g.barrelGain({ ...b1, uses: 0 }, imp, 150));
  assert.throws(() => g.fillBarrel(s, b1.id, aged.id, 10), /schon im Fass/);
});

test('Cuvée: Fassbier mit frischem Bier verschneiden; sehr verschiedene Biere beißen sich', () => {
  const s = game({ beers: [{ name: 'Stout BA', styleId: 'stout', liters: 20, quality: 80, abv: 7, ebc: 110, ibu: 35, barrel: 'bourbon', priceMul: 1.7 },
                           { name: 'Porter', styleId: 'porter', liters: 30, quality: 74, abv: 5.5, ebc: 70, ibu: 30 },
                           { name: 'Pils', styleId: 'pils', liters: 30, quality: 74, abv: 5, ebc: 6, ibu: 40 }] });
  const [ba, porter, pils] = s.beers;
  const pv = g.blendPreview(s, [{ beerId: ba.id, liters: 10 }, { beerId: porter.id, liters: 10 }]);
  assert.ok(pv.quality >= 80, `${pv.quality}`);
  const c = g.blendBeers(s, [{ beerId: ba.id, liters: 10 }, { beerId: porter.id, liters: 10 }], 'Nachtschatten Cuvée');
  assert.equal(c.liters, 20);
  assert.equal(ba.liters, 10);
  assert.ok(c.blend && c.priceMul > 1.3);
  const bad = g.blendPreview(s, [{ beerId: porter.id, liters: 10 }, { beerId: pils.id, liters: 10 }]);
  assert.ok(bad.quality < 74, `${bad.quality}`);
  assert.throws(() => g.blendBeers(s, [{ beerId: pils.id, liters: 10 }, { beerId: pils.id, liters: 5 }], 'X1'), /verschiedene/);
});

test('Produktion: Brauhelfer setzt Plan-Rezepte automatisch an und verkauft nach Regel; kostet Lohn', () => {
  const s = game({ cash: 2000 });
  s.equipment.fermenter = 'konisch'; s.equipment.cooling = 'kuehlschrank'; s.equipment.kettle = 'kessel50';
  const a = newRecipeFromStyle('helles'); a.name = 'Hausbier'; a.batchL = 40;
  const b = newRecipeFromStyle('weizen'); b.name = 'Weiße'; b.batchL = 40;
  g.saveRecipe(s, a); g.saveRecipe(s, b);
  g.setPlan(s, 'Hausbier', true); g.setPlan(s, 'Weiße', true);
  g.setSellRule(s, 'Hausbier', 'alles'); g.setSellRule(s, 'Weiße', 'markt');
  g.advanceDays(s, 1);
  assert.equal(s.batches.length, 0, 'ohne Helfer passiert nichts');
  g.hireHelper(s);
  g.advanceDays(s, 1);
  assert.equal(s.batches.filter(x => x.status === 'gaerend').length, g.slotsOf(s));
  assert.deepEqual([...new Set(s.batches.map(x => x.name))].sort(), ['Hausbier', 'Weiße']);
  const cash = s.cash;
  g.advanceDays(s, 60);
  assert.ok(s.stats.soldL > 0 && s.stats.batches > g.slotsOf(s), `sold ${s.stats.soldL}, batches ${s.stats.batches}`);
  assert.ok(!s.beers.some(x => x.name === 'Hausbier' && x.liters >= 1), 'Hausbier geht komplett weg (Händler)');
  assert.ok(s.log.some(l => /Lohn Brauhelfer/.test(l.text)));
  assert.ok(s.cash !== cash);
  // nicht bezahlbar → kündigt
  s.cash = 0; s.auto.plan = []; s.beers = []; s.batches = [];
  g.advanceDays(s, 31);
  assert.equal(s.auto.helper, false);
});

test('Alte Spielstände bekommen neue Felder und schon erreichte Bereiche', () => {
  const s = g.newGame({ skipTutorial: true });
  delete s.recipes; delete s.auto; delete s.barrels; delete s.customStyles;
  s.chapter = 5;
  g.migrate(s);
  assert.ok(Array.isArray(s.recipes) && s.auto && g.hasFeature(s, 'produktion') && g.hasFeature(s, 'fasskeller'));
});
