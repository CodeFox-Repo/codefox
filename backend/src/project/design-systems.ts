/**
 * Design systems for the html kind.
 *
 * A generated page with no style direction lands on the same dark Tailwind
 * default every time — the agent has nothing to anchor to, so it invents a
 * look per project and none of them feel deliberate. Picking a system at
 * creation gives it one.
 *
 * The token contract (names, layers, what each level is for) is borrowed
 * from nexu-io/open-design (Apache-2.0), whose 150+ systems all bind the
 * same variable set. These eight are the widest spread of that set; the
 * values are theirs. Adding one more is a row in this table — the tokens
 * ship inside the scaffolded page, so no schema, no migration, no new
 * column.
 */
import { Field, ObjectType } from '@nestjs/graphql';

export interface DesignSystem {
  /** Stable id, stored nowhere — it only selects a row at scaffold time. */
  id: string;
  /** Shown in the composer's Style picker. */
  name: string;
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
  @Field() blurb: string;
  /** The canvas swatch, so the picker shows the style instead of naming it. */
  @Field() bg: string;
  @Field() fg: string;
  @Field() accent: string;
}

/** Pull one declared value out of a system's token block. */
const token = (system: DesignSystem, name: string): string =>
  system.tokens.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1]?.trim() ?? '';

export const designSystemChoices = (): DesignSystemChoice[] =>
  DESIGN_SYSTEMS.map((s) => ({
    id: s.id,
    name: s.name,
    blurb: s.blurb,
    bg: token(s, 'bg'),
    fg: token(s, 'fg'),
    accent: token(s, 'accent'),
  }));

/**
 * Every system binds this same set, so a page written against the variables
 * survives a restyle. Only the values below differ.
 */
export const DESIGN_SYSTEMS: DesignSystem[] = [
  {
    id: 'editorial',
    name: 'Editorial',
    blurb: 'Warm paper, serif headlines, magazine pacing',
    tokens: `  --bg: #fbf7f0;
  --surface: #fffdf8;
  --surface-warm: #f1e6d6;
  --fg: #1f1a16;
  --fg-2: #4b4038;
  --muted: #7d7168;
  --meta: #9a5a2f;
  --border: #ded3c5;
  --border-soft: #eee5da;
  --accent: #9a5a2f;
  --accent-on: #ffffff;
  --success: #4f8a4f;
  --warn: #c9822f;
  --danger: #b33a3a;
  --font-display: Georgia, "Times New Roman", serif;
  --font-body: "Source Serif Pro", Georgia, serif;
  --font-mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
  --text-base: 18px;
  --text-lg: 21px;
  --text-xl: 30px;
  --text-2xl: 44px;
  --text-3xl: 66px;
  --text-4xl: 92px;
  --leading-body: 1.65;
  --leading-tight: 1;
  --tracking-display: -0.02em;
  --section-y: 112px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --elev-raised: 0 20px 50px rgba(31, 26, 22, 0.12);
  --focus-ring: 0 0 0 4px rgba(154, 90, 47, 0.24);
  --ease-standard: cubic-bezier(0.22, 1, 0.36, 1);
  --container-max: 1120px;`,
  },
  {
    id: 'product',
    name: 'Product',
    blurb: 'Near-black canvas, indigo accent, tight product-app rhythm',
    tokens: `  --bg: #08090a;
  --surface: #191a1b;
  --surface-warm: #191a1b;
  --fg: #f7f8f8;
  --fg-2: #d0d6e0;
  --muted: #8a8f98;
  --meta: #62666d;
  --border: rgba(255, 255, 255, 0.08);
  --border-soft: rgba(255, 255, 255, 0.05);
  --accent: #5e6ad2;
  --accent-on: #ffffff;
  --success: #27a644;
  --warn: #eab308;
  --danger: #dc2626;
  --font-display: "Inter", -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
  --font-body: "Inter", -apple-system, system-ui, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 24px;
  --text-2xl: 32px;
  --text-3xl: 48px;
  --text-4xl: 72px;
  --leading-body: 1.5;
  --leading-tight: 1;
  --tracking-display: -0.022em;
  --section-y: 80px;
  --radius-sm: 6px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --elev-raised: 0 8px 24px rgba(0, 0, 0, 0.5);
  --focus-ring: 0 0 0 3px rgba(94, 106, 210, 0.45);
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --container-max: 1200px;`,
  },
  {
    id: 'minimal',
    name: 'Minimal',
    blurb: 'White, black, one hairline — nothing decorative',
    tokens: `  --bg: #ffffff;
  --surface: #fafafa;
  --surface-warm: #f5f5f5;
  --fg: #111111;
  --fg-2: #3a3a3a;
  --muted: #777777;
  --meta: #111111;
  --border: #e2e2e2;
  --border-soft: #eeeeee;
  --accent: #111111;
  --accent-on: #ffffff;
  --success: #168a46;
  --warn: #b7791f;
  --danger: #c53030;
  --font-display: Inter, system-ui, sans-serif;
  --font-body: Inter, system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 22px;
  --text-2xl: 32px;
  --text-3xl: 48px;
  --text-4xl: 68px;
  --leading-body: 1.6;
  --leading-tight: 1.05;
  --tracking-display: -0.02em;
  --section-y: 96px;
  --radius-sm: 2px;
  --radius-md: 4px;
  --radius-lg: 8px;
  --elev-raised: 0 1px 2px rgba(0, 0, 0, 0.06);
  --focus-ring: 0 0 0 3px rgba(17, 17, 17, 0.2);
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --container-max: 1080px;`,
  },
  {
    id: 'brutalist',
    name: 'Brutalist',
    blurb: 'Hard black rules, loud yellow, zero radius',
    tokens: `  --bg: #f5f1e8;
  --surface: #ffffff;
  --surface-warm: #ffef5a;
  --fg: #000000;
  --fg-2: #222222;
  --muted: #555555;
  --meta: #000000;
  --border: #000000;
  --border-soft: #000000;
  --accent: #ffef5a;
  --accent-on: #000000;
  --success: #00b050;
  --warn: #ff8c00;
  --danger: #ff2b2b;
  --font-display: "Arial Black", Impact, sans-serif;
  --font-body: Arial, Helvetica, sans-serif;
  --font-mono: "Courier New", ui-monospace, monospace;
  --text-base: 17px;
  --text-lg: 20px;
  --text-xl: 28px;
  --text-2xl: 42px;
  --text-3xl: 64px;
  --text-4xl: 88px;
  --leading-body: 1.35;
  --leading-tight: 0.98;
  --tracking-display: 0;
  --section-y: 88px;
  --radius-sm: 0px;
  --radius-md: 0px;
  --radius-lg: 0px;
  --elev-raised: 8px 8px 0 #000000;
  --focus-ring: 0 0 0 4px #000000, 0 0 0 8px #ffef5a;
  --ease-standard: steps(2, end);
  --container-max: 1160px;`,
  },
  {
    id: 'luxury',
    name: 'Luxury',
    blurb: 'Black lacquer, champagne gold, spacious',
    tokens: `  --bg: #080706;
  --surface: #151310;
  --surface-warm: #241e14;
  --fg: #fff8ea;
  --fg-2: #d8cdb7;
  --muted: #9f927c;
  --meta: #c6a15b;
  --border: #3a3020;
  --border-soft: #282217;
  --accent: #c6a15b;
  --accent-on: #080706;
  --success: #5fa36a;
  --warn: #d8a94f;
  --danger: #d85a52;
  --font-display: "Didot", "Bodoni 72", Georgia, serif;
  --font-body: "Avenir Next", Inter, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;
  --text-base: 16px;
  --text-lg: 19px;
  --text-xl: 28px;
  --text-2xl: 44px;
  --text-3xl: 68px;
  --text-4xl: 96px;
  --leading-body: 1.6;
  --leading-tight: 0.98;
  --tracking-display: -0.015em;
  --section-y: 120px;
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 24px;
  --elev-raised: 0 30px 90px rgba(0, 0, 0, 0.52);
  --focus-ring: 0 0 0 4px rgba(198, 161, 91, 0.3);
  --ease-standard: cubic-bezier(0.16, 1, 0.3, 1);
  --container-max: 1160px;`,
  },
  {
    id: 'neon',
    name: 'Neon',
    blurb: 'Dark violet night, glowing accent, high energy',
    tokens: `  --bg: #070711;
  --surface: #111126;
  --surface-warm: #1e1540;
  --fg: #f8f7ff;
  --fg-2: #d6ccff;
  --muted: #9d8ad4;
  --meta: #c084fc;
  --border: #34265e;
  --border-soft: #241c42;
  --accent: #c084fc;
  --accent-on: #13051f;
  --success: #39ff88;
  --warn: #fff34d;
  --danger: #ff4d8d;
  --font-display: Inter, system-ui, sans-serif;
  --font-body: Inter, system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 24px;
  --text-2xl: 36px;
  --text-3xl: 54px;
  --text-4xl: 76px;
  --leading-body: 1.52;
  --leading-tight: 1.06;
  --tracking-display: -0.025em;
  --section-y: 96px;
  --radius-sm: 10px;
  --radius-md: 16px;
  --radius-lg: 24px;
  --elev-raised: 0 24px 80px rgba(192, 132, 252, 0.22);
  --focus-ring: 0 0 0 4px rgba(192, 132, 252, 0.32);
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --container-max: 1180px;`,
  },
  {
    id: 'glass',
    name: 'Glass',
    blurb: 'Frosted panels on a cool blue wash, deep radii',
    tokens: `  --bg: #eef6ff;
  --surface: rgba(255, 255, 255, 0.74);
  --surface-warm: rgba(238, 246, 255, 0.72);
  --fg: #102033;
  --fg-2: #34465f;
  --muted: #60708a;
  --meta: #4f8cff;
  --border: rgba(255, 255, 255, 0.64);
  --border-soft: rgba(255, 255, 255, 0.38);
  --accent: #4f8cff;
  --accent-on: #ffffff;
  --success: #22c55e;
  --warn: #f59e0b;
  --danger: #ef4444;
  --font-display: Inter, system-ui, sans-serif;
  --font-body: Inter, system-ui, sans-serif;
  --font-mono: ui-monospace, "SF Mono", Menlo, monospace;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 24px;
  --text-2xl: 36px;
  --text-3xl: 54px;
  --text-4xl: 76px;
  --leading-body: 1.55;
  --leading-tight: 1.04;
  --tracking-display: -0.025em;
  --section-y: 104px;
  --radius-sm: 16px;
  --radius-md: 24px;
  --radius-lg: 36px;
  --elev-raised: 0 24px 80px rgba(79, 140, 255, 0.18);
  --focus-ring: 0 0 0 4px rgba(79, 140, 255, 0.28);
  --ease-standard: cubic-bezier(0.22, 1, 0.36, 1);
  --container-max: 1180px;`,
  },
  {
    id: 'retro',
    name: 'Retro',
    blurb: 'Sun-faded cream, chunky terracotta, typewriter display',
    tokens: `  --bg: #fff4cf;
  --surface: #fffaf0;
  --surface-warm: #ffdca8;
  --fg: #2a1810;
  --fg-2: #593625;
  --muted: #8a6652;
  --meta: #d24b1f;
  --border: #d9aa7a;
  --border-soft: #efd0ab;
  --accent: #d24b1f;
  --accent-on: #ffffff;
  --success: #3d8f4f;
  --warn: #f2a93b;
  --danger: #b83a2f;
  --font-display: "Courier New", ui-monospace, monospace;
  --font-body: Inter, system-ui, sans-serif;
  --font-mono: "Courier New", ui-monospace, monospace;
  --text-base: 16px;
  --text-lg: 18px;
  --text-xl: 24px;
  --text-2xl: 36px;
  --text-3xl: 54px;
  --text-4xl: 76px;
  --leading-body: 1.52;
  --leading-tight: 1.06;
  --tracking-display: 0;
  --section-y: 96px;
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --elev-raised: 6px 6px 0 rgba(42, 24, 16, 0.26);
  --focus-ring: 0 0 0 4px rgba(210, 75, 31, 0.28);
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --container-max: 1180px;`,
  },
];

/**
 * Resolve a requested style id. An unknown or missing id lands on Editorial
 * rather than on nothing — a page with no tokens is the styleless default
 * this feature exists to avoid.
 */
export function designSystem(id?: string | null): DesignSystem {
  return DESIGN_SYSTEMS.find((s) => s.id === id) ?? DESIGN_SYSTEMS[0];
}
