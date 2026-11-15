// Tägliche Story-Mechanik: Fristen, Fixkosten, Hopfen-Preisschock, Mitarbeiter-Boni, Notfall-Hilfe, Zufallsaufträge.
import { round2, rand } from '../state.js';
import { addXp } from '../progress.js';
import { ensureStory, addRep, addCash, fine, say, stockL } from './common.js';
import { expireOrders, generateOrder, openOrders } from './orders.js';

export const BILLS = [
  { flag: 'halle',      label: 'Hallenmiete',            amount: () => 220 },
  { flag: 'marktstand', label: 'Standgebühr Wochenmarkt', amount: () => 35 },
  { flag: 'emp_willi',  label: 'Gehalt Braumeister Willi', amount: () => 380 },
  { flag: 'emp_jule',   label: 'Gehalt Jule (Vertrieb)',  amount: () => 260 },
  { flag: 'emp_emre',   label: 'Gehalt Emre (Buchhaltung)', amount: () => 240 },
  { flag: 'energie_schock', label: 'Energiepreis-Aufschlag', amount: s => s.flags.waermerueckgewinnung ? 0 : 140, until: s => s.story.energyUntil },
];

/** Alle laufenden Kosten für einen 30-Tage-Zyklus (für Anzeigen/Tests). */
export function monthlyCosts(s) {
  ensureStory(s);
  let sum = 0;
  for (const b of BILLS) if (s.flags[b.flag] && !(b.until && s.day > b.until(s))) sum += b.amount(s);
  if (s.story.loan) sum += Math.min(s.story.loan.left, s.story.loan.rate);
  return sum;
}

function payBills(s) {
  const st = s.story;
  const lines = [];
  let due = st.debt;
  for (const b of BILLS) {
    if (!s.flags[b.flag]) continue;
    if (b.until && s.day > b.until(s)) { s.flags[b.flag] = false; continue; }
    const a = b.amount(s); if (a > 0) { due += a; lines.push(`${b.label} ${a} €`); }
  }
  if (st.loan) {
    const inst = Math.min(st.loan.left, st.loan.rate);
    due += inst; lines.push(`Kreditrate ${inst} €`);
    const paidNow = Math.min(s.cash, due) >= due;
    if (paidNow) { st.loan.left = round2(st.loan.left - inst); if (st.loan.left <= 0.01) { st.loan = null; say(s, 'Der Kredit ist abbezahlt. Die Bank schickt Blumen – und ein Werbeschreiben für den nächsten.', 'good'); } }
  }
  // Beteiligungen am Umsatz
  const rev = s.stats.revenue - (st.revSeen ?? s.stats.revenue); st.revSeen = s.stats.revenue;
  if (s.flags.falk_investor && rev > 0) { const a = round2(rev * 0.1); due += a; lines.push(`Gewinnanteil Falk Capital ${a} €`); }
  if (s.flags.genossen_anteile && rev > 0) { const a = round2(rev * 0.04); due += a; lines.push(`Dividende Genossen ${a} €`); }
  if (due <= 0) return;
  const paid = fine(s, due);
  if (paid + 0.01 >= due) { st.debt = 0; st.missed = 0; say(s, `Fixkosten (30 Tage): ${round2(due)} € – ${lines.join(', ')}.`); }
  else {
    st.debt = round2((due - paid) * 1.05); st.missed++;
    addRep(s, -2);
    say(s, `Die Kasse reicht nicht für die Fixkosten (${round2(due)} € fällig, ${round2(paid)} € gezahlt). Der Rest läuft mit 5 % Aufschlag mit; Ruf −2.`, 'bad');
  }
}

/** Preisschock auf Hopfen: Sude, die im Schockzeitraum angesetzt wurden, kosten mehr (abhängig von Verträgen/Entscheidungen). */
function shockFactor(s) {
  let f = s.story.shock.factor;
  if (s.flags.extrakt_vertrag) f *= 0.15;          // Extrakt-Festpreis
  else if (s.flags.bauer_treue) f *= 0.3;           // Hopfenbauer hält Wort
  else if (s.flags.regional) f *= 0.6;
  if (s.flags.hopfen_vorrat) f *= 0.5;              // Vorsorge getroffen
  return f;
}

function scanBatches(s) {
  const st = s.story;
  for (const b of s.batches) {
    if (!b.sc) {
      b.sc = 1;
      if (st.shock && b.startDay >= st.shock.from && b.startDay <= st.shock.to) {
        const extra = round2((b.cost?.hops || 0) * shockFactor(s));
        if (extra > 0) { const p = fine(s, extra); say(s, `Hopfen-Preisschock: ${p} € Aufschlag für „${b.name}“.`, 'bad'); }
      }
    }
    if (b.status === 'fertig' && !b.sd) {
      b.sd = 1;
      if (s.flags.emp_willi) { addXp(s, 6, 'Willis Handschrift'); s.hygiene = Math.max(s.hygiene, 0.5); }
    }
  }
  if (s.flags.emp_willi) s.hygiene = Math.max(s.hygiene, 0.5);
  if (s.flags.emp_emre) {
    const d = s.stats.taxPaid - st.taxSeen;
    if (d > 0) { const back = round2(d * 0.25); addCash(s, back); }
  }
  st.taxSeen = s.stats.taxPaid;
}

export function storyTick(s) {
  const st = ensureStory(s);
  st.revSeen ??= s.stats.revenue;
  let guard = 0;
  while (st.tickDay < s.day && guard++ < 800) {
    st.tickDay++;
    const d = st.tickDay;
    expireOrdersAt(s, d);
    if (d >= st.nextBill) { st.nextBill += 30; payBills(s); if (s.flags.emp_jule) addRep(s, 0.5); }
    if (st.shock && d > st.shock.to) { st.shock = null; s.flags.krise_vorbei = true; say(s, 'Die Hopfenpreise normalisieren sich. Die Krise ist überstanden.', 'good'); }
  }
  scanBatches(s);
  rescue(s);
  maybeGenerate(s);
}

function expireOrdersAt(s) { expireOrders(s); }

function rescue(s) {
  const st = s.story;
  if (s.day - st.rescueDay < 45) return;
  if (s.cash < 40 && !s.batches.some(b => b.status === 'gaerend') && stockL(s) < 5) {
    const amt = s.chapter >= 12 ? 900 : s.chapter >= 4 ? 400 : 200;
    st.rescueDay = s.day; addCash(s, amt);
    say(s, `Notfall: Deine Kasse ist leer, und nichts gärt. Tante Gerda und Klaus legen im Wirtshaus zusammen und stecken dir ${amt} € zu. „Als Starthilfe. Nicht als Almosen.“`, 'story');
  }
}

function maybeGenerate(s) {
  const st = s.story;
  if (!(s.license || s.flags.schwarz) || s.chapter < 5 || s.day - st.lastGen < 28) return;
  st.lastGen = s.day;
  if (openOrders(s).length >= 4) return;
  if (rand(s) < 0.6) generateOrder(s);
}
