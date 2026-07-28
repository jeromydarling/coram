import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!lovableApiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user-context client to verify auth + role
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseUser.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: roleRows } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roleRows?.some((r: { role: string }) => r.role === "admin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { storage_path, title, key } = await req.json();

    if (!storage_path || !title || !key) {
      return new Response(JSON.stringify({ error: "Missing required fields: storage_path, title, key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Download PDF from storage — try direct download, fall back to signed URL
    let fileData: Blob | null = null;
    const { data: dlData, error: downloadError } = await supabase.storage
      .from("kb-uploads")
      .download(storage_path);

    if (downloadError || !dlData) {
      console.warn("Direct download failed, trying signed URL:", downloadError?.message);
      const { data: signedData, error: signedErr } = await supabase.storage
        .from("kb-uploads")
        .createSignedUrl(storage_path, 120);

      if (signedErr || !signedData?.signedUrl) {
        console.error("Signed URL also failed:", signedErr);
        return new Response(JSON.stringify({ error: "Failed to download PDF" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fetchRes = await fetch(signedData.signedUrl);
      if (!fetchRes.ok) {
        console.error("Fetch from signed URL failed:", fetchRes.status);
        return new Response(JSON.stringify({ error: "Failed to download PDF" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      fileData = await fetchRes.blob();
    } else {
      fileData = dlData;
    }

    // Reject files over 5MB to stay within edge function memory limits
    // (base64 encoding ~doubles size, plus JSON envelope overhead)
    const fileSizeBytes = fileData.size;
    if (fileSizeBytes > 5 * 1024 * 1024) {
      // Clean up the uploaded file
      await supabase.storage.from("kb-uploads").remove([storage_path]);
      return new Response(JSON.stringify({ error: "PDF too large (max 5 MB). Please compress it and try again." }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Convert to base64 for Gemini (chunked to avoid stack overflow)
    const arrayBuffer = await fileData.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const chunkSize = 8192;
    let binary = "";
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
      for (let j = 0; j < chunk.length; j++) {
        binary += String.fromCharCode(chunk[j]);
      }
    }
    const base64 = btoa(binary);

    // Send to Gemini via Lovable AI Gateway for markdown extraction
    // NOTE: Gemini image_url does NOT support PDF URLs — must use data URI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a document-to-markdown converter. Convert the provided PDF document into clean, well-structured markdown. 
Preserve all meaningful content including headings, lists, tables, and key data points.
Do NOT add commentary or analysis. Output ONLY the markdown conversion of the document content.
Use proper markdown heading hierarchy (# ## ### etc).
For tables, use proper markdown table syntax.
For lists, use proper markdown list syntax.
Omit page numbers, headers/footers, and decorative elements.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Convert this PDF document to clean markdown. Output only the converted content.",
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:application/pdf;base64,${base64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", aiResponse.status, errText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit exceeded, try again shortly" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI processing failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await aiResponse.json();
    const markdownContent = aiResult.choices?.[0]?.message?.content;

    if (!markdownContent) {
      return new Response(JSON.stringify({ error: "AI returned empty content" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if key already exists
    const { data: existing } = await supabase
      .from("ai_knowledge_documents")
      .select("id, version")
      .eq("key", key)
      .maybeSingle();

    let documentId: string;
    let version: number;

    if (existing) {
      // Update existing document
      version = existing.version + 1;
      documentId = existing.id;

      const { error: updateErr } = await supabase
        .from("ai_knowledge_documents")
        .update({
          content_markdown: markdownContent,
          version,
          source_urls: [`storage:kb-uploads/${storage_path}`],
        })
        .eq("id", existing.id);

      if (updateErr) throw updateErr;
    } else {
      // Create new document
      version = 1;
      const { data: newDoc, error: insertErr } = await supabase
        .from("ai_knowledge_documents")
        .insert({
          key,
          title,
          content_markdown: markdownContent,
          created_by: user.id,
          active: true,
          version: 1,
          source_urls: [`storage:kb-uploads/${storage_path}`],
        })
        .select("id")
        .single();

      if (insertErr) throw insertErr;
      documentId = newDoc.id;
    }

    // Create version record
    const { error: verErr } = await supabase
      .from("ai_knowledge_document_versions")
      .insert({
        document_id: documentId,
        version,
        content_markdown: markdownContent,
        source_urls: [`storage:kb-uploads/${storage_path}`],
        created_by: user.id,
      });

    if (verErr) console.warn("Version record failed:", verErr);

    // Clean up uploaded file
    await supabase.storage.from("kb-uploads").remove([storage_path]);

    return new Response(
      JSON.stringify({
        success: true,
        document_id: documentId,
        version,
        key,
        title,
        content_length: markdownContent.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("parse-pdf-to-kb error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
