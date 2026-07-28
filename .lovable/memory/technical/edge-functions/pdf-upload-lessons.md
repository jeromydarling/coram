# Memory: technical/edge-functions/pdf-upload-lessons
Updated: 2026-02-16

## PDF-to-KB Upload Edge Function — Hard-Won Lessons

### 1. Multi-Role Users Break `.maybeSingle()`
Users can have multiple roles (e.g., `admin` + `regional_lead`). Using `.maybeSingle()` to check roles returns an error when multiple rows exist, causing silent null and 403 failures. **Always fetch all roles and use `.some()` to check.**

### 2. Service-Role Storage Downloads Need Auth Config
`createClient(url, serviceKey)` alone doesn't guarantee service-role auth headers are sent for storage operations. Add explicit auth config:
```ts
createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
```
If `.download()` still fails (502 Bad Gateway), fall back to `.createSignedUrl()` + `fetch()`.

### 3. Base64 Encoding Blows the Stack on Files > ~60KB
`btoa(String.fromCharCode(...new Uint8Array(buffer)))` uses the spread operator which passes every byte as a function argument. This exceeds the call stack limit for any non-trivial file. **Always use chunked encoding:**
```ts
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
```

### 4. Long-Running AI Calls May Timeout the Client
The Gemini PDF-to-markdown call can take 30+ seconds. On mobile, the browser may kill the connection or background the tab. The client-side `supabase.functions.invoke()` then throws an error even though the edge function completed successfully. **Always invalidate queries in `finally`, not just `onSuccess`:**
```ts
} finally {
  setIsProcessing(false);
  queryClient.invalidateQueries({ queryKey: ['ai-kb-documents'] });
}
```
Show a non-destructive toast on catch ("may still be processing") instead of a hard error.

### 5. Mobile File Picker Destroys React State
When the OS file picker opens on mobile, the browser may unmount the entire React tree. State setters captured in closures become stale. **Use a module-level variable** (`pendingFile`) outside the component to store the selected file, and consume it via `useEffect` on remount. Poll with `setInterval` as a safety net.

### 6. Edge Function Memory Limit — 5 MB Hard Cap for PDFs
Edge functions have a ~150MB memory ceiling. Loading a PDF into memory, converting to base64 (2× size), embedding in a JSON payload, and holding the AI response easily exceeds this for files over ~5MB. **Enforce a 5MB limit in both the UI (client-side toast) and the edge function (413 response).** Gemini's `image_url` field does NOT support PDF URLs — only PNG/JPEG/WebP/GIF. PDFs **must** use `data:application/pdf;base64,...` data URIs, so the signed-URL optimization is not possible.

### 7. `refetchOnWindowFocus` Causes Premature Unmounts
React Query's default `refetchOnWindowFocus` behavior can cause parent components to show loading spinners during background refetches, unmounting child components (like the upload form). Guard loading states: `if (isLoading && documents.length === 0)` to only show full-page spinners on initial load.
