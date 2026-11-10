import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../src/game/index.js';
import { newRecipeFromStyle } from '../src/core/brew.js';
import { improve } from './bot.js';

test('Potenzial: Standardrezept ist gut, aber kein Spitzenbier – Kniffe heben es auf Trappisten-Niveau', () => {
  for (const st of ['pils', 'helles', 'weizen', 'dubbel', 'stout']) {
    const base = g.recipePotential(newRecipeFromStyle(st)).total;
    assert.ok(base >= 70 && base <= 84, `${st} Standard ${base}`);
    const best = g.recipePotential({ ...improve(newRecipeFromStyle(st)), reifung: true }).total;
    assert.ok(best >= base + 10, `${st}: ${base} → ${best}`);
  }
  const pils = improve(newRecipeFromStyle('pils')); pils.reifung = true;
  assert.ok(g.recipePotential(pils).total >= 92, 'Diplom Pils mit allen Kniffen');
});

test('Potenzial: falsche Hefe, fremder Hopfen und Stilbruch kosten Punkte', () => {
  const ok = g.recipePotential(newRecipeFromStyle('pils')).total;
  const ale = newRecipeFromStyle('pils'); ale.yeastId = 'weizen';
  const us = newRecipeFromStyle('pils'); us.hops.forEach(h => { h.id = 'citra'; });
  const strong = newRecipeFromStyle('pils'); strong.plato = 16;
  for (const r of [ale, us, strong]) assert.ok(g.recipePotential(r).total < ok - 4);
});

test('Qualität: Rezept-Potenzial ist die Obergrenze, gute Ausrüstung holt es fast ganz heraus', () => {
  const s = g.newGame({ mode: 'sandbox', seed: 5 });
  s.skill.xp = 99999;
  const r = improve(newRecipeFromStyle('helles')); r.reifung = true;
  const pot = g.recipePotential(r).total;
  const fc = g.forecast(s, r);
  assert.ok(fc.high <= pot && fc.low >= pot - 8, `${fc.low}–${fc.high} von ${pot}`);
  const b = g.startBatch(s, r);
  assert.ok(b.quality <= pot + 1 && b.quality >= pot - 10, `${b.quality} / ${pot}`);
  assert.equal(b.potential, pot);
  // Reifung verlängert die Zeit im Gärtank
  const plain = newRecipeFromStyle('helles');
  assert.ok(g.forecast(s, r).readyIn >= g.forecast(s, plain).readyIn + 14);
});

test('Sortiment: Rezepte mit eigenem Namen speichern, überschreiben, löschen; Bier trägt den Namen', () => {
  const s = g.newGame({ skipTutorial: true, seed: 2 }); s.event = null; s.cash = 500;
  const r = newRecipeFromStyle('pils'); r.name = 'Diplom Pils';
  g.saveRecipe(s, r);
  r.plato = 11.5; g.saveRecipe(s, { ...r, name: 'diplom pils' });
  assert.equal(s.recipes.length, 1);
  g.saveRecipe(s, { ...r, name: 'Leichtes Pils', plato: 9 });
  assert.equal(s.recipes.length, 2);
  assert.throws(() => g.saveRecipe(s, { ...r, name: ' ' }), /Namen/);
  assert.throws(() => g.saveRecipe(s, newRecipeFromStyle('tripel')), /nicht gelernt/);
  g.deleteRecipe(s, 'Leichtes Pils');
  assert.deepEqual(s.recipes.map(x => x.name), ['diplom pils']);
  g.buyForRecipe(s, r);
  assert.equal(g.startBatch(s, r).name, 'Diplom Pils');
  // Dekoktion kostet Energie
  const d = newRecipeFromStyle('pils'); g.setMashProgram(d, 'dekoktion');
  assert.ok(g.optionCost(d) > 0);
  assert.throws(() => g.startBatch(s, { ...newRecipeFromStyle('pils'), malts: [] }), /Malz|Gärplätze/);
});
