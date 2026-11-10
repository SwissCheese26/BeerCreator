import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../src/game/index.js';

function game({ beers = [], cash = 3000, rep = 50, chapter = 5 } = {}) {
  const s = g.newGame({ skipTutorial: true, seed: 11 });
  s.event = null; s.ended = true; s.license = true; s.reputation = rep; s.cash = cash; s.day = 200; s.chapter = chapter;
  g.unlock(s, 'verkauf', 'spenden', 'verschenken', 'marketing', 'webseite', 'auftraege', 'fasskeller');
  for (const b of beers) s.beers.push({ flaws: [], notes: [], plato: 12, abv: 5, ibu: 25, ebc: 10, finishedDay: s.day, ...b, id: s.nextId++ });
  return s;
}

test('Proben: Versand kostet, Kritik kommt nach einigen Tagen, gutes Bier bringt Ruf und Rummel', () => {
  const s = game({ beers: [{ name: 'Hausdunkel', styleId: 'dunkel', liters: 20, quality: 88, ebc: 40 }] });
  const b = s.beers[0], cash = s.cash, rep = s.reputation;
  g.sendSample(s, 'malzmeister', b.id);
  assert.equal(b.liters, 19);
  assert.ok(s.cash < cash - g.REVIEWERS.malzmeister.cost + 1e-9);
  assert.throws(() => g.sendSample(s, 'malzmeister', b.id), /unterwegs/);
  s.event = null; s.ended = true;
  g.advanceDays(s, 13);
  assert.equal(s.reviews.pending.length, 0);
  const rv = s.reviews.list.at(-1);
  if (rv) {
    assert.ok(rv.score >= 75, JSON.stringify(rv));
    assert.ok(s.reputation > rep - 1);
    assert.ok(s.buzz && g.demandFactor(s, 'hof') > 1);
  } else assert.ok(s.log.some(l => /nicht gemeldet|zerbrochen/.test(l.text)));
  assert.ok(!g.reviewerState(s, 'malzmeister').open, 'Abklingzeit');
  assert.ok(!g.reviewerState(game({ rep: 5 }), 'sommelier').open, 'großes Magazin erst mit Ruf');
  // Geschmack der Kritiker
  const beer = { styleId: 'helles', quality: 80, flaws: [] };
  assert.ok(g.reviewScore('doldenrausch', beer) < g.reviewScore('hopfenkind', beer));
  assert.ok(g.reviewScore('sudhausfunk', { ...beer, barrel: 'bourbon' }) > g.reviewScore('sudhausfunk', beer));
});

test('Kundenbewertungen: gutes Bier → gute Sterne → mehr Nachfrage; schlechtes zieht runter', () => {
  const good = game({ beers: [{ name: 'Top', styleId: 'helles', liters: 2000, quality: 90 }] });
  const bad = game({ beers: [{ name: 'Flop', styleId: 'helles', liters: 2000, quality: 35, flaws: ['diacetyl'] }] });
  for (const s of [good, bad]) for (let i = 0; i < 40; i++) { s.week = { sold: {}, rep: 0, donated: 0, festival: false }; s.reputation = 50; g.sell(s, s.beers[0].id, 20, 'gastro'); }
  assert.ok(good.ratings.count >= 5 && bad.ratings.count >= 5);
  assert.ok(g.ratingAvg(good) >= 4, `${g.ratingAvg(good)}`);
  assert.ok(g.ratingAvg(bad) <= 2, `${g.ratingAvg(bad)}`);
  good.reputation = bad.reputation = 50;
  assert.ok(g.channelDemand(good, 'hof') > g.channelDemand(bad, 'hof'));
});

test('Verkostung: kostet Snacks und Bier, bringt Ruf, Stammkunden und Bewertungen; mit Pause', () => {
  const s = game({ beers: [{ name: 'Fest', styleId: 'maerzen', liters: 30, quality: 80 }], rep: 30 });
  const hof0 = g.channelDemand(s, 'hof');
  const r = g.hostTasting(s, s.beers[0].id, 'mittel');
  assert.equal(s.beers[0].liters, 20);
  assert.ok(r.rep > 0 && r.regulars > 0 && s.ratings.count >= 1);
  assert.ok(g.channelDemand(s, 'hof') > hof0);
  assert.throws(() => g.hostTasting(s, s.beers[0].id, 'klein'), /Tagen/);
});

test('Webseite: Agentur oder KI, Onlineshop als Absatzweg, Hacker und Sicherheit', () => {
  const s = game({ beers: [{ name: 'Online', styleId: 'pils', liters: 500, quality: 80 }] });
  assert.equal(g.channelState(s, 'online').open, false);
  g.buildWebsite(s, 'ki');
  assert.equal(s.cash, 3000 - g.WEB_KINDS.ki.cost);
  assert.ok(g.channelState(s, 'online').open);
  g.sell(s, s.beers[0].id, 10, 'online');
  assert.ok(g.hackRisk(s) > 0.1);
  g.setSecurity(s, 3);
  assert.ok(g.hackRisk(s) < 0.02);
  // Ohne Pflege wird eine KI-Seite irgendwann gehackt und geht offline
  const t = game();
  g.buildWebsite(t, 'ki');
  let hacked = 0;
  for (let m = 0; m < 60 && !hacked; m++) { t.cash = 3000; g.webMonthly(t); hacked = t.web.hacks; }
  assert.ok(hacked >= 1);
  assert.ok(t.log.some(l => /HACKERANGRIFF/.test(l.text)));
  assert.equal(g.channelState(t, 'online').open, false);
  // Agentur-Seite ist von Haus aus sicherer
  const u = game(); g.buildWebsite(u, 'agentur');
  assert.ok(g.hackRisk(u) < g.hackRisk(t));
});

test('Aufträge: werden angeboten, beliefert, belohnt – oder verfallen mit Strafe', () => {
  const s = game({ beers: [{ name: 'Hochzeitshelles', styleId: 'helles', liters: 40, quality: 70 },
                           { name: 'Weizen', styleId: 'weizen', liters: 40, quality: 70 }] });
  s.ended = false; s.chapter = 4; s.event = null;
  // Angebote kommen zufällig – hier gezielt einstellen
  const q = g.questsOf(s);
  q.offered.push({ id: 'hochzeit', until: s.day + 10 }, { id: 'gerda80', until: s.day + 10 });
  g.acceptQuest(s, 'hochzeit');
  assert.throws(() => g.deliverQuest(s, 'hochzeit', s.beers[1].id), /Gewünscht/);
  const cash = s.cash;
  g.deliverQuest(s, 'hochzeit', s.beers[0].id);
  assert.equal(s.beers[0].liters, 10);
  assert.ok(s.cash > cash + 250, 'Bezahlung abzüglich Biersteuer');
  assert.ok(q.done.includes('hochzeit'));
  g.acceptQuest(s, 'gerda80');
  const honor = s.honor;
  s.day += 31;
  g.questsDaily(s);
  assert.ok(q.failed.includes('gerda80') && s.honor < honor + 1e-9);
  // Opas Seiten: Ziel-Auftrag schließt sich selbst ab und schenkt einen eigenen Stil
  q.active.push({ id: 'opas_seiten', start: s.day, due: s.day + 100 });
  s.stats.barrelAged = 1; s.stats.bestReview = 80; s.stats.styles = ['a', 'b', 'c', 'd', 'e', 'f'];
  g.questsDaily(s);
  assert.ok(s.customStyles.some(x => x.id === 'opa_jubilaeum'));
});

test('Aufträge tauchen im normalen Spielverlauf von selbst auf', () => {
  const s = game();
  s.ended = false; s.chapter = 4;
  for (let i = 0; i < 120 && !g.questsOf(s).offered.length; i++) g.questsDaily(s), s.day++;
  assert.ok(g.questsOf(s).offered.length >= 1);
});
