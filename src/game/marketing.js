// Marketing & Ruf: Proben an (erfundene) Kritiker verschicken, Kundenbewertungen, Verkostungen,
// eigene Webseite mit Onlineshop und Sicherheit gegen Hacker.
import { beerTax } from './config.js';
import { need, log, rand, round2, clamp, spend, hasFeature } from './state.js';
import { addFame, styleView } from './styles.js';
import { presentationReview, hasOrder } from './business.js';

// ---------- Kritiker ----------
// reach: wie viele Leute zuhören (wirkt auf Ruf und Nachfrage). likes/hates: Stil-Vorlieben. harsh: zieht Punkte ab.
export const REVIEWERS = {
  hopfenkind: { name: 'Hopfenkind (Blog)', icon: '✍️', followers: '900 Leser', cost: 9, reach: 0.5, answer: 0.95, harsh: 0, minRep: 0,
    likes: [], hates: [], text: 'Ein kleiner, ehrlicher Bierblog aus der Nachbarstadt. Schreibt über fast alles.' },
  malzmeister: { name: 'Malzmeister TV (YouTube)', icon: '📺', followers: '24.000 Abos', cost: 16, reach: 1, answer: 0.8, harsh: 2, minRep: 10,
    likes: ['dunkel', 'bock', 'doppelbock', 'maerzen', 'rauch', 'schwarzbier', 'dunkelweizen'], hates: ['neipa', 'berliner'],
    text: 'Ein gemütlicher Franke, der Malzbomben liebt und mit Hopfensaft wenig anfangen kann.' },
  doldenrausch: { name: 'Doldenrausch (Instagram)', icon: '📸', followers: '61.000 Follower', cost: 18, reach: 1.4, answer: 0.65, harsh: 3, minRep: 20,
    likes: ['ipa', 'neipa', 'pale', 'pils', 'saison'], hates: ['helles', 'dunkel', 'bock'],
    text: 'Hopfenfans mit schönen Fotos. Was nicht nach Tropenfrucht riecht, wird kaum gepostet.' },
  sudhausfunk: { name: 'Sudhausfunk (Podcast)', icon: '🎙️', followers: '12.000 Hörer', cost: 14, reach: 0.9, answer: 0.85, harsh: 1, minRep: 15,
    likes: [], hates: [], loveCraft: true,
    text: 'Zwei Hobbybrauer, die Neues lieben: eigene Stile, Fassreifung und Cuvées bekommen Extrapunkte.' },
  sommelier: { name: 'Der Biersommelier (Magazin)', icon: '🎩', followers: '150.000 Leser', cost: 25, reach: 2.2, answer: 0.5, harsh: 7, minRep: 40,
    likes: ['dubbel', 'tripel', 'imperial', 'doppelbock', 'porter'], hates: [],
    text: 'Das große Fachmagazin. Streng, aber wer hier gut wegkommt, ist im ganzen Land bekannt.' },
};
export const REVIEW_COOLDOWN = 30;  // Tage, bis man dieselbe Person wieder anschreiben kann
export const SAMPLE_L = 1;          // drei Flaschen

export const marketOf = s => {
  s.reviews ||= { pending: [], list: [], last: {} };
  s.ratings ||= { count: 0, sum: 0, recent: [] };
  return s;
};

export function reviewerState(s, id) {
  const r = REVIEWERS[id];
  if (!r) return { open: false, reason: 'Unbekannt.' };
  if (s.mode !== 'sandbox' && s.reputation < r.minRep) return { open: false, reason: `Antwortet erst ab ${r.minRep} Ruf.` };
  marketOf(s);
  if (s.reviews.pending.some(p => p.reviewer === id)) return { open: false, reason: 'Deine Probe ist unterwegs.' };
  const last = s.reviews.last[id];
  if (last != null && s.day - last < REVIEW_COOLDOWN) return { open: false, reason: `Wieder in ${REVIEW_COOLDOWN - (s.day - last)} Tagen.` };
  return { open: true };
}

export function sendSample(s, reviewerId, beerId) {
  need(hasFeature(s, 'marketing'), 'Marketing ist noch gesperrt.');
  const r = REVIEWERS[reviewerId];
  const st = reviewerState(s, reviewerId);
  need(st.open, st.reason);
  const b = s.beers.find(x => x.id === beerId);
  need(b, 'Dieses Bier gibt es nicht im Lager.');
  need(b.liters >= SAMPLE_L - 1e-9, `Für eine Probe brauchst du mindestens ${SAMPLE_L} L.`);
  const tax = s.license && s.mode !== 'sandbox' ? round2(beerTax(SAMPLE_L, b.plato, s.taxedLYear / 100)) : 0;
  spend(s, r.cost + tax, 'den Versand');
  if (tax) { s.taxedLYear += SAMPLE_L; s.stats.taxPaid = round2(s.stats.taxPaid + tax); }
  b.liters = round2(b.liters - SAMPLE_L);
  const { id, ...snap } = b;
  s.reviews.pending.push({ reviewer: reviewerId, beer: { ...snap, liters: SAMPLE_L }, due: s.day + 4 + Math.floor(rand(s) * 8) });
  s.reviews.last[reviewerId] = s.day;
  s.stats.samples = (s.stats.samples || 0) + 1;
  log(s, `📦 Drei Flaschen „${b.name}“ an ${r.name} geschickt (Versand ${r.cost} €${tax ? `, Biersteuer ${tax} €` : ''}).`);
}

const TASTE = b => {
  const t = [];
  t.push(b.ebc > 60 ? 'tiefschwarz' : b.ebc > 25 ? 'dunkel' : b.ebc > 12 ? 'bernsteinfarben' : 'goldgelb');
  if (b.ibu > 45) t.push('ordentlich bitter'); else if (b.ibu < 18) t.push('kaum bitter');
  if (b.abv >= 7.5) t.push('wärmend stark'); else if (b.abv < 4.3) t.push('leicht');
  if (b.barrel && b.barrel !== 'cuvee') t.push('mit schönem Holzton');
  return t.join(', ');
};
const FLAW_TXT = { infektion: 'leider sauer und infiziert', diacetyl: 'Butter-Noten (Diacetyl)', fusel: 'brandige Fuselalkohole',
  dms: 'Gemüse-Aroma (DMS)', oxidation: 'pappig-oxidiert', unvergoren: 'süß und nicht durchgegoren' };

/** Punkte (0–100), die ein Kritiker einem Bier gibt – ohne Zufall. */
export function reviewScore(reviewerId, beer) {
  const r = REVIEWERS[reviewerId];
  let x = beer.quality - r.harsh;
  if (r.likes.includes(beer.styleId)) x += 7;
  if (r.hates.includes(beer.styleId)) x -= 12;
  if (r.loveCraft && (beer.custom || beer.blend || beer.barrel)) x += 8;
  x -= (beer.flaws || []).length * 6;
  return x;
}

function writeReview(s, p) {
  const r = REVIEWERS[p.reviewer], b = p.beer;
  const look = presentationReview(s, b);
  const score = Math.round(clamp(reviewScore(p.reviewer, b) + look + (rand(s) - 0.5) * 12, 0, 100));
  const stars = clamp(Math.round(score / 20 * 2) / 2, 0.5, 5);
  const style = styleView(b).name;
  const flaws = (b.flaws || []).map(f => FLAW_TXT[f]).filter(Boolean);
  let text;
  if (score >= 85) text = `„${b.name}“ ist eine echte Entdeckung! ${style}, ${TASTE(b)} – so muss das sein. Unbedingt probieren!`;
  else if (score >= 70) text = `Ein sehr ordentliches ${style}: ${TASTE(b)}. Da steckt Handwerk drin. Gerne mehr davon.`;
  else if (score >= 55) text = `„${b.name}“ ist ${TASTE(b)} und trinkbar, haut uns aber nicht vom Hocker.`;
  else text = `Leider enttäuschend. „${b.name}“ wirkt unausgewogen${flaws.length ? ' – ' + flaws.join(', ') : ''}. Da geht noch was.`;
  if (r.hates.includes(b.styleId)) text += ' (Ehrlich gesagt: nicht ganz unser Stil.)';
  else if (r.likes.includes(b.styleId) && score >= 60) text += ' Genau unser Ding!';
  if (r.loveCraft && (b.custom || b.blend || b.barrel)) text += ' Mutig und eigenständig – das feiern wir.';
  if (look >= 4) text += ' Und die Aufmachung: Flasche, Glas, Etikett – alles stimmig. Großes Kino.';
  else if (look <= -2) text += ' Die Aufmachung passt leider gar nicht zum Bier.';

  // Wer dich schon kennt, bringt mit jeder weiteren Kritik weniger neue Leser zu dir
  const before = s.reviews.list.filter(x => x.reviewer === p.reviewer).length;
  const rep = round2(clamp((score - 65) / 12 * r.reach / (1 + 0.8 * before), -5, 4));
  if (s.mode === 'story') s.reputation = round2(clamp(s.reputation + rep, 0, 100));
  if (score >= 75) {
    const until = s.day + 21, factor = round2(1 + 0.12 * r.reach * (score - 70) / 15);
    if (!s.buzz || s.buzz.until < s.day || s.buzz.factor < factor) s.buzz = { until, factor, by: r.name };
  }
  addFame(s, b, 40 * r.reach * (score >= 70 ? 1 : 0.5)); // eigener Stil wird bekannter (oder unbeliebter)
  const entry = { day: s.day, reviewer: p.reviewer, beer: b.name, styleId: b.styleId, score, stars, text, rep };
  s.reviews.list.push(entry);
  s.reviews.list = s.reviews.list.slice(-30);
  s.stats.bestReview = Math.max(s.stats.bestReview || 0, score);
  log(s, `${r.icon} ${r.name} über „${b.name}“: ${score}/100. „${text}“ Ruf ${rep >= 0 ? '+' : ''}${f1(rep)}.`, score >= 60 ? 'good' : 'bad');
  return entry;
}
const f1 = x => (Math.round(x * 10) / 10).toString().replace('.', ',');

/** Täglich: fällige Proben beantworten. */
export function processReviews(s) {
  if (!s.reviews?.pending?.length) return;
  const due = s.reviews.pending.filter(p => p.due <= s.day);
  s.reviews.pending = s.reviews.pending.filter(p => p.due > s.day);
  for (const p of due) {
    const r = REVIEWERS[p.reviewer];
    if (rand(s) < 0.04) { log(s, `📦 Das Paket an ${r.name} ist beim Versand zerbrochen. Pech – die Probe ist verloren.`, 'bad'); continue; }
    if (rand(s) > r.answer) { log(s, `${r.icon} ${r.name} hat sich nicht gemeldet. Vielleicht beim nächsten Mal.`); continue; }
    writeReview(s, p);
  }
}

// ---------- Kundenbewertungen ----------
const CUSTOMER = {
  5: ['Bestes Bier der Gegend!', 'Kaufe ich wieder – grandios.', 'Endlich mal echtes Handwerk.'],
  4: ['Richtig gut, gerne wieder.', 'Sehr lecker, Preis passt.', 'Schönes Bier für den Feierabend.'],
  3: ['Ganz okay.', 'Trinkbar, mehr nicht.', 'Solide, aber nichts Besonderes.'],
  2: ['Hat mir nicht geschmeckt.', 'Für den Preis zu wenig.', 'Irgendwas stimmt da nicht.'],
  1: ['Ungenießbar, weggekippt.', 'Nie wieder.', 'Schmeckt komisch – Finger weg.'],
};
/** Nach einem Verkauf schreiben manche Kunden eine Bewertung (1–5 Sterne). */
export function rateSale(s, b, liters, channel) {
  if (s.mode !== 'story' || channel === 'abholen') return null;
  marketOf(s);
  if (rand(s) > Math.min(0.7, liters / 25)) return null;
  let x = (b.quality - 25) / 15 + (rand(s) - 0.5) * 1.6 - (b.flaws || []).length;
  if (b.priceMul > 1.5 && b.quality < 70) x -= 0.7; // teuer, aber nicht besonders
  const stars = clamp(Math.round(x), 1, 5);
  const list = CUSTOMER[stars];
  const text = list[Math.floor(rand(s) * list.length)];
  s.ratings.count++; s.ratings.sum += stars;
  s.ratings.recent = [{ day: s.day, stars, beer: b.name, text, channel }, ...s.ratings.recent].slice(0, 12);
  return stars;
}
export const ratingAvg = s => (s.ratings?.count ? round2(s.ratings.sum / s.ratings.count) : null);
/** Nachfrage-Faktor aus Sternen und aktuellem Rummel. */
export function demandFactor(s, ch) {
  let f = 1;
  const avg = ratingAvg(s);
  if (avg != null && s.ratings.count >= 3) f *= ch === 'online' ? 0.4 + avg / 5 * 0.9 : 0.88 + avg / 5 * 0.24;
  if (s.buzz && s.buzz.until >= s.day) f *= s.buzz.factor;
  return f;
}

// ---------- Verkostung ----------
export const TASTING_SIZES = { klein: { guests: 10, cost: 30 }, mittel: { guests: 25, cost: 70 }, gross: { guests: 50, cost: 150 } };
export const TASTING_COOLDOWN = 21;
export const TASTING_L_PER_GUEST = 0.4;

export function hostTasting(s, beerId, size) {
  need(hasFeature(s, 'marketing'), 'Marketing ist noch gesperrt.');
  const t = TASTING_SIZES[size];
  need(t, 'Unbekannte Größe.');
  need(s.flags.lastTasting == null || s.day - s.flags.lastTasting >= TASTING_COOLDOWN,
    `Die nächste Verkostung lohnt sich erst in ${TASTING_COOLDOWN - (s.day - s.flags.lastTasting)} Tagen.`);
  const b = s.beers.find(x => x.id === beerId);
  need(b, 'Dieses Bier gibt es nicht im Lager.');
  const liters = round2(t.guests * TASTING_L_PER_GUEST);
  need(b.liters >= liters - 1e-9, `Für ${t.guests} Gäste brauchst du ${liters} L „${b.name}“.`);
  const tax = s.license && s.mode !== 'sandbox' ? round2(beerTax(liters, b.plato, s.taxedLYear / 100)) : 0;
  spend(s, t.cost + tax, 'Snacks und Gläser');
  if (tax) { s.taxedLYear += liters; s.stats.taxPaid = round2(s.stats.taxPaid + tax); }
  b.liters = round2(b.liters - liters);
  s.flags.lastTasting = s.day;
  s.stats.givenL = round2(s.stats.givenL + liters);
  s.stats.tastings = (s.stats.tastings || 0) + 1;
  marketOf(s);
  const q = b.quality - (b.flaws || []).length * 8;
  const fresh = 1 / (1 + 0.2 * (s.stats.tastings - 1)) * (hasOrder(s, 'logoglas') ? 1.2 : 1); // dieselben Nachbarn kommen immer wieder
  const rep = round2(clamp((q - 58) / 14 * Math.sqrt(t.guests / 10) * (q >= 58 ? fresh : 1), -5, 4));
  const regulars = q >= 60 ? Math.round(t.guests * (q - 50) / 100) : 0;
  if (s.mode === 'story') {
    s.reputation = round2(clamp(s.reputation + rep, 0, 100));
    s.honor = round2(clamp(s.honor + (q >= 60 ? 1 : 0), 0, 100));
    s.regulars = Math.min(60, (s.regulars || 0) + regulars);
    // ein paar Gäste schreiben direkt eine Bewertung
    for (let i = 0; i < Math.ceil(t.guests / 10); i++) rateSale(s, b, 25, 'hof');
  }
  log(s, `🍻 Verkostung mit ${t.guests} Gästen: ${liters} L „${b.name}“ ausgeschenkt (${t.cost} € Snacks${tax ? `, Biersteuer ${tax} €` : ''}). ` +
    (q >= 70 ? 'Die Leute sind begeistert!' : q >= 55 ? 'Netter Abend, die Gäste waren zufrieden.' : 'Die Stimmung war eher verhalten …') +
    ` Ruf ${rep >= 0 ? '+' : ''}${f1(rep)}${regulars ? `, ${regulars} neue Stammkunden für den Hofverkauf` : ''}.`, rep >= 0 ? 'good' : 'bad');
  return { rep, regulars };
}

// ---------- Webseite & Sicherheit ----------
export const WEB_KINDS = {
  agentur: { name: 'Webagentur', icon: '🏢', cost: 500, risk: 0.05, look: 1.15,
    text: 'Profis bauen dir Seite und Shop: schickes Design, sauberer Code, sichere Grundeinstellungen.' },
  ki: { name: 'Mit KI selbst gebaut', icon: '🤖', cost: 90, risk: 0.14, look: 1.0,
    text: 'Ein Wochenende mit einem KI-Baukasten. Günstig und sieht okay aus – aber niemand prüft, ob alles dicht ist.' },
};
export const SECURITY = [
  { name: 'Keine Pflege', cost: 0, factor: 1, backup: false, text: 'Keine Updates, keine Backups. Was soll schon passieren?' },
  { name: 'Updates', cost: 10, factor: 0.5, backup: false, text: 'Software wird aktuell gehalten. Die meisten Angriffe laufen ins Leere.' },
  { name: 'Updates + Backups', cost: 25, factor: 0.3, backup: true, text: 'Dazu tägliche Backups: Nach einem Angriff bist du schnell wieder online.' },
  { name: 'Profi-Wartung', cost: 60, factor: 0.1, backup: true, text: 'Wartungsvertrag mit Firewall, Überwachung und Notfall-Hotline.' },
];
export const WEB_HOSTING = 8; // € / Monat Domain + Hosting

export const webOnline = s => !!s.web && s.day >= (s.web.offlineUntil || 0);

export function buildWebsite(s, kind) {
  need(hasFeature(s, 'webseite'), 'Die Webseite ist noch gesperrt.');
  const k = WEB_KINDS[kind];
  need(k, 'Unbekannte Variante.');
  need(!s.web || s.web.kind !== kind, 'Diese Webseite hast du schon.');
  spend(s, k.cost, 'die Webseite');
  const security = s.web?.security ?? 0;
  s.web = { kind, security, built: s.day, offlineUntil: 0, hacks: s.web?.hacks || 0 };
  log(s, `🌐 Webseite online (${k.name}, ${k.cost} €)! Der Onlineshop verschickt dein Bier jetzt in ganz Deutschland. Hosting ${WEB_HOSTING} € im Monat.`, 'good');
}

export function setSecurity(s, level) {
  need(s.web, 'Erst brauchst du eine Webseite.');
  need(SECURITY[level], 'Unbekannte Stufe.');
  s.web.security = level;
  log(s, `🔒 Sicherheit der Webseite: ${SECURITY[level].name}${SECURITY[level].cost ? ` (${SECURITY[level].cost} € im Monat)` : ''}.`);
}

/** Monatliches Hack-Risiko (0–1). */
export const hackRisk = s => (s.web ? round2(WEB_KINDS[s.web.kind].risk * SECURITY[s.web.security].factor * (1 + Math.min(1, (s.stats.onlineL || 0) / 2000))) : 0);

/** Monatlich: Kosten und Hacker. */
export function webMonthly(s) {
  if (!s.web) return;
  const sec = SECURITY[s.web.security];
  const bill = WEB_HOSTING + sec.cost;
  if (s.cash >= bill) { s.cash = round2(s.cash - bill); log(s, `🌐 Webseite: Hosting ${WEB_HOSTING} €${sec.cost ? ` + Sicherheit ${sec.cost} €` : ''}.`); }
  else {
    s.web.security = 0;
    s.web.offlineUntil = Math.max(s.web.offlineUntil, s.day + 30);
    log(s, `🌐 Rechnung für Hosting (${bill} €) nicht bezahlt – die Seite ist einen Monat offline, die Sicherheitspflege ist gekündigt.`, 'bad');
    return;
  }
  if (rand(s) >= hackRisk(s)) return;
  s.web.hacks++;
  s.stats.hacks = (s.stats.hacks || 0) + 1;
  const days = sec.backup ? 3 : 14 + Math.floor(rand(s) * 15);
  s.web.offlineUntil = s.day + days;
  const parts = [`💻 HACKERANGRIFF auf deine Webseite! Der Shop ist ${days} Tage offline.`];
  let cost = sec.backup ? 0 : 250;
  if (cost) parts.push(`Ohne Backup muss alles neu aufgesetzt werden: ${cost} €.`);
  s.reputation = round2(clamp(s.reputation - (sec.backup ? 1 : 4), 0, 100));
  parts.push(`Ruf −${sec.backup ? 1 : 4}.`);
  if (s.web.security === 0 && rand(s) < 0.5) {
    cost += 600;
    s.honor = round2(clamp(s.honor - 5, 0, 100));
    parts.push('Schlimmer noch: Kundendaten sind abgeflossen. Datenschutz-Bußgeld 600 €, Ansehen −5.');
  }
  s.cash = Math.max(0, round2(s.cash - cost));
  log(s, parts.join(' '), 'bad');
}

