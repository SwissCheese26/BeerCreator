// Karriere-Modus: endloses Brauerei-Management mit Markt, Aufträgen, Fixkosten, Jahreszielen und Punktzahl.
import { START_DAY, YEAR_DAYS, diffOf } from '../config.js';
import { levelOf } from '../progress.js';
import { log, round2 } from '../state.js';
import { initMarket, marketTick } from './market.js';
import { maybeSpawnContract, expireContracts } from './contracts.js';

export const FIXED_COSTS = 30; // Versicherung + Steuerberater, € je 30 Tage
export const RANKS = [
  { min: 0, title: 'Garagen-Tüftler' }, { min: 1500, title: 'Hobby-Brauer mit Ruf' }, { min: 4000, title: 'Lokale Größe' },
  { min: 8000, title: 'Regionale Marke' }, { min: 14000, title: 'Braumeister von Rang' }, { min: 22000, title: 'Braulegende' },
];

export function initCareer(s, { years = 5 } = {}) {
  s.license = true; s.stage = 'garage';
  s.cash = Math.round(1200 * diffOf(s).cash);
  s.career = { years, goals: [], year: 1, fixedPaid: 0, brokeDays: 0 };
  s.commissions = [];
  initMarket(s);
  yearGoals(s);
  log(s, `Karriere-Modus: Du startest mit Gewerbe, ${s.cash} € und einer Garage. Ziel: In ${years || '∞'} Jahren die beste Brauerei der Region. Markt, Saison, Aufträge und Fixkosten laufen mit.`, 'story');
}

export function careerScore(s) {
  const lvl = levelOf(s.skill.xp).lvl;
  return Math.round(s.cash / 5 + s.reputation * 25 + (lvl - 1) * 150 + s.stats.soldL * 2 + (s.stats.commissionsDone || 0) * 100
    + s.stats.medals.length * 200 + s.stats.bestQuality * 5 - (s.stats.commissionsFailed || 0) * 60);
}
export const rankOf = score => [...RANKS].reverse().find(r => Math.max(0, score) >= r.min);

function yearGoals(s) {
  const y = s.career.year;
  s.career.goals = [
    { id: 'sold', text: `Verkaufe ${y * 150 + 100} Liter in diesem Jahr`, target: y * 150 + 100, done: false },
    { id: 'rep', text: `Erreiche ${Math.min(95, 15 + y * 15)} Ruf`, target: Math.min(95, 15 + y * 15), done: false },
    { id: 'cash', text: `Halte mindestens ${y * 600} € Kapital`, target: y * 600, done: false },
  ];
  s.career.soldAtYearStart = s.stats.soldL;
}
export function careerGoals(s) {
  if (!s.career) return [];
  return s.career.goals.map(g => ({ ...g, done: g.id === 'sold' ? s.stats.soldL - s.career.soldAtYearStart >= g.target
    : g.id === 'rep' ? s.reputation >= g.target : s.cash >= g.target }));
}

function endGame(s, reason, text) {
  const score = careerScore(s);
  s.gameOver = { reason, score, rank: rankOf(score).title, day: s.day };
  log(s, `${text}\nPunktzahl: ${score} – Rang: ${rankOf(score).title}.`, 'story');
}

/** Täglicher Hook der Karriere. */
export function careerTick(s) {
  if (!s.career || s.gameOver) return;
  marketTick(s);
  expireContracts(s);
  if ((s.day - START_DAY) % 7 === 0) maybeSpawnContract(s);
  if ((s.day - START_DAY) % 30 === 0) {
    const pay = Math.min(s.cash, FIXED_COSTS); s.cash = round2(s.cash - pay);
    log(s, `Fixkosten (Versicherung, Steuerberater): ${pay} €.`);
  }
  // Insolvenz: kein Geld, nichts im Gärtank, kein Bier im Lager, 30 Tage lang
  const nothing = !s.batches.some(b => b.status === 'gaerend') && !s.beers.some(b => b.liters > 1);
  s.career.brokeDays = s.cash < 25 && nothing ? s.career.brokeDays + 1 : 0;
  if (s.career.brokeDays >= 30) return endGame(s, 'insolvenz', 'INSOLVENZ: Kein Geld, kein Bier – du musst die Brauerei aufgeben.');

  if (s.day - START_DAY >= s.career.year * YEAR_DAYS) {
    const goals = careerGoals(s), done = goals.filter(g => g.done).length;
    const bonus = done * 100; s.cash = round2(s.cash + bonus);
    log(s, `Jahresbilanz Jahr ${s.career.year}: ${done}/${goals.length} Ziele erreicht (Bonus ${bonus} €). Kapital ${s.cash} €, Ruf ${s.reputation.toFixed(0)}.`, 'story');
    s.market.maltMul = round2(s.market.maltMul * 1.03);
    s.market.year++; s.career.year++;
    if (s.career.years && s.career.year > s.career.years) return endGame(s, 'zeit', `Nach ${s.career.years} Jahren endet deine Karriere.`);
    yearGoals(s);
  }
}
