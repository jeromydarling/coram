/**
 * OperatorAdoptionPage — Living Adoption Engine Nexus workflow.
 *
 * WHAT: Surfaces gentle adoption signals and narrative guidance for operators.
 * WHERE: /operator/nexus/adoption
 * WHY: Helps operators notice where teams may benefit from guidance, without urgency.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { Heart, Compass, BookOpen, ExternalLink } from 'lucide-react';
import { FIELD_JOURNAL, getFieldJournalRoleFrequency, getFieldJournalArchetypes } from '@/content/fieldJournal';
import { CompanionAdoptionPanel } from '@/components/operator/adoption/CompanionAdoptionPanel';
import { AUTHORITY_SECTIONS } from '@/content/authority';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

interface AdoptionInsight {
  title: string;
  body: string;
  helpLink?: string;
  severity: 'gentle' | 'notice';
}

// Static adoption insights derived from content coverage
function deriveInsights(): AdoptionInsight[] {
  const insights: AdoptionInsight[] = [];
  const roleFreq = getFieldJournalRoleFrequency();
  const archetypes = getFieldJournalArchetypes();

  if (!roleFreq['Visitor'] || roleFreq['Visitor'] < 2) {
    insights.push({ title: 'Visitor stories may benefit from attention', body: 'The Field Journal has few entries from the Visitor perspective. Consider adding a field note about visitation rhythms.', severity: 'gentle' });
  }
  if (!roleFreq['Companion'] || roleFreq['Companion'] < 2) {
    insights.push({ title: 'Companion stories could grow', body: 'We are noticing limited Companion-focused content. Walking-alongside narratives resonate with many archetypes.', severity: 'gentle' });
  }
  if (!archetypes.includes('digital_inclusion')) {
    insights.push({ title: 'Digital inclusion archetype is underrepresented', body: 'Consider a field journal entry showing how digital equity teams use CROS.', severity: 'notice' });
  }
  if (AUTHORITY_SECTIONS.filter((s) => s.category === 'adoption').length < 3) {
    insights.push({ title: 'More adoption guidance could help', body: 'Leaders adopting CROS benefit from non-technical guidance. Consider adding more adoption-category authority content.', severity: 'gentle' });
  }

  return insights;
}

export default function OperatorAdoptionPage() {
  const insights = deriveInsights();
  const roleFreq = getFieldJournalRoleFrequency();

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-foreground" style={serif}>Living Adoption Engine</h1>
        <p className="text-sm text-muted-foreground">Gentle signals about where teams may benefit from guidance.</p>
      </div>

      {/* Overview cards */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Field Journal Entries</p>
            <p className="text-2xl font-semibold" style={serif}>{FIELD_JOURNAL.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Authority Sections</p>
            <p className="text-2xl font-semibold" style={serif}>{AUTHORITY_SECTIONS.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Role Coverage</p>
            <div className="flex flex-wrap gap-1 mt-1">
              {Object.entries(roleFreq).map(([role, count]) => (
                <Badge key={role} variant="secondary" className="text-[10px]">{role}: {count}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Adoption insights */}
      <section>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
          <Heart className="w-3.5 h-3.5" /> We are noticing...
        </h2>
        <div className="space-y-3">
          {insights.map((insight, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Compass className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{insight.title}</p>
                    <p className="text-sm text-muted-foreground mt-1">{insight.body}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {insights.length === 0 && (
            <Card>
              <CardContent className="p-4 text-center text-sm text-muted-foreground">
                Content coverage looks healthy. No gaps noticed right now.
              </CardContent>
            </Card>
          )}
        </div>
      </section>

      {/* Companion Adoption */}
      <CompanionAdoptionPanel />

      {/* Quick links */}
      <div className="flex flex-wrap gap-2">
        <Link to="/field-journal" target="_blank">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs"><ExternalLink className="h-3 w-3" /> View Field Journal</Button>
        </Link>
        <Link to="/authority" target="_blank">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs"><ExternalLink className="h-3 w-3" /> View Authority Hub</Button>
        </Link>
      </div>
    </div>
  );
}
