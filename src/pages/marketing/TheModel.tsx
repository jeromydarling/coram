/**
 * TheModel — Foundational narrative page: Pier Giorgio Frassati.
 *
 * WHAT: Long-form contemplative essay about the life that inspired CROS™.
 * WHERE: /the-model (primary marketing nav).
 * WHY: Establishes the spiritual and relational DNA of the platform.
 */
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import SeoHead from '@/components/seo/SeoHead';
import deskSketch from '@/assets/frassati-desk-sketch.jpg';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

/* ─── Reflection content (static gray box) ─── */
function ReflectionSection() {
  return (
    <section className="max-w-[680px] mx-auto px-4 sm:px-6 pt-8 pb-20">
      <hr className="border-[hsl(var(--marketing-border)/0.4)] mb-10" />
      <div className="rounded-xl bg-[hsl(var(--marketing-navy)/0.03)] border border-[hsl(var(--marketing-navy)/0.08)] p-6 sm:p-8">
        <p
          className="text-sm font-medium text-[hsl(var(--marketing-navy)/0.45)] uppercase tracking-wider mb-4"
          style={{ fontFamily: 'Inter, system-ui, sans-serif' }}
        >
          Reflections on His Life
        </p>
        <h3
          className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] leading-tight mb-6"
          style={serif}
        >
          Love at Scale Requires Structure
        </h3>

        <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.65)] leading-relaxed text-base sm:text-lg" style={serif}>
          <p>Pier Giorgio's life reveals something uncomfortable and practical:</p>
          <p>Love is not accidental.</p>
          <p>Sustained relational care requires discipline.</p>
          <p>He could not hold hundreds of relationships in memory by instinct alone.</p>
          <p>He built a system.</p>
          <p>He followed through.</p>
          <p>He returned when he said he would return.</p>

          <p className="pt-2">Today, organizations are full of people with the same instinct.</p>
          <p>Caregivers.<br />Mentors.<br />Pastoral workers.<br />Case managers.<br />Volunteers.</p>

          <p className="pt-2">But they use tools built for transactions.</p>

          <p>
            They track:<br />
            Appointments. Donations. Compliance. Metrics.
          </p>
          <p>
            They lose:<br />
            Context. Continuity. Story. Memory.
          </p>

          <p className="pt-2">CROS™ exists to close that gap.</p>
          <p className="font-medium text-[hsl(var(--marketing-navy))]">CROS™ is the digital discipline of remembrance.</p>

          <p className="pt-2">It mirrors his notebooks:</p>
          <ul className="space-y-1.5 pl-1">
            <li className="flex items-start gap-2"><span className="text-[hsl(var(--marketing-navy)/0.3)] mt-1">•</span> Journeys instead of cases</li>
            <li className="flex items-start gap-2"><span className="text-[hsl(var(--marketing-navy)/0.3)] mt-1">•</span> Chapters instead of transactions</li>
            <li className="flex items-start gap-2"><span className="text-[hsl(var(--marketing-navy)/0.3)] mt-1">•</span> Reflections instead of activity logs</li>
            <li className="flex items-start gap-2"><span className="text-[hsl(var(--marketing-navy)/0.3)] mt-1">•</span> Follow-through instead of closure</li>
            <li className="flex items-start gap-2"><span className="text-[hsl(var(--marketing-navy)/0.3)] mt-1">•</span> Narrative instead of extraction</li>
          </ul>

          <p className="pt-4">Every person has a thread.</p>
          <p>CROS helps you hold it.</p>
          <p>Across time.<br />Across staff turnover.<br />Across seasons.</p>

          <p className="pt-4">The logic is simple:</p>
          <p className="font-medium text-[hsl(var(--marketing-navy))]">Every person deserves to be remembered.</p>

          <p className="pt-2 italic text-[hsl(var(--marketing-navy))]">Verso l'alto.</p>
        </div>
      </div>
    </section>
  );
}

/* ─── Main page ─── */
export default function TheModel() {
  return (
    <div className="bg-white">
      <SeoHead
        title="The Model | Pier Giorgio Frassati and the Vision Behind CROS™"
        description="The life of Pier Giorgio Frassati — the relational discipline that shaped CROS™ and its commitment to remembering every person."
        canonical="/the-model"
        keywords={['Pier Giorgio Frassati', 'CROS', 'relationship memory', 'Catholic Social Teaching', 'relational care', 'community service']}
      />

      {/* ─── HERO ─── */}
      <header className="max-w-[680px] mx-auto px-4 sm:px-6 pt-20 sm:pt-32 pb-8 text-center">
        <h1
          className="text-4xl sm:text-5xl md:text-6xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.1] tracking-tight mb-5"
          style={serif}
        >
          The Model
        </h1>
        <p
          className="text-lg sm:text-xl text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed mb-3"
          style={serif}
        >
          Pier Giorgio Frassati — The Soul Behind the System
        </p>
        <p
          className="text-base text-[hsl(var(--marketing-navy)/0.45)] italic"
          style={serif}
        >
          CROS™ was not born from a feature roadmap. It was born from a life.
        </p>
      </header>

      {/* ─── PRIMARY IMAGE ─── */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20">
        <img
          src={deskSketch}
          alt="Renaissance ink sketch of a wooden desk with journals, medicine bottles, and handwritten notes illuminated by lantern light"
          className="w-full rounded-xl border border-[hsl(var(--marketing-navy)/0.08)]"
          loading="eager"
        />
      </div>

      {/* ─── PRIMARY CONTENT ─── */}
      <article className="max-w-[680px] mx-auto px-4 sm:px-6 pb-16">
        <div className="space-y-8" style={serif}>
          {/* Section title */}
          <div className="space-y-2 mb-12">
            <p className="text-xs font-medium uppercase tracking-wider text-[hsl(var(--marketing-navy)/0.35)] mb-3" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>The Soul Behind the System</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-[hsl(var(--marketing-navy))] leading-tight" style={serif}>
              He Remembered Everyone
            </h2>
            <p className="text-lg text-[hsl(var(--marketing-navy)/0.5)]" style={serif}>
              The Life of Pier Giorgio Frassati and the Vision That Became CROS™
            </p>
          </div>

          {/* Body paragraphs */}
          <div className="space-y-6 text-[hsl(var(--marketing-navy)/0.65)] leading-[1.85] text-base sm:text-lg">
            <p>When Pier Giorgio Frassati died on July 4, 1925, his family expected a quiet funeral. He was twenty-four years old — the son of one of Italy's most powerful men, a senator and the founder of <em>La Stampa</em>, Turin's great newspaper. The Frassatis were prominent, connected, educated. They assumed grief would be a private affair.</p>

            <p>They were not prepared for what came.</p>

            <p>Thousands of people flooded the streets of Turin. The poor, the sick, the forgotten — widows he had quietly supported, men whose rent he had covered without telling anyone, families who had received medicine and food and firewood and never known where it came from. They came in numbers that astonished even those who loved him most. His sister Luciana would later write that it was only at his funeral that the Frassati family truly learned who their son and brother had been.</p>

            <blockquote className="border-l-2 border-[hsl(var(--marketing-navy)/0.15)] pl-6 my-10 text-[hsl(var(--marketing-navy)/0.5)] italic">
              "Only then, at the sight of hundreds of his poor following the coffin, was it known to everyone, even to his own family, who Pier Giorgio truly was."
            </blockquote>

            <p>He had never told them. That was the point. He was not building a reputation. He was building relationships — one person at a time, tracked in the kind of careful, attentive detail that most people reserve for people who matter. To Pier Giorgio, they all mattered.</p>

            <p>CROS™ was built in his memory. Not as a monument to a saint, but as an answer to a question his life raises for every caregiver, mentor, and servant today: what if we had a system that helped us do what he did by nature — remember everyone, track every relationship, and carry the thread of each person's story forward across time?</p>
          </div>

          {/* A Wealthy Son */}
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] pt-10 leading-tight">
            A Wealthy Son Who Chose the Slums
          </h2>
          <div className="space-y-6 text-[hsl(var(--marketing-navy)/0.65)] leading-[1.85] text-base sm:text-lg">
            <p>Pier Giorgio was born into a world of comfort and consequence. His father Alfredo was a national figure. His mother Adelàide was a respected painter. The family home in Turin was large, their summers spent at an estate in Pollone in the foothills of the Alps. Pier Giorgio had every reason to inhabit the life his family had built for him.</p>

            <p>He chose otherwise — not in rebellion, but in response to something deeper he found in the Eucharist, in the writings of Saint Paul, and in the faces of people on the edges of Turin's streets. At seventeen, he joined the Society of Saint Vincent de Paul and began spending his free hours in the city's poorest neighborhoods. He brought food, medicine, money, furniture. He found housing for evicted families. He paid for medicine for sick strangers. He gave his own coat away in winter. When his father offered him a car upon graduation from university, he asked instead for the equivalent sum in cash — and gave it to the poor.</p>

            <p>What little money he had for himself, he used for bus fare. And when he spent that too on someone in need, he ran home so he wouldn't be late for dinner.</p>

            <blockquote className="border-l-2 border-[hsl(var(--marketing-navy)/0.15)] pl-6 my-10 text-[hsl(var(--marketing-navy)/0.5)] italic">
              "Charity is not enough; we need social reform." — Pier Giorgio Frassati
            </blockquote>

            <p>He was not a grim figure. By every account, he was radiant. His friends called him "an explosion of joy." He loved mountain climbing, swimming, opera, poetry, practical jokes. He organized hiking trips into the Alps and turned them into occasions for prayer and deep conversation. He was studying to be a mining engineer specifically because, as he put it, he wanted "to serve Christ better among the miners." He was anti-Fascist and unafraid to say so publicly, physically defending marchers from police violence on more than one occasion. He was fully, joyfully alive in every dimension of his life.</p>

            <p>And underneath all of it, quiet and hidden: the notebooks.</p>
          </div>

          {/* The Notebooks */}
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] pt-10 leading-tight">
            The Notebooks Nobody Knew About
          </h2>
          <div className="space-y-6 text-[hsl(var(--marketing-navy)/0.65)] leading-[1.85] text-base sm:text-lg">
            <p>Pier Giorgio kept meticulous records of the people he served. Names. Circumstances. What they needed. What he had provided. Who still needed a follow-up visit. What medicine ran out when. Whether a child's shoes had been replaced yet.</p>

            <p>These were not the records of a bureaucrat. They were the records of someone who understood that the deepest form of love is remembrance — the refusal to let a person disappear into a category or a case number. To be remembered by name, to have your particular story held in someone else's mind, is to be seen as a human being. Pier Giorgio's notebooks were an act of profound respect.</p>

            <p>His family did not know the notebooks existed. They did not know about most of what was in them. Even as Pier Giorgio was dying — felled in six days by the polio he almost certainly contracted from the very people he had been visiting in the slums — his final concern was for the names in those notebooks. With a hand already paralyzed by the disease, he scrawled a note to a friend: do not forget the injections for Converso. A man he had been caring for. A man who needed to know someone still remembered him.</p>

            <blockquote className="border-l-2 border-[hsl(var(--marketing-navy)/0.15)] pl-6 my-10 text-[hsl(var(--marketing-navy)/0.5)] italic">
              "With a paralyzed hand, his last written words were a reminder to care for someone else."
            </blockquote>

            <p>He died that evening, July 4, 1925, at seven o'clock, at twenty-four years old. And the poor came, because he had never forgotten them. Not one.</p>
          </div>

          {/* What His Life Asks */}
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] pt-10 leading-tight">
            What His Life Asks of Us
          </h2>
          <div className="space-y-6 text-[hsl(var(--marketing-navy)/0.65)] leading-[1.85] text-base sm:text-lg">
            <p>Pier Giorgio's story is not a parable about heroic sacrifice, though it is certainly that. It is something more practical and more demanding: a model of relational discipline. He showed that love, at scale, requires a system. He could not hold ten thousand relationships in his head by accident. He worked at it. He tracked it. He returned to people he had promised to return to. He followed through.</p>

            <p>The organizations that serve people today — hospitals, nonprofits, parishes, schools, mentoring programs, caregiver networks — are full of people with Pier Giorgio's instincts. They want to remember everyone. They want to carry each person's story forward. They want to follow through on what they said they would do.</p>

            <p>But they are overwhelmed. They use tools built for transactions, not relationships. They track donations and appointments, not the moment when someone's grief shifted, or the conversation that changed a child's trajectory, or the small act of care that kept a family together. The relational texture of their work disappears into spreadsheets and case management software that was never designed to hold it.</p>

            <p>That gap is why CROS™ exists.</p>
          </div>

          {/* CROS Built for the Work */}
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] pt-10 leading-tight">
            CROS™: Built for the Work He Did
          </h2>
          <div className="space-y-6 text-[hsl(var(--marketing-navy)/0.65)] leading-[1.85] text-base sm:text-lg">
            <p>CROS™ — Community Rhythm of Service — is a platform designed for people in relational care roles: caregivers, mentors, volunteers, pastoral workers, social workers, case managers, and anyone whose work is fundamentally about accompanying another human being through time. It is grounded in Catholic Social Teaching and the Ignatian rhythm of action and reflection.</p>

            <p>Its architecture reflects Pier Giorgio's actual practice. A journey, in CROS™, is not a program. It is a relationship — with a beginning, a history, a set of chapters that accumulate meaning over time. Each person you serve has their own journey. You can record what happened. You can note what you observed. You can track what you promised and what remains unfinished. You can come back months later and find the thread exactly where you left it.</p>

            <p>The notebooks Pier Giorgio kept were analog. CROS™ is digital. But the logic is identical: every person deserves to be remembered. Every relationship deserves a record. Every act of service deserves a place in a story that does not end when you close your browser window.</p>

            <blockquote className="border-l-2 border-[hsl(var(--marketing-navy)/0.15)] pl-6 my-10 text-[hsl(var(--marketing-navy)/0.5)] italic">
              "Verso l'alto — To the heights."
              <span className="block text-sm mt-2 not-italic text-[hsl(var(--marketing-navy)/0.35)]">Pier Giorgio's motto, written on his last photograph from the mountains.</span>
            </blockquote>

            <p>He wrote those words — <em>Verso l'alto</em>, to the heights — on a photograph taken during his last mountain climb. It was not a sentiment about ambition. It was a direction of movement: upward, always, in every dimension of life. Toward God. Toward the person in front of you. Toward the fullness of what service can be.</p>

            <p>That is the aspiration behind CROS™. Not to manage relationships, but to honor them. Not to organize the poor, but to remember them. Not to close cases, but to accompany people — the way a twenty-four-year-old with paralyzed hands used his last moments to make sure that Converso would not be forgotten.</p>
          </div>

          {/* A Patron */}
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] pt-10 leading-tight">
            A Patron for the Work
          </h2>
          <div className="space-y-6 text-[hsl(var(--marketing-navy)/0.65)] leading-[1.85] text-base sm:text-lg">
            <p>On September 7, 2025, Pope Leo XIV canonized Pier Giorgio Frassati as a saint of the Catholic Church, a century after his death. He is now the patron of youth, students, mountaineers, and those who serve the poor. His feast day is July 4 — the day he died.</p>

            <p>He was canonized not for the grand gestures but for the quiet ones. For the notebooks. For running home. For the note about Converso. For the thousands who came to his funeral and surprised his family by knowing his name.</p>

            <p>CROS™ is dedicated to that same discipline: the slow, faithful, careful work of remembering people. Of tracking their stories. Of following through. Of treating every relationship as something sacred enough to write down.</p>

            <p className="italic text-[hsl(var(--marketing-navy))] font-medium">Verso l'alto. To the heights.</p>
          </div>

          {/* Closing attribution */}
          <div className="pt-10 mt-10 border-t border-[hsl(var(--marketing-border)/0.4)]">
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.4)] leading-relaxed">
              Pier Giorgio Frassati (April 6, 1901 – July 4, 1925) · Canonized September 7, 2025
            </p>
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.35)] mt-1 leading-relaxed">
              CROS™ is an independent platform developed in his spirit, grounded in Catholic Social Teaching and the Ignatian rhythm of service.
            </p>
          </div>
        </div>
      </article>

      {/* ─── REFLECTION (expandable) ─── */}
      <ReflectionSection />

      {/* ─── FINAL CTA ─── */}
      <section className="bg-[hsl(var(--marketing-surface))]">
        <div className="max-w-[680px] mx-auto px-4 sm:px-6 py-20 sm:py-24 text-center">
          <h2
            className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-8"
            style={serif}
          >
            Build What He Built.
          </h2>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/features">
              <Button
                size="lg"
                className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8 h-12 text-base"
              >
                Explore CROS <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/manifesto">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full border-[hsl(var(--marketing-navy)/0.2)] text-[hsl(var(--marketing-navy)/0.7)] hover:text-[hsl(var(--marketing-navy))] px-8 h-12 text-base"
              >
                Read Why CROS <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
