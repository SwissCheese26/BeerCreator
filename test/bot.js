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

/** Rezept verfeinern: ideales Maischverfahren, Reifung, edles Grundmalz. */
export function improve(r) {
  g.setMashProgram(r, g.styleFit(r.styleId).mash.ideal);
  r.reifung = g.styleFit(r.styleId).reif !== 'lagern'; // Lagerung kostet Tankzeit – bei Lagerbier lohnt sie sich für den Bot nicht
  const base = { pilsner: 'pilsner_boden', muenchner: 'muenchner_boden', pale: 'maris' };
  const m = [...r.malts].sort((a, b) => b.share - a.share).find(x => base[x.id]);
  if (m) m.id = base[m.id];
  return r;
}

/** Spielt das Tutorial mit den richtigen Eingaben durch. */
export function playTutorial(s) {
  const input = { maischen: 67, gaeren: 'warm' };
  while (!s.tutorial.done) g.tutorialAct(s, input[g.TUTORIAL_STEPS[s.tutorial.step].id]);
}

/** Schritt 3 + Aufträge nutzen: Proben, Verkostungen, Webseite, Aufträge annehmen und beliefern. */
function useExtras(s) {
  const try_ = f => { try { f(); } catch (e) { if (!(e instanceof g.GameError)) throw e; } };
  const best = () => s.beers.filter(b => b.liters >= 5).sort((a, b) => b.quality - a.quality)[0];
  if (g.hasFeature(s, 'auftraege')) {
    const q = g.questsOf(s);
    for (const o of [...q.offered]) {
      const d = g.QUESTS[o.id];
      const doable = d.kind === 'goal' || !d.styles || d.styles.some(x => s.unlocked.includes(x));
      try_(() => (doable && q.active.length < 2 ? g.acceptQuest(s, o.id) : g.declineQuest(s, o.id)));
    }
    for (const a of [...q.active]) {
      const b = s.beers.find(x => g.QUESTS[a.id].kind === 'deliver' && g.questFits(s, a.id, x).ok);
      if (b) try_(() => g.deliverQuest(s, a.id, b.id));
    }
  }
  const gearDone = s.chapter > 4 || (s.equipment.kettle !== 'topf' && s.equipment.cooling !== 'keine');
  if (g.hasFeature(s, 'marketing') && gearDone && s.cash > 700) {
    const b = best();
    if (b && b.quality >= 65) for (const id of Object.keys(g.REVIEWERS)) if (g.reviewerState(s, id).open) { try_(() => g.sendSample(s, id, b.id)); break; }
    if (b && b.quality >= 65 && b.liters >= 10 && s.cash > 300) try_(() => g.hostTasting(s, b.id, 'mittel'));
  }
  if (g.hasFeature(s, 'webseite') && gearDone && s.license && !s.web && s.cash > 1500) { try_(() => g.buildWebsite(s, 'ki')); try_(() => g.setSecurity(s, 2)); }
}

export function playStory({ seed = 1, maxDays = 1500, verbose = false, extras = false, location = 'kesselbach' } = {}) {
  const s = g.newGame({ mode: 'story', seed, location });
  playTutorial(s);
  let brewed = 0;
  while (!s.ended && s.day < START + maxDays) {
    if (s.event) {
      const ch = g.EVENTS[s.event.id].choices, want = CHOICES[s.event.id]?.(s);
      const ok = c => !c.enabled || c.enabled(s);
      g.resolveEvent(s, (ch.find(c => c.id === want && ok(c)) || ch.find(ok)).id);
      continue;
    }

    // Ausrüstung ab dem Kapitel „Keller“
    const ch = g.CHAPTERS[s.chapter]?.id;
    if (ch === 'keller' || s.chapter > 4) {
      if (s.equipment.cooling === 'keine' && s.cash >= 280) g.buyGear(s, 'cooling', 'kuehlschrank');
      if (s.equipment.kettle === 'topf' && s.cash >= 450 + 60) g.buyGear(s, 'kettle', 'kessel50');
      if (s.chapter > 4 && s.equipment.fermenter === 'eimer' && s.cash >= 260 + 100) g.buyGear(s, 'fermenter', 'edelstahl');
      if (s.chapter > 4 && s.equipment.kettle === 'kessel50' && s.cash >= 1800 + 300) g.buyGear(s, 'kettle', 'kessel100');
      if (s.chapter > 4 && s.equipment.fermenter === 'edelstahl' && s.equipment.kettle === 'kessel100' && s.cash >= 1100 + 300) g.buyGear(s, 'fermenter', 'konisch');
    }

    // Brauen, solange Platz ist
    const slots = g.slotsOf(s) - s.batches.filter(b => b.status === 'gaerend').length;
    if (slots > 0 && s.cash > 60) {
      for (const w of WISH) { // Kurse belegen, sobald Level und Geld reichen
        const m = g.STYLE_META[w];
        if (!s.unlocked.includes(w) && g.levelOf(s.skill.xp).lvl >= m.minLevel && s.cash > m.cost + 250) g.buyStyle(s, w);
      }
      const cycle = WISH.filter(w => s.unlocked.includes(w));
      const want = extras && (s.quests?.active || []).map(a => g.QUESTS[a.id]).find(d => d.kind === 'deliver' && d.styles)?.styles.find(x => s.unlocked.includes(x));
      const style = want && brewed % 2 === 0 ? want : s.stats.styles.length < 3 || brewed % 4 === 0 ? cycle[brewed % cycle.length] : 'helles';
      const r = newRecipeFromStyle(style);
      r.batchL = g.EQUIPMENT.kettle[s.equipment.kettle].maxBatchL;
      if (s.chapter >= 4) improve(r); // ein lernender Brauer verfeinert seine Rezepte
      try { g.buyForRecipe(s, r); g.startBatch(s, r); brewed++; } catch (e) { if (!(e instanceof g.GameError)) throw e; }
    }

    if (extras) useExtras(s);
    if (s.event) continue;
    const keep = new Set();
    if (extras) for (const a of s.quests?.active || []) { const d = g.QUESTS[a.id]; const b = d.kind === 'deliver' && s.beers.filter(x => x.quality >= d.minQ && (!d.styles || d.styles.includes(x.styleId))).sort((x, y) => y.liters - x.liters)[0]; if (b) keep.add(b.id); }
    // Bier abgeben: im Fest-Kapitel verschenken, sonst über die offenen Absatzwege verkaufen
    for (const beer of s.beers.filter(b => b.liters > 0.01 && !keep.has(b.id))) {
      if (ch === 'fest') { g.give(s, beer.id, Math.min(beer.liters, 10)); continue; }
      for (const c of ['online', 'gastro', 'hof', 'festival', 'schwarz', 'abholen']) {
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
