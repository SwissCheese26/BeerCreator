import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../src/game/index.js';
import { newRecipeFromStyle, compute } from '../src/core/brew.js';

const sand = (equip = {}, day = 100, seed = 7) => {
  const s = g.newGame({ mode: 'sandbox', seed });
  Object.entries(equip).forEach(([k, v]) => g.setEquipment(s, k, v));
  s.day = day; return s;
};
const brewSand = (style, form, s = sand()) => {
  const r = newRecipeFromStyle(style); g.setHopForm(r, form); return g.startBatch(s, r);
};

test('Story startet in der Garage mit Opas altem Hopfen und einer Entscheidung', () => {
  const s = g.newGame();
  assert.equal(s.stage, 'garage');
  assert.equal(s.event.id, 'opa_brief');
  assert.equal(s.inventory.hops[0].form, 'whole');
  assert.ok(s.inventory.hops[0].ageDays > 1000);
  assert.throws(() => g.advanceDays(s, 1), /Entscheidung/);
});

test('Hopfenform hat Folgen: Extrakt = kein Aroma und harte Bittere', () => {
  const pellet = brewSand('ipa', 'pellet'), extract = brewSand('ipa', 'extract');
  assert.ok(pellet.quality > extract.quality + 15, `${pellet.quality} vs ${extract.quality}`);
  assert.ok(extract.flaws.includes('flach') && extract.flaws.includes('hart'));
  assert.ok(!pellet.flaws.includes('flach'));
});

test('Extrakt ist bei gleicher Bittere weit weniger Gramm', () => {
  const a = newRecipeFromStyle('pils'), b = newRecipeFromStyle('pils');
  g.setHopForm(b, 'extract');
  assert.ok(compute(b).hops[0].g < compute(a).hops[0].g / 3);
  assert.ok(Math.abs(compute(b).ibu - compute(a).ibu) < 0.01);
});

test('Alter Doldenhopfen: wenig Frische, Altgeruch, weniger Bittere', () => {
  const s = g.newGame(); g.resolveEvent(s, 'tradition');
  const r = newRecipeFromStyle('helles'); r.hops = [{ id: 'hallertauer', gPerL: 0.6, time: 60, form: 'whole' }];
  const pv = g.previewBatch(s, r);
  assert.ok(pv.freshness[0] < 0.25);
  assert.ok(pv.calc.ibu < compute({ ...r, hops: [{ ...r.hops[0] }] }).ibu * 0.3);
  s.cash = 500; g.buyForRecipe(s, r); // kauft die fehlenden Gramm nach (Opas 200 g reichen nicht ganz)
  const b = g.startBatch(s, r);
  assert.ok(b.flaws.includes('oxidiert'));
});

test('Gärtemperatur: Garage im Sommer/Winter schlechter als mit Kühlung', () => {
  const cool = brewSand('helles', 'pellet', sand({ cooling: 'profi' }, 190, 3));
  const summer = brewSand('helles', 'pellet', sand({ cooling: 'keine' }, 190, 3));
  const winterAle = brewSand('pale', 'pellet', sand({ cooling: 'keine' }, 20, 3));
  assert.ok(cool.quality > summer.quality);
  assert.ok(summer.flaws.includes('ester'));
  assert.ok(winterAle.flaws.includes('traege'));
});

test('Hygiene: Infektionen häufiger ohne Hygiene, Desinfektion hilft', () => {
  const rate = (hyg) => {
    let n = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const s = sand({ fermenter: 'eimer' }, 100, seed); s.mode = 'story'; s.hygiene = hyg;
      s.inventory = { malts: {}, hops: [], yeast: {}, sanitizer: 0 }; s.cash = 1e6;
      const r = newRecipeFromStyle('helles'); g.buyForRecipe(s, r); s.inventory.sanitizer = 0;
      if (g.startBatch(s, r).flaws.includes('infektion')) n++;
    }
    return n;
  };
  assert.ok(rate(0.05) > rate(0.6) * 2);
});

test('Zu wenig Hefe, zu wenig Gärplätze, zu großer Sud werden abgelehnt/bestraft', () => {
  const s = g.newGame(); g.resolveEvent(s, 'buch'); s.cash = 1000;
  const r = newRecipeFromStyle('helles'); g.buyForRecipe(s, r);
  s.inventory.yeast.lager = 1; // Bedarf ist höher
  const b = g.startBatch(s, r);
  assert.ok(b.pitchRatio < 1);
  g.buyForRecipe(s, r);
  assert.throws(() => g.startBatch(s, r), /Gärplätze/);
  const big = newRecipeFromStyle('pils'); big.batchL = 60;
  assert.throws(() => g.startBatch(g.newGame(), big), /fasst/);
});

test('Verkauf: ohne Gewerbe verboten, mit Gewerbe mit Biersteuer', () => {
  const s = sand();
  const b0 = brewSand('helles', 'pellet', s);
  s.day = b0.readyDay - 1; g.advanceDays(s, 1);
  s.mode = 'story'; s.ended = true; // Story-Logik hier ausblenden
  const id = s.beers[0].id;
  s.license = false;
  assert.throws(() => g.sell(s, id, 5), /Gewerbe/);
  s.license = true; const cash = s.cash;
  const res = g.sell(s, id, 5);
  assert.ok(res.revenue > 0 && res.tax > 0 && s.cash > cash);
  assert.ok(res.tax < res.revenue * 0.1);
});

test('Sandbox: unbegrenzt, keine Story, keine Steuer', () => {
  const s = g.newGame({ mode: 'sandbox' });
  assert.equal(s.event, null);
  const b = brewSand('ipa', 'whole', s);
  g.advanceDays(s, 40);
  assert.equal(s.beers.length, 1);
  const r = g.sell(s, b.id, 18);
  assert.equal(r.tax, 0);
});

test('Spielstand ist JSON-serialisierbar', () => {
  const s = g.newGame();
  assert.deepEqual(JSON.parse(JSON.stringify(s)), s);
});

test('Info-Texte: jede Zutat, jeder Stil, jede Technik, jedes Fehlaroma hat einen Text', async () => {
  const { MALTS, HOPS, HOP_FORMS, YEASTS, STYLES } = await import('../src/core/data.js');
  const miss = [];
  MALTS.forEach(x => g.getInfo('malt', x.id) || miss.push('malt:' + x.id));
  HOPS.forEach(x => g.getInfo('hop', x.id) || miss.push('hop:' + x.id));
  Object.keys(HOP_FORMS).forEach(x => g.getInfo('form', x) || miss.push('form:' + x));
  YEASTS.forEach(x => g.getInfo('yeast', x.id) || miss.push('yeast:' + x.id));
  STYLES.forEach(x => g.getInfo('style', x.id) || miss.push('style:' + x.id));
  Object.entries(g.EQUIPMENT).forEach(([slot, t]) => Object.keys(t).forEach(id => g.getInfo('gear', `${slot}:${id}`) || miss.push(`gear:${slot}:${id}`)));
  g.LEVELS.forEach(l => g.getInfo('level', String(l.lvl)) || miss.push('level:' + l.lvl));
  ['infektion', 'ester', 'traege', 'unterhefung', 'oxidiert', 'hart', 'flach'].forEach(f => g.getInfo('flaw', f) || miss.push('flaw:' + f));
  assert.deepEqual(miss, []);
  assert.match(g.getInfo('hop', 'citra').text, /Tropen/);
  assert.ok(g.findInfo('ipa').text.length > 40);
});

test('Preise, Aroma-Bedarf und Gärzeit existieren für alle Zutaten und Stile', async () => {
  const { MALTS, HOPS, YEASTS, STYLES } = await import('../src/core/data.js');
  MALTS.forEach(m => assert.ok(g.MALT_PRICE[m.id] > 0, m.id));
  HOPS.forEach(h => assert.ok(g.HOP_PRICE_PELLET[h.id] > 0, h.id));
  YEASTS.forEach(y => assert.ok(g.YEAST_PRICE[y.id] > 0 && g.FERMENT_DAYS[y.id] > 0, y.id));
  STYLES.forEach(x => assert.ok(g.STYLE_AROMA[x.id] != null && g.STYLE_META[x.id], x.id));
});

test('Jeder Bierstil lässt sich im Sandbox-Modus brauen', async () => {
  const { STYLES } = await import('../src/core/data.js');
  for (const st of STYLES) {
    const s = g.newGame({ mode: 'sandbox', seed: 5 }); s.day = 100;
    const b = g.startBatch(s, newRecipeFromStyle(st.id));
    assert.ok(b.quality >= 60, `${st.id}: ${b.quality}`);
    assert.ok(b.cost.total > 0 && b.costPerLiter > 0);
  }
});

test('Level-System: Stufen, Freischaltung, Kursgebühr, Gating', () => {
  const s = g.newGame(); g.resolveEvent(s, 'buch');
  assert.equal(g.levelInfo(s).lvl, 1);
  assert.deepEqual(s.unlocked.sort(), ['helles', 'pale', 'pils', 'weizen']);
  assert.throws(() => g.buyStyle(s, 'tripel'), /Level 6/);
  assert.throws(() => g.buyStyle(s, 'maerzen'), /Level 2/);
  assert.throws(() => g.buyForRecipe(s, newRecipeFromStyle('maerzen')), /nicht gelernt/);
  s.skill.xp = 120; s.cash = 100;
  g.buyStyle(s, 'maerzen');
  assert.equal(s.cash, 40);
  assert.ok(s.unlocked.includes('maerzen'));
  assert.throws(() => g.buyStyle(s, 'koelsch'), /Zu wenig Geld/);
  assert.equal(g.levelOf(5000).name, 'Braulegende');
});

test('Erfahrung: fertiger Sud gibt XP, Level-Up wird gemeldet, schwere Stile geben mehr', () => {
  const s = g.newGame({ mode: 'sandbox' }); s.mode = 'story'; s.skill.xp = 0; s.ended = true; s.event = null;
  s.unlocked = ['helles', 'pils']; s.cash = 1000; s.day = 100;
  const r = newRecipeFromStyle('helles'); g.buyForRecipe(s, r);
  const b = g.startBatch(s, r);
  s.day = b.readyDay - 1; g.advanceDays(s, 1);
  assert.ok(s.skill.xp >= 25, `xp ${s.skill.xp}`);
  assert.ok(s.log.some(l => /Erfahrung/.test(l.text)));
  assert.ok(g.brewXp(s, { styleId: 'imperial', quality: 90, flaws: [] }) > g.brewXp(s, { styleId: 'helles', quality: 90, flaws: [] }));
});

test('Können: niedriges Level und fehlende Übung senken die Qualität', () => {
  const avg = (lvl, tries) => {
    let sum = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const s = g.newGame({ mode: 'sandbox', seed }); g.setSandboxLevel(s, lvl); s.day = 100;
      if (tries) s.stats.styleCount = { imperial: tries };
      sum += g.startBatch(s, newRecipeFromStyle('imperial')).quality;
    }
    return sum / 30;
  };
  assert.ok(avg(8, 3) > avg(1, 3) + 5);
  assert.ok(avg(6, 3) > avg(6, 0) + 5);
});

test('Sudkosten werden berechnet; Extrakt-Sud ist billiger an Hopfen', () => {
  const s = g.newGame({ mode: 'sandbox' });
  const a = newRecipeFromStyle('pils'), b = newRecipeFromStyle('pils'); g.setHopForm(b, 'extract');
  const ca = g.startBatch(s, a).cost, cb = g.startBatch(s, b).cost;
  assert.ok(ca.total > 20 && ca.energy > 0);
  assert.ok(cb.hops < ca.hops);
});
