// Info-Texte zu jeder Sache im Spiel. getInfo(kind, id) → { title, text }.
import { MALTS, HOPS, HOP_FORMS, YEASTS, STYLES } from '../core/data.js';
import { EQUIPMENT } from './config.js';
import { LEVELS, STYLE_META } from './progress.js';

const MALT_INFO = {
  pilsner: 'Das hellste Standardmalz (3–4 EBC) mit viel vergärbarem Extrakt und sauberem, leicht honigartigem Malzgeschmack. Basis für Pils, Helles, Kölsch und Tripel. Braucht eine Kochzeit von mindestens 60 Minuten, damit der Geruchsstoff DMS abdampft.',
  pale: 'Ale-Malz, etwas kräftiger und brotiger als Pilsner (ca. 6 EBC). Die Basis für Pale Ale, IPA, Porter und Stout.',
  wiener: 'Leicht getoastetes Malz (ca. 9 EBC), gibt Bernsteinfarbe und rundes Brotaroma. Gut für Märzen und Helles, wenn es etwas malziger sein darf.',
  muenchner: 'Dunkler gedarrtes Malz (ca. 17 EBC) mit brotig-malzigem Aroma. Basis für Dunkel, Märzen, Bock und Altbier. Hat von Natur aus genug Enzyme für die Maische.',
  weizen: 'Helles Weizenmalz: liefert Eiweiß für stabilen Schaum und den typischen Weizencharakter. Hat keine Spelzen, daher Läuterprobleme bei hohem Anteil. In Weizenbier mindestens 50 %.',
  weizendunkel: 'Dunkel gedarrtes Weizenmalz (ca. 18 EBC): Brotkruste und Karamellnoten. Basis für Dunkelweizen, mindestens 50 % der Schüttung.',
  rauch: 'Über Buchenholz geräuchertes Malz. Schon 20 % schmecken deutlich nach Rauch; bis 100 % ist möglich (Bamberger Rauchbier). Polarisiert stark.',
  carapils: 'Dextrinmalz: sorgt für Schaumstabilität und Körper, ohne Farbe oder Süße. Bis 10 % sinnvoll.',
  carahell: 'Helles Karamellmalz (ca. 25 EBC): leichte Honig- und Karamellsüße, mehr Vollmundigkeit. Bis ca. 15–20 %.',
  caramuench: 'Dunkles Karamellmalz (ca. 120 EBC): Karamell, Rosine, Trockenfrucht. Zu viel macht das Bier klebrig-süß. Bis ca. 15 %.',
  carafa: 'Entspelztes Röstmalz (sehr dunkel): gibt viel Farbe, aber kaum herbe Röstbitterkeit. Ideal für Schwarzbier und Porter. Maximal 5 %.',
  roest: 'Röstgerste: Kaffee, dunkle Schokolade, herbe Röstbitterkeit. Prägt Stout und Porter. Maximal ca. 8 %, sonst wird es aschig.',
  melanoidin: 'Malz mit intensivem Aroma nach Brot, Honig und Malzextrakt; rötliche Farbe, fördert Vollmundigkeit. Gut für Bock, Dubbel, Altbier. Bis ca. 20 %.',
  roggen: 'Roggenmalz: würzig-pfeffrig, macht die Maische zähflüssig (Läuterprobleme!). Bis ca. 40 %, typisch 5–15 %, z. B. in Saison.',
  hafer: 'Haferflocken: cremiger, weicher Körper und Trübung. Typisch in Witbier und New England IPA. Bis ca. 20 %.',
  sauermalz: 'Enthält Milchsäure und senkt den pH-Wert der Maische. Verbessert Enzymarbeit und Geschmack heller Biere und ist reinheitsgebotskonform. Bis ca. 10 %.',
  kandis: 'Zucker, der vollständig vergärt: macht Bier trockener und alkoholstärker, ohne Körper. Typisch für Tripel und Dubbel. Im Spiel vereinfacht wie Malz gerechnet.',
};

const HOP_INFO = {
  hallertauer: 'Klassischer deutscher Edelhopfen: würzig, kräuterig, mild. Ideal für Lager, Pils, Helles und Weizen.',
  tettnanger: 'Deutscher Aromahopfen: fein, blumig, leicht würzig. Standard für Pils, Kölsch und Weizen.',
  saphir: 'Moderner deutscher Aromahopfen mit Zitrus und Frucht, aber noch fein. Gut für Pils mit Pep.',
  tradition: 'Mild-würziger Allrounder aus der Hallertau mit mittlerem Alpha-Gehalt. Gut als Bitterhopfen für deutsche Lager.',
  perle: 'Würzig, leicht minzig, mittleres Alpha. Beliebt für Altbier, Kölsch, Porter und als Bitterhopfen.',
  magnum: 'Hochalpha-Bitterhopfen mit sehr sauberer, neutraler Bittere. Spart Gramm (und Pflanzenmaterial) bei hohen IBU.',
  cascade: 'US-Klassiker: Grapefruit, Blüten. Prägt Pale Ale und amerikanische IPAs.',
  citra: 'US-Aromastar: Zitrus, Mango, Tropenfrucht. Für späte Gaben und Whirlpool; teuer.',
  mosaic: 'Beerig, tropisch, harzig-erdig. Ein Favorit für IPA und NEIPA; teuer.',
  saaz: 'Tschechischer Edelhopfen: fein, würzig, edel-herb. Das Aroma des klassischen Pilsner Urquell – auch für Belgier und Witbier.',
  hersbruck: 'Mild, heuig-blumig, wenig Alpha. Ein sanfter deutscher Aromahopfen.',
  northern: 'Herb, holzig, minzig, mittleres bis hohes Alpha. Klassisch für Porter, Altbier und englische Biere.',
  fuggles: 'Englischer Klassiker: erdig, leicht fruchtig, mild. Passt zu Porter, Stout und Bitter.',
  goldings: 'East Kent Goldings: honigartig, blumig, mild-würzig. Typisch für englische Ales und Saison.',
};

const FORM_INFO = {
  whole: 'Ganze Hopfendolden: das natürlichste Aroma, aber sperrig und empfindlich. Verlieren Alpha und Aroma recht schnell (ca. 40 % in einem Jahr bei Raumtemperatur). Ausbeute ist etwas geringer als bei Pellets. Teurer als Pellets.',
  pellet: 'Gepresste, zerkleinerte Dolden (T90): der Standard. Lange haltbar (vakuumverpackt und kühl), gute Ausbeute (ca. 10 % besser als Dolden) und volles Aroma.',
  extract: 'CO₂-Hopfenextrakt (ca. 30 % Alpha): sehr lange haltbar, klein, billig pro Bitterwert und genau dosierbar. Bringt aber nur Bittere – kein frisches Hopfenaroma – und wirkt oft hart. Gut für die Bitterung, schlecht für Aromagaben.',
};

const YEAST_INFO = {
  lager: 'Untergärige Lagerhefe: vergärt kühl (9–13 °C) sehr sauber und neutral. Braucht doppelt so viel Hefe wie Ale und eine lange Lagerzeit. Ohne Kühlung nur im Winter in der Garage möglich.',
  weizen: 'Obergärige Weizenhefe: bildet Bananen- (Ester) und Nelkenaromen (Phenole). Gärt warm (18–23 °C), schnell, stark schäumend.',
  ale: 'Neutrale, vielseitige Ale-Hefe (z. B. US-05): sauber, mit leichter Frucht. Verzeiht kleine Fehler, gärt bei 16–20 °C.',
  koelsch: 'Obergärige Hefe, die kühl und lagerähnlich vergärt (15–19 °C): saubere, feine, leicht fruchtige Biere – für Kölsch und Altbier.',
  stout: 'Englische Ale-Hefe: vergärt weniger vollständig (ca. 74 %), lässt Restsüße und Körper. Passt zu Stout und Porter.',
  belgisch: 'Belgische Abteihefe: würzige Phenole und fruchtige Ester (Birne, Pflaume, Pfeffer). Gärt warm (18–25 °C). Für Dubbel, Tripel und Witbier.',
  saison: 'Saison-Hefe: vergärt sehr hoch (ca. 88 %) und warm (22–30 °C), trocken und pfeffrig. Verträgt Hitze, die andere Hefen umbringt.',
  sauer: 'Mischkultur aus Hefe und Milchsäurebakterien (Lacto): erzeugt die Säure der Berliner Weisse. Achtung: Bakterien können deine Anlage dauerhaft „infizieren“ – nur mit extra Sorgfalt.',
};

const STYLE_INFO = {
  pils: 'Hellgelb, trocken, deutlich herb und knackig mit edlem Hopfenaroma. Einfach zu planen, aber unverzeihlich bei Fehlern – nichts versteckt sich. Einsteigerfreundlich.',
  helles: 'Süffiges, malzbetontes Lager mit milder Bittere. Das bayerische Alltagsbier. Fehler fallen auf, daher ein guter Lernstil.',
  maerzen: 'Bernsteinfarbenes, rundes Lager mit Brotkruste und moderater Bittere. Etwas stärker als Helles; gut mit Wiener und Münchner Malz.',
  weizen: 'Hefeweizen: fruchtig-würzig (Banane, Nelke), wenig Bittere, hoher Schaum. Die Hefe macht den Stil; Gärtemperatur ist entscheidend.',
  pale: 'Hopfiges, ausgewogenes Ale mit Zitrus- und Fruchtaromen und mittlerer Bittere. Zeigt, was echtes Aromahopfen leistet.',
  ipa: 'Kräftig gehopft, bitter, tropisch-harzig, 5,5–7,5 %. Aromagaben mit echtem Hopfen sind Pflicht; Extrakt allein wirkt flach und hart.',
  stout: 'Dunkel, geröstet, Kaffee- und Schokoladenaromen, cremig. Röstmalz dosieren – zu viel wird aschig-bitter.',
  doppelbock: 'Starkes, malziges Lager (7–8,5 %) mit Brot, Toffee und Trockenfrucht. Hohe Stammwürze braucht viel Hefe und lange Lagerung.',
  koelsch: 'Hell, schlank, obergärig-lagerähnlich: sauber, leicht fruchtig, fein hopfig. Verlangt kühle Gärung und Geduld.',
  dunkel: 'Münchner Dunkel: Brotrinde, Karamell, mild; wenig Röstnote. Der Gegenpol zum Pils: malzig statt hopfig.',
  schwarzbier: 'Fast schwarz, aber schlank und mild geröstet, mit lagertypischer Sauberkeit. Entspelzte Röstmalze geben Farbe ohne Schärfe.',
  bock: 'Kräftiges Lager (6–7,5 %), malzbetont, wenig Hopfenaroma. Hohe Stammwürze: mehr Hefe, längere Gärung.',
  alt: 'Düsseldorfer Altbier: kupfern, herb, malzig-trocken, mit kühler Obergärung. Etwas kräftigere Bittere als Kölsch.',
  rauch: 'Bamberger Rauchbier: rauchig-speckig mit Malzsüße. Der Rauchanteil muss zu den anderen Malzen passen.',
  porter: 'Dunkel mit Schokolade, Kaffee und leichter Röstnote, weicher als Stout. Meist englische Hefe.',
  imperial: 'Wuchtig: 8–12 % Alkohol, dichte Röstaromen, hohe Bittere. Extrem hohe Stammwürze verlangt große Hefemengen, viel Sauerstoff und lange Reifung. Meisterstück.',
  dubbel: 'Belgisch-dunkel mit Trockenfrucht, Karamell und Gewürz. Dunkler Kandis und die Hefe machen den Charakter.',
  tripel: 'Hell, stark (7,5–9,5 %), aber trocken und gefährlich süffig. Hoher Vergärungsgrad durch Kandis und warme, saubere Gärung. Fehler fallen sofort auf.',
  saison: 'Trocken, pfeffrig, spritzig, fruchtig-würzig. Die Saison-Hefe verträgt Wärme – im Sommer in der Garage fast ein Vorteil.',
  witbier: 'Belgisches Weißbier: trüb, mild, würzig (Koriander, Orange), mit Hafer und Weizen. Wenig Bittere, hohe Trinkigkeit.',
  dunkelweizen: 'Weizenbier mit Brotkruste, Karamell und Bananen-Nelken-Note. Dunkles Weizenmalz und Münchner Malz bestimmen den Körper.',
  neipa: 'New England IPA: trüb, saftig, kaum bitter, riesige späte Hopfengaben (Whirlpool/Stopfen), viel Hafer. Aroma ist alles: Extrakt ist hier keine Option.',
  berliner: 'Leichte (3 %), spritzig-saure Weisse mit Mischkultur (Hefe + Lacto). Wenig Hopfen. Risikoreich: Bakterien können später andere Sude infizieren.',
};

const EQUIP_INFO = {
  'kettle:topf': 'Der Einkochtopf aus Opas Garage. Reicht für Sude bis 20 Liter Ausschlag – genug zum Lernen.',
  'kettle:kessel50': '50-Liter-Edelstahlkessel: Sude bis 40 Liter, gleichmäßiger Siedevorgang, spart pro Liter Energie.',
  'kettle:kessel100': '100-Liter-Sudkessel: Sude bis 80 Liter. Für den Übergang zur Kleinbrauerei.',
  'fermenter:eimer': 'Gäreimer aus Kunststoff: günstig, ein Gärplatz. Kratzer bieten Keimen Versteck – schlechtere Hygiene.',
  'fermenter:edelstahl': 'Edelstahl-Gärtank: leichter zu reinigen (bessere Hygiene) und zwei Gärplätze.',
  'fermenter:konisch': 'Konischer Gärtank: Hefe und Trub lassen sich unten ablassen. Beste Hygiene und vier Gärplätze.',
  'cooling:keine': 'Ohne Kühlung gärt das Bier bei Umgebungstemperatur: im Winter zu kalt, im Sommer zu warm. Gerade Lager leiden.',
  'cooling:kuehlschrank': 'Gärkühlschrank mit Thermostat: hält die Temperatur auf ±1,5 °C der Hefeempfehlung. Der größte Qualitätssprung für Hobbybrauer.',
  'cooling:profi': 'Glykol-Kühlung: exakte Temperaturkontrolle für jeden Tank. Das Profi-Setup.',
};

const METRIC_INFO = {
  plato: ['Stammwürze (°P)', 'Anteil gelöster Stoffe (vor allem Zucker) in der Würze vor der Gärung, in Grad Plato. 12 °P ≈ 12 g Extrakt in 100 g Würze. Je höher, desto mehr Malz, Alkohol und Körper – aber auch mehr Hefe und längere Gärung.'],
  sg: ['Dichte (SG)', 'Spezifisches Gewicht der Würze, z. B. 1,048. Eine andere Schreibweise für die Stammwürze: 12 °P ≈ 1,048.'],
  abv: ['Alkohol (% vol)', 'Entsteht aus dem vergorenen Zucker: Stammwürze minus Restextrakt. Mehr Stammwürze und höherer Vergärungsgrad ergeben mehr Alkohol.'],
  ibu: ['Bittere (IBU)', 'International Bitterness Units: Maß für die Hopfenbittere. Entsteht durch langes Kochen von Alphasäure. Steigt mit Hopfenmenge, Kochzeit und Alpha-Wert; sinkt bei hoher Stammwürze und altem Hopfen.'],
  bugu: ['BU:GU', 'Bittere im Verhältnis zur Stammwürze. Unter 0,5 wirkt ein Bier malzig-süß, über 0,8 herb.'],
  ebc: ['Farbe (EBC)', 'Maß für die Bierfarbe: 4–8 hellgelb, 10–20 gold, 25–40 bernstein, 50+ dunkelbraun bis schwarz. Hängt von den Malzen ab.'],
  evg: ['Endvergärungsgrad (EVG)', 'Anteil des Zuckers, den die Hefe vergärt. Hoch = trocken und alkoholreich, niedrig = süß und körperreich. Hochstammwürze senkt ihn.'],
  restextrakt: ['Restextrakt', 'Der unvergorene Anteil nach der Gärung. Ergibt Körper, Süße und Kalorien.'],
  kcal: ['Energie (kcal)', 'Kalorien pro Halbliter aus Alkohol und Restextrakt. Starke, süße Biere haben mehr.'],
  efficiency: ['Sudhausausbeute (%)', 'Wie viel Extrakt aus dem Malz tatsächlich in der Würze landet. Gute Anlagen kommen auf 75–85 %. Schlechtere Ausbeute braucht mehr Malz.'],
  evap: ['Verdampfung (%)', 'Wasser, das beim Kochen verdampft. Stärkeres Kochen konzentriert die Würze und treibt unerwünschte Stoffe (DMS) aus, braucht aber mehr Anfangswasser.'],
  hauptguss: ['Hauptguss', 'Das Wasser, mit dem du die Schüttung einmaischst (hier ca. 3,5 Liter je kg Malz).'],
  nachguss: ['Nachguss', 'Heißes Wasser zum Auswaschen (Anschwänzen) der Treber nach dem Läutern. Es holt den restlichen Zucker heraus.'],
  pfannevoll: ['Pfanne voll', 'Würzemenge vor dem Kochen. Wegen Verdampfung muss sie größer sein als die spätere Ausschlagmenge.'],
  pitch: ['Hefemenge (Pitchrate)', 'Zellzahl pro Milliliter und Grad Plato. Lager braucht doppelt so viel wie Ale; starke Biere brauchen proportional mehr. Zu wenig Hefe stresst sie und verursacht Fehlaromen.'],
  quality: ['Qualität (0–100)', 'Gesamtwertung eines fertigen Biers: Stiltreue (40), Hopfenaroma (10), Gärtemperatur (20), Hefemenge (10), Hygiene (20) – mit Abzügen für Fehlaromen, fehlende Erfahrung bei schwierigen Stilen und mangelnde Übung (die ersten drei Sude eines Stils).'],
  hygiene: ['Hygiene', 'Wie sauber du arbeitest. Sie steigt mit Übung, Level, Gärtank-Qualität und Desinfektionsmittel. Je schlechter, desto höher die Infektionsgefahr.'],
  reputation: ['Ruf (0–100)', 'Wie bekannt und beliebt dein Bier ist. Gutes Bier macht dich bekannt; schlechtes Bier schadet. Er erhöht Nachfrage und Verkaufspreis.'],
  level: ['Level & Erfahrung', 'Du sammelst Erfahrung (XP) durch fertige Sude – mehr bei schwierigen Stilen und guter Qualität. Höhere Level schalten Kurse frei und senken Ungenauigkeit und Infektionsrisiko.'],
  license: ['Gewerbe', 'Verkauf von Bier setzt ein Gewerbe voraus. Hobbybrauer dürfen verschenken, aber nicht verkaufen.'],
  hobbygrenze: ['Hobbygrenze (200 L/Jahr)', 'Bis zu 200 Liter im Jahr sind für Hobbybrauer steuerfrei. Wer mehr braut, ohne Gewerbe zu haben, riskiert ein Bußgeld.'],
  tax: ['Biersteuer', 'Beim Verkauf fällig: je Hektoliter und Grad Plato. Hier vereinfacht mit Mengenstaffel für Kleinbrauereien.'],
  demand: ['Nachfrage pro Woche', 'So viele Liter kaufen die Leute pro Woche. Mehr Ruf = größere Nachfrage.'],
  slots: ['Gärplätze', 'Wie viele Sude gleichzeitig gären können. Mehr Tanks (oder Gerdas Keller) bringen mehr Platz.'],
  freshness: ['Hopfenalter', 'Hopfen verliert mit der Zeit Alpha-Säure und Aroma, Dolden am schnellsten, Extrakt kaum. Alter Hopfen bringt weniger Bittere und kann käsig schmecken.'],
  aroma: ['Hopfenaroma', 'Entsteht durch späte Gaben (≤15 Minuten, Whirlpool, Stopfen) von echtem Hopfen. Extrakt liefert hier nichts. Aromahopfen-Stile wie IPA brauchen viel davon.'],
  cost: ['Sudkosten', 'Malz + Hopfen + Hefe + Energie/Wasser + Desinfektion. Geteilt durch die Fertigbiermenge ergibt das die Kosten pro Liter – dein Verkaufspreis sollte darüber liegen.'],
  temp: ['Gärtemperatur', 'Jede Hefe hat einen Wohlfühlbereich. Zu warm: Fuselalkohole und Lösungsmittel-Ester. Zu kalt: träge, dünn, evtl. steckengeblieben.'],
};

const FLAW_INFO = {
  infektion: ['Infektion', 'Wilde Hefen oder Bakterien haben sich eingeschlichen: sauer, butterig, muffig. Vorbeugen: Hygiene, Desinfektionsmittel, besserer Gärtank, mehr Erfahrung.'],
  ester: ['Zu warme Gärung', 'Über dem Temperaturbereich der Hefe entstehen Fuselalkohole und lösungsmittelartige Ester – Kopfschmerzgarantie.'],
  traege: ['Zu kalte Gärung', 'Unter dem Temperaturbereich arbeitet die Hefe kaum: dünnes, süßliches Bier, das ggf. steckenbleibt.'],
  unterhefung: ['Zu wenig Hefe', 'Zu wenig Zellen gestresst: Schwefel, Fruchtester, schleppende Gärung. Mehr Päckchen oder einen Starter verwenden.'],
  oxidiert: ['Alter Hopfen', 'Oxidierter Hopfen riecht nach Käse, Fußschweiß und Pappe. Frisch kaufen und kühl, dunkel, luftdicht lagern.'],
  hart: ['Harte Bittere', 'Wenn die Bittere fast nur aus Extrakt stammt, wirkt sie kantig und kratzig, ohne die Komplexität echter Hopfenöle.'],
  flach: ['Zu wenig Aroma', 'Der Stil braucht mehr Hopfenaroma: späte Gaben von echtem Hopfen (Dolden oder Pellets) statt Extrakt.'],
};

const CONCEPT_INFO = {};

const entries = {};
const add = (kind, id, title, text) => { (entries[kind] ||= {})[id] = { title, text }; };
MALTS.forEach(m => add('malt', m.id, m.name, `${MALT_INFO[m.id]} (Farbe ${m.ebc} EBC, Extraktausbeute ${m.extract} %, empfohlen bis ${m.maxPct} %.)`));
HOPS.forEach(h => add('hop', h.id, h.name, `${HOP_INFO[h.id]} (Alpha ${h.alpha} %.)`));
Object.values(HOP_FORMS).forEach(f => add('form', f.id, f.name, FORM_INFO[f.id]));
YEASTS.forEach(y => add('yeast', y.id, y.name, `${YEAST_INFO[y.id]} (Vergärungsgrad ca. ${y.attenuation} %, ${y.temp}.)`));
STYLES.forEach(st => {
  const m = STYLE_META[st.id], r = st.ranges;
  add('style', st.id, st.name, `${STYLE_INFO[st.id]} Zielwerte: ${r.plato[0]}–${r.plato[1]} °P, ${r.ibu[0]}–${r.ibu[1]} IBU, ${r.ebc[0]}–${r.ebc[1]} EBC, ${r.abv[0]}–${r.abv[1]} % vol. ` +
    `Schwierigkeit ${m.difficulty}/5, Kurs ab Level ${m.minLevel}${m.cost ? ` für ${m.cost} €` : ' (kostenlos)'}.`);
});
Object.entries(EQUIPMENT).forEach(([slot, tiers]) => Object.entries(tiers).forEach(([id, e]) =>
  add('gear', `${slot}:${id}`, e.name, `${EQUIP_INFO[`${slot}:${id}`]}${e.cost ? ` Preis: ${e.cost} €.` : ' (Startausrüstung.)'}`)));
Object.entries(METRIC_INFO).forEach(([id, [t, x]]) => add('metric', id, t, x));
Object.entries(FLAW_INFO).forEach(([id, [t, x]]) => add('flaw', id, t, x));
LEVELS.forEach(l => add('level', String(l.lvl), `Level ${l.lvl}: ${l.name}`, `Ab ${l.xp} Erfahrung. Schaltet Kurse bis Level ${l.lvl} frei und verbessert Hygiene und Genauigkeit.`));

export const INFO_KINDS = Object.keys(entries);
export const infoIds = kind => Object.keys(entries[kind] || {});

/** getInfo('hop', 'citra') → { title, text } (oder null) */
export function getInfo(kind, id) { return entries[kind]?.[id] ?? null; }

/** Freitextsuche: getInfoAny('citra') findet den Eintrag in beliebiger Kategorie. */
export function findInfo(id) {
  for (const kind of INFO_KINDS) if (entries[kind][id]) return { kind, ...entries[kind][id] };
  return null;
}
