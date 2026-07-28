/**
 * RelationalFlowStrip — Horizontal rhythm diagram.
 *
 * WHAT: Thin visual strip showing Reflection → Participation → Generosity → Collaboration.
 * WHERE: Features page (below Financial Moments) and Pricing page (below payments section).
 * WHY: Communicates that money is one moment in a relational rhythm, not the center.
 */

import { motion } from 'framer-motion';

const stages = [
  {
    label: 'Reflection',
    desc: 'Listening, noticing, and remembering what matters.',
  },
  {
    label: 'Participation',
    desc: 'People showing up to gatherings, retreats, and shared work.',
  },
  {
    label: 'Generosity',
    desc: 'Support offered freely for the mission.',
  },
  {
    label: 'Collaboration',
    desc: 'Organizations helping one another accomplish the work.',
  },
];

export default function RelationalFlowStrip() {
  return (
    <section className="py-16 sm:py-20">
      <div className="max-w-4xl mx-auto px-4 sm:px-6">
        <p
          className="text-center text-sm font-semibold uppercase tracking-widest text-[hsl(var(--marketing-navy)/0.45)] mb-10"
        >
          The Rhythm of Relational Work
        </p>

        {/* Flow nodes */}
        <div className="flex items-start justify-between gap-2 sm:gap-4 overflow-x-auto pb-4">
          {stages.map((stage, i) => (
            <motion.div
              key={stage.label}
              className="flex flex-col items-center flex-1 min-w-[70px] relative"
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
            >
              {/* Connector line (except first) */}
              {i > 0 && (
                <div
                  className="absolute top-[18px] right-1/2 w-full h-[1px] bg-[hsl(var(--marketing-navy)/0.1)] -z-10"
                  style={{ transform: 'translateX(-50%)' }}
                />
              )}

              {/* Node */}
              <div className="w-9 h-9 rounded-full border border-[hsl(var(--marketing-navy)/0.15)] flex items-center justify-center mb-3 bg-white">
                <div className="w-2.5 h-2.5 rounded-full bg-[hsl(var(--marketing-navy)/0.2)]" />
              </div>

              {/* Label */}
              <p className="text-sm font-semibold text-[hsl(var(--marketing-navy)/0.8)] mb-1 text-center">
                {stage.label}
              </p>
              <p
                className="text-xs text-[hsl(var(--marketing-navy)/0.55)] leading-snug text-center max-w-[150px]"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
              >
                {stage.desc}
              </p>
            </motion.div>
          ))}
        </div>


        {/* Microcopy */}
        <p
          className="text-center text-sm text-[hsl(var(--marketing-navy)/0.55)] mt-8 italic"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          CROS simply helps you remember the thread.
        </p>

        {/* Verso l'alto */}
        <motion.div
          className="text-center mt-8"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8, duration: 1 }}
        >
          <div className="inline-flex flex-col items-center gap-1.5">
            <svg
              width="16"
              height="20"
              viewBox="0 0 16 20"
              fill="none"
              className="text-[hsl(var(--marketing-navy)/0.2)]"
            >
              <path
                d="M8 18V2M8 2L2 8M8 2L14 8"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span
              className="text-xs tracking-wider text-[hsl(var(--marketing-navy)/0.3)] italic"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              Verso l'alto
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
