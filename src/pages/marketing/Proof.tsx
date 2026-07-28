/**
 * Proof Page — Cost savings analysis & stack comparison.
 *
 * WHAT: Landing page for the "Proof" section linking to cost analysis content.
 * WHERE: /proof route in the marketing site.
 * WHY: Gives prospects a dedicated place to evaluate CROS™ vs fragmented tool stacks.
 */
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import PricingComparisonTable from '@/components/pricing/PricingComparisonTable';
import CostSavingsCalculator from '@/components/pricing/CostSavingsCalculator';
import SeoHead from '@/components/seo/SeoHead';

export default function Proof() {
  return (
    <div className="bg-white">
      <SeoHead title="The Proof — Why CROS™ Is Different" description="A candid look at how CROS compares to traditional CRMs on price, values, and human-centered design." canonical="/proof" />
      {/* Hero */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pt-16 sm:pt-24 pb-12 text-center">
        <p className="text-sm font-medium text-[hsl(var(--marketing-blue))] uppercase tracking-wider mb-4">
          Proof
        </p>
        <h1
          className="text-3xl sm:text-5xl font-bold text-[hsl(var(--marketing-navy))] mb-6 leading-tight"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          How Much Are You Really Paying To Stay Fragmented?
        </h1>
        <p className="text-lg text-[hsl(var(--marketing-navy)/0.6)] leading-relaxed max-w-2xl mx-auto">
          Most organizations didn't choose complexity — it accumulated over time. See how consolidating
          your tools with CROS™ can reduce cost and restore clarity.
        </p>
      </section>

      {/* Narrative Block */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-16">
        <div
          className="space-y-5 text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed"
          style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
        >
          <p>A typical ministry or nonprofit today might be paying for:</p>
          <ul className="space-y-1.5 pl-4">
            <li>• A CRM they barely use</li>
            <li>• An email marketing platform</li>
            <li>• A volunteer scheduling tool</li>
            <li>• A project manager</li>
            <li>• A calendar system</li>
            <li>• A reporting dashboard</li>
            <li>• A notes or journaling tool</li>
            <li>• An integration service to make them talk to each other</li>
          </ul>
          <p>
            Each tool solves one small problem.{' '}
            Together, they quietly drain time, money, and focus.
          </p>
          <p className="font-medium text-[hsl(var(--marketing-navy))]">
            CROS™ wasn't built to replace your mission.{' '}
            It was built to remove the layers between your mission and the people you serve.
          </p>
        </div>
      </section>

      {/* Comparison Table */}
      <PricingComparisonTable />

      {/* Calculator */}
      <CostSavingsCalculator />

      {/* Closing */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24 text-center">
        <div style={{ fontFamily: 'Georgia, "Times New Roman", serif' }} className="space-y-5 text-[hsl(var(--marketing-navy)/0.7)] leading-relaxed">
          <p className="text-xl font-semibold text-[hsl(var(--marketing-navy))]">
            The biggest savings isn't money.
          </p>
          <p className="text-xl font-semibold text-[hsl(var(--marketing-navy))]">
            It's attention.
          </p>
          <p>
            Every extra system creates another login, another training session, another place where the story gets lost.
          </p>
          <p className="font-medium text-[hsl(var(--marketing-navy))]">
            CROS™ keeps the relationship alive — and lets technology serve the human work instead of replacing it.
          </p>
        </div>
        <div className="mt-10">
          <Link to="/pricing">
            <Button
              size="lg"
              className="rounded-full bg-[hsl(var(--marketing-navy))] text-white hover:bg-[hsl(var(--marketing-navy)/0.9)] px-8"
            >
              View Pricing <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
