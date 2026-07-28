/**
 * RelationshipVsTransactionDiagram — Two-philosophy comparison.
 *
 * WHAT: Side-by-side radial diagrams showing CRM (money-centered) vs CROS (relationship-centered).
 * WHERE: Features page, above the Financial Moments section.
 * WHY: Communicates the core CROS philosophy in under five seconds — money is not the center.
 */

const traditionalNodes = ['Donor', 'Campaign', 'Gift Amount', 'Donor Tier', 'Fundraising Goals'];
const crosNodes = ['Reflection', 'Participation', 'Generosity', 'Collaboration', 'Community'];

function RadialDiagram({
  centerLabel,
  nodes,
  accent = false,
}: {
  centerLabel: string;
  nodes: string[];
  accent?: boolean;
}) {
  const cx = 150;
  const cy = 140;
  const radius = 95;

  return (
    <svg
      viewBox="0 0 300 280"
      className="w-full max-w-[320px] mx-auto"
      aria-hidden="true"
    >
      {/* Connecting lines */}
      {nodes.map((_, i) => {
        const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
        const nx = cx + radius * Math.cos(angle);
        const ny = cy + radius * Math.sin(angle);
        return (
          <line
            key={`line-${i}`}
            x1={cx}
            y1={cy}
            x2={nx}
            y2={ny}
            stroke={accent ? 'hsl(209 75% 56% / 0.25)' : 'hsl(220 40% 16% / 0.12)'}
            strokeWidth="1"
          />
        );
      })}

      {/* Center circle */}
      <circle
        cx={cx}
        cy={cy}
        r="32"
        fill="none"
        stroke={accent ? 'hsl(209 75% 56% / 0.4)' : 'hsl(220 40% 16% / 0.18)'}
        strokeWidth="1.5"
      />
      <text
        x={cx}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        className="text-[13px] font-semibold"
        fill={accent ? 'hsl(209 75% 46%)' : 'hsl(220 40% 16% / 0.7)'}
      >
        {centerLabel}
      </text>

      {/* Outer nodes */}
      {nodes.map((label, i) => {
        const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2;
        const nx = cx + radius * Math.cos(angle);
        const ny = cy + radius * Math.sin(angle);
        return (
          <g key={label}>
            <circle
              cx={nx}
              cy={ny}
              r="24"
              fill="none"
              stroke={accent ? 'hsl(209 75% 56% / 0.3)' : 'hsl(220 40% 16% / 0.12)'}
              strokeWidth="1"
            />
            <text
              x={nx}
              y={ny}
              textAnchor="middle"
              dominantBaseline="central"
              className="text-[10px]"
              fill={accent ? 'hsl(220 40% 16% / 0.8)' : 'hsl(220 40% 16% / 0.55)'}
            >
              {label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export default function RelationshipVsTransactionDiagram() {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        {/* Headline */}
        <div className="text-center mb-12">
          <h2
            className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-3"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            Two Ways to Organize a Community
          </h2>
          <p
            className="text-base sm:text-lg text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed max-w-lg mx-auto"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
          >
            Most software organizes people around money.
            <br />
            CROS organizes people around relationships.
          </p>
        </div>

        {/* Side by side */}
        <div className="grid sm:grid-cols-2 gap-8 sm:gap-12">
          {/* Traditional CRM */}
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.45)] mb-6">
              Traditional CRM
            </p>
            <RadialDiagram centerLabel="Donations" nodes={traditionalNodes} />
            <p
              className="mt-4 text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed max-w-[260px] mx-auto italic"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              In most systems, relationships are organized around financial transactions.
            </p>
          </div>

          {/* CROS */}
          <div className="text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--marketing-blue))] mb-6">
              CROS™
            </p>
            <RadialDiagram centerLabel="Relationship" nodes={crosNodes} accent />
            <p
              className="mt-4 text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed max-w-[260px] mx-auto italic"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              In CROS™, generosity is simply one moment in the life of a relationship.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
