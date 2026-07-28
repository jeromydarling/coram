import { ExternalLink } from 'lucide-react';
import type { InsightsJson } from '@/hooks/useNeighborhoodInsights';

interface NeighborhoodInsightDetailsProps {
  insights: InsightsJson;
}

export function NeighborhoodInsightDetails({ insights }: NeighborhoodInsightDetailsProps) {
  return (
    <div className="space-y-4">
      {insights.demographics_summary && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Neighborhood Demographics</h4>
          <p className="text-sm bg-muted/30 p-2 rounded-lg">📊 {insights.demographics_summary}</p>
        </div>
      )}

      {insights.current_trends && insights.current_trends.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Current Trends</h4>
          <ul className="text-sm space-y-1">
            {insights.current_trends.map((t, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-primary mt-0.5">📈</span>
                <span>{t}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {insights.current_struggles && insights.current_struggles.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Current Struggles</h4>
          <ul className="text-sm space-y-1">
            {insights.current_struggles.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-warning mt-0.5">⚠️</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {insights.community_needs && insights.community_needs.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Community Needs</h4>
          <ul className="text-sm space-y-1">
            {insights.community_needs.map((n, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-accent mt-0.5">🎯</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {insights.program_opportunities && insights.program_opportunities.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Program Opportunities</h4>
          <ul className="text-sm space-y-1">
            {insights.program_opportunities.map((o, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-success mt-0.5">💡</span>
                <span>{o}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {insights.helpful_articles && insights.helpful_articles.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Helpful Articles</h4>
          <div className="space-y-2">
            {insights.helpful_articles.map((a, i) => (
              <a
                key={i}
                href={a.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5 mt-0.5 text-primary shrink-0" />
                <div>
                  <span className="font-medium">{a.title}</span>
                  <p className="text-xs text-muted-foreground">{a.why}</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {insights.sources && insights.sources.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground uppercase mb-1">Sources</h4>
          <div className="space-y-2">
            {insights.sources.map((s, i) => (
              <div key={i} className="text-xs p-2 rounded-lg bg-muted/20 border border-border/50">
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary hover:underline">
                  {s.title}
                </a>
                <p className="text-muted-foreground italic mt-1">"{s.quote}"</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
