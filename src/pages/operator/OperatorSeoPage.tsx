/**
 * OperatorSeoPage — SEO phase registry & marketing page directory.
 *
 * WHAT: Lists all SEO/narrative authority phases with their associated marketing URLs.
 * WHERE: /operator/seo under CRESCERE zone.
 * WHY: Gives the Gardener a single living reference for every public page.
 *       Dynamically pulls from marketingPageRegistry so new content auto-appears.
 */
import { useState, useMemo } from 'react';
import { ExternalLink, ChevronDown, ChevronRight, Globe, FileText, BookOpen, Map, Users, Layers, Radio, Pen, Scale, Search, Sparkles } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { buildSeoPhases, getTotalPageCount, getDynamicPageCount, type SeoPhase } from '@/lib/marketingPageRegistry';

const iconMap: Record<string, React.ElementType> = {
  Globe, Layers, Users, Scale, BookOpen, Pen, Map, Radio, FileText, Search, Sparkles,
};

const statusColors: Record<string, string> = {
  'complete': 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20',
  'in-progress': 'bg-amber-500/10 text-amber-700 border-amber-500/20',
  'planned': 'bg-muted text-muted-foreground border-border',
};

export default function OperatorSeoPage() {
  const phases = useMemo(() => buildSeoPhases(), []);
  const totalPages = useMemo(() => getTotalPageCount(), []);
  const dynamicPages = useMemo(() => getDynamicPageCount(), []);
  const completedPhases = phases.filter((p) => p.status === 'complete').length;

  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set(['p1']));
  const [filter, setFilter] = useState('');

  const togglePhase = (id: string) => {
    setExpandedPhases((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedPhases(new Set(phases.map((p) => p.id)));
  const collapseAll = () => setExpandedPhases(new Set());

  const filtered = filter.trim()
    ? phases
        .map((p) => ({
          ...p,
          pages: p.pages.filter(
            (pg) =>
              pg.label.toLowerCase().includes(filter.toLowerCase()) ||
              pg.path.toLowerCase().includes(filter.toLowerCase()) ||
              pg.description?.toLowerCase().includes(filter.toLowerCase())
          ),
        }))
        .filter((p) => p.pages.length > 0 || p.title.toLowerCase().includes(filter.toLowerCase()) || p.purpose.toLowerCase().includes(filter.toLowerCase()))
    : phases;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            SEO & Narrative Authority
            <HelpTooltip content="Living registry of all SEO phases and their associated marketing pages. Dynamically pulls from content registries (Mission Atlas, Callings, Pathways) so new pages auto-appear. All marketing pages use static, hand-curated content — they do not pull from the database." />
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {completedPhases}/{phases.length} phases complete · {totalPages} marketing pages · {dynamicPages} auto-generated from content
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Expand all
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Collapse all
          </Button>
        </div>
      </div>

      <Input
        placeholder="Filter pages or phases…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-sm"
      />

      <div className="space-y-3">
        {filtered.map((phase) => {
          const isExpanded = expandedPhases.has(phase.id);
          const Icon = iconMap[phase.icon] || Globe;
          const dynamicCount = phase.pages.filter((p) => p.dynamic).length;
          return (
            <Card key={phase.id} className="overflow-hidden">
              <CardHeader
                className="cursor-pointer py-3 px-4 hover:bg-muted/30 transition-colors"
                onClick={() => togglePhase(phase.id)}
              >
                <div className="flex items-center gap-3">
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <Icon className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2 flex-wrap">
                      <span className="text-muted-foreground font-normal">{phase.phase}</span>
                      {phase.title}
                      <Badge variant="outline" className={statusColors[phase.status]}>
                        {phase.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-normal ml-auto hidden sm:inline">
                        {phase.pages.length} page{phase.pages.length !== 1 ? 's' : ''}
                        {dynamicCount > 0 && (
                          <span className="ml-1 text-primary/70">({dynamicCount} dynamic)</span>
                        )}
                      </span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-0.5">{phase.description}</p>
                  </div>
                </div>
              </CardHeader>

              {isExpanded && (
                <CardContent className="pt-0 pb-3 px-4">
                  {/* Phase purpose narrative */}
                  <div className="bg-muted/30 rounded-lg px-4 py-3 mb-3 border border-border/50">
                    <p className="text-xs text-muted-foreground leading-relaxed italic">
                      {phase.purpose}
                    </p>
                  </div>

                  <div className="border-t border-border pt-3 space-y-1.5">
                    {phase.pages.map((page, idx) => (
                      <a
                        key={`${page.path}-${idx}`}
                        href={page.path}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors group text-sm"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <span className="text-foreground font-medium">
                            {page.label}
                            {page.dynamic && (
                              <Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0 bg-primary/5 text-primary/70 border-primary/20">
                                auto
                              </Badge>
                            )}
                          </span>
                          {page.description && (
                            <p className="text-muted-foreground text-xs mt-0.5 leading-relaxed">
                              {page.description}
                            </p>
                          )}
                        </div>
                        <code className="text-xs text-muted-foreground font-mono hidden md:inline truncate max-w-48 mt-0.5">
                          {page.path}
                        </code>
                      </a>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
