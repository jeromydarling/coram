/**
 * GardenOrientationCard — Session-once orientation card for Gardener Nexus.
 *
 * WHAT: Displays a collapsible welcome card explaining why this space exists.
 * WHERE: Top of /operator/nexus
 * WHY: Grounds the Gardener in stewardship language on first session visit.
 */
import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown } from 'lucide-react';

const SESSION_KEY = 'cros-gardener-intro-dismissed';

export default function GardenOrientationCard() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!sessionStorage.getItem(SESSION_KEY)) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="pt-5 pb-4">
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <div className="flex items-center justify-between gap-4">
            <CollapsibleTrigger className="flex items-center gap-2 text-left">
              <h2 className="text-base font-semibold text-foreground font-serif">
                Why This Space Exists
              </h2>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`}
              />
            </CollapsibleTrigger>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-muted-foreground shrink-0"
              onClick={dismiss}
            >
              Dismiss
            </Button>
          </div>

          <CollapsibleContent>
            <div
              className="text-sm text-muted-foreground leading-relaxed space-y-2 mt-3 max-w-lg"
              style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
              <p>
                This console is a garden, not a control room.<br />
                You are here to tend movement, not manage people.
              </p>
              <p>
                It grew from years of walking alongside human beings —
                and exists to help you tend movement with care.
              </p>
              <p className="text-foreground/70 font-medium">
                Your work is stewardship, not supervision.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
