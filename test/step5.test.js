import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../src/game/index.js';
import { newRecipeFromStyle } from '../src/core/brew.js';

function game({ rep = 50, beers = [] } = {}) {
  const s = g.newGame({ skipTutorial: true, seed: 9 });
  s.event = null; s.ended = true; s.license = true; s.reputation = rep; s.honor = 20; s.cash = 5000; s.day = 300;
  g.unlock(s, 'verkauf', 'marketing', 'presse', 'radio', 'webseite');
  for (const b of beers) s.beers.push({ flaws: [], notes: [], plato: 12, abv: 5, ibu: 25, ebc: 10, finishedDay: s.day, liters: 50, ...b, id: s.nextId++ });
  return s;
}

test('Sortiment: beliebig viele Rezepte, auch mehrere vom gleichen Stil', () => {
  const s = game();
  for (let i = 0; i < 12; i++) {
    const r = newRecipeFromStyle(i % 2 ? 'pils' : 'helles');
    r.name = g.uniqueRecipeName(s, r.name);
    g.saveRecipe(s, r);
  }
  assert.equal(s.recipes.length, 12);
  assert.ok(s.recipes.some(r => r.name === 'Mein Helles 6'));
  assert.ok(g.recipeExists(s, 'mein pils 3'));
});

test('Interview: drei Fragen, Antworten formen die Persönlichkeit und den Ruf', () => {
  const s = game({ beers: [{ name: 'Kellerperle', styleId: 'helles', quality: 80 }] });
  s.mode = 'story';
  g.pressOf(s).offer = { media: 'zeitung', day: s.day, expires: s.day + 10 };
  g.acceptInterview(s);
  let res, n = 0;
  do {
    const v = g.interviewView(s);
    assert.equal(v.answers.length, 3);
    res = g.answerInterview(s, 0); n++;
  } while (!res.done);
  assert.equal(n, 3);
  assert.equal(s.press.archive.length, 1);
  assert.ok(res.article.headline.includes(s.breweryName));
  assert.equal(g.interviewView(s), null);
  assert.ok(typeof g.persona(s).title === 'string');
});

test('Persönlichkeit: Traditionsbrauer:innen punkten beim Malzmeister, Heimat stärkt den Hofverkauf', () => {
  const s = game();
  s.press.persona = { trad: 5, bold: 0, heimat: 5 };
  assert.ok(g.personaReviewBonus(s, 'malzmeister') > 0);
  assert.equal(g.personaReviewBonus(s, 'doldenrausch'), 0);
  assert.ok(g.pressDemand(s, 'hof') > 1);
  assert.match(g.persona(s).title, /Tradition/);
});

test('Gebrochenes Versprechen: „keine Massenware“ und dann Lohnbrauen kostet Ansehen', () => {
  const s = game();
  s.mode = 'story';
  g.pressOf(s).claims.push({ id: 'handwerk', day: s.day, owned: 0, media: 'zeitung' });
  const honor = s.honor;
  s.contracts.push({ liters: 1000, readyDay: s.day + 20, recipe: { name: 'X' } });
  g.pressDaily(s);
  assert.equal(s.honor, honor - 5);
  assert.equal(s.press.claims.length, 0);
});

test('Radio: Spot erhöht die Nachfrage der Hörer, passendes Bier wirkt stärker; Gast in der Sendung', () => {
  const s = game({ beers: [{ name: 'Rauchzeichen', styleId: 'rauch', quality: 75 }] });
  s.mode = 'story';
  const before = g.channelDemand(s, 'festival');
  assert.ok(g.adFactor(s, 'metalcore') > g.adFactor(s, 'ru-rap'), 'Rauchbier passt zum Moshpit');
  g.bookAd(s, 'metalcore');
  assert.ok(g.channelDemand(s, 'festival') > before);
  assert.throws(() => g.bookAd(s, 'metalcore'), /schon/);
  g.advanceDays(s, g.AD_DAYS + 1);
  s.press.offer = null; s.press.current = null;
  g.radioGuest(s);
  assert.equal(g.interviewView(s).media, 'radio');
  g.answerInterview(s, 0); g.answerInterview(s, 0);
  const v = g.interviewView(s);
  assert.match(v.question, /Musik/);
  g.answerInterview(s, 1);
  assert.ok(s.press.radio.fav);
  assert.throws(() => g.radioGuest(s), /wieder in/);
});

test('Radio-Player: Songs aus den Playlists, Sender wechseln, weiter', () => {
  const s = game();
  for (const id of Object.keys(g.SHOWS)) {
    g.tuneRadio(s, id);
    const a = g.nowPlaying(s);
    assert.ok(a.title && a.artist && a.url.startsWith('https://open.spotify.com/track/'), id);
    g.nextSong(s);
    assert.notEqual(g.nowPlaying(s).url, a.url);
  }
  const cash = s.cash;
  s.mode = 'story';
  g.sponsorShow(s, 'rock');
  assert.equal(s.cash, cash - g.SPONSOR_MONTH);
  assert.ok(g.pressDemand(s, 'gastro') > 1);
  g.sponsorShow(s, null);
  assert.equal(s.press.radio.sponsor, null);
});
