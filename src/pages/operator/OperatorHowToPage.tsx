/**
 * OperatorHowToPage — Comprehensive guide for every Gardener Console section.
 *
 * WHAT: A single-page reference explaining what each operator tool does, how to read it, and when to use it.
 * WHERE: /operator/how-to
 * WHY: Gardeners need a quick, scannable guide without leaving the console.
 *
 * AUTO-SYNC: This page reads from gardenerNavRegistry.ts — adding a new nav entry there
 * automatically creates a How-To card here. No manual sync needed.
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Download, HelpCircle } from 'lucide-react';
import { downloadHowToMarkdown } from '@/lib/howToMarkdown';
import {
  GARDENER_NAV_REGISTRY,
  ZONE_LABELS,
  type GardenerZone,
} from '@/lib/gardenerNavRegistry';

const ZONE_ORDER: GardenerZone[] = ['cura', 'machina', 'crescere', 'scientia', 'silentium'];

export default function OperatorHowToPage() {
  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 shrink-0">
            <HelpCircle className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Gardener Guide</h1>
            <p className="text-sm text-muted-foreground mt-1">
              A complete reference for every section of the Gardener Console, organized by zone. Learn what each tool shows, how to read the signals, and what actions to take.
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Auto-generated from the nav registry — {GARDENER_NAV_REGISTRY.length} sections across {ZONE_ORDER.length} zones.
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 gap-1.5"
          onClick={() => downloadHowToMarkdown(GARDENER_NAV_REGISTRY.map(({ icon, ...rest }) => rest))}
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Download Markdown</span>
        </Button>
      </div>

      {/* Quick orientation */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">What is the Gardener Console?</CardTitle>
          <CardDescription>
            The Gardener Console is the ecosystem stewardship layer for CROS, organized into five zones:
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Object.entries(ZONE_LABELS).map(([key, { label, color, description }]) => (
              <div key={key} className="flex items-start gap-2">
                <Badge variant="outline" className={`${color} border-0 text-xs shrink-0 mt-0.5`}>
                  {label}
                </Badge>
                <span className="text-xs">{description}</span>
              </div>
            ))}
          </div>
          <div className="border-t border-border pt-3 space-y-2">
            <p><strong className="text-foreground">Daily routine:</strong> Check Dashboard → review Error Desk → scan Automation Results → glance at System Health → triage Intake.</p>
            <p><strong className="text-foreground">Weekly routine:</strong> Review Testimonium rollups → audit Communio privacy → check tenant usage trends → review Partner pipeline → check Activation readiness → review Adoption depth.</p>
            <p><strong className="text-foreground">Pre-release:</strong> System Health → Walk the Garden tab → run full sweep → review scoreboard → QA Hub tests → Tour for screenshots.</p>
            <p><strong className="text-foreground">Outreach cycle:</strong> Create tracking links in Outreach → schedule demos → convert partners → monitor Activation progress.</p>
          </div>
        </CardContent>
      </Card>

      {/* Zone legend */}
      <div className="flex flex-wrap gap-2">
        {ZONE_ORDER.map(key => {
          const { label, color } = ZONE_LABELS[key];
          return (
            <Badge key={key} variant="outline" className={`${color} border-0 text-xs`}>
              {label}
            </Badge>
          );
        })}
      </div>

      {/* Section-by-section guide */}
      {ZONE_ORDER.map(zone => {
        const zoneSections = GARDENER_NAV_REGISTRY.filter(s => s.zone === zone);
        const zoneInfo = ZONE_LABELS[zone];
        return (
          <div key={zone} className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Badge variant="outline" className={`${zoneInfo.color} border-0 text-xs`}>
                {zoneInfo.label}
              </Badge>
              <span>{zoneSections.length} sections</span>
              <span className="font-normal normal-case text-xs">— {zoneInfo.description}</span>
            </h2>
            <Accordion type="multiple" className="space-y-2">
              {zoneSections.map((s) => {
                const hasContent = s.whatYouSee.length > 0 && s.whatYouSee[0] !== 'This page!';
                return (
                  <AccordionItem key={s.route} value={s.route} className="border rounded-lg px-1">
                    <AccordionTrigger className="hover:no-underline py-3 px-3">
                      <div className="flex items-center gap-3 text-left">
                        <div className="p-1.5 rounded-md bg-muted shrink-0">
                          <s.icon className="w-4 h-4 text-foreground" />
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground text-sm">{s.title}</span>
                          <span className="text-xs text-muted-foreground hidden sm:inline">{s.route}</span>
                          {!hasContent && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-700 dark:text-amber-400 border-0">
                              Documentation pending
                            </Badge>
                          )}
                          {s.tabs && (
                            <div className="flex gap-1 flex-wrap">
                              {s.tabs.map(tab => (
                                <Badge key={tab} variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {tab}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-4 space-y-4">
                      <p className="text-sm text-muted-foreground">{s.summary}</p>

                      {s.whatYouSee.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">What You'll See</h4>
                          <ul className="space-y-1">
                            {s.whatYouSee.map((item, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                <span className="text-primary shrink-0">•</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {s.whatToDo.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">What To Do</h4>
                          <ul className="space-y-1">
                            {s.whatToDo.map((item, i) => (
                              <li key={i} className="text-sm text-muted-foreground flex gap-2">
                                <span className="text-primary shrink-0">→</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {s.tips && s.tips.length > 0 && (
                        <div className="bg-muted/50 rounded-md p-3">
                          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2">💡 Tips</h4>
                          <ul className="space-y-1">
                            {s.tips.map((tip, i) => (
                              <li key={i} className="text-sm text-muted-foreground">{tip}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </div>
        );
      })}
    </div>
  );
}
