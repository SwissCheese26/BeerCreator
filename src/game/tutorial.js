// Geführtes Tutorial: das erste Bier mit Opas Sudbuch und Gerda. Fast alles ist am Anfang gesperrt (🔒).
import { newRecipeFromStyle } from '../core/brew.js';
import { GameError, need, unlock, round2 } from './state.js';
import { buyForRecipe, startBatch, setHopForm } from './batch.js';
import { advanceDays, checkStory, finishTutorial } from './engine.js';
import { addXp } from './progress.js';

export function tutorialRecipe() {
  const r = newRecipeFromStyle('weizen');
  r.batchL = 20; r.name = 'Mein erstes Weizen';
  setHopForm(r, 'pellet');
  return r;
}
const myBatch = s => s.batches.find(b => b.tutorial);

// Jeder Schritt: Sprechblasen (who: opa | gerda), ein Bild-Emoji, eine Aktion.
// kind: 'button' (Standard), 'mash' (Temperatur wählen), 'choice' (Auswahl)
export const TUTORIAL_STEPS = [
  { id: 'start', icon: '📔', title: 'Opas Sudbuch',
    lines: [['gerda', 'Dein Opa hat gesagt, du sollst das hier kriegen. Er hat jeden Sud aufgeschrieben. Sogar die schlechten.'],
      ['opa', 'Wenn du das liest, braust du jetzt. Keine Angst – Bier will gelingen. Wir machen das zusammen.']],
    button: '📖 Sudbuch aufschlagen', unlock: ['sudbuch'] },
  { id: 'kaufen', icon: '🛒', title: 'Einkaufen',
    lines: [['opa', 'Für den Anfang ein Weizen. Es verzeiht viel und ist schnell fertig. Du brauchst Malz, ein bisschen Hopfen und Hefe.'],
      ['gerda', 'Das Geld ist in Opas Umschlag. Der hatte für alles einen Umschlag.']],
    button: '🛒 Starterpaket Weizen kaufen', unlock: ['lager'],
    run: s => { const before = s.cash; buyForRecipe(s, tutorialRecipe()); return `Eingekauft für ${round2(before - s.cash)} €: Weizenmalz, Pilsner Malz, Hopfen-Pellets, Weizenhefe und Desinfektionsmittel.`; } },
  { id: 'putzen', icon: '🧽', title: 'Putzen',
    lines: [['opa', 'Das Wichtigste zuerst: putzen. Bakterien trinken auch gern Bier – die laden wir aber nicht ein.']],
    button: '🧽 Eimer und Topf desinfizieren',
    run: s => { s.hygiene = Math.min(0.6, s.hygiene + 0.05); return 'Blitzblank. Deine Hygiene steigt ein wenig.'; } },
  { id: 'maischen', icon: '🌡️', title: 'Schroten & Maischen', kind: 'mash',
    lines: [['opa', 'Malz schroten heißt: Körner knacken, nicht zermahlen. Dann ab ins warme Wasser.'],
      ['opa', 'Bei etwa 67 °C wird Stärke zu Zucker. Halt die Temperatur eine Stunde – wie ein warmes Bad.']],
    button: '🌡️ Rast starten',
    run: (s, temp) => {
      const t = Number(temp);
      need(t >= 60, `${t} °C ist zu kalt – da passiert kaum etwas. Ein bisschen wärmer!`);
      need(t <= 72, `${t} °C ist zu heiß – dann wird das Bier süß und dünn. Etwas kühler!`);
      need(t >= 65 && t <= 68, `${t} °C geht schon, aber Opa schreibt: „Genau zwischen 65 und 68 Grad.“ Schieb noch ein bisschen.`);
      return `Eine Stunde bei ${t} °C. Gerda: „Riecht wie Müsli. Ist das normal?“ – Opas Zettel: „Ja, Gerda, das ist normal.“`;
    } },
  { id: 'laeutern', icon: '🫗', title: 'Läutern',
    lines: [['opa', 'Jetzt trennen wir die süße Flüssigkeit – die Würze – von den Körnern. Die Treber kriegen Gerdas Hühner.'],
      ['gerda', 'Die Hühner werden dich lieben.']],
    button: '🫗 Läutern' },
  { id: 'kochen', icon: '🔥', title: 'Kochen & Hopfen',
    lines: [['opa', 'Eine Stunde kochen. Hopfen am Anfang macht bitter, Hopfen kurz vor Schluss macht Duft.'],
      ['opa', 'Hopfen gibt’s als Dolde (ganze Blüte), als Pellet (gepresst, praktisch) und als Extrakt (konzentriert). Wir nehmen Pellets.']],
    button: '🔥 Kochen & Hopfen rein' },
  { id: 'kuehlen', icon: '❄️', title: 'Abkühlen & Hefe',
    lines: [['opa', 'Heiß mag die Hefe nicht. Erst runter auf 20 °C, dann Hefe rein. Sie macht aus Zucker Alkohol und Kohlensäure.']],
    button: '❄️ Kühlen & Hefe zugeben' },
  { id: 'gaeren', icon: '🫧', title: 'Gärplatz wählen', kind: 'choice',
    lines: [['opa', 'Die Temperatur entscheidet den Geschmack. Zu warm schmeckt komisch, zu kalt passiert nichts. Weizen mag es um 18 bis 20 °C.']],
    choices: [{ id: 'warm', label: '🔥 Warme Ecke beim Heizlüfter (19 °C)' }, { id: 'tor', label: '🚪 Am Garagentor (6 °C)' }],
    unlock: ['gaerkeller'],
    run: (s, choice) => {
      if (choice === 'tor') throw new GameError('Gerda: „Brrr! Da friert ja die Hefe ein. Nimm lieber die warme Ecke.“');
      const b = startBatch(s, tutorialRecipe(), { tutorial: true, fermTemp: 19, name: 'Mein erstes Weizen' });
      return `Der Eimer steht in der warmen Ecke. In ${b.readyDay - b.startDay} Tagen ist das Bier fertig.`;
    } },
  { id: 'warten', icon: '⏳', title: 'Warten',
    lines: [['gerda', 'Und jetzt?'], ['opa', 'Jetzt kommt das Schwerste: Finger weg. Ungefähr zwei Wochen.']],
    button: '⏩ Zeit vorspulen', unlock: ['zeit'],
    run: s => { const b = myBatch(s); if (b && b.status === 'gaerend') advanceDays(s, b.readyDay - s.day); return 'Blubb … blubb … blubb. Gerda jeden Morgen: „Es lebt!“'; } },
  { id: 'abfuellen', icon: '🍾', title: 'Abfüllen',
    lines: [['opa', 'Ab in die Flaschen, mit einem Löffel Zucker für die Kohlensäure. Bügelflaschen nehmen wir immer wieder.']],
    button: '🍾 Abfüllen' },
  { id: 'probieren', icon: '🍺', title: 'Probieren!',
    lines: [['gerda', 'Zisch! Na los – du zuerst!']],
    button: '🍺 Probieren',
    run: s => { addXp(s, 50, 'erstes Bier'); return 'Opa: „Wenn du das liest, hast du dein erstes Bier gebraut. Ich bin stolz auf dich. Und jetzt: Mach was draus.“'; } },
];

export function tutorialView(s) {
  if (s.mode !== 'story' || s.tutorial?.done) return null;
  const i = s.tutorial.step;
  const st = TUTORIAL_STEPS[i];
  return { index: i, total: TUTORIAL_STEPS.length, ...st, run: undefined, beer: st.id === 'probieren' ? s.beers.find(b => b.id === myBatch(s)?.id) : null };
}

/** Den aktuellen Tutorial-Schritt ausführen. input: Temperatur (mash) oder Auswahl-ID (choice). */
export function tutorialAct(s, input) {
  need(s.mode === 'story' && !s.tutorial.done, 'Das Tutorial ist schon vorbei.');
  const st = TUTORIAL_STEPS[s.tutorial.step];
  const msg = st.run ? st.run(s, input) : '';
  if (msg) s.log.push({ day: s.day, kind: 'tutorial', text: msg });
  if (st.unlock) unlock(s, ...st.unlock);
  s.tutorial.step++;
  if (s.tutorial.step >= TUTORIAL_STEPS.length) finishTutorial(s);
  checkStory(s);
  return msg;
}

/** Tutorial überspringen: Startpaket kaufen ist nicht nötig, man startet direkt in Kapitel 1. */
export function skipTutorial(s) {
  need(s.mode === 'story' && !s.tutorial.done, 'Das Tutorial ist schon vorbei.');
  finishTutorial(s, true);
  checkStory(s);
}
