/**
 * ReflectionCycleCard — Groups essays under a monthly reflection cycle.
 *
 * WHAT: Displays a month's essays as a reflective collection, not a timeline.
 * WHERE: Used in EssaysIndex page.
 * WHY: Essays are grouped by Reflection Cycle (YYYY-MM), not by date.
 */
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Essay {
  id: string;
  title: string;
  slug: string;
  draft_type: string;
  voice_origin: string;
  is_interim_content: boolean;
  published_at: string | null;
  body: string | null;
  essay_type?: string;
}

interface ReflectionCycleCardProps {
  cycle: string; // YYYY-MM
  essays: Essay[];
}

function formatCycleTitle(cycle: string): string {
  const [year, month] = cycle.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) + ' Reflections';
}

export default function ReflectionCycleCard({ cycle, essays }: ReflectionCycleCardProps) {
  return (
    <section className="mb-10">
      <div className="mb-4 pb-2 border-b border-border/50">
        <h2 className="text-xl font-semibold text-foreground font-serif">
          {formatCycleTitle(cycle)}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {essays.length} {essays.length === 1 ? 'reflection' : 'reflections'}
        </p>
      </div>

      <div className="space-y-4">
        {essays.map((essay) => (
          <Link key={essay.id} to={`/essays/${essay.slug}`}>
            <Card className="hover:border-primary/30 transition-colors" data-origin={essay.is_interim_content ? 'interim' : 'tenant'}>
              <CardContent className="py-5 px-5">
                <h3 className="text-base font-semibold text-foreground font-serif mb-1">
                  {essay.title}
                </h3>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {(() => {
                    const text = essay.body?.replace(/<[^>]*>/g, '').replace(/[#*_]/g, '').replace(/\s+/g, ' ').trim() || '';
                    if (text.length <= 180) return text;
                    const truncated = text.slice(0, 180);
                    const lastSpace = truncated.lastIndexOf(' ');
                    return (lastSpace > 108 ? truncated.slice(0, lastSpace) : truncated) + '…';
                  })()}
                </p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline" className="text-xs">{essay.essay_type || essay.draft_type}</Badge>
                  {essay.voice_origin === 'nri' && <Badge variant="secondary" className="text-xs">NRI</Badge>}
                  {essay.is_interim_content && <Badge variant="outline" className="text-xs opacity-70">Interim</Badge>}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
}
