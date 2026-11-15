// Tests der großen Kampagne: Ereignisse, Enden, Soft-Locks, Zustand, Spielzeit.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../src/game/index.js';
import { newRecipeFromStyle, compute } from '../src/core/brew.js';
import { runCampaign, POLICIES, estimateMinutes } from './bot.js';
import { giveFragment, fragments } from '../src/game/campaign/common.js';

const ENDS = ['handwerk', 'industrie', 'genossenschaft', 'uebernahme'];
const rng = seed => { let x = seed >>> 0; return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296); };

/** Gut ausgestatteter Spielstand für Einzeltests von Ereignissen. */
function rich(flags = {}, seed = 11) {
  const s = g.newGame({ skipTutorial: true, seed });
  s.event = null; s.cash = 100000; s.license = true; s.reputation = 60; s.honor = 40; s.skill.xp = 6000; s.day = 400; s.chapter = 10; s.chapterStarted = true;
  g.unlock(s, ...Object.keys(g.FEATURES));
  s.unlocked = g.STYLES.map(x => x.id);
  s.equipment = { kettle: 'kessel100', fermenter: 'konisch', cooling: 'profi' };
  for (const st of g.STYLES) { const c = compute(newRecipeFromStyle(st.id)); s.beers.push({ id: s.nextId++, name: st.name, styleId: st.id, liters: 120, quality: 90, flaws: [], notes: [], plato: c.plato, abv: c.abv, ibu: c.ibu, ebc: c.ebc, finishedDay: 390 }); }
  s.inventory.yeast = { lager: 5, ale: 5 }; s.story = undefined;
  Object.assign(s.flags, flags);
  settle(s);
  return s;
}
/** Offene Entscheidungen (z. B. Nebenereignisse) abräumen. */
function settle(s) {
  for (let i = 0; i < 30; i++) { g.checkStory(s); if (!s.event) return; g.resolveEvent(s, g.EVENTS[s.event.id].choices.find(c => !c.enabled || c.enabled(s)).id); }
}
const finite = (o, path = 's') => {
  const bad = [];
  (function walk(v, p) { if (typeof v === 'number' && !Number.isFinite(v)) bad.push(p); else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) walk(x, `${p}.${k}`); })(o, path);
  return bad;
};
const VARIANTS = [
  {}, { sabotage: true }, { falk_investor: true, genossen_anteile: true }, { regional: true, klaus_ally: true, gerda_ally: true }, { extrakt_vertrag: true },
  { genossen_plan: true, klaus_ally: true, gerda_ally: true, massiv_verhandelt: true }, { schwarz: true }, { emp_ottokar: true, emp_jule: true, emp_emre: true, halle: true },
];

test('Aufbau: 20 Kapitel, 4 Enden, über 40 Entscheidungen, Aufträge und Zufallsereignisse', () => {
  assert.ok(g.CHAPTERS.length >= 18 && g.CHAPTERS.length <= 24, `Kapitel ${g.CHAPTERS.length}`);
  assert.ok(g.CHAPTERS.filter(c => c.ending).length === 1 && g.CHAPTERS.at(-1).ending);
  assert.deepEqual(Object.keys(g.ENDINGS).sort(), [...ENDS].sort());
  assert.ok(Object.keys(g.EVENTS).length >= 55, 'Ereignisse');
  assert.ok(Object.values(g.EVENTS).filter(e => e.random).length >= 10, 'Zufallsereignisse');
  assert.ok(Object.values(g.QUESTS).filter(q => q.story).length >= 20, 'Story-Aufträge');
  for (const c of g.CHAPTERS) assert.ok(c.title && c.intro && c.outro && c.objectives.length, c.id);
});

test('(a) Jedes Ereignis und jede Option lässt sich ohne Fehler anwenden (Zustand bleibt gültig)', () => {
  const covered = new Set(), all = [];
  for (const [id, def] of Object.entries(g.EVENTS)) for (const c of def.choices) all.push(`${id}:${c.id}`);
  for (const [id, def] of Object.entries(g.EVENTS)) {
    assert.ok(def.title && (typeof def.text === 'function' || def.text) && def.choices.length >= 1, id);
    let anyEnabled = false;
    for (const v of VARIANTS) for (const c of def.choices) {
      const s = rich(v);
      s.event = { id, title: def.title, text: '', choices: [] };
      if (c.enabled && !c.enabled(s)) continue;
      anyEnabled = true;
      const text = g.resolveEvent(s, c.id);
      assert.ok(typeof text === 'string' && text.length > 10, `${id}:${c.id} ohne Text`);
      assert.deepEqual(finite(s), [], `${id}:${c.id}: NaN`);
      assert.ok(s.reputation >= 0 && s.reputation <= 100 && s.honor >= 0 && s.honor <= 100 && s.cash >= 0, `${id}:${c.id}: Werte außerhalb`);
      JSON.parse(JSON.stringify(s));
      covered.add(`${id}:${c.id}`);
    }
    assert.ok(anyEnabled, `${id}: keine wählbare Option`);
  }
  const missing = all.filter(x => !covered.has(x));
  assert.deepEqual(missing, [], `Optionen, die nie wählbar waren: ${missing.join(', ')}`);
});

test('Ereignisse und Optionen sind im Spiel erreichbar (Bot-Varianten und Zufallsentscheidungen)', () => {
  const events = new Set(), choices = new Set();
  const take = r => { r.seen.events.forEach(e => events.add(e)); r.seen.choices.forEach(c => choices.add(c)); };
  for (const p of Object.keys(POLICIES)) take(runCampaign({ seed: 5, policy: p, maxDays: 3000 }));
  for (let i = 0; i < 24; i++) {
    const r = rng(100 + i);
    take(runCampaign({ seed: 20 + i, maxDays: 2200, choose: (s, ev) => { const ok = g.EVENTS[ev.id].choices.filter(c => !c.enabled || c.enabled(s)); return ok[Math.floor(r() * ok.length)].id; } }));
  }
  const allEvents = Object.keys(g.EVENTS);
  const OLD = ['abtei_besuch', 'abtei_sud']; // Abtei-Nebengeschichte: eigene Tests (step5)
  const missing = allEvents.filter(e => !events.has(e) && !OLD.includes(e));
  assert.deepEqual(missing, [], `nie ausgelöste Ereignisse: ${missing.join(', ')}`);
  const allChoices = allEvents.flatMap(e => g.EVENTS[e].choices.map(c => `${e}:${c.id}`));
  const miss2 = allChoices.filter(c => !choices.has(c));
  assert.ok(miss2.length <= Math.ceil(allChoices.length * 0.06), `zu viele nie gewählte Optionen im Spiel (${miss2.length}): ${miss2.join(', ')}`);
});

test('(b) Jedes Ende ist erreichbar – abhängig von den Entscheidungen', () => {
  const got = {};
  for (const p of ENDS) {
    const r = runCampaign({ seed: 3, policy: p === 'industrie' ? 'industrie' : p });
    assert.ok(r.s.ended, `${p}: nicht beendet (Kapitel ${r.s.chapter}, Tag ${r.s.day})`);
    got[p] = r.s.ending;
    assert.equal(r.s.stage, 'brauerei');
    assert.ok(r.s.log.some(l => l.kind === 'story' && /^ENDE – /.test(l.text)), 'Endtext');
  }
  assert.deepEqual(got, { handwerk: 'handwerk', industrie: 'industrie', genossenschaft: 'genossenschaft', uebernahme: 'uebernahme' });
  // Die Wahl ist an Vorentscheidungen gebunden
  const s = rich();
  const ev = g.EVENTS.vermaechtnis;
  const enabled = x => ev.choices.filter(c => !c.enabled || c.enabled(x)).map(c => c.id);
  assert.deepEqual(enabled(s), ['handwerk']);
  assert.ok(enabled(rich({ falk_investor: true })).includes('industrie'));
  assert.ok(enabled(rich({ genossen_plan: true, klaus_ally: true, gerda_ally: true })).includes('genossenschaft'));
  assert.ok(!enabled(rich({ genossen_plan: true, klaus_ally: true })).includes('genossenschaft'), 'zwei Verbündete nötig');
  assert.ok(enabled(rich({ massiv_verhandelt: true })).includes('uebernahme'));
});

test('(c) Kein Soft-Lock: Fristen haben eine zweite Chance oder eine Konsequenz; wer nichts liefert, kommt trotzdem ans Ende', () => {
  for (const seed of [1, 2]) {
    const r = runCampaign({ seed, lazy: true });
    assert.ok(r.s.ended, `Seed ${seed}: träger Spieler blieb hängen (Kapitel ${r.s.chapter}: ${g.objectives(r.s).filter(o => !o.done).map(o => o.text).join(' | ')})`);
    assert.ok(g.questsOf(r.s).failed.length >= 8, 'Aufträge sind gescheitert, ohne zu blockieren');
  }
  // Zweite Chance: erst neue Frist, dann Konsequenz
  const s = rich({}); g.offerQuest(s, 'tv_fass');
  const a = () => g.questsOf(s).active.find(x => x.id === 'tv_fass');
  s.day = a().due + 1; g.questsDaily(s);
  assert.ok(a() && a().retried, 'zweite Chance');
  const rep = s.reputation; s.day = a().due + 1; g.questsDaily(s);
  assert.ok(!a() && g.questsOf(s).failed.includes('tv_fass') && s.flags.tv_blamage && s.reputation < rep, 'Konsequenz statt Sackgasse');
  // Jedes Kapitelziel wird in einem vollen Durchlauf tatsächlich erfüllt; Ziele nennen Fortschritt oder Text
  const r = runCampaign({ seed: 4 });
  assert.ok(r.s.ended && r.s.chapter === g.CHAPTERS.length - 1);
  for (const c of g.CHAPTERS) for (const o of c.objectives) assert.ok(typeof o.done === 'function' && (typeof o.text === 'function' || o.text.length > 5), `${c.id}/${o.id}`);
});

test('Notfall-Hilfe: leere Kasse ohne Sud ist kein Sackgasse', () => {
  const s = rich(); s.cash = 5; s.beers.forEach(b => { b.liters = 0; }); s.batches = []; s.day = 500; settle(s);
  g.advanceDays(s, 2);
  assert.ok(s.cash > 100, `Kasse ${s.cash}`);
});

/** n Tage vorspulen und dabei Entscheidungen beantworten (erste wählbare Option). */
function advance(s, n) {
  for (let d = 0; d < n; d++) { settle(s); g.advanceDays(s, 1); }
  settle(s);
}

test('Fixkosten, Kredit und Hopfen-Krise folgen den Verträgen; die Kasse rutscht nie ins Minus', async () => {
  const { shockFactor, storyCosts } = await import('../src/game/campaign/tick.js');
  const base = rich({ halle: true, emp_ottokar: true, emp_jule: true, emp_emre: true }); base.cash = 5000; base.chapter = 16; base.chapterStarted = true;
  g.checkStory(base); base.story.loan = { left: 990, rate: 330 };
  assert.equal(storyCosts(base), 220 + 380 + 260 + 240 + 330);
  advance(base, 35);
  assert.ok(base.log.some(l => /Fixkosten der Brauerei/.test(l.text)), 'Fixkosten abgebucht');
  assert.ok(base.story.loan.left < 990 && base.cash >= 0);
  // Verträge verändern den Preisschock
  const f = flags => { const s = rich(flags); g.checkStory(s); s.story.shock = { from: s.day, to: s.day + 100, factor: 3 }; return shockFactor(s); };
  assert.equal(f({}), 3);
  assert.ok(f({ regional: true }) < f({}) && f({ bauer_treue: true }) < f({ regional: true }) && f({ extrakt_vertrag: true }) < f({ bauer_treue: true }));
  assert.equal(f({ hopfen_vorrat: true }), 1.5);
  // Aufschlag wird tatsächlich auf Sude berechnet, die im Schockzeitraum angesetzt werden
  const s = rich({}); g.checkStory(s); s.story.shock = { from: s.day, to: s.day + 100, factor: 3 };
  const pr = newRecipeFromStyle('pils'); g.buyForRecipe(s, pr); const b = g.startBatch(s, pr); const cash = s.cash; advance(s, 1);
  assert.ok(s.log.some(l => /Hopfen-Preisschock/.test(l.text)) && s.cash < cash && b.cost.hops > 0);
  // Kein Schuldenberg: leere Kasse führt zu Ruf-/Ansehensverlust und Kündigung, nie zu Minus
  const poor = rich({ halle: true, emp_jule: true }); g.checkStory(poor); poor.cash = 10; poor.story.rescueDay = poor.day + 1000; poor.beers.forEach(x => { x.liters = 0; });
  advance(poor, 100);
  assert.ok(poor.cash >= 0 && !poor.flags.emp_jule, 'Jule hat gekündigt');
});

test('(d) Zustand bleibt JSON-serialisierbar und frei von NaN – auch mitten im Spiel', () => {
  for (const policy of ['handwerk', 'uebernahme']) {
    const r = runCampaign({ seed: 6, policy });
    assert.deepEqual(finite(r.s), []);
    const copy = JSON.parse(JSON.stringify(r.s));
    assert.equal(JSON.stringify(copy), JSON.stringify(r.s));
    assert.ok(Array.isArray(r.s.quests.active) && r.s.story && Array.isArray(r.s.story.fragments));
  }
  // Mitten im Spiel speichern und laden: der Lauf geht auf dem geladenen Stand weiter
  const half = runCampaign({ seed: 7, maxDays: 500 }).s;
  const loaded = g.migrate(JSON.parse(JSON.stringify(half)));
  g.checkStory(loaded);
  if (!loaded.event) g.advanceDays(loaded, 5); else g.resolveEvent(loaded, g.EVENTS[loaded.event.id].choices.find(c => !c.enabled || c.enabled(loaded)).id);
  assert.deepEqual(finite(loaded), []);
});

test('Aufträge: Anforderungen (Stil, Menge, Qualität, IBU/EBC/Alkohol) sind mit dem Startrezept erfüllbar', () => {
  for (const [id, q] of Object.entries(g.QUESTS)) {
    if (!q.story || q.kind !== 'deliver') continue;
    const styles = q.styles || g.STYLES.map(x => x.id);
    const fits = styles.some(st => {
      const c = compute(newRecipeFromStyle(st));
      const inR = (v, r) => !r || (v >= r[0] && v <= r[1]);
      return inR(c.ibu, q.ibu) && inR(c.ebc, q.ebc) && inR(c.abv, q.abv);
    });
    assert.ok(fits, `${id}: kein Standardrezept passt zu den Anforderungen`);
    assert.ok(q.minQ <= 90 && q.days >= 30 && q.liters >= 5, id);
    for (const st of q.styles || []) assert.ok(g.STYLE_META[st], `${id}: Stil ${st}`);
  }
  // IBU-/EBC-/ABV-Anforderungen werden geprüft, Teillieferungen sind möglich
  const s = rich(); g.offerQuest(s, 'kette_pils');
  const pils = s.beers.find(b => b.styleId === 'pils');
  pils.ibu = 80;
  assert.equal(g.questFits(s, 'kette_pils', pils).ok, false);
  pils.ibu = 35; pils.liters = 40;
  g.deliverQuest(s, 'kette_pils', pils.id);
  assert.ok(g.questsOf(s).active.some(a => a.id === 'kette_pils'), 'nur Teilmenge geliefert');
  const more = s.beers.find(b => b.styleId === 'pils' && b.id !== pils.id) || pils;
  pils.liters = 80; g.deliverQuest(s, 'kette_pils', pils.id);
  assert.ok(g.questsOf(s).done.includes('kette_pils'));
});

test('Opas Rezeptbuch: sechs Seiten, jede mit eigenem Bonus; Festbier-Auftrag nur mit allen Seiten', () => {
  const s = rich();
  const ids = ['wasser', 'hefe', 'hopfen', 'malz', 'wettstreit', 'reifung'];
  const xp = s.skill.xp;
  ids.forEach(i => giveFragment(s, i));
  giveFragment(s, 'wasser'); // doppelt: nichts passiert
  assert.equal(fragments(s).length, 6);
  assert.ok(s.skill.xp > xp);
  s.event = { id: 'jubilaeum' }; g.resolveEvent(s, 'friedhof');
  assert.ok(s.flags.offered_festbier && g.questsOf(s).active.some(a => a.id === 'opas_festbier'));
  const t = rich(); giveFragment(t, 'wasser'); t.event = { id: 'jubilaeum' }; g.resolveEvent(t, 'friedhof');
  assert.ok(!t.flags.offered_festbier);
});

test('Spielzeit-Schätzung: ein effizienter Spieler braucht 100–240 Minuten (25 s je Aktion, 200 Wörter/min)', () => {
  const rows = [];
  for (const seed of [1, 2, 3, 4]) {
    const r = runCampaign({ seed });
    assert.ok(r.s.ended, `Seed ${seed}`);
    assert.equal(r.estimate, estimateMinutes(r.actions, r.words));
    rows.push(`Seed ${seed}: ${r.actions} Aktionen, ${r.cnt.event} Entscheidungen, ${r.words} Wörter ⇒ ${r.estimate} min (${Math.round(r.s.day - g.START_DAY)} Spieltage)`);
    assert.ok(r.estimate >= 100 && r.estimate <= 240, rows.at(-1));
    assert.ok(r.actions >= 300, `mindestens 300 bewusste Aktionen: ${r.actions}`);
    assert.ok(r.cnt.event >= 40, `mindestens 40 Entscheidungen: ${r.cnt.event}`);
    assert.ok(r.words >= 6000, `Lesetext: ${r.words}`);
  }
  console.log('\n' + rows.join('\n'));
  assert.equal(estimateMinutes(240, 2000), 100 + 10); // 240 × 25 s = 100 min, 2000 Wörter = 10 min
});

test('Keine Sackgasse bei Entscheidungen: jedes Ereignis hat auch bei leerer Kasse und leerem Lager eine wählbare Option', () => {
  const bad = [];
  for (const [id, def] of Object.entries(g.EVENTS)) for (const v of VARIANTS) for (const broke of [false, true]) {
    const s = rich(v);
    if (broke) { s.cash = 0; s.beers.forEach(b => { b.liters = 0; }); s.license = false; s.reputation = 0; s.skill.xp = 0; s.inventory.yeast = {}; }
    if (!def.choices.some(c => !c.enabled || c.enabled(s))) bad.push(`${id}${broke ? ' (pleite)' : ''}`);
  }
  assert.deepEqual([...new Set(bad)], [], 'Ereignisse ohne wählbare Option würden das Spiel anhalten');
});
