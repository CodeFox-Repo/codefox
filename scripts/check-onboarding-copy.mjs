#!/usr/bin/env node
// Copy contracts supplement the interactive component tests. They do not
// measure comprehension or validate a deployed model-provider configuration.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const prompt = read('frontend/src/components/root/prompt-form.tsx');
const landing = read('frontend/src/components/root/landing.tsx');
const chat = read('frontend/src/components/chat/chat-bottombar.tsx');
const questions = read('frontend/src/components/chat/question-card.tsx');
const auth = read('frontend/src/components/auth-choice-modal.tsx');
assert.match(
  prompt,
  /aria-label="Describe your project"/,
  'prompt needs a stable accessible name'
);
assert.match(
  prompt,
  /role="alert"/,
  'prompt errors must reach users, not only the log'
);
assert.match(
  prompt,
  /Couldn.t improve your prompt\. Your text is still here\. Try again\./
);
assert.match(prompt, /Improving prompt/);
assert.match(prompt, /Describe your project first\./);
assert.doesNotMatch(
  landing,
  /cloud keys required|no cloud API key|Claude Code inside|All of it happens on your machine/
);
assert.match(landing, /configured model provider/);
assert.match(chat, /aria-label="Message CodeFox"/);
assert.match(chat, /Press Enter or select Send to queue it/);
assert.doesNotMatch(chat, /Keep typing — sends|快速 ·|强力 ·/);
assert.match(questions, /aria-label="Additional details \(optional\)"/);
assert.match(questions, /Select all that apply/);
assert.match(auth, /Sign in or create an account to continue/);
console.log(
  'ok — onboarding copy names inputs, explains explicit queuing, and avoids provider guarantees'
);
