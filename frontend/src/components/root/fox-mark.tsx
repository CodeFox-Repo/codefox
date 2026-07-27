/**
 * The CodeFox mark. Inline SVG rather than /codefox.svg because an <img> can
 * not inherit `currentColor` — the old asset was a traced bitmap with black
 * baked in, which disappeared on the dark theme.
 *
 * Geometry follows the rest of the brand: straight edges, round joins, one
 * terracotta accent. The ears double as angle brackets.
 */
export function FoxMark({ className = 'h-7 w-7' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      role="img"
      aria-label="CodeFox"
    >
      {/* Head: straight edges tapering to a muzzle, ears cut in as chevrons.
          All-line geometry so it stays legible at 24px in the sidebar rail. */}
      <path
        d="M4.5 3.5 10.5 11h11l6-7.5L28 13 16 28.5 4 13Z"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* eyes */}
      <path
        d="M11 15h2.4M18.6 15h2.4"
        stroke="hsl(var(--primary))"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}
