/**
 * A line drawing of a bicycle, used as a faint background. Purely decorative, so it is
 * hidden from screen readers. It draws in `currentColor`, so the colour and the
 * opacity come from the Tailwind text classes where it is used.
 */
export function BikeSketch({ className = "" }: { className?: string }) {
  // Spokes: lines from each hub out to its rim, evenly spaced.
  const spokes = (cx: number, cy: number, r: number, n = 10) =>
    Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2 + 0.2;
      return (
        <line
          key={`${cx}-${i}`}
          x1={cx + Math.cos(a) * 7}
          y1={cy + Math.sin(a) * 7}
          x2={cx + Math.cos(a) * (r - 3)}
          y2={cy + Math.sin(a) * (r - 3)}
          strokeWidth="1.5"
        />
      );
    });

  return (
    <svg
      viewBox="0 0 400 240"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {/* wheels: two slightly different rings each, so it looks hand-drawn */}
      <circle cx="90" cy="160" r="62" />
      <circle cx="91" cy="159" r="56" strokeWidth="1.5" />
      <circle cx="310" cy="160" r="62" />
      <circle cx="309" cy="161" r="56" strokeWidth="1.5" />
      {spokes(90, 160, 62)}
      {spokes(310, 160, 62)}
      <circle cx="90" cy="160" r="6" />
      <circle cx="310" cy="160" r="6" />

      {/* frame */}
      <path d="M90 160 L190 160" />
      <path d="M90 160 L165 82" />
      <path d="M165 82 L190 160" />
      <path d="M165 82 L282 76" />
      <path d="M190 160 L286 94" />
      <path d="M282 76 L286 94" />
      <path d="M286 94 L310 160" />

      {/* saddle and handlebar */}
      <path d="M165 82 L160 62" />
      <path d="M138 60 Q162 51 192 60" />
      <path d="M282 76 L277 54" />
      <path d="M258 49 Q282 41 304 55" />

      {/* chainring, crank, pedal, chain */}
      <circle cx="190" cy="160" r="17" />
      <circle cx="190" cy="160" r="4" />
      <path d="M190 160 L204 187" />
      <path d="M198 189 L214 185" />
      <path d="M96 151 L176 146" strokeWidth="1.5" />
      <path d="M96 169 L176 175" strokeWidth="1.5" />

      {/* front basket, as on Divvy bikes */}
      <path d="M296 70 L330 66 L326 94 L292 98 Z" strokeWidth="2" />
      <path d="M305 69 L302 96 M316 68 L313 95" strokeWidth="1.5" />
    </svg>
  );
}

/** Just the bike, small and solid, for the logo. */
export function BikeMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <circle cx="11" cy="21" r="8" />
      <circle cx="37" cy="21" r="8" />
      <path d="M11 21 L20 21 L16 10 L33 9 L37 21" />
      <path d="M20 21 L33 9" />
      <path d="M13 8 L19 8" />
      <path d="M31 6 L36 5" />
    </svg>
  );
}

/** Six-pointed star, as on the Chicago flag. */
export function FlagStar({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" focusable="false" className={className}>
      <polygon points="10,1 18.66,16 1.34,16" />
      <polygon points="10,19 1.34,4 18.66,4" />
    </svg>
  );
}
