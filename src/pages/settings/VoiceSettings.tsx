/**
 * VoiceSettings — Tenant admin page for voice note configuration.
 *
 * WHAT: Toggle voice notes, audio storage, set max duration.
 * WHERE: /settings/voice — accessible by tenant admins/stewards.
 * WHY: Gives admins control over audio retention and privacy settings.
 */

import { useState, useEffect } from 'react';
import { MainLayout } from '@/components/layout/MainLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Loader2, Mic, Shield, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';
import { HelpTooltip } from '@/components/ui/help-tooltip';

export default function VoiceSettings() {
  const { tenantId } = useTenant();
  const queryClient = useQueryClient();

  const [enableVoice, setEnableVoice] = useState(true);
  const [storeAudio, setStoreAudio] = useState(true);
  const [maxSeconds, setMaxSeconds] = useState(180);
  const [dirty, setDirty] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['tenant-voice-settings', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_voice_settings')
        .select('*')
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings) {
      setEnableVoice(settings.enable_voice_notes);
      setStoreAudio(settings.store_audio);
      setMaxSeconds(settings.max_audio_seconds);
      setDirty(false);
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        tenant_id: tenantId!,
        enable_voice_notes: enableVoice,
        store_audio: storeAudio,
        max_audio_seconds: maxSeconds,
      };

      const { error } = await supabase
        .from('tenant_voice_settings')
        .upsert(payload as any, { onConflict: 'tenant_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tenant-voice-settings'] });
      setDirty(false);
      toast.success('Voice settings saved');
    },
    onError: (err: any) => {
      toast.error('Failed to save: ' + (err.message || 'Unknown error'));
    },
  });

  // Recent stats
  const { data: stats } = useQuery({
    queryKey: ['voice-notes-stats', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { count: total } = await supabase
        .from('voice_notes')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId!)
        .gte('created_at', sevenDaysAgo);

      const { count: completed } = await supabase
        .from('voice_notes')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', tenantId!)
        .eq('transcript_status', 'completed')
        .gte('created_at', sevenDaysAgo);

      return { total: total || 0, completed: completed || 0 };
    },
  });

  if (isLoading) {
    return (
      <MainLayout title="Voice Settings">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Voice Settings" mobileTitle="Voice">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-semibold text-foreground">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Voice notes (7 days)</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4 text-center">
                <p className="text-2xl font-semibold text-foreground">
                  {stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Transcription success</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              Voice Note Settings
            </CardTitle>
            <CardDescription>
              Configure how voice notes work for your organization.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Enable voice notes */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Voice Notes</Label>
                <p className="text-xs text-muted-foreground">
                  Allow visitors and staff to record voice notes.
                </p>
              </div>
              <Switch
                checked={enableVoice}
                onCheckedChange={(v) => { setEnableVoice(v); setDirty(true); }}
              />
            </div>

            {/* Store audio */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />
                  Store Audio Files
                  <HelpTooltip
                    content="Controls whether original audio recordings are kept after transcription. When disabled, audio is deleted after transcription — only the text transcript is retained."
                  />
                </Label>
                <p className="text-xs text-muted-foreground">
                  When disabled, audio is deleted after transcription. Only the transcript is kept.
                </p>
              </div>
              <Switch
                checked={storeAudio}
                onCheckedChange={(v) => { setStoreAudio(v); setDirty(true); }}
              />
            </div>

            {/* Max duration */}
            <div className="space-y-3">
              <Label className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                Maximum Recording Duration
              </Label>
              <div className="flex items-center gap-4">
                <Slider
                  value={[maxSeconds]}
                  onValueChange={([v]) => { setMaxSeconds(v); setDirty(true); }}
                  min={60}
                  max={300}
                  step={30}
                  className="flex-1"
                />
                <span className="text-sm font-mono w-16 text-right">
                  {Math.floor(maxSeconds / 60)}:{(maxSeconds % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>

            <Button
              className="w-full"
              disabled={!dirty || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Saving…</>
              ) : (
                'Save Settings'
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
