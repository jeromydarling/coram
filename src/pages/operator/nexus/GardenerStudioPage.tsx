/**
 * GardenerStudioPage — Editorial workspace for narrative content.
 *
 * WHAT: Tabbed editor for essays, playbooks, voice calibration, communio directory, and mission atlas.
 * WHERE: /operator/nexus/studio (SCIENTIA zone)
 * WHY: Gardener needs native editorial power. Admin settings live in Platform Config.
 */
import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BookOpen, FileText, Mic2, Users, Map } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HelpCircle as HelpIcon } from 'lucide-react';

import StudioLibraryTab from '@/components/operator/studio/StudioLibraryTab';
import StudioPlaybooksTab from '@/components/operator/studio/StudioPlaybooksTab';
import StudioVoiceTab from '@/components/operator/studio/StudioVoiceTab';
import StudioCommunioTab from '@/components/operator/studio/StudioCommunioTab';
import StudioAtlasTab from '@/components/operator/studio/StudioAtlasTab';

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider><Tooltip><TooltipTrigger asChild>
      <HelpIcon className="h-3.5 w-3.5 text-muted-foreground inline ml-1" />
    </TooltipTrigger><TooltipContent><p className="max-w-xs text-xs">{text}</p></TooltipContent></Tooltip></TooltipProvider>
  );
}

export default function GardenerStudioPage() {
  const [tab, setTab] = useState('library');

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-semibold text-foreground font-serif">Garden Studio</h1>
          <HelpTip text="Your editorial workspace. Every change is audited, versioned, and reversible. Draft-first for all publishable content. Admin settings (Switches, Gardeners, Notifications) are in Platform Config." />
        </div>
        <p className="text-sm text-muted-foreground">
          Shape the narrative gently. Every edit is remembered.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-muted/50 p-1">
          <TabsTrigger value="library" className="gap-1.5 text-xs">
            <BookOpen className="h-3.5 w-3.5" /> Library
          </TabsTrigger>
          <TabsTrigger value="playbooks" className="gap-1.5 text-xs">
            <FileText className="h-3.5 w-3.5" /> Playbooks
          </TabsTrigger>
          <TabsTrigger value="voice" className="gap-1.5 text-xs">
            <Mic2 className="h-3.5 w-3.5" /> Voice & Tone
          </TabsTrigger>
          <TabsTrigger value="communio" className="gap-1.5 text-xs">
            <Users className="h-3.5 w-3.5" /> Communio Directory
          </TabsTrigger>
          <TabsTrigger value="atlas" className="gap-1.5 text-xs">
            <Map className="h-3.5 w-3.5" /> Atlas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="library"><StudioLibraryTab /></TabsContent>
        <TabsContent value="playbooks"><StudioPlaybooksTab /></TabsContent>
        <TabsContent value="voice"><StudioVoiceTab /></TabsContent>
        <TabsContent value="communio"><StudioCommunioTab /></TabsContent>
        <TabsContent value="atlas"><StudioAtlasTab /></TabsContent>
      </Tabs>
    </div>
  );
}
