import SeoHead from '@/components/seo/SeoHead';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

export default function UniversalCaseStudy() {
  return (
    <div className="bg-white">
      <SeoHead title="A Universal Story — How CROS™ Grows With You" description="A narrative case study following one organization as it grows into CROS: reflections, community awareness, and the quiet emergence of pattern." canonical="/case-study" />
      {/* SECTION 1 — HERO */}
      <section className="pt-20 sm:pt-28 pb-16 sm:pb-20 bg-[hsl(var(--marketing-surface))]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[hsl(var(--marketing-blue))] mb-6">
            A Universal Story
          </p>
          <h1
            className="text-3xl sm:text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-10"
            style={serif}
          >
            The Work of Showing Up
          </h1>
          <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed text-base sm:text-lg" style={serif}>
            <p>
              Across churches, nonprofits, and community organizations, the mission is often described differently — but the work is the same.
            </p>
            <p>
              To meet people.{'\n'}
              To know them.{'\n'}
              To walk with them through the moments that shape a life.
            </p>
            <p className="whitespace-pre-line">
              {'When someone is born.\nWhen someone marries.\nWhen someone loses a job.\nWhen someone enters recovery.\nWhen someone grieves.\nWhen someone begins again.'}
            </p>
            <p className="whitespace-pre-line">
              {'The question has never been,\n"How much data did we collect?"'}
            </p>
            <p className="text-lg sm:text-xl font-medium text-[hsl(var(--marketing-navy))]" style={serif}>
              The real question has always been:{'\n'}
              "What did we do when they needed us?"
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 2 — THE UNIVERSAL MOMENTS */}
      <section className="py-16 sm:py-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed text-base sm:text-lg whitespace-pre-line" style={serif}>
            <p className="font-medium text-[hsl(var(--marketing-navy))]">
              Every organization carries these moments quietly:
            </p>
            <p>
              {'When someone lost their home — did we respond?\nWhen someone welcomed a child — were we present?\nWhen someone buried a loved one — did we remember?\nWhen someone struggled — did we notice?\nWhen someone healed — did we celebrate?'}
            </p>
            <p>These are not transactions.</p>
            <p className="text-lg sm:text-xl font-medium text-[hsl(var(--marketing-navy))]">
              They are stories.
            </p>
            <p className="italic text-[hsl(var(--marketing-navy)/0.55)]">
              And stories do not belong in spreadsheets.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 3 — HOW WE LOST THE STORY */}
      <section className="py-16 sm:py-24 bg-[hsl(var(--marketing-surface))]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2
            className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))] mb-8 tracking-tight"
            style={serif}
          >
            How We Lost the Story
          </h2>
          <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed text-base sm:text-lg whitespace-pre-line" style={serif}>
            <p>
              {'Technology helped us scale our work —\nbut somewhere along the way,\npeople became rows,\ninteractions became checkboxes,\nand relationships became metrics.'}
            </p>
            <p>
              {'Traditional CRMs organize information,\nbut they do not understand narrative.'}
            </p>
            <p>
              {'They store moments without context.\nThey track activity without meaning.'}
            </p>
            <p className="text-lg sm:text-xl font-medium text-[hsl(var(--marketing-navy))]">
              A person is worth more than a data point.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 4 — WHY CROS EXISTS */}
      <section className="py-16 sm:py-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2
            className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))] mb-8 tracking-tight"
            style={serif}
          >
            Putting Humanity Back Into the Work
          </h2>
          <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed text-base sm:text-lg whitespace-pre-line" style={serif}>
            <p>CROS was built to restore the story behind the work.</p>
            <p>
              {'Instead of forcing humans to translate life into rigid systems,\nCROS listens to the rhythm already present in your relationships.'}
            </p>
            <p>
              {'Reflections become memory.\nEvents become presence.\nJourneys become growth.'}
            </p>
            <p>
              AI helps organize what happens —{'\n'}
              but Narrative Relational Intelligence (NRI) helps us understand why it matters.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION 5 — THE HUMAN NERVOUS SYSTEM */}
      <section className="py-16 sm:py-24 bg-[hsl(var(--marketing-surface))]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2
            className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))] mb-8 tracking-tight"
            style={serif}
          >
            The System Is Nothing Without You
          </h2>
          <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed text-base sm:text-lg whitespace-pre-line" style={serif}>
            <p>
              {'CROS is not the intelligence.\nYou are.'}
            </p>
            <p>
              {'You are the nervous system.\nThe witness.\nThe one who shows up.'}
            </p>
            <p>
              {'Technology simply holds the threads together\nso the story is never lost.'}
            </p>
            <p>
              {'Without human care,\nno system has meaning.'}
            </p>
            <p className="text-lg sm:text-xl font-medium text-[hsl(var(--marketing-navy))]">
              {'With it,\ntechnology becomes a living memory.'}
            </p>
          </div>
        </div>
      </section>

      {/* SECTION — PRINCIPLES THAT SHAPED CROS */}
      <section className="py-16 sm:py-24">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="rounded-2xl bg-[hsl(var(--marketing-surface))] border border-[hsl(var(--marketing-border))] px-6 sm:px-10 py-10 sm:py-14">
            <p className="text-xs tracking-[0.15em] uppercase text-[hsl(var(--marketing-navy)/0.4)] mb-3">
              Quiet foundations behind the work
            </p>
            <h2
              className="text-2xl sm:text-3xl font-semibold text-[hsl(var(--marketing-navy))] mb-8 tracking-tight"
              style={serif}
            >
              Principles That Shaped CROS
            </h2>

            <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed text-base sm:text-lg" style={serif}>
              <p>
                CROS did not begin as a software idea.
              </p>
              <p>
                It grew slowly from years spent in ministry, nonprofit work, and community life — watching how people actually accompany one another through hardship, growth, and hope.
              </p>
              <p className="font-medium text-[hsl(var(--marketing-navy))]">
                Over time, a few quiet convictions began to shape everything:
              </p>
            </div>

            <div className="mt-8 space-y-6 text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed text-base sm:text-lg" style={serif}>
              <div>
                <p className="font-medium text-[hsl(var(--marketing-navy))]">— The person comes before the data.</p>
                <p className="mt-1">Technology should help us see people more clearly, not reduce them to transactions.</p>
              </div>
              <div>
                <p className="font-medium text-[hsl(var(--marketing-navy))]">— Communities grow through relationship, not optimization.</p>
                <p className="mt-1">The most meaningful work happens in conversations, visits, and shared presence.</p>
              </div>
              <div>
                <p className="font-medium text-[hsl(var(--marketing-navy))]">— Stewardship matters more than control.</p>
                <p className="mt-1">The platform was never meant to be operated like a machine, but cultivated like a garden.</p>
              </div>
              <div>
                <p className="font-medium text-[hsl(var(--marketing-navy))]">— Stories are not decoration — they are the ontology.</p>
                <p className="mt-1">What we remember about one another shapes how we care for one another.</p>
              </div>
              <div>
                <p className="font-medium text-[hsl(var(--marketing-navy))]">— Stewardship of Intelligence.</p>
                <p className="mt-1">We believe intelligence should be governed, not extracted. CROS was designed so that AI serves the mission — never the other way around.</p>
              </div>
            </div>

            <div className="mt-8 space-y-5 text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed text-base sm:text-lg" style={serif}>
              <p>
                Many of these ideas resonate with traditions of social teaching and Ignatian reflection, but they are offered here simply as human wisdom gathered from lived experience.
              </p>
              <p>
                CROS exists to support organizations who want technology to feel more like accompaniment than administration.
              </p>
            </div>

            <p className="mt-10 text-sm italic text-[hsl(var(--marketing-navy)/0.4)]" style={serif}>
              Every platform is shaped by a philosophy. These are ours.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION — A NOTE FROM THE GARDENER */}
      <section className="py-16 sm:py-24 bg-[hsl(var(--marketing-surface))]">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <div className="rounded-xl bg-[hsl(var(--marketing-navy)/0.02)] border border-[hsl(var(--marketing-navy)/0.06)] px-6 sm:px-8 py-8 sm:py-10">
            <h3
              className="text-lg sm:text-xl font-semibold text-[hsl(var(--marketing-navy))] mb-5 tracking-tight"
              style={serif}
            >
              A Note from the Gardener
            </h3>
            <div className="space-y-5 text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed text-base sm:text-lg" style={serif}>
              <p>
                For many years, I had the unexpected privilege of portraying Pier Giorgio Frassati in a theatrical production about his life.
              </p>
              <p>What began as a role slowly became something else.</p>
              <p>
                To step into his story night after night was to inhabit his rhythm — the joy, the urgency, the hidden discipline of remembering people. I had to study the notebooks. The follow-through. The way he moved through a room. The way he carried names.
              </p>
              <p>And something shifted.</p>
              <p>
                I began to see how much of relational work is lost — not because people don't care, but because we forget. We get busy. We move on. We don't have a structure strong enough to hold what matters.
              </p>
              <p>
                Pier Giorgio's life revealed something deeply practical: love at scale requires discipline.
              </p>
              <p>CROS™ was born from that realization.</p>
              <p className="whitespace-pre-line">
                {'Not to digitize a saint.\nNot to romanticize service.\nBut to build a structure that supports the kind of remembering he practiced naturally.'}
              </p>
              <p>
                If CROS™ works, it works because it is rooted in a life that proved remembering people changes everything.
              </p>

              <hr className="border-[hsl(var(--marketing-navy)/0.08)] my-6" />

              <p className="italic">
                I didn't set out to build a product.
                I set out to make sense of the work I had been doing for decades — walking with people through recovery, ministry, family life, and community service.
              </p>
              <p className="italic">
                CROS is not something I invented from a distance.
                It is something that grew slowly from real relationships, long conversations, and years spent asking how technology could help us stay human instead of becoming more mechanical.
              </p>
              <p className="italic">
                If you use this platform, you are not stepping into someone else's system.
                You are stepping into a garden that many hands will help cultivate over time.
              </p>
              <p className="not-italic font-medium text-[hsl(var(--marketing-navy)/0.7)]">
                Thank you for being part of its growth.
              </p>

              <p className="italic text-[hsl(var(--marketing-navy))] font-medium pt-2">Verso l'alto.</p>
            </div>
          </div>

          <a
            href="/the-model"
            className="inline-block mt-10 text-sm text-[hsl(var(--marketing-navy)/0.45)] hover:text-[hsl(var(--marketing-navy)/0.7)] transition-colors"
            style={serif}
          >
            Read about The Model →
          </a>
        </div>
      </section>

      {/* SECTION 6 — CLOSING MANIFESTO */}
      <section className="py-20 sm:py-28">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <blockquote
            className="text-xl sm:text-2xl md:text-3xl leading-snug text-[hsl(var(--marketing-navy))] font-medium whitespace-pre-line"
            style={serif}
          >
            {"\"We do not exist to turn people into data.\nWe exist to remember the story of how we loved our neighbor well.\""}
          </blockquote>
          <p className="mt-10 text-sm text-[hsl(var(--marketing-navy)/0.5)]" style={serif}>
            CROS exists so that organizations can scale their mission{'\n'}
            without losing their humanity.
          </p>
        </div>
      </section>
    </div>
  );
}
