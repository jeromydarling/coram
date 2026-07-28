import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Video, Square, Loader2 } from 'lucide-react';

interface ScreenRecorderProps {
  onRecordingComplete: (file: File) => void;
  disabled?: boolean;
}

export function ScreenRecorder({ onRecordingComplete, disabled }: ScreenRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [duration, setDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setIsPreparing(true);
      
      // Request screen capture
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'browser',
        },
        audio: false,
      });
      
      streamRef.current = stream;
      chunksRef.current = [];
      
      // Create MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9',
      });
      
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        // Create video file from chunks
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const file = new File([blob], `screen-recording-${Date.now()}.webm`, {
          type: 'video/webm',
        });
        
        onRecordingComplete(file);
        
        // Cleanup
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
          streamRef.current = null;
        }
        
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        setDuration(0);
        setIsRecording(false);
      };
      
      // Handle stream ending (user stops sharing)
      stream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current?.state === 'recording') {
          mediaRecorderRef.current.stop();
        }
      };
      
      // Start recording
      mediaRecorder.start(1000); // Collect data every second
      setIsRecording(true);
      setIsPreparing(false);
      
      // Start timer
      timerRef.current = window.setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Failed to start screen recording:', error);
      setIsPreparing(false);
    }
  }, [onRecordingComplete]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Check if screen recording is supported
  const isSupported = 'mediaDevices' in navigator && 'getDisplayMedia' in navigator.mediaDevices;

  if (!isSupported) {
    return null;
  }

  if (isRecording) {
    return (
      <Button
        type="button"
        variant="destructive"
        size="sm"
        onClick={stopRecording}
        className="gap-2"
      >
        <Square className="w-4 h-4 fill-current" />
        Stop Recording ({formatDuration(duration)})
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={startRecording}
      disabled={disabled || isPreparing}
      className="gap-2"
    >
      {isPreparing ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <Video className="w-4 h-4" />
      )}
      {isPreparing ? 'Starting...' : 'Record Screen'}
    </Button>
  );
}
