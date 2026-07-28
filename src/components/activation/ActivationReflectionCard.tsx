/**
 * ActivationReflectionCard — Post-activation flywheel card.
 *
 * WHAT: Gentle reflection card shown after activation completes.
 * WHERE: Below completed activation sessions.
 * WHY: Reinforces the growth flywheel by linking back to authority content.
 */
import { Link } from 'react-router-dom';
import { BookOpen, Compass } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const serif = { fontFamily: 'Georgia, "Times New Roman", serif' };

export default function ActivationReflectionCard() {
  return (
    <Card className="border-dashed">
      <CardContent className="pt-5 pb-4 text-center">
        <p className="text-sm text-muted-foreground mb-1" style={serif}>
          Many teams discover CROS through someone they trust.
        </p>
        <p className="text-xs text-muted-foreground mb-4" style={serif}>
          Explore stories from organizations walking a similar path.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Link to="/archetypes">
            <Button variant="outline" size="sm" className="text-xs gap-1.5 rounded-full">
              <Compass className="h-3.5 w-3.5" /> View Archetypes
            </Button>
          </Link>
          <Link to="/authority/weeks">
            <Button variant="outline" size="sm" className="text-xs gap-1.5 rounded-full">
              <BookOpen className="h-3.5 w-3.5" /> Read a Week in the Life
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
