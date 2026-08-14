import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * A project whose scaffold failed must never look like a finished build.
 *
 * The old path: `createProjectInBackground` caught a scaffold failure, logged
 * it, left `projectPath = ''` and bound the chat anyway — on the reasoning
 * that "the chat still works, the agent just has no files". It does not.
 * `ChatController` reads `''` as falsy, which is indistinguishable from "this
 * chat has no project at all", and routes the turn to `pipePlainCompletion`:
 * a bare model with no tools and no working directory. The user got a
 * confident "I've built your landing page…" about files nothing had touched,
 * an empty file tree, and no error anywhere but one server log line. The
 * frontend readiness gate only checks that `project` is non-null, so it
 * happily fired the first turn. Retrying never recovered — `projectPath`
 * stayed empty for the life of the project.
 *
 * Two halves, both pinned here: the failure must not be bound as a live
 * project, and an empty path must be an error rather than a silent downgrade.
 */
const service = readFileSync('backend/src/project/project.service.ts', 'utf8');
const controller = readFileSync('backend/src/chat/chat.controller.ts', 'utf8');

// --- half one: a failed scaffold does not become a live project ---
const background = service.slice(
  service.indexOf('createProjectInBackground'),
  service.indexOf('async deleteProject')
);
assert.ok(background, 'cannot find createProjectInBackground');

const scaffoldCatch = background.match(
  /catch \(error\) \{[\s\S]*?Failed to scaffold project[\s\S]*?\n      \}/
);
assert.ok(scaffoldCatch, 'the scaffold failure is no longer caught here');

assert.match(
  scaffoldCatch[0],
  /\breturn;/,
  'a failed scaffold falls through to bindProjectAndChat again — that binds a ' +
    'project with no directory, which ChatController then serves as a plain ' +
    'completion pretending to be a build'
);
assert.match(
  scaffoldCatch[0],
  /isDeleted = true/,
  'the unscaffolded project row is left live; nothing will ever give it files'
);

// The bind must genuinely be after the catch, not reordered above it.
assert.ok(
  background.indexOf('Failed to scaffold project') <
    background.indexOf('bindProjectAndChat'),
  'the bind moved ahead of the scaffold guard'
);

// --- half two: an empty path is an error, not a downgrade ---
const chat = controller.slice(
  controller.indexOf('async chat('),
  controller.indexOf('private async pipeAgent')
);
assert.ok(chat, 'cannot find the chat() handler');

const guardAt = chat.indexOf('project && !projectPath');
assert.ok(
  guardAt !== -1,
  'ChatController no longer separates "project with no directory" from "no ' +
    'project" — a failed scaffold silently gets a toolless completion again'
);
assert.ok(
  guardAt < chat.indexOf('pipePlainCompletion'),
  'the empty-path guard runs after the plain-completion fallback has claimed it'
);
// It has to reach the user, not just the log: the client parses ndjson.
const guard = chat.slice(guardAt, chat.indexOf('pipePlainCompletion'));
assert.match(
  guard,
  /t: 'error'/,
  'the failed-scaffold case no longer reports an error frame the UI can show'
);

console.log('ok — a failed scaffold says so instead of faking a build');
