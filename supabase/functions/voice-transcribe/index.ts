/**
 * voice-transcribe — Transcribes uploaded audio and creates a canonical activity record.
 *
 * WHAT: Downloads audio from storage, sends to Lovable AI for transcription, saves transcript.
 * WHERE: Called by client after voice_notes row is created with audio uploaded.
 * WHY: Converts voice notes into NRI-ready text that feeds the relationship memory system.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonRes({ error: "Unauthorized" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");

    // Auth client to verify user
    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claimsData?.claims) return jsonRes({ error: "Unauthorized" }, 401);
    const userId = claimsData.claims.sub as string;

    // Service client for privileged operations
    const svc = createClient(supabaseUrl, serviceKey);

    // Parse body — supports JSON { voice_note_id } or multipart with audio + metadata
    let voiceNoteId: string;
    let audioBlob: Blob | null = null;

    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      // Multipart: audio file + voice_note_id
      const formData = await req.formData();
      voiceNoteId = formData.get("voice_note_id") as string;
      const audioFile = formData.get("audio") as File | null;
      if (audioFile) audioBlob = audioFile;
    } else {
      const body = await req.json();
      voiceNoteId = body.voice_note_id;
    }

    if (!voiceNoteId) return jsonRes({ error: "voice_note_id required" }, 400);

    // Fetch the voice note
    const { data: voiceNote, error: vnErr } = await svc
      .from("voice_notes")
      .select("*")
      .eq("id", voiceNoteId)
      .single();

    if (vnErr || !voiceNote) return jsonRes({ error: "Voice note not found" }, 404);
    if (voiceNote.user_id !== userId) return jsonRes({ error: "Not your voice note" }, 403);
    if (voiceNote.transcript_status === "completed") return jsonRes({ error: "Already transcribed" }, 409);

    // Mark as processing
    await svc
      .from("voice_notes")
      .update({ transcript_status: "processing" })
      .eq("id", voiceNoteId);

    // Get audio data
    let audioData: ArrayBuffer | null = null;
    let audioMime = voiceNote.audio_mime || "audio/webm";

    if (audioBlob) {
      // Audio sent directly in request
      audioData = await audioBlob.arrayBuffer();
      audioMime = audioBlob.type || audioMime;
    } else if (voiceNote.audio_path) {
      // Download from storage
      const { data: fileData, error: dlErr } = await svc.storage
        .from("voice-notes")
        .download(voiceNote.audio_path);
      if (dlErr || !fileData) {
        await svc.from("voice_notes").update({
          transcript_status: "failed",
          error: { message: "Failed to download audio", detail: dlErr?.message },
        }).eq("id", voiceNoteId);
        return jsonRes({ error: "Failed to download audio" }, 500);
      }
      audioData = await fileData.arrayBuffer();
    }

    if (!audioData) {
      await svc.from("voice_notes").update({
        transcript_status: "failed",
        error: { message: "No audio data available" },
      }).eq("id", voiceNoteId);
      return jsonRes({ error: "No audio data" }, 400);
    }

    // Check size limits
    const { data: settings } = await svc
      .from("tenant_voice_settings")
      .select("*")
      .eq("tenant_id", voiceNote.tenant_id)
      .maybeSingle();

    const maxMb = settings?.max_audio_mb ?? 20;
    if (audioData.byteLength > maxMb * 1024 * 1024) {
      await svc.from("voice_notes").update({
        transcript_status: "failed",
        error: { message: `Audio exceeds ${maxMb}MB limit` },
      }).eq("id", voiceNoteId);
      return jsonRes({ error: `Audio exceeds ${maxMb}MB limit` }, 413);
    }

    // Transcribe using Lovable AI
    if (!lovableKey) {
      await svc.from("voice_notes").update({
        transcript_status: "failed",
        error: { message: "LOVABLE_API_KEY not configured" },
      }).eq("id", voiceNoteId);
      return jsonRes({ error: "Transcription service not configured" }, 500);
    }

    // Convert audio to base64 for the AI model
    const audioBase64 = btoa(
      new Uint8Array(audioData).reduce((data, byte) => data + String.fromCharCode(byte), "")
    );

    // Use Gemini's audio understanding capability
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "You are a transcription assistant. Transcribe the audio faithfully. Return ONLY the transcript text, nothing else. If the audio is unclear or empty, return '[inaudible]'. Do not add any commentary, labels, or formatting — just the spoken words.",
          },
          {
            role: "user",
            content: [
              {
                type: "input_audio",
                input_audio: {
                  data: audioBase64,
                  format: audioMime.includes("wav") ? "wav" : audioMime.includes("mp3") ? "mp3" : "wav",
                },
              },
              { type: "text", text: "Transcribe this audio recording." },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[voice-transcribe] AI error:", aiResponse.status, errText);
      await svc.from("voice_notes").update({
        transcript_status: "failed",
        error: { message: "Transcription failed", status: aiResponse.status, detail: errText.slice(0, 500) },
      }).eq("id", voiceNoteId);

      if (aiResponse.status === 429) return jsonRes({ error: "Rate limited, try again later" }, 429);
      if (aiResponse.status === 402) return jsonRes({ error: "Credits exhausted" }, 402);
      return jsonRes({ error: "Transcription failed" }, 500);
    }

    const aiResult = await aiResponse.json();
    const transcript = aiResult.choices?.[0]?.message?.content?.trim() || "[inaudible]";

    // Create canonical activity record for NRI
    const activityId = `voice-${voiceNoteId.slice(0, 8)}-${Date.now()}`;
    const activityInsert: Record<string, unknown> = {
      activity_id: activityId,
      activity_type: "Visit Note",
      activity_date_time: voiceNote.recorded_at,
      notes: transcript,
      tenant_id: voiceNote.tenant_id,
    };

    // Link to the right entity
    if (voiceNote.subject_type === "opportunity") {
      activityInsert.opportunity_id = voiceNote.subject_id;
    } else if (voiceNote.subject_type === "contact") {
      activityInsert.contact_id = voiceNote.subject_id;
    }
    // Events and other types: notes stored but not linked to specific activity FK

    const { data: activityRow, error: actErr } = await svc
      .from("activities")
      .insert(activityInsert)
      .select("id")
      .single();

    if (actErr) {
      console.warn("[voice-transcribe] Activity insert warning:", actErr.message);
    }

    // Update voice note with transcript
    await svc
      .from("voice_notes")
      .update({
        transcript,
        transcript_status: "completed",
        transcript_provider: "lovable-ai/gemini-2.5-flash",
        source_activity_id: activityRow?.id || null,
      })
      .eq("id", voiceNoteId);

    // If store_audio is false, delete the audio file after transcription
    if (settings && !settings.store_audio && voiceNote.audio_path) {
      await svc.storage.from("voice-notes").remove([voiceNote.audio_path]);
      await svc.from("voice_notes").update({ audio_path: null }).eq("id", voiceNoteId);
    }

    return jsonRes({
      ok: true,
      transcript,
      source_activity_id: activityRow?.id || null,
    });
  } catch (e) {
    console.error("[voice-transcribe] error:", e);
    return jsonRes(
      { error: e instanceof Error ? e.message : "Unknown error" },
      500
    );
  }
});
