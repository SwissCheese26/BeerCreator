// Akt III – Wettbewerbe & Rivalin (Kapitel 7–8) und Akt IV Teil 1 – Behörden & Geld (Kapitel 9–10).
import { spend, rand, unlock } from '../state.js';
import { addXp } from '../progress.js';
import { STYLES, byId } from '../../core/data.js';
import { addRep, addHonor, addCash, fine, giveFragment, persona, medalFor, jury, stockOf, bestBeer, lvl, allies, offerQuest, questSettled,
  QUESTS, ensureStory, flag, say } from './common.js';
import { AUTO_OFFERS } from './tick.js';
import { LICENSE_COST } from '../config.js';

Object.assign(QUESTS, {
  tv_fass: { story: true, who: 'presse', title: 'Fernsehen im Sudhaus', kind: 'deliver', styles: ['pale', 'ipa', 'pils', 'helles'], liters: 40, minQ: 68, days: 70, retryDays: 35, paid: true,
    text: 'Das Regionalfernsehen dreht „Heimat, Hopfen, Handwerk“ und will Merle Trübsal und dich in einem Beitrag gegenüberstellen. Für den Dreh brauchen wir 40 Liter Pale Ale, IPA, Pils oder Helles in guter Qualität. 380 € Aufwandsentschädigung.',
    reward: s => { addCash(s, 380); addRep(s, 5); return 'Der Beitrag läuft zur besten Sendezeit. Dein Handschlag mit Merle im Abspann ist der Aufreger der Woche. 380 €, Ruf +5.'; },
    fail: s => { addRep(s, -3); s.flags.tv_blamage = true; } },
  behoerde_probe: { story: true, who: 'zollinger', title: 'Probe fürs Lebensmittelamt', kind: 'deliver', liters: 6, minQ: 60, days: 40, retryDays: 25,
    text: 'Für die Betriebserlaubnis möchte das Lebensmittelamt eine Probe aus deiner laufenden Produktion – 6 Liter, tadellos und ohne Fehler. Das ist Routine, aber ich drücke dir die Daumen.',
    reward: s => { addHonor(s, 3); s.flags.zollinger_ally = true; return 'Das Labor meldet: „keine Beanstandungen“. Frau Zollinger lächelt zum ersten Mal richtig. Ansehen +3.'; },
    fail: s => { addHonor(s, -3); s.flags.amt_skeptisch = true; } },
});
AUTO_OFFERS.push(
  { id: 'behoerde_probe', when: s => s.chapter >= 9 && s.license },
);

const CATS = ['pils', 'helles', 'maerzen', 'weizen', 'dunkel', 'pale'];
/** Kategorie der Bundesmeisterschaft: ein Stil, den du schon beherrschst. */
export const bundesCat = s => { const st = ensureStory(s); if (!st.bundesCat || !s.unlocked.includes(st.bundesCat)) st.bundesCat = CATS.filter(c => s.unlocked.includes(c))[Math.floor(rand(s) * CATS.filter(c => s.unlocked.includes(c)).length)] || 'helles'; return st.bundesCat; };
const bundesBeer = s => stockOf(s).filter(b => b.styleId === bundesCat(s) && b.quality >= 65).sort((a, b) => b.quality - a.quality)[0];

function takeYeast(s) { const k = Object.keys(s.inventory.yeast).find(x => s.inventory.yeast[x] > 0); if (k) s.inventory.yeast[k]--; }

export const act3Chapters = [
  {
    id: 'rivalin', title: 'Kapitel 7 – Zwischen Ehre und Sieg',
    intro: 'Die Landesmeisterschaft war nur das Vorspiel. Merle Trübsal hat dich in der Bierliga überholt, das Regionalfernsehen wittert eine Fehde, und im Wirtshaus wird getuschelt. Gegen Merle zu bestehen heißt nicht nur: besser brauen. Es heißt auch: entscheiden, wer du dabei sein willst.',
    onEnter: s => { offerQuest(s, 'tv_fass'); },
    objectives: [
      { id: 'merle', text: 'Entscheide, wie du Merle begegnest.', done: s => !!s.flags.done_merle_hefe },
      { id: 'lvl5', text: 'Erreiche Level 5 (Brauergeselle).', done: s => lvl(s) >= 5, progress: s => `Level ${lvl(s)} / 5` },
      { id: 'tv', text: 'Erledige den Fernseh-Auftrag (oder räume die Folgen auf).', done: s => questSettled(s, 'tv_fass') },
      { id: 'styles8', text: 'Braue acht verschiedene Bierstile.', done: s => s.stats.styles.length >= 8, progress: s => `${s.stats.styles.length} / 8` },
    ],
    outro: 'Zwischen zwei Brauern, die sich gegenseitig anstacheln, entsteht gutes Bier. Das weiß auch das Publikum. Im Kalender prangt jetzt ein Termin, der alles verändern kann: die Bundesmeisterschaft.',
    events: [{ id: 'merle_hefe', when: s => s.stats.batches >= 1 }],
  },
  {
    id: 'bundes', title: 'Kapitel 8 – Die Bundesmeisterschaft',
    intro: 'Dreihundert Brauereien, eine Kategorie, eine Blindverkostung. Dieses Jahr zählt nur ein Stil – und die Jury unter Dr. Sabine Stammwürze kennt keine Gnade. Ein Medaillenplatz würde deinen Namen weit über die Region hinaus tragen.',
    onEnter: s => { bundesCat(s); },
    objectives: [
      { id: 'bundes', text: s => `Gewinne eine Medaille bei der Bundesmeisterschaft (Kategorie: ${byId(STYLES, bundesCat(s)).name} – lege ein Bier ab Qualität 65 ins Lager).`, done: s => !!s.flags.bundes_medal },
      { id: 'q85', text: 'Braue ein Bier mit Qualität 85 oder mehr.', done: s => s.stats.bestQuality >= 85 },
      { id: 'buch5', text: 'Sprich mit Merle über Opas Buch.', done: s => !!s.flags.done_merle_buch },
    ],
    outro: 'Ein Blitzlichtgewitter, ein Pokal – und das Gefühl, dass hinter der Medaille noch eine Geschichte wartet. Zeit, aus dem Hobby einen richtigen Betrieb zu machen.',
    events: [
      { id: 'bundes', when: s => !!bundesBeer(s) },
      { id: 'merle_buch', when: s => !!s.flags.bundes_medal },
    ],
  },
  {
    id: 'behoerden', title: 'Kapitel 9 – Amtsstube',
    intro: 'Eine Brauerei ist nicht bloß ein größerer Kessel. Sie ist ein Betrieb mit Steuerlager, Lebensmittelaufsicht, Abwassergenehmigung, Brandschutz und Rechtsform. Frau Zollinger legt einen Ordner auf den Tisch, der aussieht, als hätte er eigene Gravitation.',
    onEnter: s => { unlock(s, 'industrie'); },
    objectives: [
      { id: 'lizenz', text: 'Habe ein angemeldetes Gewerbe.', done: s => s.license },
      { id: 'antrag', text: 'Stelle den Antrag auf die Betriebserlaubnis.', done: s => !!s.flags.done_antrag },
      { id: 'form', text: 'Wähle eine Rechtsform.', done: s => !!s.flags.done_rechtsform },
      { id: 'probe', text: 'Bestehe die Probe des Lebensmittelamts.', done: s => questSettled(s, 'behoerde_probe') },
      { id: 'cash2000', text: 'Lege 2000 € Betriebskapital zurück.', done: s => s.cash >= 2000, progress: s => `${Math.floor(s.cash)} / 2000 €` },
    ],
    outro: 'Der letzte Stempel kracht aufs Papier. Frau Zollinger schiebt dir die Mappe zu: „Und jetzt, Herr Brauer, brauchen Sie nur noch Geld.“',
    events: [
      { id: 'altlast', when: s => !s.license },
      { id: 'antrag', when: s => s.license },
      { id: 'rechtsform', when: s => !!s.flags.done_antrag },
    ],
  },
  {
    id: 'geld', title: 'Kapitel 10 – Das liebe Geld',
    intro: 'Ein Sudkessel mit 100 Litern, ein konischer Gärtank, Glykolkühlung – das alles kostet mehr, als ein Hobby je einbrachte. Die Bank sitzt auf ihrem Geld, ein Investor wittert Rendite, und im Dorf kursieren Ideen, die schöner klingen als Bilanzen.',
    objectives: [
      { id: 'fin', text: 'Entscheide, wie du die Brauerei finanzierst.', done: s => !!s.flags.done_finanzierung },
      { id: 'kessel', text: 'Kaufe einen 100-L-Sudkessel.', done: s => ['kessel100', 'anlage2hl'].includes(s.equipment.kettle) },
    ],
    outro: 'Die Finanzierung steht, der Kessel glänzt. Im Dorf nennt man dich jetzt „den Brauer“ – ohne Anführungszeichen.',
    events: [
      { id: 'finanzierung', when: () => true },
      { id: 'falk_treffen', when: s => !!s.flags.falk_investor },
      { id: 'genossen_abend', when: s => !!s.flags.genossen_anteile },
    ],
  },
];

export const act3Events = {
  merle_hefe: {
    title: 'Merles Hefe-Panne', who: 'jury',
    text: 'Zwei Tage vor Abgabeschluss steht Merle Trübsal um 22 Uhr im Hof. Ihr Hefekühlschrank ist ausgefallen, ihre Anstellhefe längst warm. „Ich weiß, dass ich nicht fragen sollte“, sagt sie heiser. Du hast zwei Päckchen frische Hefe im Kühlschrank. Das eine ist genau das, was sie braucht. Das andere ist eine Weißbierhefe in neutraler Verpackung – und würde ihr Pils ruinieren. Sie kann den Unterschied im Dunkeln nicht erkennen.',
    choices: [
      { id: 'helfen', label: '🤝 Ihr deine beste Hefe überlassen (−1 Päckchen), ohne Gegenleistung.',
        apply: s => { takeYeast(s); s.flags.merle_ally = true; persona(s, 'trad', 2); addHonor(s, 5); return 'Merle starrt auf das Päckchen, dann auf dich. „Du bist verrückt, Heinrichs Enkel.“ Sie gibt dir die Hand – und diesmal drückt sie lange. (Ansehen +5)'; } },
      { id: 'handel', label: '🍻 Helfen – aber nur gegen einen Gefallen: eine Kiste ihres besten Biers.',
        apply: s => { addHonor(s, 1); addXp(s, 40, 'Fachsimpeln mit Merle'); s.flags.merle_respekt = true; return 'Sie lacht schallend. „Abgemacht.“ Die Kiste hat es in sich – du lernst bei jedem Schluck. (Erfahrung +40, Ansehen +1)'; } },
      { id: 'wegschicken', label: '🚪 Sie wegschicken: Hefe ist heilig, Konkurrenz ist Konkurrenz.',
        apply: s => { s.flags.merle_rivalin = true; persona(s, 'bold', 1); return 'Du schließt die Tür. Draußen hörst du die Schritte verklingen. Mitleid hat dich nicht beschlichen – nur ein leises Ziehen im Magen.'; } },
      { id: 'sabotage', label: '😈 Ihr die falsche Hefe geben: „Die verträgt Wärme gut.“ (Sabotage)',
        apply: s => { s.flags.sabotage = true; s.flags.merle_rivalin = true; persona(s, 'bold', 2); persona(s, 'trad', -3); addHonor(s, -3); return 'Das Päckchen trägt das Etikett einer Weißbierhefe. Merle bedankt sich überschwänglich. Dir wird erst auf dem Weg zur Haustür bewusst, was du da getan hast. (Ansehen −3 – und die Geschichte ist noch nicht zu Ende.)'; } },
    ],
  },
  bundes: {
    title: 'Bundesmeisterschaft', who: 'jury',
    text: s => `Dreihundert Brauereien, eine Kategorie: in diesem Jahr ${byId(STYLES, bundesCat(s)).name}. Anmeldegebühr 90 €. Dr. Stammwürze ruft: „Die Gläser sind unmarkiert, die Urteile gnadenlos!“ Auch Merle ist angemeldet.`,
    repeatable: true,
    choices: [
      { id: 'teilnehmen', label: '🏆 Mit deinem besten Bier der Kategorie antreten (90 €).',
        enabled: s => s.cash >= 90 && !!bundesBeer(s), done: false,
        apply: s => {
          spend(s, 90, 'die Startgebühr');
          const beer = bundesBeer(s);
          const score = jury(s, rand, beer, 12) + (s.flags.sabotage ? 6 : 0) + (s.flags.merle_ally ? 2 : 0);
          const merle = 76 + rand(s) * 12 - (s.flags.sabotage ? 9 : 0);
          const medal = medalFor(score, 88, 80, 72);
          s.flags.retry_bundes = s.day + 40;
          const vs = score > merle ? 'Du liegst vor Merle.' : 'Merle liegt knapp vor dir.';
          if (!medal) { addRep(s, 1); return `Wertung ${score.toFixed(0)} (Merle ${merle.toFixed(0)}) – keine Platzierung. ${vs} „Nächstes Jahr!“`; }
          s.stats.medals.push({ medal, beer: beer.name, day: s.day, bundes: true });
          s.flags.bundes_medal = true; if (score > merle) s.flags.merle_geschlagen = true;
          const bonus = { Gold: [12, 500], Silber: [8, 250], Bronze: [5, 100] }[medal];
          addXp(s, { Gold: 250, Silber: 150, Bronze: 80 }[medal], 'Bundesmedaille'); addRep(s, bonus[0]); addCash(s, bonus[1]); addHonor(s, 3);
          return `${medal}medaille für „${beer.name}“ (Wertung ${score.toFixed(0)}, Merle ${merle.toFixed(0)})! ${vs} Ruf +${bonus[0]}, Preisgeld ${bonus[1]} €, Ansehen +3.`;
        } },
      { id: 'verzichten', label: '⏭️ Dieses Mal verzichten (Frage kommt in 40 Tagen wieder).', done: false,
        apply: s => { s.flags.retry_bundes = s.day + 40; return 'Du schaust lieber aus der Zuschauerreihe zu – und verbesserst in der Zwischenzeit dein Rezept.'; } },
    ],
  },
  merle_buch: {
    title: 'Merle und die zweite Seite', who: 'jury',
    text: 'Nach der Siegerehrung findet Merle dich im Foyer. Sie trägt eine Kartonmappe unter dem Arm. „Mein Großvater hat nach dem Streit die Hälfte von deines Opas Rezeptbuch behalten. Ich habe es aufgehoben, ohne es zu lesen. Ich glaube, es gehört dir.“',
    choices: [
      { id: 'danke', label: '🙏 Annehmen und bedanken – ohne Hintergedanken.', enabled: s => !s.flags.sabotage,
        apply: s => { s.flags.merle_ally = true; persona(s, 'trad', 1); return 'Ihr trinkt im Foyer das erste ruhige Bier zusammen. Die Seite riecht nach Keller und alter Tinte.' + giveFragment(s, 'wettstreit'); } },
      { id: 'beichte', label: '😔 Erst beichten: „Ich habe dir die falsche Hefe gegeben.“', enabled: s => !!s.flags.sabotage,
        apply: s => { s.flags.sabotage_gebeichtet = true; s.flags.sabotage = false; addHonor(s, 4); persona(s, 'trad', 2); s.flags.merle_ally = true; return 'Merle schweigt lange. „Ich wusste es“, sagt sie schließlich. „Ich wollte sehen, ob du es sagst.“ Sie gibt dir die Mappe trotzdem – und ihre Hand. (Ansehen +4)' + giveFragment(s, 'wettstreit'); } },
      { id: 'schweigen', label: '🤐 Annehmen und schweigen – es wird schon nichts herauskommen.', enabled: s => !!s.flags.sabotage,
        apply: s => { addHonor(s, -1); return 'Du nimmst die Mappe. In deinem Magen wächst ein Stein, der das Gewicht der Seite lässig übersteigt.' + giveFragment(s, 'wettstreit'); } },
      { id: 'handel', label: '💼 Anbieten, die Seite zu bezahlen (200 €).', enabled: s => s.cash >= 200 && !s.flags.sabotage,
        apply: s => { spend(s, 200, 'Merles Seite'); s.flags.merle_respekt = true; return 'Merle winkt ab, nimmt aber das Geld „für die nächste Rundenspende im Wirtshaus“. Die Geschichte bleibt kühl, aber fair.' + giveFragment(s, 'wettstreit'); } },
    ],
  },
  altlast: {
    title: 'Die Altlast', who: 'zoll',
    text: 'Frau Zollinger legt zwei Blätter nebeneinander: dein Gewerbe, das es nicht gibt – und eine Liste von Ladenbesitzern, die „Garagenbier ohne Rechnung“ bestätigt haben. „Wenn Sie eine Brauerei eröffnen wollen, muss das hier sauber sein. Sie haben zwei Wege.“',
    choices: [
      { id: 'nachzahlen', label: `📋 Selbstanzeige: anmelden und nachzahlen (${LICENSE_COST + 300} €).`, enabled: s => s.cash >= LICENSE_COST + 300,
        apply: s => { spend(s, LICENSE_COST + 300, 'Anmeldung und Nachzahlung'); s.license = true; s.flags.schwarz = false; addHonor(s, 2); s.flags.zollinger_ally = true; return 'Die Zahlung geht durch. Frau Zollinger schreibt „Einsicht, Kooperation“ in die Akte. Sauber. (Ansehen +2)'; } },
      { id: 'ratenzahlung', label: '📅 Anmelden, aber die Strafe in Raten zahlen (Ruf −3, Ansehen −4).', enabled: s => s.cash >= LICENSE_COST,
        apply: s => { spend(s, LICENSE_COST, 'die Anmeldung'); s.license = true; s.flags.schwarz = false; s.flags.vorbestraft = true; addRep(s, -3); addHonor(s, -4); return 'Die Raten laufen noch zwei Jahre – und der Vermerk in der Akte bleibt. Aber du bist legal.'; } },
      { id: 'amtlich', label: '🖋️ Nichts mehr tun: Das Amt meldet dich „von Amts wegen“ an (Ruf −6, Ansehen −8, Gebühr aus der Kasse, soweit vorhanden).',
        apply: s => { const paid = fine(s, LICENSE_COST + 300); s.license = true; s.flags.schwarz = false; s.flags.vorbestraft = true; addRep(s, -6); addHonor(s, -8); return `Frau Zollinger füllt das Formular selbst aus, seufzend, mit schöner Handschrift. Die Kasse zahlt ${paid} €, der Ruf zahlt den Rest. Immerhin: Du bist jetzt legal.`; } },
    ],
  },
  antrag: {
    title: 'Der Antrag', who: 'zoll',
    text: 'Dreiundzwanzig Formulare, vier Gutachten, zwei Grundrisse. Frau Zollinger erklärt dir den Weg Seite für Seite: „Steuerlager, HACCP-Konzept, Abwasser, Brandschutz.“ Sie sieht dich über den Brillenrand an. „Man kann das schnell machen. Oder richtig.“',
    choices: [
      { id: 'gruendlich', label: '📚 Gründlich alles selbst durcharbeiten (kostet Zeit, bringt Ansehen und Erfahrung).',
        apply: s => { addHonor(s, 3); addXp(s, 80, 'Betriebsrecht'); s.flags.zollinger_ally = true; s.hygiene = Math.min(0.8, s.hygiene + 0.05); return 'Drei Wochen später kennst du dein HACCP-Konzept besser als dein Sudbuch. Frau Zollinger nickt: „So macht man das.“ (Ansehen +3, Erfahrung +80, Hygiene +)'; } },
      { id: 'berater', label: '💼 Einen Berater nehmen (400 €).', enabled: s => s.cash >= 400,
        apply: s => { spend(s, 400, 'den Berater'); addXp(s, 20, 'Beratung'); return 'Der Berater stempelt, zeichnet, rechnet und schickt eine ordentliche Rechnung. Es läuft glatt. (Erfahrung +20)'; } },
      { id: 'abkuerzen', label: '🎁 Frau Zollinger „eine Kiste zum Dank“ vorbeibringen.',
        apply: s => { addHonor(s, -6); s.flags.zollinger_beleidigt = true; s.flags.vorbestraft = true; return 'Frau Zollinger schaut so lange auf die Kiste, dass du die Kronkorken zählen kannst. „Ich lasse das als Scherz stehen. Einmal.“ (Ansehen −6)'; } },
    ],
  },
  rechtsform: {
    title: 'Rechtsform: Einzelunternehmen oder GmbH?', who: 'zoll',
    text: 'Frau Zollinger legt zwei Formulare nebeneinander. „Einzelunternehmen: günstig und unkompliziert, aber Sie haften mit allem, was Sie besitzen. GmbH: 800 Euro, mehr Papier, dafür haften nur das Firmenvermögen und Ihr Ruf. Überlegen Sie sich das – eine Brauerei kann auch mal ein Unglück erleben.“',
    choices: [
      { id: 'gmbh', label: '🏢 GmbH gründen (800 €): Haftung begrenzt.', enabled: s => s.cash >= 800,
        apply: s => { spend(s, 800, 'die GmbH'); s.flags.gmbh = true; return 'Die Gründungsurkunde liegt auf dem Küchentisch. Opa hätte „GmbH“ vermutlich für eine Krankheit gehalten.'; } },
      { id: 'einzel', label: '👤 Einzelunternehmen bleiben (150 €, falls vorhanden).',
        apply: s => { fine(s, 150); s.flags.einzel = true; persona(s, 'trad', 1); return 'Du unterschreibst mit deinem vollen Namen. Wenn etwas schiefgeht, trägst du es persönlich – und das macht dich vorsichtig.'; } },
    ],
  },
  finanzierung: {
    title: 'Woher das Geld?', who: 'gerda',
    text: 'Der Businessplan ist fertig, die Zahlen stimmen auf dem Papier. Auf dem Tisch liegen vier Wege: Ein Kredit der Sparkasse über 8000 € (30 Monate à 330 €), Dr. Konrad Falk von Falk Capital mit 14.000 € gegen 10 % deines Umsatzes, ein Genossenschaftsaufruf an Dorf und Freunde mit 6000 € Anteilen (4 % Umsatz als Dividende) – oder alles mit eigener Kraft (2500 € aus Ersparnissen), ohne einen Cent Fremdkapital.',
    choices: [
      { id: 'bank', label: '🏦 Sparkassen-Kredit: 8000 €, Rate 330 € im Monat.',
        apply: s => { addCash(s, 8000); ensureStory(s).loan = { left: 9900, rate: 330 }; s.flags.bank_kredit = true; persona(s, 'trad', 1); return 'Der Kreditberater schiebt die Papiere hin wie ein Kellner das Dessert. Unterschrift, Handschlag – 8000 € auf dem Konto, 30 Raten im Nacken.'; } },
      { id: 'falk', label: '💼 Investor Dr. Falk: 14.000 €, 10 % vom Umsatz, redet mit.',
        apply: s => { addCash(s, 14000); s.flags.falk_investor = true; persona(s, 'bold', 2); persona(s, 'trad', -1); return 'Dr. Falk strahlt, als hätte er gerade ein Fass entkorkt. „Ich glaube an Skalierung.“ Sein Händedruck ist trocken, seine Zahlen sind es auch.'; } },
      { id: 'gemeinschaft', label: '🏘️ Genossenschaft aus Dorf und Freunden: 6000 €, 4 % Dividende.', enabled: s => s.flags.klaus_ally || s.flags.gerda_ally || s.flags.toni_ally,
        apply: s => { addCash(s, 6000); s.flags.genossen_anteile = true; persona(s, 'heimat', 2); addHonor(s, 4); return 'Klaus schreibt Anteilsscheine per Hand, Gerda backt Kuchen für die Gründungsversammlung. Vierzig Leute zeichnen zwischen 50 und 500 Euro. Ein Dorf wird Teilhaber.'; } },
      { id: 'eigen', label: '🛠️ Eigene Kraft: Sparbuch, Zweitwagen, Opas Rasenmäher – 2500 €, aber kein Fremdgeld (+Ansehen).',
        apply: s => { addCash(s, 2500); addHonor(s, 3); persona(s, 'trad', 2); s.flags.eigen_stolz = true; return 'Du löst das Sparbuch auf, verkaufst den Zweitwagen und Opas Rasenmäher und biegst jeden Euro zweimal um. 2500 € – es wird knapp, aber es gehört dir.'; } },
    ],
  },
  falk_treffen: {
    title: 'Dr. Falk im Sudhaus', who: 'falk',
    text: 'Dr. Falk läuft mit Aktenmappe durch deine Garage, tippt auf Kessel und Rohre. „Ich sehe vor mir ein Dreihundert-Hektoliter-Unternehmen. Sie sehen eine Nachbarschaftsbrauerei. Vielleicht können wir uns in der Mitte treffen?“',
    choices: [
      { id: 'skalieren', label: '📈 Zuhören und über Wachstum nachdenken.',
        apply: s => { s.flags.falk_vertraut = true; addXp(s, 40, 'Businessplanung'); return 'Er zeichnet dir einen Wachstumsplan auf eine Serviette. Er ist verlockend, und das Schlimmste ist: Er stimmt.'; } },
      { id: 'grenzen', label: '🛑 Klare Grenzen ziehen: „Das Bier bestimme ich.“',
        apply: s => { persona(s, 'trad', 1); addHonor(s, 1); return 'Falk lächelt gequält. „Selbstverständlich.“ In seinem Gesicht arbeitet eine Rechenmaschine weiter.'; } },
    ],
  },
  genossen_abend: {
    title: 'Der erste Genossenschaftsabend', who: 'klaus',
    text: 'Im Hinterzimmer des Wirtshauses sitzen vierzig Leute: Klaus als Vorsitzender, Gerda als Kassenwartin, Kalle als Beisitzer, Frau Kowalski mit Sparbuch. Alle wollen wissen: Wie wird das Geld verwendet? Wer entscheidet? Und gibt es Freibier?',
    choices: [
      { id: 'transparent', label: '📊 Alle Zahlen offenlegen und Mitbestimmung versprechen.',
        apply: s => { addHonor(s, 3); s.flags.klaus_ally = true; s.flags.gerda_ally = true; persona(s, 'heimat', 1); return 'Der Abend dauert vier Stunden. Klaus hält die Tafel ein, Gerda schlichtet, alle gehen mit einem Bier und einem Gefühl heim.'; } },
      { id: 'frei', label: '🍺 Auf die Freibier-Frage mit einer Runde antworten.',
        apply: s => { addRep(s, 2); s.flags.klaus_ally = true; return 'Die Stimmung kippt ins Fröhliche. Ab da sind alle sicher, dass die Brauerei gut aufgehoben ist.'; } },
    ],
  },
};
