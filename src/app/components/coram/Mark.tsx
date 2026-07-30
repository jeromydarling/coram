/**
 * The mark: eight people around a table.
 *
 * The same drawing the marketing site uses, redrawn here because the site's
 * lives in a Hono JSX module the SPA does not import. Kept in sync by
 * Mark.test.tsx, which counts the people — an eight-person table that quietly
 * became seven would be the sort of thing nobody notices for a year.
 */

const SEATS = 8;

export function Mark({ size = 22, className }: { size?: number; className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Coram"
    >
      <circle
        cx="50"
        cy="50"
        r="20"
        fill="none"
        stroke="hsl(var(--gold))"
        strokeWidth="6"
        vectorEffect="non-scaling-stroke"
      />
      {Array.from({ length: SEATS }, (_, i) => {
        const a = (i / SEATS) * Math.PI * 2 - Math.PI / 2;
        return (
          <circle
            key={i}
            data-seat
            cx={50 + Math.cos(a) * 36}
            cy={50 + Math.sin(a) * 36}
            r="7.5"
            fill="currentColor"
          />
        );
      })}
    </svg>
  );
}
