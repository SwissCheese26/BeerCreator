// Zufalls-Bot (Hilfsmodul): drückt wild auf alle Knöpfe. Erlaubt sind nur „saubere“ Spielfehler (GameError) –
// kein Absturz, kein NaN, kein negatives Lager oder Geld.
import assert from 'node:assert/strict';
import * as g from '../src/game/index.js';
import { newRecipeFromStyle } from '../src/core/brew.js';
import { playTutorial } from './bot.js';

function rng(seed) { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); }

function check(s, where) {
  const bad = [];
  const walk = (o, path) => {
    if (typeof o === 'number' && Number.isNaN(o)) bad.push(path);
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, `${path}.${k}`);
  };
  walk(s, 's');
  assert.deepEqual(bad, [], `${where}: NaN in ${bad.join(', ')}`);
  if (s.mode === 'story') assert.ok(s.cash >= -1e-6, `${where}: Geld ${s.cash}`);
  for (const b of s.beers) assert.ok(b.liters >= -1e-6, `${where}: ${b.name} ${b.liters} L`);
  assert.ok(s.reputation >= 0 && s.reputation <= 100 && s.honor >= 0 && s.honor <= 100, `${where}: Ruf ${s.reputation} / Ansehen ${s.honor} – ${s.log.slice(-3).map(l => l.text).join(' | ')}`);
  JSON.parse(JSON.stringify(s)); // speicherbar
}

export function fuzz(mode, seed, steps) {
  const r = rng(seed), pick = a => a[Math.floor(r() * a.length)];
  const s = g.newGame({ mode, seed, location: pick(Object.keys(g.LOCATIONS)) });
  if (mode === 'story') playTutorial(s);
  const beer = () => s.beers.length ? pick(s.beers).id : 1;
  const L = () => pick([0.5, 1, 5, 10, 30, 200, -3, 0]);
  const actions = [
    () => g.advanceDays(s, pick([1, 3, 7, 30])),
    () => { const rc = newRecipeFromStyle(pick(g.STYLES).id); rc.batchL = pick([5, 20, 40, 80, 300]); if (r() < 0.5) rc.reifung = true; if (s.mode !== 'sandbox') g.buyForRecipe(s, rc); g.startBatch(s, rc); },
    () => g.sell(s, beer(), L(), pick(Object.keys(g.CHANNELS))),
    () => g.give(s, beer(), L()),
    () => g.donate(s, pick(Object.keys(g.DONATION_TARGETS)), pick([5, 10, 100, 5000])),
    () => g.buyGear(s, pick(['kettle', 'fermenter', 'cooling']), pick(Object.values(g.TIER_ORDER).flat())),
    () => g.buyStyle(s, pick(g.STYLES).id),
    () => g.registerBusiness(s),
    () => g.buyBarrel(s, pick(Object.keys(g.BARRELS))),
    () => s.barrels.length && g.fillBarrel(s, pick(s.barrels).id, beer(), pick([5, 10, 30, 40])),
    () => s.barrels.length && g.emptyBarrel(s, pick(s.barrels).id),
    () => g.blendBeers(s, [{ beerId: beer(), liters: L() }, { beerId: beer(), liters: L() }], pick(['', 'Cuvée X'])),
    () => g.createStyle(s, { name: 'Haus' + Math.floor(r() * 99), base: pick(g.STYLES).id, ranges: pick(g.STYLES).ranges, yeastId: 'ale' }),
    () => g.hireHelper(s), () => g.fireHelper(s),
    () => { const rc = newRecipeFromStyle(pick(['helles', 'pils', 'weizen'])); rc.name = pick(['A', 'B']); g.saveRecipe(s, rc); g.setPlan(s, rc.name, r() < 0.7); g.setSellRule(s, rc.name, pick(Object.keys(g.SELL_RULES))); },
    () => g.sendSample(s, pick(Object.keys(g.REVIEWERS)), beer()),
    () => g.hostTasting(s, beer(), pick(Object.keys(g.TASTING_SIZES))),
    () => g.buildWebsite(s, pick(Object.keys(g.WEB_KINDS))),
    () => g.setSecurity(s, pick([0, 1, 2, 3, 7])),
    () => { const q = g.questsOf(s); const o = q.offered[0]; if (o) (r() < 0.7 ? g.acceptQuest : g.declineQuest)(s, o.id); },
    () => { const a = g.questsOf(s).active[0]; if (a) g.deliverQuest(s, a.id, beer()); },
    () => g.buyTech(s, pick(Object.keys(g.TECH))),
    () => g.setBrand(s, { symbol: pick(g.BRAND_SYMBOLS), color: pick(g.BRAND_COLORS), shape: pick(Object.keys(g.BRAND_SHAPES)), text: pick(['', 'ab', 'HHBXX']) }),
    () => g.placeOrder(s, pick(Object.keys(g.ORDERS))),
    () => g.setPackaging(s, beer(), { bottle: pick(Object.keys(g.BOTTLES)), glass: pick(Object.keys(g.GLASSES)) }),
    () => { const rc = newRecipeFromStyle(pick(['pils', 'weizen', 'helles'])); rc.filter = r() < 0.5; if (s.mode !== 'sandbox') g.buyForRecipe(s, rc); g.startBatch(s, rc); },
    () => s.recipes.length && g.contractBrew(s, pick(s.recipes).name, pick([100, 500, 2000, 9000])),
    () => g.buyBrewery(s, pick(g.forSale(s)).name),
    () => s.owned.length && g.sellBrewery(s, pick(s.owned)),
  ];
  let errors = 0;
  for (let i = 0; i < steps; i++) {
    if (s.event) {
      const ok = g.EVENTS[s.event.id].choices.filter(c => !c.enabled || c.enabled(s));
      assert.ok(ok.length, `Schritt ${i}: Ereignis „${s.event.id}“ hat keine wählbare Option – das Spiel wäre blockiert`);
      g.resolveEvent(s, pick(ok).id); continue;
    }
    try { pick(actions)(); } catch (e) {
      if (!(e instanceof g.GameError)) throw new Error(`Schritt ${i}: ${e.stack}`);
      errors++;
    }
    if (i % 25 === 0) check(s, `Schritt ${i}`);
    if (s.mode === 'story' && r() < 0.05) s.cash += 500; // ab und zu Geld, damit auch teure Dinge drankommen
  }
  check(s, 'Ende');
  return { s, errors };
}

