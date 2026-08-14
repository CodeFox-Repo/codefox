#!/usr/bin/env node
/**
 * Two keyboard regressions that are invisible in a screenshot.
 *
 * 1. Escape used to drop focus on <body>. Radix restores focus to the opener,
 *    but by the time it tries, that element has been blurred — so a keyboard
 *    user pressed Escape and lost their place on the page, with the next Tab
 *    starting over from the top of the document. Measured on both auth
 *    modals; every dialog in the app renders through the one DialogContent,
 *    so the fix and this guard are both in one place.
 *
 * 2. The question card's options are toggles drawn as plain buttons. Selected
 *    state was a border colour and a check icon — nothing a screen reader can
 *    see. `aria-pressed` is what makes the state audible.
 *
 * Source assertions: the behaviour needs a browser, a built frontend and a
 * free port, which is what the visual-qa scripts are for. What breaks here is
 * one prop going missing, and that is readable from the source.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const dialog = read('frontend/src/components/ui/dialog.tsx');
const card = read('frontend/src/components/chat/question-card.tsx');

// Recorded on open, not on mount: Radix renders DialogContent before the
// dialog is ever shown, when the active element is still <body>.
assert.match(
  dialog,
  /onOpenAutoFocus=\{\(event\) => \{\s*openerRef\.current = document\.activeElement/,
  'the dialog no longer records which control opened it — Escape will drop ' +
    'focus on <body> and a keyboard user loses their place'
);
assert.match(
  dialog,
  /onCloseAutoFocus[\s\S]{0,400}?opener\?\.isConnected[\s\S]{0,120}?opener\.focus\(\)/,
  'the dialog no longer restores focus to its opener on close'
);
// Restoring to an element that has since been removed would throw away the
// focus position entirely; the guard has to stay.
assert.ok(
  dialog.includes('isConnected'),
  'the focus restore no longer checks the opener is still in the document'
);

// Both option flavours — the plain buttons and the design-system swatches.
assert.equal(
  (card.match(/aria-pressed=\{selected\}/g) ?? []).length,
  2,
  'a question-card option lost its aria-pressed, so a screen reader can no ' +
    'longer tell which options are picked'
);

console.log('ok — dialogs give focus back, and card options say they are picked');
