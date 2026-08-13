/**
 * Regenerate backend/src/project/design-systems.ts from an open-design checkout.
 *
 * Run when open-design ships new systems:
 *   node scripts/import-design-systems.mjs /path/to/open-design
 *
 * Every system there binds the same token contract as codefox's page starter
 * except for one name: open-design publishes a responsive `--section-y-*`
 * trio, and the starter reads a single `--section-y`. The desktop value is
 * the one the starter means, so it is aliased on the way in and the tablet /
 * phone tiers are carried through untouched for pages that want them.
 *
 * ponytail: writes the table as source rather than reading the CSS at boot —
 * the values never change between deploys, and a generated .ts file needs no
 * loader, no fixture directory in the image, and no failure mode at startup.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ?? '/tmp/open-design';
const source = path.join(root, 'design-systems');
const target = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  '../backend/src/project/design-systems.ts',
);

/** The names the page starter and the restyle endpoint rely on. */
const CONTRACT = [
  'bg', 'surface', 'surface-warm', 'fg', 'fg-2', 'muted', 'meta',
  'border', 'border-soft', 'accent', 'accent-on', 'success', 'warn', 'danger',
  'font-display', 'font-body', 'font-mono',
  'text-base', 'text-lg', 'text-xl', 'text-2xl', 'text-3xl', 'text-4xl',
  'leading-body', 'leading-tight', 'tracking-display', 'section-y',
  'radius-sm', 'radius-md', 'radius-lg',
  'elev-raised', 'focus-ring', 'ease-standard', 'container-max',
];

/**
 * The real `:root` body. Comments come out first: several systems document
 * the contract with a literal ":root { … }" example in their file header,
 * and matching that instead of the declaration block silently loses tokens.
 */
const rootBlock = (css) =>
  css.replace(/\/\*[\s\S]*?\*\//g, '').match(/:root\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';

/** `--name: value;` pairs, last write wins as CSS does. */
function declarations(body) {
  const out = new Map();
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
    out.set(m[1].slice(2), m[2].replace(/\s+/g, ' ').trim());
  }
  return out;
}

/**
 * The one-line description under the H1 in DESIGN.md. Two systems predate
 * that convention (one ships YAML front-matter, one puts the line outside the
 * blockquote), so fall back to the first prose line that is not the category.
 */
function blurbOf(md, name) {
  // One system ships YAML front-matter ahead of its H1; without dropping it
  // the fallback below picks up a `colors:` key as the description.
  const body = md.replace(/^---\n[\s\S]*?\n---\n/, '');
  const head = body.slice(0, 1200);
  // A blockquote description is often hard-wrapped over several lines; join
  // them before taking a sentence, or the blurb ends at the wrap column.
  const quoted = [...head.matchAll(/^>\s*(.+)$/gm)]
    .map((m) => m[1].trim())
    // `Category:` / `Surface:` and friends are metadata, not description.
    .filter((line) => !/^[A-Z][\w -]{0,18}:\s/.test(line))
    .join(' ');
  if (quoted) return tidy(quoted);
  const prose = head
    .split('\n')
    .map((l) => l.trim())
    .find(
      (l) =>
        l &&
        !l.startsWith('#') &&
        !l.startsWith('>') &&
        !l.startsWith('-') &&
        !l.startsWith('---') &&
        !/^\w+:/.test(l),
    );
  return prose ? tidy(prose) : `${name} design system`;
}

/** One sentence, no trailing period — the picker sets its own punctuation. */
function tidy(line) {
  const first = line.replace(/\s+/g, ' ').trim().split(/(?<=\.)\s+/)[0];
  if (first.length <= 96) return first.replace(/[.,;:]$/, '');
  // Cut at the last word boundary that fits: an ellipsis mid-word reads as a
  // bug in the picker, and these are the one line a user judges a style by.
  const clipped = first.slice(0, 95);
  const cut = clipped.lastIndexOf(' ');
  return `${(cut > 40 ? clipped.slice(0, cut) : clipped).replace(/[.,;:]$/, '')}…`;
}

const escape = (s) => s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${');

/**
 * codefox's own systems, kept across regenerations.
 *
 * The original eight were copied from open-design and then edited here. Three
 * (product, brutalist, glass) have no upstream folder at all; three more
 * (minimal, luxury, neon) share an id with upstream but their values have
 * since diverged, so the local edit is the one to keep. The other two
 * (editorial, retro) are still byte-identical upstream and are not listed —
 * they come in with the import like any other system.
 */
const localPath = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  'design-systems.local.json',
);
const locals = fs.existsSync(localPath)
  ? JSON.parse(fs.readFileSync(localPath, 'utf8'))
  : [];
const localIds = new Set(locals.map((s) => s.id));

const systems = [];
const skipped = [];
const held = [];

for (const dir of fs.readdirSync(source).sort()) {
  const full = path.join(source, dir);
  if (dir.startsWith('_') || !fs.statSync(full).isDirectory()) continue;

  const cssPath = path.join(full, 'tokens.css');
  const manifestPath = path.join(full, 'manifest.json');
  if (!fs.existsSync(cssPath) || !fs.existsSync(manifestPath)) {
    skipped.push(`${dir}: no tokens.css or manifest.json`);
    continue;
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  // A local edit wins over its upstream namesake: someone changed those
  // values here on purpose, and a re-import must not quietly undo that.
  if (localIds.has(manifest.id ?? dir)) {
    held.push(manifest.id ?? dir);
    continue;
  }
  const decls = declarations(rootBlock(fs.readFileSync(cssPath, 'utf8')));

  // The single alias this import exists to apply.
  if (!decls.has('section-y') && decls.has('section-y-desktop')) {
    decls.set('section-y', decls.get('section-y-desktop'));
  }

  const missing = CONTRACT.filter((name) => !decls.has(name));
  if (missing.length) {
    skipped.push(`${dir}: missing ${missing.join(', ')}`);
    continue;
  }

  // Contract first so the file reads the same for every system, then whatever
  // else the system binds — the extra tiers are free and some pages want them.
  const ordered = [
    ...CONTRACT,
    ...[...decls.keys()].filter((k) => !CONTRACT.includes(k)),
  ];
  const tokens = ordered
    .map((name) => `  --${name}: ${decls.get(name)};`)
    .join('\n');

  const md = fs.readFileSync(path.join(full, 'DESIGN.md'), 'utf8');
  systems.push({
    id: manifest.id ?? dir,
    name: manifest.name ?? dir,
    category: manifest.category ?? 'Other',
    blurb: blurbOf(md, manifest.name ?? dir),
    tokens,
  });
}

// Locals first: they are the eight the picker opened on before the import,
// and the first row is also what an unknown style id falls back to.
systems.unshift(
  ...locals.map((s) => ({ ...s, category: s.category ?? 'codefox' })),
);

const row = (s) => `  {
    id: '${s.id}',
    name: ${JSON.stringify(s.name)},
    category: ${JSON.stringify(s.category)},
    blurb: ${JSON.stringify(s.blurb)},
    tokens: \`${escape(s.tokens)}\`,
  },`;

const file = `/**
 * Design systems for the html kind.
 *
 * A generated page with no style direction lands on the same dark Tailwind
 * default every time — the agent has nothing to anchor to, so it invents a
 * look per project and none of them feel deliberate. Picking a system at
 * creation gives it one.
 *
 * GENERATED — do not edit this file. Re-run:
 *   node scripts/import-design-systems.mjs /path/to/open-design
 *
 * Values come from nexu-io/open-design (Apache-2.0); the token contract is
 * theirs. The first ${locals.length} rows are codefox's own — they live in
 * scripts/design-systems.local.json and win over any upstream system sharing
 * their id, so a re-import cannot undo a local edit. Adding a system is a row
 * in this table: the tokens ship inside the scaffolded page, so no schema and
 * no migration.
 */
import { Field, ObjectType } from '@nestjs/graphql';

export interface DesignSystem {
  /** Stable id, stored nowhere — it only selects a row at scaffold time. */
  id: string;
  /** Shown in the composer's Style picker. */
  name: string;
  /** Groups the picker; ${new Set(systems.map((s) => s.category)).size} of them across the catalog. */
  category: string;
  /** One line under the name, and the sentence the agent is told. */
  blurb: string;
  /** The :root body — open-design's token contract, one system's values. */
  tokens: string;
}

/**
 * What the picker needs: the tokens stay server-side, so adding a system
 * never ships a second copy of its values to the browser.
 */
@ObjectType()
export class DesignSystemChoice {
  @Field() id: string;
  @Field() name: string;
  @Field() category: string;
  @Field() blurb: string;
  /** The swatch, so the picker shows the style instead of naming it. */
  @Field() bg: string;
  @Field() surface: string;
  @Field() fg: string;
  @Field() accent: string;
}

/**
 * What a restyle did. Not a bare boolean: the interesting cases (the agent
 * restructured the styles, the project is a Next app) need a sentence the UI
 * can show, and none of them are server errors.
 */
@ObjectType()
export class RestyleResult {
  @Field() ok: boolean;
  @Field() message: string;
}

/** Pull one declared value out of a system's token block. */
const token = (system: DesignSystem, name: string): string =>
  system.tokens.match(new RegExp(\`--\${name}:\\\\s*([^;]+);\`))?.[1]?.trim() ?? '';

export const designSystemChoices = (): DesignSystemChoice[] =>
  DESIGN_SYSTEMS.map((s) => ({
    id: s.id,
    name: s.name,
    category: s.category,
    blurb: s.blurb,
    bg: token(s, 'bg'),
    surface: token(s, 'surface'),
    fg: token(s, 'fg'),
    accent: token(s, 'accent'),
  }));

/**
 * Every system binds this same set, so a page written against the variables
 * survives a restyle. Only the values below differ.
 */
export const DESIGN_SYSTEMS: DesignSystem[] = [
${systems.map(row).join('\n')}
];

/**
 * Resolve a requested style id. An unknown or missing id lands on the first
 * system rather than on nothing — a page with no tokens is the styleless
 * default this feature exists to avoid.
 */
export function designSystem(id?: string | null): DesignSystem {
  return DESIGN_SYSTEMS.find((s) => s.id === id) ?? DESIGN_SYSTEMS[0];
}

/**
 * Swap the values in a page's first \`:root\` block for another system's.
 *
 * Only the token block moves — every rule downstream reads \`var(--*)\`, so the
 * page restyles without touching a line of its own markup. Returns null when
 * there is no \`:root\` to replace, which is the honest signal that the agent
 * restructured the styles and the caller should say so rather than guess.
 *
 * Lives here rather than in the controller so it can be tested without
 * dragging in the auth guard's native sqlite binding.
 *
 * ponytail: string replace on the first block, not a CSS parse. The starter
 * writes exactly one \`:root\` and the agent is told to keep it; a page that
 * grew a second one keeps it, which is the conservative outcome.
 */
export function swapTokens(html: string, tokens: string): string | null {
  const match = /:root\\s*\\{[^}]*\\}/.exec(html);
  if (!match) return null;
  // Indent to wherever the block already sits, so the file does not reflow.
  const indent = /(^|\\n)([ \\t]*):root/.exec(html)?.[2] ?? '';
  const body = tokens
    .split('\\n')
    .map((line) => (line.trim() ? \`\${indent}\${line.trim()}\` : line))
    .join('\\n');
  return \`\${html.slice(0, match.index)}:root {\\n\${body}\\n\${indent}}\${html.slice(
    match.index + match[0].length,
  )}\`;
}
`;

fs.writeFileSync(target, file);
console.log(`wrote ${systems.length} systems to ${path.relative(process.cwd(), target)}`);
if (held.length) {
  console.log(
    `kept ${held.length} local edit(s) over upstream: ${held.join(', ')}`,
  );
}
if (skipped.length) {
  console.log(`skipped ${skipped.length}:`);
  for (const s of skipped) console.log(`  ${s}`);
}
