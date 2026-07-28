/**
 * RetreatCenters — Marketing landing page for the Retreat Center archetype.
 *
 * WHAT: Hero + body copy + feature list for retreat center organizations.
 * WHERE: /retreat-centers (public marketing route).
 * WHY: SEO gravity for retreat centers considering CROS as their relational OS.
 */

import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Users, Calendar, Heart, HandHeart, BookOpen, DollarSign, Compass } from 'lucide-react';
import retreatSketch from '@/assets/retreat-center-sketch.jpg';
import SeoHead from '@/components/seo/SeoHead';

const features = [
  { icon: Users, text: 'Remember retreat participants across years' },
  { icon: Compass, text: 'Track spiritual direction relationships' },
  { icon: Calendar, text: 'Manage retreat registrations' },
  { icon: DollarSign, text: 'Pay guest speakers with dignity' },
  { icon: HandHeart, text: 'Coordinate volunteers' },
  { icon: Heart, text: 'Record generosity and support' },
  { icon: BookOpen, text: 'Carry the thread of each person\'s journey forward' },
];

export default function RetreatCenters() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16 space-y-16">
      <SeoHead title="CROS™ for Retreat Centers — Remember Every Retreatant" description="A relational operating system for retreat centers. Remember participants across years, honor spiritual direction relationships, and coordinate volunteers with care." canonical="/retreat-centers" />
      {/* Hero */}
      <div className="text-center space-y-6">
        <h1
          className="text-4xl md:text-5xl font-bold tracking-tight text-foreground"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Hold the thread of every retreat journey.
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
          Retreat centers host moments that change lives.
          CROS helps you remember the people who return year after year.
        </p>
      </div>

      {/* Sketch image */}
      <div className="rounded-2xl overflow-hidden border border-border/50">
        <img
          src={retreatSketch}
          alt="Renaissance-style sketch of a retreat center with people arriving along a winding path"
          className="w-full h-auto"
          loading="lazy"
        />
      </div>

      {/* Body copy */}
      <div className="max-w-3xl mx-auto space-y-6 text-muted-foreground leading-relaxed">
        <p className="text-lg font-medium text-foreground">
          Retreat work is relational work.
        </p>
        <p>
          Participants return year after year.
          Spiritual directors walk with retreatants across time.
          Volunteers serve quietly behind the scenes.
        </p>
        <p>
          Most systems track registrations.
          CROS remembers the people.
        </p>
      </div>

      {/* Feature list */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-xl font-semibold text-foreground mb-6">
          With CROS, retreat centers can:
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {features.map((f, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
              <f.icon className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <span className="text-sm text-foreground">{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="text-center space-y-4 pt-8 border-t border-border/50">
        <p
          className="text-xl font-semibold text-foreground"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Ready to hold the thread?
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/pricing">See Plans</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/contact">Talk to Us</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
