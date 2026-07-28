/**
 * FieldNotesIndex — Public listing of NRI field notes.
 *
 * WHAT: Displays published field notes — lightweight narrative signals.
 * WHERE: /field-notes-library
 * WHY: Part of the Living Library rhythm. Not a blog. Calm, signal-based content.
 */
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import SeoHead from '@/components/seo/SeoHead';
import SeoBreadcrumb from '@/components/seo/SeoBreadcrumb';
import { FileText } from 'lucide-react';

export default function FieldNotesIndex() {
  const { data: notes, isLoading } = useQuery({
    queryKey: ['published-field-notes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('operator_content_drafts')
        .select('id, title, slug, published_at, body, voice_origin, editorial_mode, month_tag')
        .eq('status', 'published')
        .eq('editorial_mode', 'field_note')
        .order('published_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <>
      <SeoHead
        title="Field Notes — CROS"
        description="Short observations from the network — emerging patterns, localized movement, and signals worth noticing."
        canonical="/field-notes-library"
      />

      <main className="max-w-3xl mx-auto px-4 py-10 sm:py-16">
        <SeoBreadcrumb items={[
          { label: 'Home', to: '/' },
          { label: 'Library', to: '/library' },
          { label: 'Field Notes' },
        ]} />
        <header className="mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground font-serif mb-3">Field Notes</h1>
          <p className="text-base text-muted-foreground leading-relaxed">
            Short observations from the network — emerging patterns, localized movement, and signals worth noticing.
          </p>
        </header>

        {isLoading ? (
          <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        ) : !notes?.length ? (
          <div className="text-center py-16">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-serif">Field notes are being gathered. Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {notes.map((note: any) => (
              <Link key={note.id} to={`/essays/${note.slug}`} className="block group">
                <article className="p-4 rounded-lg border border-border/50 hover:border-primary/20 transition-colors">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs">Field Note</Badge>
                    {note.voice_origin === 'nri' && <Badge variant="secondary" className="text-xs">NRI</Badge>}
                    {note.month_tag && <span className="text-xs text-muted-foreground">{note.month_tag}</span>}
                  </div>
                  <h2 className="text-base font-semibold text-foreground font-serif group-hover:text-primary transition-colors">
                    {note.title}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {note.body?.replace(/[#*_]/g, '').slice(0, 160)}
                  </p>
                  {note.published_at && (
                    <time className="text-xs text-muted-foreground mt-2 block" dateTime={note.published_at}>
                      {new Date(note.published_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                    </time>
                  )}
                </article>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
