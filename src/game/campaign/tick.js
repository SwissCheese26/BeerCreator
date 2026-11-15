// Tägliche Story-Mechanik: Fixkosten der eigenen Brauerei, Hopfen-Preisschock, Mitarbeiter-Boni, Notfall-Hilfe.
// Wird aus checkStory aufgerufen (einmal pro Spieltag, Nachholen bei Zeitsprüngen).
import { round2 } from '../state.js';
import { addXp } from '../progress.js';
import { ensureStory, addRep, addHonor, addCash, fine, say, stockL, offerQuest } from './common.js';

/** Story-Aufträge, die automatisch angeboten werden, sobald `when` gilt: { id, when(s) }. */
export const AUTO_OFFERS = [];

export const BILLS = [
  { flag: 'halle',      label: 'Hallenmiete',               amount: () => 220 },
  { flag: 'emp_ottokar', label: 'Gehalt Braumeister Ottokar', amount: () => 380 },
  { flag: 'emp_jule',   label: 'Gehalt Jule (Vertrieb)',     amount: () => 260 },
  { flag: 'emp_emre',   label: 'Gehalt Emre (Buchhaltung)',  amount: () => 240 },
  { flag: 'energie_schock', label: 'Energiepreis-Aufschlag', amount: s => (s.flags.waermerueckgewinnung ? 0 : 140), until: s => s.story.energyUntil },
];

/** Laufende Story-Kosten pro 30 Tage (Anzeige/Tests). */
export function storyCosts(s) {
  const st = ensureStory(s);
  let sum = 0;
  for (const b of BILLS) if (s.flags[b.flag] && !(b.until && s.day > b.until(s))) sum += b.amount(s);
  if (st.loan) sum += Math.min(st.loan.left, st.loan.rate);
  return sum;
}

function payBills(s) {
  const st = s.story, lines = [];
  let due = 0, inst = 0;
  for (const b of BILLS) {
    if (!s.flags[b.flag]) continue;
    if (b.until && s.day > b.until(s)) { s.flags[b.flag] = false; continue; }
    const a = b.amount(s); if (a > 0) { due += a; lines.push(`${b.label} ${a} €`); }
  }
  if (st.loan) { inst = Math.min(st.loan.left, st.loan.rate); due += inst; lines.push(`Kreditrate ${inst} €`); }
  const rev = s.stats.revenue - st.revSeen; st.revSeen = s.stats.revenue;
  if (s.flags.falk_investor && rev > 0) { const a = round2(rev * 0.1); due += a; lines.push(`Gewinnanteil Falk Capital ${a} €`); }
  if (s.flags.genossen_anteile && rev > 0) { const a = round2(rev * 0.04); due += a; lines.push(`Dividende an die Genossen ${a} €`); }
  if (due <= 0.005) return;
  const paid = fine(s, due);
  if (paid + 0.01 >= due) {
    st.missed = 0;
    if (st.loan) { st.loan.left = round2(st.loan.left - inst); if (st.loan.left <= 0.01) { st.loan = null; say(s, '🏦 Der Kredit ist abbezahlt. Die Bank schickt Blumen – und ein Werbeschreiben für den nächsten.', 'good'); } }
    say(s, `🧾 Fixkosten der Brauerei (30 Tage): ${round2(due)} € – ${lines.join(', ')}.`, 'info');
    return;
  }
  // Kasse reicht nicht: kein Schuldenberg, sondern Konsequenzen (kein Soft-Lock): Ruf/Ansehen, nach zwei Monaten kündigt das Personal
  st.missed++;
  addRep(s, -2); addHonor(s, -2);
  say(s, `🧾 Die Kasse reicht nicht für die Fixkosten (${round2(due)} € fällig, ${round2(paid)} € gezahlt). Ruf −2, Ansehen −2.`, 'bad');
  if (st.missed >= 2) {
    for (const f of ['emp_jule', 'emp_emre', 'emp_ottokar']) if (s.flags[f]) { s.flags[f] = false; say(s, `🧾 ${{ emp_jule: 'Jule', emp_emre: 'Emre', emp_ottokar: 'Ottokar' }[f]} kündigt, weil das Gehalt ausblieb. „Ich glaube an dich, aber ich muss auch Miete zahlen.“`, 'bad'); break; }
    st.missed = 0;
  }
}

/** Preisschock auf Hopfen: Sude, die im Schockzeitraum angesetzt werden, kosten mehr – je nach früheren Verträgen. */
export function shockFactor(s) {
  let f = s.story.shock.factor;
  if (s.flags.extrakt_vertrag) f *= 0.15;     // Extrakt-Festpreis
  else if (s.flags.bauer_treue) f *= 0.3;      // Toni hält Wort
  else if (s.flags.regional) f *= 0.6;
  if (s.flags.hopfen_vorrat) f *= 0.5;         // Vorsorge getroffen
  return f;
}

function scanBatches(s) {
  const st = s.story;
  for (const b of s.batches) {
    if (!b.sc) {
      b.sc = 1;
      if (st.shock && b.startDay >= st.shock.from && b.startDay <= st.shock.to) {
        const extra = round2((b.cost?.hops || 0) * shockFactor(s));
        if (extra > 0) { const p = fine(s, extra); say(s, `📈 Hopfen-Preisschock: ${p} € Aufschlag für „${b.name}“.`, 'bad'); }
      }
    }
    if (b.status === 'fertig' && !b.sd) {
      b.sd = 1;
      if (s.flags.emp_ottokar) addXp(s, 6, 'Ottokars Handschrift');
    }
  }
  if (s.flags.emp_ottokar) s.hygiene = Math.max(s.hygiene, 0.5);
  if (s.flags.emp_emre) { const d = s.stats.taxPaid - st.taxSeen; if (d > 0) addCash(s, round2(d * 0.25)); }
  st.taxSeen = s.stats.taxPaid;
}

export function storyTick(s) {
  const st = ensureStory(s);
  let guard = 0;
  while (st.tickDay < s.day && guard++ < 800) {
    st.tickDay++;
    if (st.tickDay >= st.nextBill) {
      st.nextBill += 30;
      if (s.chapter >= 6) payBills(s);
      if (s.flags.emp_jule) addRep(s, 0.5);
    }
    if (st.shock && st.tickDay > st.shock.to) { st.shock = null; s.flags.krise_vorbei = true; say(s, '📉 Die Hopfenpreise normalisieren sich. Die Krise ist überstanden.', 'good'); }
  }
  scanBatches(s);
  rescue(s);
  for (const o of AUTO_OFFERS) if (o.when(s)) offerQuest(s, o.id);
}

/** Sicherheitsnetz: leere Kasse, nichts gärt, nichts im Lager – Gerda und Klaus legen zusammen. */
function rescue(s) {
  const st = s.story;
  if (s.day - st.rescueDay < 45 || s.chapter < 1) return;
  if (s.cash < 40 && !s.batches.some(b => b.status === 'gaerend') && stockL(s) < 5) {
    const amt = s.chapter >= 9 ? 900 : s.chapter >= 3 ? 400 : 150;
    st.rescueDay = s.day; addCash(s, amt);
    say(s, `🤝 Notfall: Deine Kasse ist leer, und nichts gärt. Gerda und Klaus legen im Wirtshaus zusammen und stecken dir ${amt} € zu. „Als Starthilfe. Nicht als Almosen.“`, 'story');
  }
}
