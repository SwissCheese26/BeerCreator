// Spielmodi: Story, Sandbox, Karriere, Challenge.
import { careerTick, initCareer } from './career.js';
import { challengeTick, initChallenge } from './challenges.js';
import { FEATURES } from '../state.js';
import { initEmpire, empireTick } from '../empire/index.js';
export * from './market.js';
export * from './contracts.js';
export * from './career.js';
export * from './challenges.js';

export const MODES = {
  story:     { label: 'Story',     desc: 'Die große Kampagne von Opas Garage bis zur eigenen Brauerei.' },
  karriere:  { label: 'Karriere',  desc: 'Endloses Management mit Markt, Aufträgen, Fixkosten und Punktzahl.' },
  challenge: { label: 'Challenge', desc: 'Handgebaute Rätsel mit Frist und Sternen, dazu die tägliche Aufgabe.' },
  konzern:   { label: 'Braukonzern', desc: 'Vom Regionalbrauer zur Weltgruppe: Länder, Zukäufe, Neubauten, Marken, Schulden und Weltrangliste.' },
  sandbox:   { label: 'Sandbox',   desc: 'Alles frei, nur die Brau-Simulation zählt.' },
};

export function initMode(s, opts = {}) {
  s.features = Object.keys(FEATURES); s.tutorial = { step: 0, done: true }; // Karriere/Challenge: alles freigeschaltet, kein Tutorial
  if (s.mode === 'karriere') initCareer(s, opts);
  if (s.mode === 'challenge') initChallenge(s, opts.challengeId, opts.scenario);
  if (s.mode === 'konzern') initEmpire(s, { years: opts.years || 30, name: opts.name });
}
export function modeTick(s) { careerTick(s); challengeTick(s); empireTick(s); }
