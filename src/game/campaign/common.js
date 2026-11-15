// Gemeinsame Helfer der Kampagne. Alles arbeitet auf dem JSON-Spielstand `s`.
import { TIER_ORDER } from '../config.js';
import { log, clamp, round2, spend } from '../state.js';
import { levelOf, addXp } from '../progress.js';

export const tierAtLeast = (s, slot, tier) => TIER_ORDER[slot].indexOf(s.equipment[slot]) >= TIER_ORDER[slot].indexOf(tier);
export const stockOf = s => s.beers.filter(b => b.liters > 0.01);
export const bestBeer = s => [...stockOf(s)].sort((a, b) => b.quality - a.quality)[0];
export const lvl = s => levelOf(s.skill.xp).lvl;
export const stockL = s => stockOf(s).reduce((a, b) => a + b.liters, 0);

export const addRep = (s, d) => { s.reputation = round2(clamp(s.reputation + d, 0, 100)); };
export const addCash = (s, c) => { s.cash = round2(s.cash + c); };
/** Geld ausgeben, falls vorhanden; sonst so viel wie möglich (für Strafen, die nie blockieren sollen). */
export const fine = (s, c) => { const pay = Math.min(s.cash, c); s.cash = round2(s.cash - pay); return pay; };
export const pay = (s, c, what) => spend(s, c, what);
export const say = (s, text, kind = 'story') => log(s, text, kind);

/** Zugriff auf den Kampagnen-Zusatzzustand (wird bei Bedarf angelegt). */
export function ensureStory(s) {
  s.orders ||= [];
  const st = (s.story ||= {});
  st.tickDay ??= s.day;
  st.nextBill ??= s.day + 30;
  st.randDay ??= s.day;
  st.lastRand ??= s.day - 10;
  st.cool ||= {};
  st.fragments ||= [];
  st.orderSeq ??= 1;
  st.lastBatchId ??= 0;
  st.taxSeen ??= 0;
  st.debt ??= 0;
  st.shock ??= null;       // { from, to, factor } Hopfen-Preisschock
  st.loan ??= null;        // { left, rate }
  st.missed ??= 0;
  st.rescueDay ??= -999;
  st.lastGen ??= s.day;
  return st;
}

export const flag = (s, k) => !!s.flags[k];
/** Anzahl der Verbündeten (Klaus, Gerda, Hopfenbauer, Rivalin, Behörde), die dir wohlgesinnt sind. */
export const allies = s => ['klaus_ally', 'gerda_ally', 'bauer_ally', 'marlene_ally', 'wendland_ally'].filter(k => s.flags[k]).length;
export const employees = s => ['emp_willi', 'emp_jule', 'emp_emre'].filter(k => s.flags[k]).length;

// ---- Opas Rezeptbuch ----
export const FRAGMENTS = {
  wasser:  { title: 'Seite 1 – Das Wasser', text: '„Weiches Wasser fürs Helle, hartes fürs Dunkle. Und immer erst den Eimer schrubben, dann das Herz.“' },
  hefe:    { title: 'Seite 2 – Die Hefe', text: '„Hefe ist ein Haustier: füttere sie gut, halte sie kühl, und sie dankt es dir in jedem Glas.“' },
  hopfen:  { title: 'Seite 3 – Der Hopfen', text: '„Hopfen wird gepflückt, nicht gekauft. Wer ihn nicht riecht, hat ihn nicht verdient.“' },
  malz:    { title: 'Seite 4 – Das Malz', text: '„Das Malz ist die Seele. Dunkel heißt nicht schwer, und hell heißt nicht einfach.“' },
  wettstreit: { title: 'Seite 5 – Der Wettstreit', text: '„Gewinnen ist schön. Aber nur, wenn der andere hinterher noch mit dir anstoßen mag.“' },
  reifung: { title: 'Seite 6 – Die Reifung', text: '„Bier braucht Zeit. Geduld ist die einzige Zutat, die man nicht kaufen kann.“' },
};
export const FRAGMENT_BOON = {
  wasser: s => { s.hygiene = Math.min(0.8, s.hygiene + 0.08); return 'Hygiene dauerhaft +0,08'; },
  hefe: s => { addXp(s, 60, 'Opas Hefe-Tipps'); return '+60 Erfahrung'; },
  hopfen: s => { s.inventory.hops.push({ id: 'hallertauer', form: 'pellet', g: 400, ageDays: 0 }); return '400 g frischer Hallertauer als Erbstück'; },
  malz: s => { addRep(s, 3); return 'Ruf +3'; },
  wettstreit: s => { addRep(s, 4); return 'Ruf +4'; },
  reifung: s => { addXp(s, 120, 'Opas Reifungs-Geheimnis'); return '+120 Erfahrung'; },
};
export const fragments = s => ensureStory(s).fragments;
export function giveFragment(s, id) {
  const st = ensureStory(s);
  if (st.fragments.includes(id)) return '';
  st.fragments.push(id);
  const boon = FRAGMENT_BOON[id](s);
  say(s, `Opas Rezeptbuch – ${FRAGMENTS[id].title}\n${FRAGMENTS[id].text}\n(${boon}. Gesammelt: ${st.fragments.length}/6)`, 'story');
  return ` Du hast eine Seite aus Opas Rezeptbuch: ${FRAGMENTS[id].title}. (${boon}.)`;
}

// ---- Wettbewerbs-Wertung (Landes- und Bundesmeisterschaft) ----
export function medalFor(score, gold = 85, silver = 75, bronze = 65) {
  return score >= gold ? 'Gold' : score >= silver ? 'Silber' : score >= bronze ? 'Bronze' : null;
}
