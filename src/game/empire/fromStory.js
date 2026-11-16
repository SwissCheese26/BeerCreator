// Übergang vom Story-Ende in den Braukonzern: Was du erreicht hast, bestimmt den Start.
import { newGame } from '../engine.js';
import { clamp, log } from '../state.js';
import { HQ_LEVELS, countryOf, HOME } from './data.js';

export const STORY_START = {
  handwerk:      { suffix: ' Handwerksbrauerei',  cash: 4e6,  hq: 1, cap: 100, quality: 12, brand: 20, text: 'Du bleibst dem Handwerk treu: eine kleinere, dafür herausragende Brauerei mit loyalem Publikum – und dem Ehrgeiz, die Welt zu erobern, ohne die Seele zu verkaufen.' },
  industrie:     { suffix: ' Industries',         cash: 14e6, hq: 2, cap: 300, quality: 0,  brand: 8,  text: 'Mit dem Geld von Investor Falk geht es in großen Schritten. Die Zentrale steht, die Tanks sind größer – und die Bank wartet auf Ergebnisse.' },
  genossenschaft:{ suffix: ' Genossenschaft eG', cash: 6e6,  hq: 1, cap: 160, quality: 6,  brand: 14, text: 'Die Genossenschaft steht hinter dir: viele Anteilseigner, eine treue Region und Kapital, das Geduld hat.' },
  uebernahme:    { suffix: ' (Massivbräu-Gruppe)', cash: 25e6, hq: 2, cap: 450, quality: -3, brand: 0,  text: 'Als Teil der Massivbräu-Gruppe hast du Kapital und Reichweite – und musst zeigen, dass du mehr bist als eine Fußnote im Konzernbericht.' },
};

/** Erzeugt einen Konzern-Spielstand aus einem beendeten Story-Spiel. */
export function empireFromStory(story) {
  const key = STORY_START[story.ending] ? story.ending : 'handwerk';
  const cfg = STORY_START[key];
  const s = newGame({ mode: 'konzern', seed: story.rng, difficulty: story.difficulty, breweryName: `${story.breweryName}${cfg.suffix}` });
  const best = story.beers.slice().sort((a, b) => b.quality - a.quality)[0];
  const e = s.empire;
  const b = e.breweries[0];
  b.name = story.breweryName;
  b.capKhl = cfg.cap;
  b.quality = Math.round(clamp(55 + (story.stats.bestQuality || 0) * 0.25 + cfg.quality, 50, 90));
  b.brand = Math.round(clamp(28 + story.reputation * 0.45 + cfg.brand, 20, 85));
  b.style = best && countryOf(HOME).styles[best.styleId] ? best.styleId : b.style;
  e.hqLevel = cfg.hq;
  s.cash = Math.round(cfg.cash * ({ entspannt: 1.4, normal: 1, hardcore: 0.7 }[story.difficulty] || 1)) + Math.round(story.cash);
  s.stats.medals = [...(story.stats.medals || [])];
  s.legacy = { from: 'story', ending: key, breweryName: story.breweryName, medals: s.stats.medals.length, bestQuality: story.stats.bestQuality || 0 };
  log(s, `${cfg.text}\nStart: ${b.capKhl} Tsd. hl, Qualität ${b.quality}, Marke ${b.brand}, ${HQ_LEVELS[cfg.hq - 1].name}.`, 'story');
  return s;
}
