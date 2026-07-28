/**
 * Diocese — Visionary landing page for diocesan-level CROS adoption.
 *
 * WHAT: Narrative page showing aggregated diocesan view concept.
 * WHERE: /diocese (public marketing route).
 * WHY: Positions CROS as infrastructure for subsidiarity-respecting church leadership.
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Church, Users, Heart, BookOpen, Shield } from 'lucide-react';
import dioceseSketch from '@/assets/diocese-sketch.jpg';
import SeoHead from '@/components/seo/SeoHead';

const parishExamples = [
  { name: 'Parish A', desc: 'Food pantry serving 120 families', icon: Heart },
  { name: 'Parish B', desc: 'Mentorship program serving 30 youth', icon: Users },
  { name: 'Parish C', desc: 'Marriage ministry supporting 45 couples', icon: Heart },
  { name: 'Retreat Center', desc: '600 retreat participants this year', icon: Church },
];

export default function Diocese() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-16 space-y-16">
      <SeoHead title="CROS™ for Dioceses — Subsidiarity-Respecting Church Infrastructure" description="An aggregated diocesan view of parish life that honors subsidiarity. See ministry momentum across parishes without collapsing their autonomy." canonical="/diocese" />
      {/* Hero */}
      <div className="text-center space-y-6">
        <h1
          className="text-4xl md:text-5xl font-bold tracking-tight text-foreground"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          What if a Diocese could see the whole story?
        </h1>
        <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
          Across parishes, ministries, and charities, the Church is doing extraordinary work every day.
          But most of that work is invisible. CROS reveals the relationships behind it.
        </p>
      </div>

      {/* Sketch */}
      <div className="rounded-2xl overflow-hidden border border-border/50">
        <img
          src={dioceseSketch}
          alt="Renaissance-style sketch of a cathedral with parish churches surrounding it"
          className="w-full h-auto"
          loading="lazy"
        />
      </div>

      {/* Imagine section */}
      <div className="max-w-3xl mx-auto space-y-6">
        <h2
          className="text-2xl font-semibold text-foreground"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Imagine a diocesan view showing:
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {parishExamples.map((p, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="pt-5 pb-4 px-5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <p.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.desc}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-muted-foreground leading-relaxed">
          Instead of spreadsheets, leadership sees the living work of the Church.
        </p>
      </div>

      {/* Subsidiarity */}
      <div className="max-w-3xl mx-auto rounded-2xl bg-muted/50 p-6 sm:p-8 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Subsidiarity</h2>
        </div>
        <p className="text-muted-foreground leading-relaxed">
          Parishes always own their data.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          CROS allows diocesan leadership to see aggregated insights
          without removing local ownership.
          The result is awareness without centralization.
        </p>
      </div>

      {/* CTA */}
      <div className="text-center space-y-4 pt-8 border-t border-border/50">
        <p
          className="text-xl font-semibold text-foreground"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Ready to see the whole story?
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link to="/contact">Start a Conversation</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/pricing">See Plans</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
