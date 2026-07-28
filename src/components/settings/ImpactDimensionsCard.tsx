/**
 * ImpactDimensionsCard — Settings link card for Impact Dimensions.
 *
 * WHAT: A card in Settings that links to the Impact Dimensions management page.
 * WHERE: Settings page.
 * WHY: Entry point for tenants to configure structured impact metrics.
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { HelpTooltip } from '@/components/ui/help-tooltip';
import { Ruler, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function ImpactDimensionsCard() {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Ruler className="h-5 w-5" />
          Impact Dimensions
          <HelpTooltip
            what="Define structured metrics for your organization's impact."
            where="Settings > Impact Dimensions"
            why="These appear on events, activities, and provisions — and feed your reports."
          />
        </CardTitle>
        <CardDescription>
          Measure what matters in your work — without changing how CROS stays simple.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/settings/impact')}
          className="gap-1.5"
        >
          Manage Impact Dimensions
          <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </CardContent>
    </Card>
  );
}
