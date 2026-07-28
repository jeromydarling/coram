import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, ExternalLink, Search, AlertTriangle, Lightbulb, CheckCircle2 } from 'lucide-react';

interface SearchBrief {
  summary: string;
  what_we_found: string[];
  what_may_be_missing: string[];
  helpful_sites: { name: string; url: string; why: string }[];
  suggested_queries: string[];
  confidence: number | null;
  caveats: string[];
}

interface SearchBriefCardProps {
  brief: SearchBrief;
  onSuggestedQueryClick?: (query: string) => void;
}

export function SearchBriefCard({ brief, onSuggestedQueryClick }: SearchBriefCardProps) {
  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          Search Brief
          {brief.confidence !== null && (
            <Badge variant="outline" className="text-xs ml-auto">
              {Math.round(brief.confidence * 100)}% confidence
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-foreground">{brief.summary}</p>


        {brief.what_may_be_missing.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> What may be missing
            </h4>
            <ul className="space-y-0.5">
              {brief.what_may_be_missing.map((item, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
                  <span className="mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}

        {brief.helpful_sites.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" /> Helpful sites
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {brief.helpful_sites.map((site, i) => (
                <a
                  key={i}
                  href={site.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs bg-background border rounded-md px-2 py-1 hover:border-primary/50 transition-colors"
                  title={site.why}
                >
                  <ExternalLink className="w-2.5 h-2.5" />
                  {site.name}
                </a>
              ))}
            </div>
          </div>
        )}

        {brief.suggested_queries.length > 0 && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
              <Search className="w-3 h-3" /> Try these searches
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {brief.suggested_queries.map((q, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => onSuggestedQueryClick?.(q)}
                  className="text-xs bg-background border rounded-full px-2.5 py-1 hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {brief.caveats.length > 0 && (
          <div className="text-[11px] text-muted-foreground italic border-t pt-2 mt-2">
            {brief.caveats.join(' • ')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
