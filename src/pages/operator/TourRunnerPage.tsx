/**
 * TourRunnerPage — User flow walkthrough with screenshot capture.
 *
 * WHAT: Step-by-step tour of tenant user experience with screenshot download.
 * WHERE: /operator/tour
 * WHY: Generate QA walkthroughs for leadership review.
 */
import { useState, useCallback, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from '@/components/ui/sonner';
import { Camera, Download, ChevronRight, ChevronLeft, Play, HelpCircle, MapPin } from 'lucide-react';

const TOUR_STEPS = [
  { key: 'dashboard', label: 'Dashboard', path: '', description: 'Overview of tenant workspace with relationship memory and community awareness.' },
  { key: 'opportunities', label: 'Journey Board', path: 'opportunities', description: 'Relationship pipeline showing organizations across journey stages.' },
  { key: 'opp_detail', label: 'Opportunity Story', path: 'opportunities', description: 'Deep dive into an organization\'s story — reflections, email history, campaign touches.' },
  { key: 'events', label: 'Events', path: 'events', description: 'Community events with attendance tracking and event reflections.' },
  { key: 'provisions', label: 'Prōvīsiō', path: 'provisions', description: 'Technology provisions with spreadsheet export capability.' },
  { key: 'volunteers', label: 'Voluntārium', path: 'volunteers', description: 'Volunteer management with hours tracking inbox.' },
  { key: 'metros', label: 'Metro Narrative', path: 'metros', description: 'Metro-level community narrative with Signum sources.' },
  { key: 'people', label: 'People', path: 'people', description: 'Contact directory with relationship intelligence.' },
  { key: 'communio', label: 'Communio', path: 'communio', description: 'Cross-tenant shared signals and community collaboration.' },
  { key: 'testimonium', label: 'Testimonium', path: 'testimonium', description: 'Executive narrative reports and storytelling exports.' },
];

function HelpTip({ text }: { text: string }) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild><HelpCircle className="h-3.5 w-3.5 text-muted-foreground inline ml-1 cursor-help" /></TooltipTrigger>
        <TooltipContent className="max-w-xs"><p className="text-xs">{text}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function TourRunnerPage() {
  const [selectedTenant, setSelectedTenant] = useState('');
  const [currentStep, setCurrentStep] = useState(0);
  const [tourActive, setTourActive] = useState(false);
  const [captures, setCaptures] = useState<{ step_key: string; filename: string }[]>([]);

  const { data: demoTenants } = useQuery({
    queryKey: ['demo-tenants-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('demo_tenants').select('id, name, slug, tenant_id');
      if (error) throw error;
      return data;
    },
  });

  const tenant = demoTenants?.find(t => t.id === selectedTenant);
  const step = TOUR_STEPS[currentStep];
  const previewUrl = tenant ? `/${tenant.slug}/${step.path}` : '';

  const startTour = () => {
    if (!selectedTenant) { toast.error('Select a demo tenant first'); return; }
    setTourActive(true);
    setCurrentStep(0);
    setCaptures([]);
    toast.success('Tour started — navigate through each step');
  };

  const captureScreenshot = useCallback(() => {
    const filename = `tour-step-${currentStep + 1}-${step.key}.png`;
    setCaptures(prev => [...prev, { step_key: step.key, filename }]);
    toast.success(`Screenshot recorded: ${filename}`, { description: 'Use browser DevTools or PrintScreen to capture the actual image.' });
  }, [currentStep, step]);

  const exportManifest = () => {
    const manifest = {
      tour_date: new Date().toISOString(),
      tenant: tenant?.name,
      tenant_slug: tenant?.slug,
      steps: TOUR_STEPS.map((s, i) => ({
        step: i + 1,
        key: s.key,
        label: s.label,
        description: s.description,
        path: `/${tenant?.slug}/${s.path}`,
        captured: captures.some(c => c.step_key === s.key),
        filename: captures.find(c => c.step_key === s.key)?.filename ?? null,
      })),
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `tour-manifest-${tenant?.slug}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Tour manifest downloaded');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">User Flow Tour</h1>
        <p className="text-muted-foreground text-sm">Walk through tenant user experience and capture screenshots for QA. <HelpTip text="This tour guides you through the key screens a tenant user sees, letting you capture screenshots at each step for leadership review." /></p>
      </div>

      {/* Setup */}
      <Card>
        <CardHeader><CardTitle className="text-base">Tour Setup</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedTenant} onValueChange={setSelectedTenant}>
            <SelectTrigger><SelectValue placeholder="Select demo tenant..." /></SelectTrigger>
            <SelectContent>
              {demoTenants?.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.slug})</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button onClick={startTour} disabled={!selectedTenant}>
              <Play className="h-4 w-4 mr-2" /> Start Tour
            </Button>
            {captures.length > 0 && (
              <Button variant="outline" onClick={exportManifest}>
                <Download className="h-4 w-4 mr-2" /> Export Manifest ({captures.length} captures)
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Active Tour */}
      {tourActive && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                Step {currentStep + 1} of {TOUR_STEPS.length}: {step.label}
              </CardTitle>
              <Badge variant="secondary">{captures.some(c => c.step_key === step.key) ? '📸 Captured' : 'Not captured'}</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{step.description}</p>
            <div className="bg-muted/50 rounded-lg p-3 text-sm">
              <span className="text-muted-foreground">Navigate to: </span>
              <a href={previewUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-mono text-xs">{previewUrl}</a>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex gap-2">
                <Button size="sm" variant="outline" disabled={currentStep === 0} onClick={() => setCurrentStep(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                </Button>
                <Button size="sm" variant="outline" disabled={currentStep === TOUR_STEPS.length - 1} onClick={() => setCurrentStep(p => p + 1)}>
                  Next <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
              <Button size="sm" onClick={captureScreenshot}>
                <Camera className="h-4 w-4 mr-1" /> Capture Screenshot
              </Button>
            </div>

            {/* Step progress */}
            <div className="flex gap-1">
              {TOUR_STEPS.map((s, i) => (
                <button
                  key={s.key}
                  onClick={() => setCurrentStep(i)}
                  className={`h-2 flex-1 rounded-full transition-colors ${i === currentStep ? 'bg-primary' : i < currentStep ? 'bg-primary/40' : 'bg-muted-foreground/20'}`}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Captures log */}
      {captures.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Captured Steps</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-1">
              {captures.map((c, i) => (
                <div key={i} className="flex items-center gap-2 text-sm py-1">
                  <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{TOUR_STEPS.find(s => s.key === c.step_key)?.label}</span>
                  <span className="text-muted-foreground font-mono text-xs">{c.filename}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
