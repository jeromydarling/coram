import { useTranslation } from 'react-i18next';
import { Download, FileJson } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type WorkflowCategory = "search" | "enrichment" | "discovery" | "intelligence" | "automation";

interface WorkflowEntry {
  name: string;
  file: string;
  category: WorkflowCategory;
  description?: string;
}

const workflows: WorkflowEntry[] = [
  // Search workflows
  { name: "Find People (v6 — High-Recall)", file: "search-people-firecrawl-v5-expanded-filtered.json", category: "search", description: "4-variant query expansion + search + LLM extraction" },
  { name: "Find Events (v4 — High-Recall)", file: "search-events-firecrawl-v1-from-people-v5.json", category: "search", description: "Event discovery with brief reconciliation" },
  { name: "Find Grants (v8 — Exhaustive Recall)", file: "search-grants-firecrawl-v1-from-people-v5.json", category: "search", description: "Grant discovery with 30-day memory merge" },
  { name: "Find Opportunities (v1)", file: "search-opportunities-firecrawl-v1.json", category: "search" },

  // Enrichment workflows
  { name: "Partner Enrich (v1)", file: "partner-enrich-v1.json", category: "enrichment", description: "Perplexity website research + signal extraction" },
  { name: "Grant Enrichment (v1)", file: "grant-enrichment-v1.json", category: "enrichment" },
  { name: "Grant Alignment Score (v1)", file: "grant-alignment-score-v1.json", category: "enrichment" },
  { name: "Event Attendee Enrichment (patched)", file: "event-attendee-enrichment-PROD-patched.json", category: "enrichment" },
  { name: "Event Attendee Enrich (v1)", file: "event-attendee-enrich-v1.json", category: "enrichment" },

  // Discovery workflows
  { name: "Discovery — People (v1)", file: "discovery-people-v1.json", category: "discovery" },
  { name: "Discovery — Events (v1)", file: "discovery-events-v1.json", category: "discovery" },
  { name: "Discovery — Grants (v1)", file: "discovery-grants-v1.json", category: "discovery" },
  { name: "Watchlist Ingest (v1)", file: "watchlist-ingest-v1.json", category: "discovery" },
  { name: "Watchlist Diff (v1)", file: "watchlist-diff-v1.json", category: "discovery" },
  { name: "Watchlist Deep Dive (v1)", file: "watchlist-deep-dive-v1.json", category: "discovery" },
  { name: "Watchlist Deep Dive (patched)", file: "watchlist-enrichment-PROD-patched.json", category: "discovery" },

  // Intelligence workflows
  { name: "Opportunity Monitor (v1)", file: "opportunity-monitor-v1.json", category: "intelligence" },
  { name: "Recommendations Generate (v1)", file: "recommendations-generate-v1.json", category: "intelligence" },
  { name: "Prospect Pack Generate (v1)", file: "prospect-pack-generate-v1.json", category: "intelligence" },

  // Automation / Cron workflows
  { name: "Daily Intel Feed + Priority Scoring", file: "cron-daily-intelligence-feed.json", category: "automation" },
  { name: "Momentum Nightly Recompute", file: "momentum-nightly.json", category: "automation" },
  { name: "NBA Moments Health Check", file: "phase25-cron-nba-moments-health.json", category: "automation" },
  { name: "Emit Relationship Edges (PATCH)", file: "emit-relationship-edges-patch.json", category: "automation" },
];

const categoryLabels: Record<WorkflowCategory, string> = {
  search: "Search",
  enrichment: "Enrichment",
  discovery: "Discovery",
  intelligence: "Intelligence",
  automation: "Automation / Cron",
};

const categoryColors: Record<WorkflowCategory, string> = {
  search: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  enrichment: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  discovery: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  intelligence: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  automation: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
};

const WorkflowDownloads = () => {
  const { t } = useTranslation('projects');
  const handleDownload = (file: string) => {
    const link = document.createElement("a");
    link.href = `/n8n-workflows/${file}`;
    link.download = file;
    link.click();
  };

  const grouped = workflows.reduce<Record<WorkflowCategory, WorkflowEntry[]>>((acc, w) => {
    if (!acc[w.category]) acc[w.category] = [];
    acc[w.category].push(w);
    return acc;
  }, {} as Record<WorkflowCategory, WorkflowEntry[]>);

  const categoryOrder: WorkflowCategory[] = ["search", "enrichment", "discovery", "intelligence", "automation"];

  return (
    <div className="container max-w-3xl mx-auto py-12 px-4">
      <div className="flex items-center gap-3 mb-8">
        <FileJson className="h-7 w-7 text-primary" />
        <h1 className="text-2xl font-bold">{t('workflowDownloads.title')}</h1>
      </div>
      <p className="text-muted-foreground mb-8 text-sm">
        {t('workflowDownloads.description')}{" "}
        <code className="text-xs bg-muted px-1 py-0.5 rounded">Authorization: Bearer</code> +{" "}
        <code className="text-xs bg-muted px-1 py-0.5 rounded">X-Api-Key</code> {t('workflowDownloads.descriptionSuffix')}
      </p>

      {categoryOrder.map((cat) => {
        const items = grouped[cat];
        if (!items?.length) return null;
        return (
          <div key={cat} className="mb-8">
            <h2 className="text-lg font-semibold mb-3">{categoryLabels[cat]}</h2>
            <div className="space-y-2">
              {items.map((w) => (
                <Card key={w.file} className="hover:border-primary/30 transition-colors">
                  <CardContent className="flex items-center justify-between py-3 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-medium text-sm truncate">{w.name}</span>
                        <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${categoryColors[cat]}`}>
                          {categoryLabels[cat]}
                        </Badge>
                      </div>
                      {w.description && (
                        <p className="text-xs text-muted-foreground truncate">{w.description}</p>
                      )}
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleDownload(w.file)}>
                      <Download className="h-4 w-4 mr-1" /> {t('workflowDownloads.downloadButton')}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default WorkflowDownloads;
