import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight, Shield, Lock, Eye, Mail, Link2, RefreshCw, PlayCircle, FileText, RotateCcw, ShieldCheck, Database } from 'lucide-react';
import { securityPage, integrationConfidence } from '@/content/marketing';
import SeoHead from '@/components/seo/SeoHead';
import securityHero from '@/assets/security-hero.webp';

const sections = [
  { icon: Lock, ...securityPage.dataBoundaries },
  { icon: Shield, ...securityPage.roleBased },
  { icon: Eye, ...securityPage.auditHealth },
  { icon: ShieldCheck, ...securityPage.enterpriseHardening },
  { icon: Database, ...securityPage.dataQuality },
  { icon: Mail, ...securityPage.emailCalendar },
  { icon: RotateCcw, ...securityPage.recoveryRestore },
];

const ladderIcons = [Link2, RefreshCw, PlayCircle, FileText];

export default function Security() {
  return (
    <div className="bg-white">
      <SeoHead
        title="Security — CROS™"
        description="Learn how CROS protects your community's trust with data boundaries, role-based access, secure nonprofit integrations, and human oversight."
        canonical="/security"
      />
      <section className="relative overflow-hidden">
        <img src={securityHero} alt="" aria-hidden="true" loading="eager" className="pointer-events-none absolute inset-0 w-full h-full opacity-[0.15] object-cover object-center scale-[2.4] origin-top" />
        <div className="relative max-w-[720px] mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-16 sm:pb-20 text-center">
          <p className="text-sm font-medium text-[hsl(var(--marketing-blue))] uppercase tracking-wider mb-3">Trust & Safety</p>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[hsl(var(--marketing-navy))] leading-[1.15] tracking-tight mb-4" style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}>
            Security, the human way
          </h1>
          <p className="text-lg text-[hsl(var(--marketing-navy)/0.6)] max-w-xl mx-auto leading-relaxed">
            We built CROS™ so your community's trust is never at risk. Here's how we protect what matters.
          </p>
        </div>
      </section>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-12 sm:pt-16 pb-16 sm:pb-24">

        <div className="space-y-10">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.title} className="flex gap-5">
                <div className="w-10 h-10 rounded-xl bg-[hsl(var(--marketing-surface))] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon className="h-5 w-5 text-[hsl(var(--marketing-navy)/0.4)]" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[hsl(var(--marketing-navy))] mb-2">{s.title}</h3>
                  <p className="text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed">{s.body}</p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Integration Confidence Ladder */}
        <div className="mt-20 pt-14 border-t border-[hsl(var(--marketing-border))]">
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-3">
            {integrationConfidence.heading}
          </h2>
          <p className="text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed max-w-xl mb-10">
            {integrationConfidence.subheading}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {integrationConfidence.cards.map((card, i) => {
              const Icon = ladderIcons[i];
              return (
                <div
                  key={card.title}
                  className="rounded-2xl border border-[hsl(var(--marketing-border))] bg-[hsl(var(--marketing-surface))] p-6"
                >
                  <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center mb-4">
                    <Icon className="h-4.5 w-4.5 text-[hsl(var(--marketing-navy)/0.45)]" />
                  </div>
                  <h3 className="text-base font-semibold text-[hsl(var(--marketing-navy))] mb-2">
                    {card.title}
                  </h3>
                  <p className="text-sm text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed">
                    {card.body}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Trust Callout */}
          <div className="mt-8 rounded-2xl border border-[hsl(var(--marketing-blue)/0.15)] bg-[hsl(var(--marketing-blue)/0.04)] p-6 sm:p-8">
            <h3 className="text-base font-semibold text-[hsl(var(--marketing-navy))] mb-2">
              {integrationConfidence.trustCallout.title}
            </h3>
            <p className="text-sm text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">
              {integrationConfidence.trustCallout.body}
            </p>
          </div>
        </div>

        {/* AI Stewardship */}
        <div className="mt-20 pt-14 border-t border-[hsl(var(--marketing-border))]">
          <h2 className="text-2xl sm:text-3xl font-bold text-[hsl(var(--marketing-navy))] mb-3">
            AI Stewardship
          </h2>
          <p className="text-[hsl(var(--marketing-navy)/0.55)] leading-relaxed max-w-xl mb-8">
            Intelligence should serve your mission — never the other way around.
          </p>
          <div className="space-y-4">
            {[
              'Private action breadcrumbs help undo mistakes without exposing content.',
              'AI usage is governed by shared limits — predictable and calm.',
              'No content is sold to advertisers.',
              'Human review always remains possible.',
            ].map((item) => (
              <div key={item} className="flex gap-4">
                <div className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--marketing-navy)/0.25)] mt-2.5 flex-shrink-0" />
                <p className="text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed">{item}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 pt-10 border-t border-[hsl(var(--marketing-border))] text-center">
          <p className="text-sm text-[hsl(var(--marketing-navy)/0.45)] mb-2">
            Action breadcrumbs are enabled by default so your assistant can help undo mistakes. Organizations can opt out at any time in Steward Settings.
          </p>
          <p className="text-sm text-[hsl(var(--marketing-navy)/0.45)] mb-6">
            Questions about security or compliance? We're happy to talk.
          </p>
          <Link to="/contact">
            <Button
              className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-6"
            >
              Contact us <ArrowRight className="ml-2 h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
