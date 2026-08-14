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

Regions, in order: a nav bar (wordmark + 3-4 links + one CTA button); a hero
(eyebrow, headline, one-sentence subhead, primary CTA, and a visual — an
inline SVG or a tinted block, never a stock photo URL); a proof strip (3-6
logos as wordmarks, or a single quote with an attributed name); a features
section (3 cards, each an icon, a short title and two lines of copy); pricing
if the brief implies a paid product; a closing CTA; a small footer.

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

Regions: a left sidebar (220-260px — a brand mark, then 6-8 nav links, the
active one carrying the accent); a top bar (page title left, search and an
avatar right); and a main area holding, in rows: 3-4 KPI cards (label, big
number, delta against the prior period), then one primary chart, then a
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

Layout: a masthead (wordmark left, 2-3 short links right, thin rule under);
a hero block (a 16:9 tinted panel or an inline SVG of the product); a
headline lockup at the largest display size; two short paragraphs of body
copy; one primary CTA button; a specifications or details grid if the brief
implies a product; a footer with an unsubscribe line.

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

Left: a sticky nav 240-280px wide, 3-5 groups of 4-8 links, the current page
bold with an accent stripe on its leading edge. Centre: the article, max-width
around 720px — an H1, a lede paragraph, H2 sections, code blocks, note and
warning callouts, lists. Right: a sticky "On this page" table of contents
200-240px wide listing the H2s.

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

Regions: a masthead (name at display size, one line saying what you do, and
2-4 links — email, GitHub, whichever the brief names); a selected-work
section of 3-6 pieces, each a generous visual block with a title, a one-line
role, a year, and two sentences of what it was; a short about paragraph
written in first person; a contact line that is a real mailto link.

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

One column, max-width around 760px, on a plain background. Regions in order:
a header (name at var(--text-2xl), then role, location, email, and links on
one wrapped line); a two-to-three sentence summary; experience as reverse
chronological entries, each with role, organisation, dates right-aligned,
and 2-4 bullets that state what changed rather than what was assigned;
skills as a compact wrapped list, not a bar chart of invented percentages;
education last.

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

Regions: a hero carrying the event name, a one-line pitch, and the date and
place as their own prominent line (not buried in a paragraph); a primary
register CTA repeated once near the bottom; an agenda or schedule as a
time-and-session list; speakers or hosts as 3-8 blocks with name, role, and
a monogram avatar built from initials; a venue block with the address and
plain travel notes; an FAQ of 3-5 real questions.

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

Regions: a hero with the name, one line of what it is, and the neighbourhood;
hours as a plain day-and-time list, with today's row emphasised if the brief
implies it; the offering — a menu, service list or price list, grouped, with
prices as plain text; a location block with the address, one line of getting
there, and a tel: link that actually dials; two or three lines of story; a
footer repeating address, phone and hours.

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

Regions: a short intro naming what is being compared and for whom; the
comparison itself as a real <table> with the options as columns and the
criteria as rows, marking one column as the common recommendation; a
per-option summary block saying who it suits and what it costs them; a
closing verdict paragraph that actually picks, hedged only where the brief
genuinely leaves it open; an FAQ if the brief supports one.

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
    guidance: '',
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

export function scenario(id?: string | null): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0];
}

export const scenarioChoices = (): ScenarioChoice[] =>
  SCENARIOS.map(({ id, name, blurb }) => ({ id, name, blurb }));
