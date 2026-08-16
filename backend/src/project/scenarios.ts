import { Field, ObjectType } from '@nestjs/graphql';

/**
 * What the user is making, as guidance appended to the agent's instructions.
 *
 * "Page or Next.js app" asks which toolchain; nobody arrives wanting a
 * toolchain. They arrive wanting a landing page, a dashboard, a deck. The
 * scenario is that answer — it picks the workspace kind AND tells the agent
 * what shape the thing has, so a deck gets slides and a dashboard gets KPI
 * cards instead of every project being a centered hero.
 *
 * Layout guidance adapted from nexu-io/open-design's design-templates
 * (Apache-2.0), rewritten against codefox's contract: tokens come from the
 * page's own `:root` block, and the agent edits files rather than emitting
 * `<artifact>` tags.
 *
 * ponytail: the guidance lives in this table and is appended to the prompt at
 * turn time — no DB column, no migration, no DB_SYNCHRONIZE deploy dance.
 * Which scenario a project is stays where the user's answer already lands:
 * in the files the agent writes.
 */
/** What the picker needs. Guidance stays server-side — it is prompt text. */
@ObjectType()
export class ScenarioChoice {
  @Field() id: string;
  @Field() name: string;
  @Field() blurb: string;
}

export interface Scenario {
  /** Stable id, sent by the composer. */
  id: string;
  /** Shown in the "what are you making" picker. */
  name: string;
  /** One line under the name. */
  blurb: string;
  /** Workspace kind this scenario scaffolds. */
  template: 'html' | 'next';
  /** Appended to the agent's instructions for this project. */
  guidance: string;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'landing',
    name: 'Landing page',
    blurb: 'One page that sells one thing',
    template: 'html',
    guidance: `You are building a landing page — one page, one product, one call to action.

A visitor arriving cold must learn, in the first screen, what this is, who
it is for, and what to do next. Everything after that earns attention by
being specific: named customers, real numbers, the actual thing rather than
an adjective about it. One action leads; the rest give way to it.

This kind of page fails by being generic — a slogan nobody would disagree
with, three interchangeable feature cards, no evidence anyone uses it. If a
sentence would survive being moved to a competitor's site unchanged, it is
filler.

Write real copy from the brief — a real product name, a real benefit
sentence. "Feature One / Lorem ipsum" is a failure, not a placeholder.
Headlines use var(--font-display) at var(--text-3xl) or larger; body copy
uses var(--font-body). Cap the accent at two visible uses: the primary CTA
and one more. Everything else is var(--fg) and var(--muted).`,
  },
  {
    id: 'dashboard',
    name: 'Dashboard',
    blurb: 'Sidebar, KPIs, charts — an admin screen',
    template: 'html',
    guidance: `You are building a single-screen dashboard.

Someone opens this to answer a question about how things are going, so the
data has to be dense enough to be worth reading and shaped so the rows that
need a human stand out from the ones that do not. Summary figures are
computed from the rows on screen, and recompute when a filter changes.

This kind of screen fails by being a poster: six cards with round numbers
and nothing to interrogate. Filters that do not filter, a total that
disagrees with the table beneath it, and a chart whose axis does not match
its legend all destroy trust in everything else on the page, then a
secondary chart or a table of recent rows.

Decide what it monitors from the brief and generate specific, plausible
metric names and numbers — never "Metric A". Charts are inline SVG, no
libraries: a line chart is a <polyline> with a soft area fill, a bar chart
is a row of <rect>s. CSS Grid for the page, Flexbox inside cards. Sidebar
and top bar stay put while main scrolls. Accent at most twice — the active
nav item and one chart highlight.`,
  },
  {
    id: 'deck',
    name: 'Slide deck',
    blurb: 'Slides you arrow through, in one page',
    template: 'html',
    guidance: `You are building a slide deck as one HTML file.

A deck is read from across a room and driven without looking down, so a
slide carries one idea at a size that survives a projector. The arc matters
more than any single slide: something to open on, a case developed in
order, something to leave them with.

This fails when a slide is a document — a paragraph nobody at the back can
read, three points competing for the same moment, or a deck that ends
without saying what to do.

Every slide is a <section class="slide"> sized to the viewport, carrying
exactly one theme class: light, dark, hero light, or hero dark. Alternate
them — three of the same theme in a row is visual fatigue. Give each a
data-screen-label like "01 Cover" so slides can be referenced.

Arrow keys, Page Up/Down and clicking move between slides; use
scrollTo({ left, top, behavior: 'smooth' }) on the scroller, never
scrollIntoView — it yanks the page when the deck sits inside a preview frame.

A slide holds one idea: a headline at var(--text-3xl) or larger, and at most
three supporting lines or one chart. A cover slide, then content, then a
closing slide. Write real content from the brief — a deck of section titles
with no substance is not a deck.`,
  },
  {
    id: 'email',
    name: 'Email',
    blurb: 'A newsletter or launch email',
    template: 'html',
    guidance: `You are building an HTML email — a single centered column,
600-680px wide, sitting on a tinted page background so the body reads as an
email rather than a web page.

Someone reads this in a mail client on a phone, often with images off. The
message has to survive that: the essential facts as live text, one clear
action, and a reason to care in the first two lines. Everything else is
supporting detail.

This fails by being a web page in an email's clothing — a layout that
collapses in Outlook, a CTA that is only clickable on the text, or critical
information baked into an image nobody loads.

Email clients are not browsers: use tables or simple stacked divs, inline
the critical styles, and avoid flex/grid for the outer structure. No
JavaScript — it is stripped. One big idea and one CTA; a second CTA halves
the first one's click rate.`,
  },
  {
    id: 'docs',
    name: 'Docs page',
    blurb: 'Nav, article, table of contents',
    template: 'html',
    guidance: `You are building a documentation page — three columns.

A developer arrives with a specific question and wants to leave with an
answer. So: real API names, runnable examples with plausible values, and the
errors they will actually hit. Structure exists to let them find their
question fast, not to look organised.

This fails by being a table of contents with nothing under it, or by being
prose about the product rather than instructions for using it. Examples that
would not run are worse than no examples.

Pick a real topic from the brief and write real documentation: concrete API
names, runnable command examples, plausible parameters and return values.
Prose uses var(--font-body) at a comfortable measure; code uses
var(--font-mono) on a var(--surface) background. Callouts earn colour —
notes muted, warnings amber — and the accent is otherwise reserved for the
current nav item and inline links.`,
  },
  {
    id: 'portfolio',
    name: 'Portfolio',
    blurb: 'Your work, your name, one page',
    template: 'html',
    guidance: `You are building a portfolio — the work is the content, and
everything else gets out of its way.

The work is the argument, so each piece needs enough context to be
understood — what it was, what the person did, when — and enough visual
weight to be looked at. A visitor should finish knowing what kind of
problems this person is good at.

This fails when the pieces are interchangeable: same size, same treatment,
no dates, no client names, a role described as "designer" with nothing
about what changed.

The visual for each piece is an inline SVG composition or a tinted panel
built from the token palette — never a stock photo url, which will 404 and
make a portfolio look abandoned. Vary the blocks: a full-bleed first piece
then a two-column pair reads as considered; six identical cards reads as a
template. Case-study depth beats quantity, so if the brief only supports
three pieces, build three good ones.

Accent stays on the name and one link. Everything else is var(--fg) and
var(--muted) — a portfolio competing with its own work is the failure mode.`,
  },
  {
    id: 'resume',
    name: 'Résumé',
    blurb: 'One page, prints clean',
    template: 'html',
    guidance: `You are building a résumé that reads on screen and survives
being printed.

A recruiter skims this in twenty seconds and may print it. So the hierarchy
has to carry them — name, current role, then achievements stated as what
changed, with numbers where numbers exist. Dates align down the page so the
timeline reads at a glance, and skills are grouped meaningfully rather than
sprayed as a keyword wall.

This fails by listing duties instead of outcomes, by burying the strongest
thing below the fold, or by looking correct on screen and breaking apart
when printed.

Print is a real target: add @media print that sets a white background, black
text, hides any nav, and avoids page-break-inside on an entry. Test the
assumption that the reader skims — dates and titles carry the scanning load,
so keep them structurally consistent down the page.

Never invent a metric the brief did not supply. "Reduced build time" with no
number is honest; "reduced build time by 47%" that nobody said is a lie the
candidate has to defend in an interview.`,
  },
  {
    id: 'event',
    name: 'Event page',
    blurb: 'Date, place, speakers, register',
    template: 'html',
    guidance: `You are building a page for one event — a conference, a
meetup, a launch. The job is answering what/when/where before anything else.

Someone is deciding whether to go, so what, when and where come before
anything persuasive — as their own prominent facts, not sentences to parse.
After that: who is speaking, what happens when, and how to get there.

This fails when the date is inside a paragraph, when the schedule is prose
rather than a scannable list, or when registering takes more than one
obvious step.

Use <time datetime="..."> for the date and every schedule row — this is the
one page type where a machine-readable date genuinely matters, and it costs
one attribute.

If the brief leaves the date, city or price unstated, write a clear
placeholder line the organiser will obviously replace ("Tickets — TBA"). An
invented date on an event page is the error that actually strands someone at
a door.`,
  },
  {
    id: 'local',
    name: 'Local business',
    blurb: 'Hours, menu, where to find you',
    template: 'html',
    guidance: `You are building a page for a real place — a café,
restaurant, studio, shop. Someone is on a phone deciding whether to walk
over, so the practical facts come first.

Someone on a phone is deciding whether to walk over. Hours, address, and a
tappable phone number come first, then what the place actually offers, with
real prices. Atmosphere matters but earns its place after the practical
facts.

This fails by putting a mood photograph and a paragraph of story above the
opening hours, or by listing an address that is not a link and a phone
number that does not dial.

Design for the phone first: single column, generous tap targets, no
horizontal scroll at 360px. A menu that needs pinch-zoom is the commonest
failure of this page type.

Every phone number is a <a href="tel:">, every address links to a maps
search. Do not invent hours, prices or an address the brief did not give —
write the placeholder instead. Those three facts are the entire reason
someone opened the page.`,
  },
  {
    id: 'compare',
    name: 'Comparison',
    blurb: 'Options side by side, with a verdict',
    template: 'html',
    guidance: `You are building a comparison — plans, products or
approaches, laid out so a reader can decide.

A reader is choosing, so the page has to make differences visible rather
than list features twice. Same criteria in the same order for every option,
the ones that actually differ made obvious, and a recommendation for who
each suits.

This fails when every option looks equally good — a matrix of ticks with no
weighting, no statement of who should pick what, and no acknowledgement of
what each gives up.

This is one of the few places a <table> is correct — it is tabular data, not
layout. Give it <thead>, scope="col" on headers, and let it scroll
horizontally inside a wrapper on narrow screens rather than reflowing into
unreadable stacks.

Use ✓ and — as plain text cell values, not emoji or icon fonts. Comparisons
live or die on being read as fair: differentiating cells get the accent,
everything else stays neutral, and no option gets flattering copy the others
do not.`,
  },
  {
    id: 'app',
    name: 'Web app',
    blurb: 'Next.js starter with a dev server',
    template: 'next',
    guidance: `You are building a full-stack web app on the Next.js starter —
App Router, Server Components by default, interactivity in client components.

Build the UI with the shadcn components that are already in the project:
@/components/ui (button, card, dialog, select, tabs, table, form, chart —
the full set). Never hand-roll a primitive that exists there, and never
reach for a CDN or a new dependency: every package they need is already
installed. Style with Tailwind and the tokens in globals.css. A page of raw
<div>s with utility classes is the failure mode — composed, quiet,
consistent components are the goal.

Never run npm ci or npm install: node_modules is shared with every other
project, and either command can wipe or poison it for all of them.
Everything you need is already there — if you think you need a package,
build without it.

The app has a real database: \`import { getDb } from '@/lib/db'\` gives a
better-sqlite3 handle on a file inside the project (data/app.db, WAL on). It
needs no setup — call it and query. There are no migrations: create tables
with CREATE TABLE IF NOT EXISTS from a small ensureSchema() you call at the
top of the handlers that need them.

Reads and writes that change state belong in Route Handlers
(app/api/<thing>/route.ts); pages read through the same helper directly when
the data is read-only. Seed a few believable rows on first use — an app that
opens empty reads as broken, not as new.

This database is for building and testing the app: it persists across dev
server restarts, and it is not a production store. Keep the schema simple.`,
  },
];

/**
 * Resolve a scenario id. Unknown or missing lands on the landing page, which
 * is both the commonest answer and the safest thing to build from a vague
 * brief.
 */
/**
 * How a project remembers what it is: a meta tag in its own index.html.
 * Written by the scaffold, read back on every turn — the two live in
 * different modules, so both use these rather than their own copy.
 */
export const scenarioMeta = (id: string): string =>
  `<meta name="codefox-scenario" content="${id}" />`;

export const SCENARIO_META_RE = /name="codefox-scenario"\s+content="([\w-]+)"/;

/** The scenario a page declares, or null for one scaffolded before this. */
export function scenarioOfPage(html?: string | null): string | null {
  return html?.match(SCENARIO_META_RE)?.[1] ?? null;
}

/**
 * No default: an unpicked or unrecognised scenario means the user's own
 * words carry the shape. Falling back to SCENARIOS[0] injected the landing
 * guidance into every unpicked project — a collaborative editor built on
 * this default came out as a marketing page with a hero and a logo strip.
 */
export function scenario(id?: string | null): Scenario | undefined {
  return SCENARIOS.find((s) => s.id === id);
}

export const scenarioChoices = (): ScenarioChoice[] =>
  SCENARIOS.map(({ id, name, blurb }) => ({ id, name, blurb }));
