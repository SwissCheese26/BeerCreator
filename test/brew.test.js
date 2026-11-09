import test from 'node:test';
import assert from 'node:assert/strict';
import { compute, newRecipeFromStyle, setIbu, platoToSG, sgToPlato, ebcToHex } from '../src/core/brew.js';
import { STYLES } from '../src/core/data.js';

const near = (a, b, tol) => assert.ok(Math.abs(a - b) <= tol, `${a} !≈ ${b} (±${tol})`);

test('Plato <-> SG', () => {
  near(platoToSG(12), 1.0483, 0.0005);
  near(sgToPlato(1.048), 11.9, 0.1);
});

test('Pils-Startrezept liegt im Stilbereich', () => {
  const r = newRecipeFromStyle('pils');
  const c = compute(r);
  near(c.ibu, 35, 0.01);
  near(c.abv, 5.0, 0.4);
  assert.ok(c.ebc > 2 && c.ebc < 9, `EBC ${c.ebc}`);
  near(c.grainKg, 4.2, 0.5);
});

test('Alle Stile bleiben mit Startrezept im Bereich', () => {
  for (const s of STYLES) {
    const c = compute(newRecipeFromStyle(s.id));
    const { plato, ibu, ebc, abv } = s.ranges;
    const inR = (v, [lo, hi]) => v >= lo * 0.95 && v <= hi * 1.05;
    assert.ok(inR(c.plato, plato), `${s.id} plato`);
    assert.ok(inR(c.ibu, ibu), `${s.id} ibu ${c.ibu}`);
    assert.ok(inR(c.ebc, ebc), `${s.id} ebc ${c.ebc}`);
    assert.ok(inR(c.abv, abv), `${s.id} abv ${c.abv}`);
  }
});

test('Stammwürze hoch -> mehr Malz, mehr Alkohol, mehr Körper, weniger Bittere', () => {
  const r = newRecipeFromStyle('helles');
  const a = compute(r);
  r.plato += 3;
  const b = compute(r);
  assert.ok(b.grainKg > a.grainKg);
  assert.ok(b.abv > a.abv);
  assert.ok(b.fgP > a.fgP);
  assert.ok(b.ibu < a.ibu);        // Ausbeute sinkt bei höherer Würze
  assert.ok(b.kcalPer100ml > a.kcalPer100ml);
  assert.ok(b.yeast.cellsBillion > a.yeast.cellsBillion);
});

test('Hochstammwürze senkt Vergärungsgrad', () => {
  const r = newRecipeFromStyle('doppelbock');
  const c = compute(r);
  assert.ok(c.gravityPenalty > 0);
  assert.ok(c.attenuation < 80);
});

test('IBU-Regler skaliert Hopfen linear', () => {
  const r = newRecipeFromStyle('ipa');
  const g0 = compute(r).hops[0].g;
  setIbu(r, 120);
  const c = compute(r);
  near(c.ibu, 120, 0.01);
  near(c.hops[0].g / g0, 2, 0.01);
});

test('Größere Menge -> proportional mehr Zutaten, gleiche Werte', () => {
  const r = newRecipeFromStyle('pils');
  const a = compute(r);
  r.batchL = 40;
  const b = compute(r);
  near(b.grainKg / a.grainKg, 2, 0.001);
  near(b.ibu, a.ibu, 0.01);
  near(b.abv, a.abv, 0.001);
});

test('Dunkle Malze färben stärker', () => {
  const r = newRecipeFromStyle('pils');
  const light = compute(r).ebc;
  r.malts.push({ id: 'carafa', share: 5 });
  assert.ok(compute(r).ebc > light * 3);
});

test('Wasser: Haupt- + Nachguss = Gesamtwasser', () => {
  const c = compute(newRecipeFromStyle('weizen'));
  near(c.water.mash + c.water.sparge, c.water.total, 1e-9);
  assert.match(ebcToHex(10), /^#[0-9a-f]{6}$/);
});

test('Robustheit: leere Schüttung, V=0, negative Zeit ergeben keine NaN/Infinity', () => {
  const r = newRecipeFromStyle('pils');
  const check = c => Object.entries(c).forEach(([k, v]) => typeof v === 'number' && assert.ok(Number.isFinite(v), `${k}=${v}`));
  r.malts = []; check(compute(r));
  r.malts = [{ id: 'pilsner', share: 0 }]; check(compute(r));
  const r2 = newRecipeFromStyle('pils'); r2.batchL = 0; check(compute(r2));
  r2.batchL = 20; r2.hops[0].time = -10; assert.ok(compute(r2).hops[0].ibu >= 0);
});

test('Hopfenform: Extrakt hat festes Alpha, Frische senkt die Bittere', () => {
  const r = newRecipeFromStyle('pils');
  const pellet = compute(r).ibu;
  r.hops.forEach(h => { h.fresh = 0.5; });
  near(compute(r).ibu, pellet * 0.5, 0.01);
  r.hops.forEach(h => { h.fresh = 1; h.form = 'extract'; });
  assert.ok(compute(r).hops[0].alpha === 30);
});

test('IBU-Regler lässt Aroma-Gaben (0 min) unverändert', () => {
  const r = newRecipeFromStyle('ipa');
  const g0 = compute(r).hops.at(-1).g;
  setIbu(r, 120);
  near(compute(r).hops.at(-1).g, g0, 1e-9);
});
