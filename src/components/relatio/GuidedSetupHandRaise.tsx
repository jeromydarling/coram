/**
 * GuidedSetupHandRaise — Supportive hand-raise for guided onboarding help.
 *
 * WHAT: "Feeling overwhelmed?" section at bottom of integration guides.
 * WHERE: IntegrationGuidePanel.
 * WHY: Supportive, never upsell-heavy. Connects to activation sessions.
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Heart, ArrowRight, Sparkles } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface GuidedSetupHandRaiseProps {
  connectorLabel: string;
}

export function GuidedSetupHandRaise({ connectorLabel }: GuidedSetupHandRaiseProps) {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <Separator />
      <Card className="border-dashed">
        <CardContent className="py-6 text-center space-y-3">
          <div className="flex items-center justify-center gap-2 text-muted-foreground">
            <Heart className="h-4 w-4" />
            <p className="text-sm italic">Feeling overwhelmed? We can help.</p>
          </div>
          <Button
            variant="outline"
            onClick={() => setShowModal(true)}
            className="rounded-full"
          >
            Request Guided Setup <ArrowRight className="ml-1 h-3 w-3" />
          </Button>
        </CardContent>
      </Card>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Guided Setup
            </DialogTitle>
            <DialogDescription>
              Our team can walk you through connecting {connectorLabel} to CROS in a
              live session. We'll handle the technical details so you can focus on
              your mission.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-muted/50 space-y-2 text-sm">
              <p className="font-medium">What you get:</p>
              <ul className="space-y-1 text-muted-foreground">
                <li>• A calm, 30-minute video session</li>
                <li>• We connect your system for you</li>
                <li>• Verify data is flowing correctly</li>
                <li>• Answer any questions about Companion Mode</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground italic">
              This is included for organizations that need a helping hand.
              No pressure — your pace, your timeline.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowModal(false)} className="rounded-full flex-1">
                Maybe Later
              </Button>
              <Button
                onClick={() => {
                  setShowModal(false);
                  // In future: navigate to activation session booking
                  window.open('mailto:Gardener@thecros.app?subject=Guided Setup Request — ' + connectorLabel, '_blank');
                }}
                className="rounded-full flex-1"
              >
                Request Setup
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
