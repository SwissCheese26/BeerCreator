// Presse & Radio: Interviews geben, ein eigenes Brauer-Profil (Persönlichkeit) aufbauen,
// Werbung und Patenschaften beim Lokalsender – und nebenbei Musik aus den eigenen Playlists hören.
import { need, log, rand, round2, clamp, spend, hasFeature } from './state.js';
import { locOf } from './business.js';
import { RADIO_TRACKS } from './radio-tracks.js';

const stockOf = s => s.beers.filter(b => b.liters > 0.01);
const bestBeer = s => stockOf(s).sort((a, b) => b.quality - a.quality)[0];

export function pressOf(s) {
  s.press ||= {};
  const p = s.press;
  p.offer ??= null; p.current ??= null; p.archive ||= []; p.claims ||= []; p.lastOffer ??= -999;
  p.persona ||= { trad: 0, bold: 0, heimat: 0 };
  p.radio ||= {};
  p.radio.ads ||= []; p.radio.sponsor ??= null; p.radio.lastGuest ??= -999; p.radio.fav ??= null;
  p.radio.show ||= 'rock'; p.radio.idx ??= 0;
  return p;
}

// ---------- Radio ----------
// Die Sendungen von „Radio Kesselwelle“ – eine pro Playlist. audience = Absatzweg, den die Hörer nutzen.
export const RADIO_NAME = 'Radio Kesselwelle 98,4';
export const SHOWS = {
  metalcore: { name: 'Moshpit-Mittwoch', icon: '🤘', slot: 'Mi 22–24 Uhr', host: 'DJ Grabesruh', audience: 'festival',
    likes: ['imperial', 'stout', 'schwarzbier', 'rauch', 'porter', 'doppelbock'],
    text: 'Metalcore & Deathcore – so laut, dass der Gärspund wackelt. Die Hörer fahren auf jedes Festival.' },
  rock: { name: 'Rock-Klassiker am Freitag', icon: '🎸', slot: 'Fr 19–22 Uhr', host: 'Rocky Malzahn', audience: 'gastro',
    likes: ['pils', 'helles', 'maerzen', 'dunkel', 'alt'],
    text: 'Von Grunge bis Neue Deutsche Härte – Feierabendrock, der in jeder Kneipe läuft.' },
  reggaeton: { name: 'Reggaeton Summer Nights', icon: '🌴', slot: 'Sa 20–24 Uhr', host: 'La Doña Lupulina', audience: 'festival', summer: true,
    likes: ['witbier', 'weizen', 'koelsch', 'berliner', 'pale'],
    text: 'Perreo bis Sonnenaufgang. Im Sommer die Partysendung schlechthin – leichte, spritzige Biere gewinnen.' },
  'ru-rap': { name: 'Rap Ost', icon: '🎤', slot: 'Do 21–23 Uhr', host: 'MC Kwas', audience: 'online',
    likes: ['neipa', 'ipa', 'pale'],
    text: 'Russischer Rap und Pop. Ein junges Publikum, das fast alles online bestellt.' },
  'ru-retro': { name: 'Russendisko Retro', icon: '🪩', slot: 'So 18–21 Uhr', host: 'Tante Ljuba', audience: 'hof',
    likes: ['dunkel', 'maerzen', 'bock', 'helles', 'dunkelweizen'],
    text: 'Die Hits der 90er und 2000er – die Nachbarschaft tanzt im Wohnzimmer und holt das Bier direkt vom Hof.' },
  hiphop: { name: 'Trap & Hip-Hop Nacht', icon: '🎧', slot: 'Fr 23–2 Uhr', host: 'Lil Dolde', audience: 'online',
    likes: ['neipa', 'ipa', 'imperial', 'berliner'],
    text: 'Cloud-Rap und Trap bis tief in die Nacht. Wer hier läuft, verkauft im Onlineshop.' },
};
export const AD_COST = 90, AD_DAYS = 14, SPONSOR_MONTH = 140, GUEST_COOLDOWN = 45, GUEST_MIN_REP = 15;

/** Song, der gerade läuft (nur Anzeige – das Spiel spielt keine Musik ab). */
export function nowPlaying(s) {
  const r = pressOf(s).radio;
  const list = RADIO_TRACKS[r.show] || RADIO_TRACKS.rock;
  const i = (((r.idx + s.day) % list.length) + list.length) % list.length; // jeden Tag läuft ein anderer Song
  const [title, artist, id] = list[i];
  return { show: r.show, ...SHOWS[r.show], title, artist, url: `https://open.spotify.com/track/${id}`, count: list.length, pos: i + 1 };
}
export function tuneRadio(s, showId) {
  need(SHOWS[showId], 'Diese Sendung gibt es nicht.');
  const r = pressOf(s).radio;
  r.show = showId;
  r.idx = Math.floor(rand(s) * RADIO_TRACKS[showId].length); // irgendwo mitten in der Sendung einsteigen
}
export function nextSong(s, step = 1) { pressOf(s).radio.idx += step; }

/** Passt etwas aus deinem Lager zur Sendung? („Bier zum Sound“) */
export const fitsShow = (s, showId) => stockOf(s).some(b => SHOWS[showId].likes.includes(b.styleId) && b.quality >= 60);
const isSummer = s => { const d = ((s.day - 1) % 360) + 1; return d >= 140 && d <= 250; };

export function adFactor(s, showId) {
  const sh = SHOWS[showId], p = pressOf(s);
  let f = 0.12;
  if (fitsShow(s, showId)) f += 0.08;
  if (p.radio.fav === showId) f += 0.05; // du hast im Interview verraten, dass du die Sendung liebst
  if (sh.summer) f *= isSummer(s) ? 1.5 : 0.6;
  return round2(1 + f);
}
export function bookAd(s, showId) {
  need(hasFeature(s, 'presse'), 'Presse & Radio sind noch gesperrt.');
  need(SHOWS[showId], 'Diese Sendung gibt es nicht.');
  const p = pressOf(s);
  need(!p.radio.ads.some(a => a.show === showId && a.until >= s.day), 'In dieser Sendung läuft dein Spot schon.');
  spend(s, AD_COST, 'den Radiospot');
  const factor = adFactor(s, showId);
  p.radio.ads = p.radio.ads.filter(a => a.until >= s.day);
  p.radio.ads.push({ show: showId, until: s.day + AD_DAYS, factor });
  s.stats.radioAds = (s.stats.radioAds || 0) + 1;
  const sh = SHOWS[showId];
  log(s, `📻 Dein Spot läuft zwei Wochen lang in „${sh.name}“ (${AD_COST} €). ${sh.host}: „${fitsShow(s, showId) ? 'Und das Bier passt perfekt zu unserem Sound!' : 'Bring uns mal eine Kiste vorbei!'}“`, 'good');
}
export function sponsorShow(s, showId) {
  need(hasFeature(s, 'presse'), 'Presse & Radio sind noch gesperrt.');
  const p = pressOf(s);
  if (!showId) { if (p.radio.sponsor) log(s, `📻 Du beendest die Patenschaft für „${SHOWS[p.radio.sponsor].name}“.`); p.radio.sponsor = null; return; }
  need(SHOWS[showId], 'Diese Sendung gibt es nicht.');
  need(s.license || s.mode === 'sandbox', 'Patenschaften gehen nur mit Gewerbe.');
  spend(s, SPONSOR_MONTH, 'die Patenschaft');
  p.radio.sponsor = showId;
  log(s, `📻 „${SHOWS[showId].name} – präsentiert von ${s.breweryName}“. ${SPONSOR_MONTH} € pro Monat.`, 'good');
}

/** Nachfrage-Faktor aus Radio und Persönlichkeit für einen Absatzweg. */
export function pressDemand(s, ch) {
  if (!s.press) return 1;
  const p = s.press;
  let f = 1;
  for (const a of p.radio?.ads || []) if (a.until >= s.day && SHOWS[a.show]?.audience === ch) f *= a.factor;
  if (p.radio?.sponsor && SHOWS[p.radio.sponsor]?.audience === ch) f *= 1.07;
  const h = p.persona?.heimat || 0;
  if (h >= 3 && ch === 'hof') f *= 1.08;
  if (h <= -3 && (ch === 'online' || ch === 'gastro')) f *= 1.06;
  return f;
}

// ---------- Persönlichkeit ----------
// trad: Tradition (+) ↔ Experiment (−) · bold: große Klappe (+) ↔ bescheiden (−) · heimat: Dorf (+) ↔ Wachstum (−)
export function persona(s) {
  const { trad, bold, heimat } = pressOf(s).persona;
  const parts = [];
  parts.push(trad >= 3 ? ['🏺', 'Traditionsbrauer:in', 'Hält Rezepte in Ehren. Malzliebhaber vertrauen dir.']
    : trad <= -3 ? ['🧪', 'Experimentierer:in', 'Probiert alles aus. Craft-Fans und Hopfenköpfe lieben dich.']
    : ['⚖️', 'Allrounder:in', 'Weder Museum noch Labor.']);
  parts.push(bold >= 3 ? ['📣', 'mit großer Klappe', 'Gute Schlagzeilen – aber wehe, das Bier hält nicht, was du versprichst.']
    : bold <= -3 ? ['🤫', 'der leisen Töne', 'Bescheiden und glaubwürdig. Das bringt Ansehen.']
    : ['🙂', '', '']);
  parts.push(heimat >= 3 ? ['🏡', 'mit Herz fürs Dorf', 'Die Nachbarschaft kauft lieber bei dir (Hofverkauf +8 %).']
    : heimat <= -3 ? ['📈', 'mit Geschäftssinn', 'Du denkst groß (Kneipen und Onlineshop +6 %).']
    : ['🧭', '', '']);
  const known = pressOf(s).archive.length;
  const title = parts[0][1] + (parts[1][1] ? ' ' + parts[1][1] : '') + (parts[2][1] ? (parts[1][1] ? ' und ' : ' ') + parts[2][1] : '');
  return { title, parts: parts.filter(x => x[1]), trad, bold, heimat, known };
}
/** Kritiker mögen Brauer:innen, die zu ihnen passen. */
export function personaReviewBonus(s, reviewerId) {
  const t = s.press?.persona?.trad || 0;
  if (t >= 3) return { malzmeister: 3, sommelier: 1 }[reviewerId] || 0;
  if (t <= -3) return { sudhausfunk: 3, doldenrausch: 2 }[reviewerId] || 0;
  return 0;
}
const nudge = (s, k, d) => { const p = pressOf(s).persona; p[k] = clamp((p[k] || 0) + d, -10, 10); };

// ---------- Interviews ----------
const PAPER = { kesselbach: 'Kesselbacher Anzeiger', nordhafen: 'Nordhafener Abendblatt', gipfelbrunn: 'Gipfelbrunner Bergbote', lindenberg: 'Lindenberger Campus-Kurier' };
export const MEDIA = {
  zeitung: { name: s => PAPER[s.location] || 'Lokalzeitung', icon: '📰', reach: 0.6, minRep: 5, who: 'Redakteurin Mona Spundloch' },
  podcast: { name: () => 'Podcast „Zwei Hälse, ein Kasten“', icon: '🎧', reach: 0.9, minRep: 18, who: 'Jo & Jule' },
  radio: { name: () => RADIO_NAME, icon: '📻', reach: 1, minRep: GUEST_MIN_REP, who: 'Moderator Rocky Malzahn', guest: true },
  magazin: { name: () => 'Magazin „Genuss & Gerste“', icon: '🗞️', reach: 1.4, minRep: 35, who: 'Chefredakteur Dr. Habicht' },
  tv: { name: () => 'Brauland TV (Regionalfernsehen)', icon: '📺', reach: 1.8, minRep: 45, who: 'Moderatorin Sandra Sud' },
};
export const mediaName = (s, id) => MEDIA[id].name(s);

// Fragen. q(s) = Frage, a = Antworten: label (Text oder Funktion), fx(s) → { rep, honor, trad, bold, heimat, claim, fav, buzz }
const Q = {
  anfang: { q: () => 'Wie hat das alles bei Ihnen angefangen?', a: [
    { label: 'Mit Opas altem Sudbuch – und einem Einkochtopf in der Garage.', fx: () => ({ trad: 2, heimat: 1, honor: 1, rep: 0.5 }) },
    { label: 'Ich wollte endlich Bier, das nach etwas schmeckt.', fx: () => ({ trad: -1, bold: 1, rep: 0.6 }) },
    { label: 'Ehrlich? Mit einer übergekochten Würze und sehr viel Putzen.', fx: () => ({ bold: -1, rep: 0.7 }) },
  ] },
  bestes: { when: s => !!bestBeer(s), q: s => `Welches Ihrer Biere sollen unsere Leute unbedingt probieren?`, a: [
    { label: s => `„${bestBeer(s).name}“ – mein bestes Bier.`, fx: s => { const b = bestBeer(s); return b.quality >= 65 ? { rep: 0.8, buzz: true } : { rep: -1, note: 'Die Leute probieren es – und sind nicht überzeugt.' }; } },
    { label: 'Alle! Jedes Bier ist wie ein Kind für mich.', fx: () => ({ bold: -1, heimat: 1, rep: 0.3 }) },
    { label: 'Mein bestes Bier habe ich noch gar nicht gebraut.', fx: () => ({ bold: 1, trad: -1, rep: 0.4 }) },
  ] },
  konzerne: { q: () => 'Großbrauereien verkaufen den Kasten für zwölf Euro. Wie wollen Sie da mithalten?', a: [
    { label: 'Gar nicht. Ich braue Handwerk, keine Massenware.', fx: s => ({ trad: 1, heimat: 1, honor: 1, rep: 0.5, claim: 'handwerk' }) },
    { label: 'Mit Qualität – und irgendwann auch mit Menge.', fx: () => ({ heimat: -2, bold: 1, rep: 0.5 }) },
    { label: 'Die kochen auch nur mit Wasser. Und zwar mit viel zu viel.', fx: () => ({ bold: 2, honor: -1, rep: 0.9 }) },
  ] },
  heimat: { q: s => `Was bedeutet Ihnen ${locOf(s).name}?`, a: [
    { label: 'Alles. Hier wird mein Bier zuerst getrunken.', fx: () => ({ heimat: 2, honor: 1, rep: 0.4 }) },
    { label: 'Ein guter Anfang. Aber die Welt ist groß.', fx: () => ({ heimat: -2, bold: 1, rep: 0.4 }) },
    { label: 'Die Leute hier sind meine strengsten Kritiker.', fx: () => ({ heimat: 1, bold: -1, rep: 0.6 }) },
  ] },
  trends: { q: () => 'Hazy IPA, Sauerbier, Pastry Stout – laufen Sie jedem Trend hinterher?', a: [
    { label: 'Bei mir gibt es ehrliches Bier nach alter Schule.', fx: () => ({ trad: 3, rep: 0.3 }) },
    { label: 'Ich probiere alles aus, was gut schmeckt.', fx: () => ({ trad: -3, rep: 0.3 }) },
    { label: 'Erst verstehen, dann brauen. Ein Trend muss zu mir passen.', fx: () => ({ honor: 1, rep: 0.5 }) },
  ] },
  musik: { q: () => 'Und welche Musik läuft bei Ihnen im Sudhaus?', a: s => pickShows(s).map(id => ({ label: MUSIC_ANSWER[id], show: id })) },
  fehler: { q: () => 'Ging bei Ihnen schon mal ein Sud so richtig daneben?', a: [
    { label: 'Mehr als einer. Aus jedem habe ich gelernt.', fx: () => ({ bold: -2, honor: 2, rep: 0.3 }) },
    { label: 'Nein. Bei mir geht nichts schief.', fx: s => (s.batches.some(b => (b.flaws || []).length) || (s.stats.bestQuality || 0) < 70)
      ? { bold: 2, rep: -1.5, note: 'Ein paar Leser erinnern sich an ein Bier, das nach Butter schmeckte …' } : { bold: 2, rep: 0.6 } },
    { label: 'Fragen Sie lieber nicht meine Nachbarn.', fx: () => ({ rep: 0.7 }) },
  ] },
  opa: { when: s => s.mode === 'story', q: () => 'Was würde Ihr Opa Heinrich zu Ihrem Bier sagen?', a: [
    { label: '„Zu wenig Hopfen.“ Er hatte immer etwas zu meckern.', fx: () => ({ trad: 1, rep: 0.7 }) },
    { label: 'Er wäre stolz, hoffe ich.', fx: () => ({ heimat: 1, honor: 2, rep: 0.3 }) },
    { label: 'Er würde fragen, warum ich so wenig daran verdiene.', fx: () => ({ heimat: -1, bold: 1, rep: 0.4 }) },
  ] },
  preis: { when: s => s.stats.soldL > 0, q: () => 'Ihr Bier ist nicht gerade billig. Warum eigentlich?', a: [
    { label: 'Gute Zutaten und Zeit kosten Geld.', fx: () => ({ trad: 1, honor: 1, rep: 0.4 }) },
    { label: 'Weil es das wert ist.', fx: s => (bestBeer(s)?.quality || 0) >= 72 ? { bold: 2, rep: 1 } : { bold: 2, rep: -1, note: 'Die Leser finden: so gut ist es dann auch wieder nicht.' } },
    { label: 'Ich arbeite an einem günstigen Feierabendbier.', fx: () => ({ heimat: 1, bold: -1, rep: 0.4 }) },
  ] },
  medaille: { when: s => s.stats.medals.length > 0, q: () => 'Glückwunsch zur Medaille! Was bedeutet sie Ihnen?', a: [
    { label: 'Viel Arbeit und ein bisschen Glück.', fx: () => ({ bold: -2, honor: 1, rep: 0.5 }) },
    { label: 'Die nächste wird Gold. Versprochen.', fx: () => ({ bold: 2, rep: 0.8 }) },
    { label: 'Die gehört dem ganzen Dorf.', fx: () => ({ heimat: 2, honor: 2, rep: 0.3 }) },
  ] },
  wachstum: { when: s => (s.owned || []).length > 0, q: s => `Sie haben „${s.owned[0]}“ übernommen. Werden Sie jetzt zum Bierkonzern?`, a: [
    { label: 'Nein. Ich rette kleine Brauereien vor dem Aus.', fx: s => ({ honor: 2, heimat: 1, rep: 0.4, claim: 'retter' }) },
    { label: 'Wachstum ist kein Schimpfwort.', fx: () => ({ heimat: -2, bold: 1, rep: 0.5 }) },
    { label: 'Kein Kommentar.', fx: () => ({ bold: -1, rep: -0.3 }) },
  ] },
  zukunft: { q: () => 'Wo sehen Sie sich in zehn Jahren?', a: [
    { label: 'Hinterm Tresen meiner eigenen Brauerei.', fx: () => ({ heimat: 1, trad: 1, rep: 0.4 }) },
    { label: 'In jedem Kühlschrank des Landes.', fx: () => ({ bold: 2, heimat: -2, rep: 0.6 }) },
    { label: 'Auf der Veranda, mit einem Bier in der Hand. Mehr brauche ich nicht.', fx: () => ({ bold: -2, honor: 1, rep: 0.4 }) },
  ] },
  lieblingsbier: { q: () => 'Mal ehrlich: Was trinken Sie selbst am liebsten?', a: [
    { label: 'Mein eigenes. Was sonst?', fx: () => ({ bold: 1, rep: 0.4 }) },
    { label: 'Ein schlichtes Helles beim Nachbarn.', fx: () => ({ heimat: 1, bold: -1, honor: 1, rep: 0.3 }) },
    { label: 'Belgisches Trappistenbier. Davon träume ich nachts.', fx: () => ({ trad: 1, rep: 0.5 }) },
  ] },
};
const MUSIC_ANSWER = {
  metalcore: 'Metalcore. Laut genug, dass die Hefe mitmosht.',
  rock: 'Rock-Klassiker. Mit Gitarre braut es sich besser.',
  reggaeton: 'Reggaeton – dann gärt sogar die Hefe im Takt.',
  'ru-rap': 'Russischer Rap. Beim Schroten ein guter Beat.',
  'ru-retro': 'Russische 90er. Opa hätte mitgetanzt.',
  hiphop: 'Trap und Hip-Hop, vor allem nachts beim Abfüllen.',
};
function pickShows(s) {
  const ids = Object.keys(SHOWS);
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(rand(s) * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  return ids.slice(0, 3);
}

/** Offene Interview-Anfrage annehmen → Fragen erscheinen nacheinander. */
function startInterview(s, media) {
  const p = pressOf(s);
  const pool = Object.keys(Q).filter(id => id !== 'musik' && (!Q[id].when || Q[id].when(s)));
  const recent = new Set(p.archive.slice(-2).flatMap(x => x.qids || []));
  const fresh = pool.filter(id => !recent.has(id));
  const src = fresh.length >= 3 ? fresh : pool;
  const qids = [];
  while (qids.length < 3 && src.length) qids.push(src.splice(Math.floor(rand(s) * src.length), 1)[0]);
  if (MEDIA[media].guest) qids[2] = 'musik'; // im Radio fragt der Moderator immer nach der Musik
  p.current = { media, qids, step: 0, answers: [], rep: 0, honor: 0, quotes: [], notes: [] };
  p.current.options = buildOptions(s, qids[0]);
  return p.current;
}
function buildOptions(s, qid) {
  const def = Q[qid];
  const answers = typeof def.a === 'function' ? def.a(s) : def.a;
  return { qid, question: def.q(s), answers: answers.map((x, i) => ({ i, label: typeof x.label === 'function' ? x.label(s) : x.label, ...(x.show ? { show: x.show } : {}) })) };
}

export function interviewView(s) {
  const p = pressOf(s), c = p.current;
  if (!c) return null;
  return { media: c.media, name: mediaName(s, c.media), icon: MEDIA[c.media].icon, who: MEDIA[c.media].who,
    step: c.step, total: c.qids.length, question: c.options.question, answers: c.options.answers.map(({ i, label }) => ({ i, label })) };
}

export function acceptInterview(s) {
  const p = pressOf(s);
  need(p.offer, 'Es gibt gerade keine Interview-Anfrage.');
  need(!p.current, 'Du bist schon mitten in einem Interview.');
  const media = p.offer.media;
  p.offer = null;
  return startInterview(s, media);
}
export function declineInterview(s) {
  const p = pressOf(s);
  need(p.offer, 'Es gibt gerade keine Interview-Anfrage.');
  log(s, `${MEDIA[p.offer.media].icon} Du sagst ${mediaName(s, p.offer.media)} ab. „Schade – vielleicht ein andermal.“`);
  p.offer = null;
}
export function radioGuest(s) {
  need(hasFeature(s, 'presse'), 'Presse & Radio sind noch gesperrt.');
  const p = pressOf(s);
  need(!p.current, 'Du bist schon mitten in einem Interview.');
  need(s.mode === 'sandbox' || s.reputation >= GUEST_MIN_REP, `Der Sender lädt dich erst ab ${GUEST_MIN_REP} Ruf ein.`);
  const wait = p.radio.lastGuest + GUEST_COOLDOWN - s.day;
  need(wait <= 0, `Du warst gerade erst zu Gast – wieder in ${wait} Tagen.`);
  p.radio.lastGuest = s.day;
  return startInterview(s, 'radio');
}

/** Eine Antwort geben. Nach der letzten Frage erscheint der Artikel / die Sendung. */
export function answerInterview(s, i) {
  const p = pressOf(s), c = p.current;
  need(c, 'Gerade läuft kein Interview.');
  const def = Q[c.qids[c.step]];
  const opt = c.options.answers[i];
  need(opt, 'Diese Antwort gibt es nicht.');
  // Musikfrage: die Antworten hängen von den zufällig gezeigten Sendungen ab
  const fx = opt.show ? { fav: opt.show, rep: 0.4, bold: opt.show === 'metalcore' || opt.show === 'hiphop' ? 1 : 0 } : def.a[i].fx(s);
  const reach = MEDIA[c.media].reach;
  for (const k of ['trad', 'bold', 'heimat']) if (fx[k]) nudge(s, k, fx[k]);
  // Wer eine große Klappe hat, bekommt größere Ausschläge – in beide Richtungen
  const swing = 1 + Math.max(0, p.persona.bold) * 0.04;
  c.rep = round2(c.rep + (fx.rep || 0) * reach * swing);
  c.honor = round2(c.honor + (fx.honor || 0));
  if (fx.claim && !p.claims.some(x => x.id === fx.claim)) p.claims.push({ id: fx.claim, day: s.day, owned: (s.owned || []).length, media: c.media });
  if (fx.fav) p.radio.fav = fx.fav;
  if (fx.buzz && s.mode === 'story') {
    const factor = round2(1 + 0.05 * reach);
    if (!s.buzz || s.buzz.until < s.day || s.buzz.factor < factor) s.buzz = { until: s.day + 14, factor, by: mediaName(s, c.media) };
  }
  if (fx.note) c.notes.push(fx.note);
  c.answers.push(i);
  c.quotes.push({ q: c.options.question, a: opt.label, rep: fx.rep || 0 });
  c.step++;
  if (c.step < c.qids.length) { c.options = buildOptions(s, c.qids[c.step]); return { done: false }; }
  return { done: true, article: finishInterview(s) };
}

function finishInterview(s) {
  const p = pressOf(s), c = p.current;
  // Beim selben Medium bist du irgendwann keine Neuigkeit mehr: positive Wirkung nimmt ab, Fehltritte nicht
  const before = p.archive.filter(x => x.media === c.media).length;
  const rep = round2(clamp(c.rep > 0 ? c.rep / (1 + 0.5 * before) : c.rep, -4, 4)), honor = round2(clamp(c.honor > 0 ? c.honor / (1 + 0.5 * before) : c.honor, -3, 4));
  if (s.mode === 'story') {
    s.reputation = round2(clamp(s.reputation + rep, 0, 100));
    s.honor = round2(clamp(s.honor + honor, 0, 100));
  }
  const top = [...c.quotes].sort((a, b) => Math.abs(b.rep) - Math.abs(a.rep))[0];
  const tone = rep >= 1.5 ? 'Der Star von nebenan' : rep >= 0.5 ? 'Zu Besuch bei' : rep > -0.5 ? 'Ein Abend mit' : 'Viel Schaum um';
  const headline = `${tone} „${s.breweryName}“: „${top.a.replace(/[„“"]/g, '')}“`;
  const entry = { day: s.day, media: c.media, name: mediaName(s, c.media), headline, quotes: c.quotes, rep, honor, notes: c.notes, qids: c.qids };
  p.archive.push(entry);
  p.archive = p.archive.slice(-20);
  p.current = null;
  s.stats.interviews = (s.stats.interviews || 0) + 1;
  const sign = x => (x >= 0 ? '+' : '') + String(x).replace('.', ',');
  log(s, `${MEDIA[c.media].icon} ${entry.name}: ${headline}${c.notes.length ? ' ' + c.notes.join(' ') : ''} Ruf ${sign(rep)}${honor ? `, Ansehen ${sign(honor)}` : ''}. Du giltst jetzt als ${persona(s).title}.`, rep >= 0 ? 'good' : 'bad');
  return entry;
}

// ---------- Täglich / monatlich ----------
export function pressDaily(s) {
  if (!hasFeature(s, 'presse') || s.mode !== 'story') return;
  const p = pressOf(s);
  if (p.offer && p.offer.expires < s.day) { log(s, `${MEDIA[p.offer.media].icon} ${mediaName(s, p.offer.media)} hat jemand anderen interviewt.`); p.offer = null; }
  // Glaubwürdigkeit: Was du in Interviews versprichst, wird später nachgeprüft
  for (const cl of [...p.claims]) {
    let broke = null;
    if (cl.id === 'handwerk' && ((s.contracts || []).length || s.beers.some(b => b.industrial))) broke = '„Keine Massenware“ – und jetzt lässt du bei der Lohnbrauerei Stahlkessel brauen?';
    if (cl.id === 'retter' && (s.owned || []).length < cl.owned) broke = '„Ich rette kleine Brauereien“ – und dann verkaufst du eine einfach weiter?';
    if (broke) {
      p.claims = p.claims.filter(x => x !== cl);
      s.honor = round2(clamp(s.honor - 5, 0, 100)); s.reputation = round2(clamp(s.reputation - 2, 0, 100));
      log(s, `📰 ${mediaName(s, cl.media)} gräbt dein altes Interview aus: ${broke} Ansehen −5, Ruf −2.`, 'bad');
    }
  }
  if (p.offer || p.current || s.day - p.lastOffer < 25 || rand(s) > 0.05) return;
  const open = Object.keys(MEDIA).filter(id => !MEDIA[id].guest && s.reputation >= MEDIA[id].minRep);
  if (!open.length) return;
  const media = open.length > 1 && rand(s) < 0.55 ? open[open.length - 1 - Math.floor(rand(s) * Math.min(2, open.length))] : open[Math.floor(rand(s) * open.length)];
  p.offer = { media, day: s.day, expires: s.day + 10 };
  p.lastOffer = s.day;
  log(s, `${MEDIA[media].icon} ${mediaName(s, media)} möchte ein Interview mit dir! (unter „Presse & Radio“, 10 Tage Zeit)`, 'good');
}
export function pressMonthly(s) {
  const p = s.press;
  if (!p?.radio?.sponsor || s.mode !== 'story') return;
  if (s.cash >= SPONSOR_MONTH) {
    s.cash = round2(s.cash - SPONSOR_MONTH);
    s.regulars = Math.min(60, (s.regulars || 0) + 1);
    log(s, `📻 Patenschaft „${SHOWS[p.radio.sponsor].name}“: ${SPONSOR_MONTH} €. Ein paar Hörer kommen jetzt regelmäßig vorbei.`);
  } else {
    log(s, `📻 Die Patenschaft für „${SHOWS[p.radio.sponsor].name}“ endet – dafür fehlte das Geld.`, 'bad');
    p.radio.sponsor = null;
  }
}
