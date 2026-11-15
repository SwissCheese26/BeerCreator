// Spielbot: spielt die Story durch (Machbarkeit, Balance, Spielzeit-Schätzung).
// `runCampaign` liefert zusätzlich Zähler: bewusste Aktionen und gelesene Wörter.
import * as g from '../src/game/index.js';
import { newRecipeFromStyle } from '../src/core/brew.js';

const START = g.START_DAY;
const wc = t => String(t || '').trim().split(/\s+/).filter(Boolean).length;

/** Entscheidungs-Varianten: eventId → Option (Funktion oder Text). Ohne Eintrag wählt der Bot die erste wählbare Option. */
const BASE = {
  opa_brief: 'buch', fest_einladung: 'zusagen', keller_angebot: 'annehmen', wettbewerb: 'teilnehmen', lieferant: 'bauer', kenner: 'absicht', zollinger: 'sorgfaeltig',
  gewerbe: s => (s.cash >= g.LICENSE_COST ? 'anmelden' : 'hobby'),
  heizluefter: s => (s.cash >= 25 ? 'kaufen' : 'decken'), kursleiter: s => (s.cash >= 60 ? 'kurs' : 'bier'),
  abtei_besuch: 'zusagen', abtei_sud: 'siegel',
  seite_wasser: 'teilen', nachbarin: s => (g.stockOf?.(s)?.length || s.beers.some(b => b.liters >= 5) ? 'probe' : 'erklaeren'), fest_abend: 'anstich', amt_hinweis: 'nachmelden', markt_stand: 'festerplatz',
  gerda_buch: 'versprechen', kalle_wirt: 'offen', merle_trifft: 'freundlich', toni_ernte: 'pfluecken', max_vertreter: 'probieren',
  merle_hefe: 'helfen', bundes: s => (s.cash >= 90 ? 'teilnehmen' : 'verzichten'), merle_buch: 'danke', altlast: 'nachzahlen', antrag: 'gruendlich', rechtsform: 'einzel',
  finanzierung: 'bank', falk_treffen: 'grenzen', genossen_abend: 'transparent', halle: s => (s.cash >= 900 ? 'garage' : 'garage'), umbau_panne: 'fachfirma', klaus_dachboden: 'abholen',
  ottokar_bewerbung: 'einstellen', jule_bewerbung: 'einstellen', emre_bewerbung: 'einstellen', markenname: 'tradition', etikett: 'agentur',
  eroeffnungsfest: 'dorf', zollinger_besuch: 'zeigen', handelskette: 'regional', lohnbrauen_angebot: 'vertrag',
  ernte_schlecht: s => (s.flags.regional ? 'treue' : 'vorrat'), energiepreise: s => (s.cash >= 2500 + 1500 ? 'waermerueckgewinnung' : 'sparen'),
  skandal: 'rueckruf', hygiene_offensive: 'labor', sabotage_entdeckt: 'gestehen', massiv_angebot: 'ablehnen', falk_ultimatum: 'auszahlen',
  genossen_plan: 'vielleicht', merle_wiedersehen: 'respekt', jubilaeum: 'friedhof', vermaechtnis: 'handwerk',
};
export const POLICIES = {
  handwerk: BASE,
  industrie: { ...BASE, lieferant: 'unabhaengig', finanzierung: 'falk', handelskette: 'kette', falk_ultimatum: 'folgen', massiv_angebot: 'praesent', genossen_plan: 'nein', vermaechtnis: 'industrie' },
  genossenschaft: { ...BASE, finanzierung: 'gemeinschaft', handelskette: 'regional', genossen_plan: 'ja', vermaechtnis: 'genossenschaft' },
  uebernahme: { ...BASE, lieferant: 'extrakt', gewerbe: 'schwarz', merle_hefe: 'sabotage', merle_buch: 'schweigen', sabotage_entdeckt: 'leugnen', altlast: 'ratenzahlung', antrag: 'abkuerzen',
    rechtsform: 'gmbh', halle: 'gewerbepark', ernte_schlecht: 'extrakt', skandal: 'vertuschen', massiv_angebot: 'verhandeln', genossen_plan: 'nein', merle_wiedersehen: 'kuehl', falk_ultimatum: 'auszahlen', vermaechtnis: 'uebernahme' },
};

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

const WISH = ['helles', 'pils', 'weizen', 'pale', 'maerzen', 'koelsch', 'dunkel', 'alt', 'bock'];
const FILL = ['helles', 'pils', 'weizen', 'maerzen'];
const SELL_CH = ['online', 'gastro', 'hof', 'festival', 'schwarz', 'abholen'];

/**
 * Spielt die Kampagne. Optionen: policy (Name oder Objekt), seed, maxDays, lazy (ignoriert Aufträge: nimmt keine an),
 * choose (eigene Entscheidungsfunktion (s, event) → optionId), keepGoing (Funktion, die vorzeitig abbrechen darf).
 */
export function runCampaign({ seed = 1, maxDays = 3000, policy = 'handwerk', lazy = false, choose = null, location = 'kesselbach', extras = true, verbose = false, optional = false } = {}) {
  const P = typeof policy === 'string' ? POLICIES[policy] : policy;
  const s = g.newGame({ mode: 'story', seed, location });
  const cnt = { brew: 0, sell: 0, give: 0, event: 0, quest: 0, gear: 0, course: 0, tech: 0, wait: 0, misc: 0, tutorial: 0 };
  const seen = { events: new Set(), choices: new Set(), quests: new Set(), eventWords: 0, questWords: 0 };
  const ok = f => { try { f(); return true; } catch (e) { if (!(e instanceof g.GameError)) throw e; return false; } };
  /** Aktion ausführen und nur bei Erfolg zählen. */
  const act = (kind, f, n = 1) => { const r = ok(f); if (r) cnt[kind] += n; return r; };

  cnt.tutorial = g.TUTORIAL_STEPS.length;
  playTutorial(s);
  let brewed = 0, brandDone = false;

  const decide = () => {
    const ev = s.event, def = g.EVENTS[ev.id];
    const good = def.choices.filter(c => !c.enabled || c.enabled(s));
    let want = choose ? choose(s, ev) : (typeof P[ev.id] === 'function' ? P[ev.id](s) : P[ev.id]);
    if (!good.length) throw new Error(`Ereignis ${ev.id} ohne wählbare Option (Soft-Lock!) – Kasse ${s.cash}`);
    const pick = good.find(c => c.id === want) || good[0];
    seen.events.add(ev.id); seen.choices.add(`${ev.id}:${pick.id}`);
    seen.eventWords += wc(ev.title) + wc(ev.text) + ev.choices.reduce((a, c) => a + wc(c.label), 0);
    cnt.event++;
    g.resolveEvent(s, pick.id);
  };

  // Aufträge: annehmen, beliefern; Bedarf ermitteln
  const questOps = () => {
    const q = g.questsOf(s);
    for (const o of [...q.offered]) {
      const d = g.QUESTS[o.id];
      if (lazy) { if (!d.story) act('quest', () => g.declineQuest(s, o.id)); continue; }
      if (!d.story && !optional) continue; // Zufallsaufträge lässt ein effizienter Spieler links liegen
      const doable = d.kind === 'goal' || !d.styles || d.styles.some(x => s.unlocked.includes(x) || g.STYLE_META[x].minLevel <= g.levelOf(s.skill.xp).lvl);
      const open = q.active.filter(a => !g.QUESTS[a.id].story).length;
      if (!seen.quests.has(o.id)) { seen.quests.add(o.id); seen.questWords += wc(d.title) + wc(d.text); }
      act('quest', () => ((d.story || (doable && open < 2)) ? g.acceptQuest(s, o.id) : g.declineQuest(s, o.id)));
    }
    if (lazy) return; // nichts liefern: Fristen laufen ab, die Konsequenzen greifen
    for (const a of [...q.active]) {
      const d = g.QUESTS[a.id];
      if (d.kind !== 'deliver') continue;
      for (const b of s.beers.filter(x => x.liters > 0.05).sort((x, y) => x.quality - y.quality)) {
        if (!g.questsOf(s).active.some(z => z.id === a.id)) break;
        if (g.questFits(s, a.id, b).ok) { if (!act('quest', () => g.deliverQuest(s, a.id, b.id))) break; if (s.event) return; }
      }
    }
  };
  const needs = () => {
    const out = [];
    if (lazy) return out;
    for (const a of g.questsOf(s).active) {
      const d = g.QUESTS[a.id];
      if (d.kind !== 'deliver') continue;
      const have = s.beers.filter(b => b.liters > 0.05 && g.questFits(s, a.id, b).ok).reduce((x, b) => x + b.liters, 0)
        + s.batches.filter(b => b.status === 'gaerend' && (!d.styles || d.styles.includes(b.styleId)) && b.quality >= d.minQ).reduce((x, b) => x + b.liters, 0);
      const left = (d.story ? d.liters - (a.got || 0) : d.liters) - have;
      if (left > 0.5) out.push({ d, left });
    }
    return out;
  };

  const buyGear = () => {
    const c = s.chapter, e = s.equipment, tiers = g.TIER_ORDER;
    const want = [];
    if (c >= 4) want.push(['cooling', 'kuehlschrank'], ['kettle', 'kessel50']);
    if (c >= 5) want.push(['fermenter', 'edelstahl']);
    if (c >= 8) want.push(['kettle', 'kessel100']);
    if (c >= 10) want.push(['fermenter', 'konisch'], ['cooling', 'profi']);
    if (c >= 11) want.push(['kettle', 'kessel100'], ['fermenter', 'konisch'], ['cooling', 'profi']);
    for (const [slot, tier] of want) {
      if (tiers[slot].indexOf(e[slot]) >= tiers[slot].indexOf(tier)) continue;
      const cost = g.EQUIPMENT[slot][tier].cost;
      if (s.cash >= cost + (c >= 9 ? 400 : 120)) { if (act('gear', () => g.buyGear(s, slot, tier))) return; }
    }
  };
  const buyTechs = () => {
    const c = s.chapter, want = [];
    if (c >= 11) want.push('filter', 'sensorik');
    if (c >= 15) want.push('abfueller');
    for (const t of want) if (!g.hasTech(s, t) && s.cash >= g.TECH[t].cost + 800 && g.levelOf(s.skill.xp).lvl >= g.TECH[t].level) { if (act('tech', () => g.buyTech(s, t))) return; }
  };
  const buyStyles = () => {
    const wanted = new Set(g.questsOf(s).active.flatMap(a => g.QUESTS[a.id].styles || []));
    for (const w of WISH) {
      const m = g.STYLE_META[w];
      const useful = wanted.has(w) || s.chapter >= 7 || s.cash > 2500;
      if (useful && !s.unlocked.includes(w) && g.levelOf(s.skill.xp).lvl >= m.minLevel && s.cash > m.cost + 250) act('course', () => g.buyStyle(s, w));
    }
  };
  const extrasOps = () => {
    const c = s.chapter;
    const best = s.beers.filter(b => b.liters >= 2).sort((a, b) => b.quality - a.quality)[0];
    if (c >= 13 && !s.brand?.designed) act('misc', () => g.setBrand(s, { symbol: '🌾', color: '#7a3b12', shape: 'schild', text: 'HHB' }), 2);
    if (c >= 12 && !s.auto.helper && s.cash > 600) act('misc', () => g.hireHelper(s));
    if (c >= 13 && best && best.quality >= 70 && (s.stats.bestReview || 0) < 70 && s.cash > 400)
      for (const id of Object.keys(g.REVIEWERS)) if (g.reviewerState(s, id).open) { if (act('misc', () => g.sendSample(s, id, best.id))) break; }
    if (c >= 15 && !s.beers.some(b => b.industrial) && !s.contracts.length && s.cash > 1200 && s.license) {
      const r = improve(newRecipeFromStyle('helles')); r.name = 'Lohn-Helles';
      act('misc', () => { g.saveRecipe(s, r); g.contractBrew(s, 'Lohn-Helles', 500); }, 2);
    }
  };

  const soldPending = () => g.objectives(s).some(o => !o.done && /Verkaufe|Level|Bierstile|Qualität|Kapital/.test(o.text));
  const brewStep = () => {
    const slots = g.slotsOf(s) - s.batches.filter(b => b.status === 'gaerend').length;
    if (slots <= 0 || s.cash <= 60) return;
    const kettleMax = g.EQUIPMENT.kettle[s.equipment.kettle].maxBatchL;
    let style = null, liters = kettleMax;
    const chId = g.CHAPTERS[s.chapter]?.id;
    if (chId === 'bundes' && !s.flags.bundes_medal) { const cat = s.story?.bundesCat; if (cat && s.unlocked.includes(cat) && !s.beers.some(b => b.liters > 5 && b.styleId === cat && b.quality >= 65) && !s.batches.some(b => b.status === 'gaerend' && b.styleId === cat)) { style = cat; liters = Math.min(kettleMax, 20); } }
    for (const n of style ? [] : needs()) {
      const st = (n.d.styles || FILL).find(x => s.unlocked.includes(x));
      if (st) { style = st; liters = Math.min(kettleMax, Math.max(10, Math.ceil(n.left / 0.92 / 5) * 5)); break; }
    }
    if (!style) {
      if (s.chapter >= 7 && s.cash >= 4000 && !soldPending()) return; // genug Kapital: nur noch bei Bedarf brauen
      const stockLiters = s.beers.reduce((a, b) => a + b.liters, 0) + s.batches.filter(b => b.status === 'gaerend').reduce((a, b) => a + b.liters, 0);
      if (stockLiters > 250 + g.slotsOf(s) * kettleMax * 0.5) return; // nicht auf Halde brauen
      const cycle = WISH.filter(w => s.unlocked.includes(w));
      style = s.stats.styles.length < 8 && cycle.length > s.stats.styles.length ? cycle.find(w => !s.stats.styles.includes(w)) : (brewed % 3 === 0 ? cycle[brewed % cycle.length] : FILL.filter(f => s.unlocked.includes(f))[brewed % 2]);
    }
    const r = newRecipeFromStyle(style);
    r.batchL = liters;
    if (s.chapter >= 4) improve(r);
    if (s.flags.extrakt_vertrag) g.setHopForm(r, 'extract'); // der Liefervertrag erlaubt nur Extrakt
    const fresh = !s.stats.styles.includes(style); // ein neuer Stil will einmal bewusst gestaltet werden
    if (act('brew', () => { g.buyForRecipe(s, r); g.startBatch(s, r); }, fresh ? 2 : 1)) brewed++;
  };

  const sellStep = () => {
    const keep = new Map();
    for (const a of g.questsOf(s).active) {
      const d = g.QUESTS[a.id];
      if (d.kind !== 'deliver') continue;
      let left = d.story ? d.liters - (a.got || 0) : d.liters;
      for (const b of s.beers.filter(x => x.liters > 0.05 && g.questFits(s, a.id, x).ok)) { const k = Math.min(left, b.liters - (keep.get(b.id) || 0)); if (k > 0) { keep.set(b.id, (keep.get(b.id) || 0) + k); left -= k; } }
    }
    const chName = g.CHAPTERS[s.chapter]?.id;
    if (chName === 'bundes' && !s.flags.bundes_medal) { const cb = s.beers.filter(b => b.liters > 5 && b.styleId === s.story?.bundesCat && b.quality >= 65).sort((a, b) => b.quality - a.quality)[0]; if (cb) keep.set(cb.id, cb.liters); }
    for (const beer of s.beers.filter(b => b.liters > 0.01)) {
      const free = beer.liters - (keep.get(beer.id) || 0);
      if (free < 1) continue;
      if (chName === 'fest' && (s.stats.givenL >= 20 && s.reputation >= 8) === false) { act('give', () => g.give(s, beer.id, Math.min(Math.floor(free), 10))); if (s.event) return; continue; }
      for (const c of SELL_CH) {
        if (!g.channelState(s, c).open || (c === 'festival' && free < 25) || (c === 'schwarz' && s.license)) continue;
        const room = Math.floor(g.channelRoom(s, c));
        const l = Math.min(Math.floor(beer.liters - (keep.get(beer.id) || 0)), room);
        if (l > 0) act('sell', () => g.sell(s, beer.id, l, c));
        if (s.event) return;
        if (beer.liters - (keep.get(beer.id) || 0) < 1) break;
      }
    }
  };

  let guard = 0;
  const timeline = [];
  let lastCh = -1;
  while (!s.ended && s.day < START + maxDays && guard++ < 20000) {
    if (s.chapter !== lastCh) { lastCh = s.chapter; timeline.push({ chapter: s.chapter, id: g.CHAPTERS[s.chapter]?.id, day: s.day - START, actions: Object.values(cnt).reduce((a, b) => a + b, 0), cash: Math.round(s.cash), xp: s.skill.xp, cnt: { ...cnt } }); }
    if (s.event) { decide(); continue; }
    buyGear(); buyStyles(); buyTechs();
    if (extras) extrasOps();
    if (s.event) continue;
    questOps(); if (s.event) continue;
    brewStep();
    sellStep(); if (s.event) continue;
    questOps(); if (s.event) continue;
    const ready = s.batches.filter(b => b.status === 'gaerend').map(b => b.readyDay - s.day).filter(d => d > 0);
    const idle = s.chapter >= 7 && s.cash >= 4000 && !soldPending() && !needs().length;
    const step = Math.max(1, Math.min(ready.length ? 35 : idle ? 30 : 7, ready.length ? Math.min(...ready) : (idle ? 30 : 7)));
    cnt.wait++;
    g.advanceDays(s, step);
  }
  if (verbose) console.log(s.log.filter(l => l.kind === 'story').map(l => `[Tag ${l.day}] ${l.text}`).join('\n'));

  // Lesen: Kapitel-/Ereignis-Texte aus dem Log + gezeigte Ereignisse + Aufträge + Tutorial
  const logWords = s.log.filter(l => l.kind === 'story' || l.kind === 'unlock').reduce((a, l) => a + wc(l.text), 0);
  const tutWords = g.TUTORIAL_STEPS.reduce((a, st) => a + st.lines.reduce((b, l) => b + wc(l[1]), 0), 0);
  const questLogWords = s.log.filter(l => l.text.startsWith('📮 NEUER AUFTRAG')).reduce((a, l) => a + wc(l.text), 0);
  const words = logWords + seen.eventWords + seen.questWords + questLogWords + tutWords;
  const actions = Object.values(cnt).reduce((a, b) => a + b, 0);
  return { s, cnt, actions, words, seen, timeline, estimate: estimateMinutes(actions, words) };
}

/** Spielzeit-Schätzung: 25 s je bewusster Aktion, 200 Wörter pro Minute Lesen. */
export const SECONDS_PER_ACTION = 25, WORDS_PER_MINUTE = 200;
export const estimateMinutes = (actions, words) => Math.round(((actions * SECONDS_PER_ACTION) / 60 + words / WORDS_PER_MINUTE) * 10) / 10;

export function playStory(opts = {}) { return runCampaign(opts).s; }

// Wer „heimlich“ verkauft und dem Amt ausweicht, wird in Kapitel 9 von der Altlast eingeholt.
POLICIES.schwarz = { ...BASE, gewerbe: 'schwarz', amt_hinweis: 'abwimmeln', altlast: 'ratenzahlung', merle_hefe: 'wegschicken', skandal: 'schuld', rechtsform: 'gmbh', halle: 'muehle', finanzierung: 'eigen', etikett: 'enkelin', markenname: 'modern', ernte_schlecht: 'aussitzen', energiepreise: 'solar', hygiene_offensive: 'sparen', massiv_angebot: 'praesent', genossen_plan: 'nein', falk_ultimatum: 'hinhalten', merle_wiedersehen: 'kuehl', eroeffnungsfest: 'gross', jubilaeum: 'wirtshaus', ottokar_bewerbung: 'absagen', jule_bewerbung: 'absagen', emre_bewerbung: 'absagen' };
