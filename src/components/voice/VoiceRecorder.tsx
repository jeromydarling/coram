/**
 * VoiceRecorder — One-tap voice note capture with transcription.
 *
 * WHAT: Records audio, uploads to storage, triggers transcription, shows editable transcript.
 * WHERE: Used on Visits page, event detail, contact/opportunity detail pages.
 * WHY: Enables elderly volunteers and field workers to capture notes without typing.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Mic, Square, Upload, Loader2, Check, AlertCircle, FileAudio } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from '@/components/ui/sonner';

interface OnBehalfOfInfo {
  volunteerId: string;
  volunteerName: string;
  activityId: string;
}

interface VoiceRecorderProps {
  subjectType: 'opportunity' | 'contact' | 'event' | 'activity' | 'reflection';
  subjectId: string;
  onTranscriptSaved?: (transcript: string, voiceNoteId: string) => void;
  /** QA mode: show file upload instead of mic */
  qaMode?: boolean;
  /** When recording on behalf of a volunteer without a login */
  onBehalfOf?: OnBehalfOfInfo;
}

type RecorderState = 'idle' | 'recording' | 'uploading' | 'transcribing' | 'editing' | 'saving' | 'done' | 'error';

export function VoiceRecorder({ subjectType, subjectId, onTranscriptSaved, qaMode, onBehalfOf }: VoiceRecorderProps) {
  const { user } = useAuth();
  const { tenantId } = useTenant();
  const [state, setState] = useState<RecorderState>('idle');
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [voiceNoteId, setVoiceNoteId] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxSeconds = 180; // 3 minutes

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start(1000); // collect chunks every second
      setState('recording');
      setSeconds(0);
      setErrorMsg('');

      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev >= maxSeconds - 1) {
            stopRecording();
            return maxSeconds;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Microphone access error:', err);
      setErrorMsg('Microphone access denied. Please allow microphone access and try again.');
      setState('error');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      // Process after a short delay to let final chunks arrive
      setTimeout(() => processAudio(new Blob(chunksRef.current, { type: 'audio/webm' })), 200);
    }
  }, []);

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processAudio(file);
  }, []);

  const processAudio = async (audioBlob: Blob) => {
    if (!user?.id || !tenantId) return;

    setState('uploading');

    try {
      // 1. Create voice_notes row
      const { data: vn, error: vnErr } = await supabase
        .from('voice_notes')
        .insert({
          tenant_id: tenantId,
          user_id: user.id,
          subject_type: subjectType,
          subject_id: subjectId,
          recorded_at: new Date().toISOString(),
          audio_mime: audioBlob.type || 'audio/webm',
          audio_seconds: seconds || Math.ceil(audioBlob.size / 16000),
          transcript_status: 'pending',
          ...(onBehalfOf ? {
            contact_id: subjectType === 'contact' ? subjectId : null,
            author_volunteer_id: onBehalfOf.volunteerId,
            recorded_by_user_id: user.id,
            recording_mode: 'on_behalf_of',
            source_activity_id: onBehalfOf.activityId,
          } : {
            recording_mode: 'self',
            recorded_by_user_id: user.id,
          }),
        } as any)
        .select('id')
        .single();

      if (vnErr) throw vnErr;
      const noteId = vn.id;
      setVoiceNoteId(noteId);

      // 2. Upload audio to storage
      const storagePath = `tenant/${tenantId}/user/${user.id}/${noteId}.webm`;
      const { error: uploadErr } = await supabase.storage
        .from('voice-notes')
        .upload(storagePath, audioBlob, { contentType: audioBlob.type || 'audio/webm' });

      if (uploadErr) {
        console.warn('Storage upload failed, will send audio directly:', uploadErr.message);
      } else {
        // Update audio_path
        await supabase
          .from('voice_notes')
          .update({ audio_path: storagePath } as any)
          .eq('id', noteId);
      }

      // 3. Call transcription edge function
      setState('transcribing');

      if (uploadErr) {
        // Send audio directly via multipart
        const formData = new FormData();
        formData.append('voice_note_id', noteId);
        formData.append('audio', audioBlob, 'recording.webm');

        const resp = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-transcribe`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
            body: formData,
          }
        );
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: 'Transcription failed' }));
          throw new Error(err.error || 'Transcription failed');
        }
        const result = await resp.json();
        setTranscript(result.transcript || '');
      } else {
        // Audio is in storage, just pass the ID
        const { data: fnData, error: fnErr } = await supabase.functions.invoke('voice-transcribe', {
          body: { voice_note_id: noteId },
        });
        if (fnErr) throw fnErr;
        setTranscript(fnData?.transcript || '');
      }

      setState('editing');
    } catch (err: any) {
      console.error('Voice note error:', err);
      setErrorMsg(err.message || 'Something went wrong');
      setState('error');
      toast.error('Voice note failed: ' + (err.message || 'Unknown error'));
    }
  };

  const saveTranscript = async () => {
    if (!voiceNoteId || !transcript.trim()) return;

    setState('saving');
    try {
      // Update the voice note transcript (and the linked activity)
      const { error } = await supabase
        .from('voice_notes')
        .update({ transcript: transcript.trim() } as any)
        .eq('id', voiceNoteId);
      if (error) throw error;

      // Also update the canonical activity record if it exists
      const { data: vn } = await supabase
        .from('voice_notes')
        .select('source_activity_id')
        .eq('id', voiceNoteId)
        .single();

      if ((vn as any)?.source_activity_id) {
        await supabase
          .from('activities')
          .update({ notes: transcript.trim() })
          .eq('id', (vn as any).source_activity_id);
      }

      setState('done');
      toast.success('Voice note saved');
      onTranscriptSaved?.(transcript.trim(), voiceNoteId);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to save');
      setState('error');
    }
  };

  const reset = () => {
    setState('idle');
    setTranscript('');
    setErrorMsg('');
    setVoiceNoteId(null);
    setSeconds(0);
    chunksRef.current = [];
  };

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <Card data-testid="voice-recorder" className="border-primary/20">
      <CardContent className="p-4 space-y-3">
        {/* Privacy disclaimer */}
        <p className="text-xs text-muted-foreground italic">
          Keep notes focused on relationship context. Avoid sensitive medical details.
        </p>

        {/* Idle state */}
        {state === 'idle' && (
          <div className="flex gap-2">
            {!qaMode && (
              <Button
                data-testid="voice-record-btn"
                size="lg"
                className="flex-1 h-14 text-base gap-2"
                onClick={startRecording}
              >
                <Mic className="h-6 w-6" />
                Record Voice Note
              </Button>
            )}
            {/* File upload (always available, prominent in QA mode) */}
            <Button
              data-testid="voice-upload-btn"
              size="lg"
              variant={qaMode ? 'default' : 'outline'}
              className={qaMode ? 'flex-1 h-14 text-base gap-2' : 'h-14'}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileAudio className="h-5 w-5" />
              {qaMode && 'Upload Audio'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={handleFileUpload}
              data-testid="voice-file-input"
            />
          </div>
        )}

        {/* Recording state */}
        {state === 'recording' && (
          <div className="space-y-3 text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="w-4 h-4 rounded-full bg-destructive animate-pulse" />
              <span className="text-2xl font-mono tabular-nums" data-testid="voice-timer">
                {formatTime(seconds)}
              </span>
              <span className="text-xs text-muted-foreground">/ {formatTime(maxSeconds)}</span>
            </div>
            <Button
              data-testid="voice-stop-btn"
              size="lg"
              variant="destructive"
              className="w-full h-14 text-base gap-2"
              onClick={stopRecording}
            >
              <Square className="h-6 w-6" />
              Stop Recording
            </Button>
          </div>
        )}

        {/* Uploading / Transcribing */}
        {(state === 'uploading' || state === 'transcribing') && (
          <div className="flex flex-col items-center gap-3 py-4" data-testid="voice-processing">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">
              {state === 'uploading' ? 'Uploading…' : 'Transcribing…'}
            </p>
          </div>
        )}

        {/* Editing transcript */}
        {state === 'editing' && (
          <div className="space-y-3">
            <label className="text-sm font-medium text-foreground">Edit Transcript</label>
            <Textarea
              data-testid="voice-transcript-edit"
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              rows={4}
              className="text-base"
              placeholder="Transcript will appear here…"
            />
            <div className="flex gap-2">
              <Button
                data-testid="voice-save-btn"
                size="lg"
                className="flex-1 h-12 text-base gap-2"
                onClick={saveTranscript}
                disabled={!transcript.trim()}
              >
                <Check className="h-5 w-5" />
                Save Note
              </Button>
              <Button size="lg" variant="outline" className="h-12" onClick={reset}>
                Discard
              </Button>
            </div>
          </div>
        )}

        {/* Saving */}
        {state === 'saving' && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm text-muted-foreground">Saving…</span>
          </div>
        )}

        {/* Done */}
        {state === 'done' && (
          <div className="space-y-3 text-center py-2">
            <div className="flex items-center justify-center gap-2 text-primary">
              <Check className="h-5 w-5" />
              <span className="font-medium">Voice note saved</span>
            </div>
            <Button variant="outline" size="sm" onClick={reset} data-testid="voice-new-btn">
              Record Another
            </Button>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div className="space-y-3">
            <div className="flex items-start gap-2 text-destructive">
              <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <p className="text-sm">{errorMsg}</p>
            </div>
            <Button variant="outline" size="sm" onClick={reset} data-testid="voice-retry-btn">
              Try Again
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
