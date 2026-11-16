import test from 'node:test';
import assert from 'node:assert/strict';
import * as g from '../src/game/index.js';
import { playStory } from './bot.js';

test('Die Story ist von Anfang bis Ende durchspielbar (mehrere Seeds)', () => {
  for (const seed of [1, 2, 3, 4]) {
    const s = playStory({ seed });
    assert.ok(s.ended, `Seed ${seed}: nicht fertig – Kapitel ${s.chapter}, Tag ${s.day}, Ruf ${s.reputation}, Geld ${s.cash}`);
    assert.equal(s.stage, 'brauerei');
    assert.ok(s.stats.medals.length >= 1);
    assert.ok(s.day - g.START_DAY < 2000);
    assert.equal(s.chapter, g.CHAPTERS.length - 1, 'das Ende liegt im letzten Kapitel (Finale), nicht mehr bei „Die eigene Brauerei“');
    assert.ok(Object.keys(g.ENDINGS).includes(s.ending), `Ende ${s.ending}`);
    assert.ok((s.story.fragments || []).length >= 4, 'Opas Rezeptbuch wurde (teilweise) gesammelt');
  }
});

test('Das Kapitel „Die eigene Brauerei“ ist nicht mehr das Ende; das Finale hat mehrere Enden', () => {
  const brauerei = g.CHAPTERS.findIndex(c => c.id === 'brauerei');
  assert.equal(brauerei, 6);
  assert.ok(!g.CHAPTERS[brauerei].ending);
  assert.ok(g.CHAPTERS.length > brauerei + 10);
  assert.equal(typeof g.CHAPTERS.at(-1).ending, 'function');
});
