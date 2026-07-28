import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Flexible interface to handle Read.ai native webhook AND Zapier formats
interface ReadAIPayload {
  // Read.ai native uses session_id; Zapier may use meeting_id/meetingId/id
  session_id?: string;
  meeting_id?: string;
  meetingId?: string;
  id?: string;
  // Read.ai native: trigger field (e.g. "meeting_end")
  trigger?: string;
  // Common variations for meeting_title
  meeting_title?: string;
  meetingTitle?: string;
  title?: string;
  name?: string;
  // Common variations for meeting_start_time
  meeting_start_time?: string;
  meetingStartTime?: string;
  start_time?: string;
  startTime?: string;
  date?: string;
  // Read.ai native: end_time
  end_time?: string;
  // Common variations for meet_url
  meet_url?: string;
  meetUrl?: string;
  meeting_url?: string;
  meetingUrl?: string;
  hangout_link?: string;
  hangoutLink?: string;
  // Common variations for recording_url
  recording_url?: string;
  recordingUrl?: string;
  recording_link?: string;
  recordingLink?: string;
  // Read.ai native: report_url
  report_url?: string;
  reportUrl?: string;
  // Common variations for summary
  summary?: string;
  notes?: string;
  description?: string;
  // Action items: Read.ai native sends [{text: "..."}], Zapier may send string[]
  action_items?: unknown;
  actionItems?: unknown;
  tasks?: unknown;
  // Read.ai native: key_questions, topics, chapter_summaries, transcript
  key_questions?: unknown;
  topics?: unknown;
  chapter_summaries?: unknown;
  transcript?: unknown;
  // Attendees: Read.ai native uses participants with {name, first_name, last_name, email}
  attendees?: unknown;
  participants?: unknown;
  // Read.ai native: owner (the meeting host)
  owner?: { name?: string; email?: string };
  // Read.ai native: platform info
  platform_meeting_id?: string | null;
  platform?: string | null;
}

// Parse action items from array of objects [{text:"..."}], string[], or text format
function parseActionItems(input: unknown): string[] {
  if (!input) return [];
  if (Array.isArray(input)) {
    return input
      .map(item => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object' && 'text' in item) return String((item as {text:string}).text);
        return '';
      })
      .filter(s => s.length > 0);
  }
  if (typeof input === 'string') {
    return input
      .split(/\n\n+/)
      .map(item => item.replace(/^text:\s*/i, '').trim())
      .filter(item => item.length > 0);
  }
  return [];
}

// Parse attendees/participants from Read.ai native or Zapier formats
function parseAttendees(input: unknown): Array<{ email: string; name?: string }> {
  if (!input) return [];
  if (Array.isArray(input)) {
    const result: Array<{ email: string; name?: string }> = [];
    for (const item of input) {
      if (typeof item === 'object' && item !== null) {
        const obj = item as Record<string, unknown>;
        const email = obj.email ? String(obj.email) : '';
        if (!email || email === 'null' || email === 'None') continue;
        const name = obj.name ? String(obj.name) :
          [obj.first_name, obj.last_name].filter(Boolean).join(' ') || undefined;
        result.push({ email, name: name || undefined });
      }
    }
    return result;
  }
  if (typeof input === 'string') {
    const attendees: Array<{ email: string; name?: string }> = [];
    const blocks = input.split(/\n\n+/);
    for (const block of blocks) {
      const lines = block.split('\n');
      let email = '';
      let name = '';
      for (const line of lines) {
        const emailMatch = line.match(/^email:\s*(.+)/i);
        const nameMatch = line.match(/^name:\s*(.+)/i);
        if (emailMatch && emailMatch[1] !== 'None') email = emailMatch[1].trim();
        if (nameMatch) name = nameMatch[1].trim();
      }
      if (email) {
        attendees.push({ email, name: name || undefined });
      }
    }
    return attendees;
  }
  return [];
}

// Normalize the payload to extract values regardless of field naming
function normalizePayload(payload: ReadAIPayload) {
  const rawActionItems = payload.action_items || payload.actionItems || payload.tasks;
  const rawAttendees = payload.attendees || payload.participants;
  
  return {
    // Read.ai native uses session_id as the unique meeting identifier
    meeting_id: payload.session_id || payload.meeting_id || payload.meetingId || payload.id || null,
    meeting_title: payload.meeting_title || payload.meetingTitle || payload.title || payload.name || null,
    meeting_start_time: payload.meeting_start_time || payload.meetingStartTime || payload.start_time || payload.startTime || payload.date || null,
    meet_url: payload.meet_url || payload.meetUrl || payload.meeting_url || payload.meetingUrl || payload.hangout_link || payload.hangoutLink || null,
    recording_url: payload.recording_url || payload.recordingUrl || payload.recording_link || payload.recordingLink || payload.report_url || payload.reportUrl || null,
    summary: payload.summary || payload.notes || payload.description || null,
    action_items: parseActionItems(rawActionItems),
    attendees: parseAttendees(rawAttendees)
  };
}

interface ActionItemMatch {
  item: string;
  matched: boolean;
  matchedName?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const apiKey = url.searchParams.get('key');

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'Missing API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Validate API key using secure RPC function (service role reads from webhook_keys table)
    const { data: validatedUserId, error: keyError } = await supabase
      .rpc('validate_webhook_key', { p_key: apiKey });

    if (keyError || !validatedUserId) {
      console.error('Invalid API key:', apiKey);
      return new Response(
        JSON.stringify({ error: 'Invalid API key' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = validatedUserId as string;

    // Parse and normalize payload
    const rawPayload: ReadAIPayload = await req.json();
    console.log('Received raw payload:', JSON.stringify(rawPayload, null, 2));
    
    const payload = normalizePayload(rawPayload);
    console.log('Normalized payload:', JSON.stringify(payload, null, 2));

    // Validate required fields (after normalization)
    if (!payload.meeting_id || !payload.meeting_title) {
      console.error('Missing required fields after normalization. meeting_id:', payload.meeting_id, 'meeting_title:', payload.meeting_title);
      console.error('Available keys in raw payload:', Object.keys(rawPayload));
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: meeting_id, meeting_title',
          hint: 'Ensure your Zapier mapping includes fields like "meeting_id" or "id" and "meeting_title" or "title"',
          received_keys: Object.keys(rawPayload)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check idempotency - prevent duplicate processing
    const { data: existingNote } = await supabase
      .from('meeting_notes')
      .select('id')
      .eq('user_id', userId)
      .eq('source_meeting_id', payload.meeting_id)
      .single();

    if (existingNote) {
      console.log('Meeting already processed:', payload.meeting_id);
      return new Response(
        JSON.stringify({ success: true, message: 'Meeting already processed', meeting_note_id: existingNote.id }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile for name matching
    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, nickname, name_aliases')
      .eq('user_id', userId)
      .single();

    // Build list of names to match against
    const userNames: string[] = [];
    if (profile?.display_name) {
      const firstName = profile.display_name.split(' ')[0];
      userNames.push(firstName.toLowerCase());
    }
    if (profile?.nickname) {
      userNames.push(profile.nickname.toLowerCase());
    }
    if (profile?.name_aliases && Array.isArray(profile.name_aliases)) {
      profile.name_aliases.forEach((alias: string) => {
        userNames.push(alias.toLowerCase());
      });
    }

    // Fallback: extract from email if no names set
    if (userNames.length === 0) {
      const { data: authUser } = await supabase.auth.admin.getUserById(userId);
      if (authUser?.user?.email) {
        const emailPrefix = authUser.user.email.split('@')[0];
        userNames.push(emailPrefix.toLowerCase());
      }
    }

    console.log('User names for matching:', userNames);

    // Match to Google Calendar event
    let calendarEventId: string | null = null;
    let linkedContactId: string | null = null;

    // First try matching by Meet URL
    if (payload.meet_url) {
      const meetCode = payload.meet_url.match(/meet\.google\.com\/([a-z-]+)/)?.[1];
      if (meetCode) {
        // Search for events with this meet link in description or location
        const { data: events } = await supabase
          .from('google_calendar_events')
          .select('id, contact_id, description, location')
          .eq('user_id', userId)
          .or(`description.ilike.%${meetCode}%,location.ilike.%${meetCode}%`);

        if (events && events.length > 0) {
          calendarEventId = events[0].id;
          linkedContactId = events[0].contact_id;
        }
      }
    }

    // Fallback: match by title and time window (±2 hours)
    if (!calendarEventId && payload.meeting_start_time) {
      const meetingTime = new Date(payload.meeting_start_time);
      const startWindow = new Date(meetingTime.getTime() - 2 * 60 * 60 * 1000).toISOString();
      const endWindow = new Date(meetingTime.getTime() + 2 * 60 * 60 * 1000).toISOString();

      // Try title match first
      const { data: titleEvents } = await supabase
        .from('google_calendar_events')
        .select('id, contact_id, title')
        .eq('user_id', userId)
        .gte('start_time', startWindow)
        .lte('start_time', endWindow)
        .ilike('title', `%${payload.meeting_title.substring(0, 30)}%`);

      if (titleEvents && titleEvents.length > 0) {
        calendarEventId = titleEvents[0].id;
        linkedContactId = titleEvents[0].contact_id;
      } else {
        // Title mismatch (Read.ai often generates its own title).
        // Fall back to closest event in the time window.
        const { data: timeEvents } = await supabase
          .from('google_calendar_events')
          .select('id, contact_id, title, start_time')
          .eq('user_id', userId)
          .gte('start_time', startWindow)
          .lte('start_time', endWindow)
          .order('start_time', { ascending: true });

        if (timeEvents && timeEvents.length > 0) {
          // Pick the event closest to the meeting start time
          let closest = timeEvents[0];
          let closestDiff = Math.abs(new Date(closest.start_time).getTime() - meetingTime.getTime());
          for (const ev of timeEvents) {
            const diff = Math.abs(new Date(ev.start_time).getTime() - meetingTime.getTime());
            if (diff < closestDiff) {
              closest = ev;
              closestDiff = diff;
            }
          }
          calendarEventId = closest.id;
          linkedContactId = closest.contact_id;
          console.log(`Time-only fallback matched calendar event "${closest.title}" (diff: ${Math.round(closestDiff / 60000)}min)`);
        }
      }
    }

    // Auto-mark as attended if we found a matching calendar event
    if (calendarEventId) {
      console.log('Marking calendar event as attended:', calendarEventId);
      await supabase
        .from('google_calendar_events')
        .update({ attended: true })
        .eq('id', calendarEventId);
    }

    // Filter action items for user's name
    const actionItems = payload.action_items || [];
    const actionItemMatches: ActionItemMatch[] = actionItems.map(item => {
      const itemLower = item.toLowerCase();
      const matchedName = userNames.find(name => itemLower.includes(name));
      return {
        item,
        matched: !!matchedName,
        matchedName
      };
    });

    const matchedItems = actionItemMatches.filter(a => a.matched).map(a => a.item);
    const skippedItems = actionItemMatches.filter(a => !a.matched).map(a => a.item);

    console.log('Action items - matched:', matchedItems.length, 'skipped:', skippedItems.length);

    // Create meeting note
    const { data: meetingNote, error: noteError } = await supabase
      .from('meeting_notes')
      .insert({
        user_id: userId,
        google_calendar_event_id: calendarEventId,
        source: 'read_ai',
        source_meeting_id: payload.meeting_id,
        meeting_title: payload.meeting_title,
        meeting_start_time: payload.meeting_start_time || null,
        meet_link: payload.meet_url || null,
        summary: payload.summary || null,
        action_items: actionItems,
        matched_action_items: matchedItems,
        skipped_action_items: skippedItems,
        recording_url: payload.recording_url || null
      })
      .select()
      .single();

    if (noteError) {
      console.error('Error creating meeting note:', noteError);
      throw noteError;
    }

    console.log('Created meeting note:', meetingNote.id);

    // Link contacts via attendee email matching
    const linkedContactIds: string[] = [];
    if (payload.attendees && payload.attendees.length > 0) {
      const attendeeEmails = payload.attendees
        .map(a => a.email?.toLowerCase())
        .filter((e): e is string => !!e);
      
      const { data: contacts } = attendeeEmails.length > 0
        ? await supabase
            .from('contacts')
            .select('id, email')
            .in('email', attendeeEmails)
        : { data: null };

      if (contacts && contacts.length > 0) {
        // Create junction records
        const junctionRecords = contacts.map((contact, index) => ({
          meeting_note_id: meetingNote.id,
          contact_id: contact.id,
          is_primary: index === 0 // First match is primary
        }));

        await supabase
          .from('meeting_note_contacts')
          .insert(junctionRecords);

        linkedContactIds.push(...contacts.map(c => c.id));
        console.log('Linked contacts:', linkedContactIds.length);
      }
    }

    // If calendar event had a contact, also link it
    if (linkedContactId && !linkedContactIds.includes(linkedContactId)) {
      await supabase
        .from('meeting_note_contacts')
        .insert({
          meeting_note_id: meetingNote.id,
          contact_id: linkedContactId,
          is_primary: linkedContactIds.length === 0
        });
      linkedContactIds.push(linkedContactId);
    }

    // Create tasks for matched action items
    const createdTasks: string[] = [];
    if (matchedItems.length > 0 && linkedContactIds.length > 0) {
      // Create tasks for the primary linked contact
      const primaryContactId = linkedContactIds[0];
      
      for (const item of matchedItems) {
        // Parse due date from action item (e.g., "by Friday", "tomorrow", "next week")
        let dueDate: string | null = null;
        const now = new Date();
        
        if (/by friday/i.test(item)) {
          const friday = new Date(now);
          friday.setDate(now.getDate() + ((5 - now.getDay() + 7) % 7 || 7));
          dueDate = friday.toISOString().split('T')[0];
        } else if (/tomorrow/i.test(item)) {
          const tomorrow = new Date(now);
          tomorrow.setDate(now.getDate() + 1);
          dueDate = tomorrow.toISOString().split('T')[0];
        } else if (/next week/i.test(item)) {
          const nextWeek = new Date(now);
          nextWeek.setDate(now.getDate() + 7);
          dueDate = nextWeek.toISOString().split('T')[0];
        } else if (/end of month/i.test(item)) {
          const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          dueDate = endOfMonth.toISOString().split('T')[0];
        } else {
          // Default: 3 business days
          const defaultDue = new Date(now);
          let daysAdded = 0;
          while (daysAdded < 3) {
            defaultDue.setDate(defaultDue.getDate() + 1);
            if (defaultDue.getDay() !== 0 && defaultDue.getDay() !== 6) {
              daysAdded++;
            }
          }
          dueDate = defaultDue.toISOString().split('T')[0];
        }

        const { data: task, error: taskError } = await supabase
          .from('contact_tasks')
          .insert({
            contact_id: primaryContactId,
            title: item.length > 200 ? item.substring(0, 197) + '...' : item,
            description: `Auto-created from Read.ai meeting: ${payload.meeting_title}`,
            due_date: dueDate,
            source: 'read_ai',
            source_meeting_note_id: meetingNote.id,
            created_by: userId
          })
          .select()
          .single();

        if (!taskError && task) {
          createdTasks.push(task.id);
        }
      }

      console.log('Created tasks:', createdTasks.length);
    }

    // Emit push notification for meeting notes
    const primaryContactId = linkedContactIds.length > 0 ? linkedContactIds[0] : null;
    try {
      const internalNotifyKey = Deno.env.get('INTERNAL_NOTIFY_KEY');

      // Look up contact slug for deep link
      let contactSlug: string | undefined;
      if (primaryContactId) {
        const { data: contactRow } = await supabase
          .from('contacts')
          .select('slug')
          .eq('id', primaryContactId)
          .single();
        contactSlug = contactRow?.slug ?? undefined;
      }

      const notifPayload = {
        mode: 'emit',
        event_type: 'meeting_notes_ready',
        org_id: null,
        user_id: userId,
        metadata: {
          meeting_note_id: meetingNote.id,
          meeting_title: payload.meeting_title,
          tasks_created: createdTasks.length,
          contacts_linked: linkedContactIds.length,
          contact_slug: contactSlug,
        },
        priority: 'normal',
        fingerprint: `meeting_notes:${meetingNote.id}`,
        tier: 'T1',
        deep_link: contactSlug ? `/people/${contactSlug}` : '/',
        title: '📝 Meeting notes ready',
        body: `Notes from ${payload.meeting_title}${createdTasks.length > 0 ? ` with ${createdTasks.length} action item${createdTasks.length > 1 ? 's' : ''}` : ''} — available when you're ready.`,
      };

      if (internalNotifyKey) {
        await fetch(`${supabaseUrl}/functions/v1/notification-dispatcher`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'x-internal-key': internalNotifyKey,
          },
          body: JSON.stringify(notifPayload),
        });
      }
    } catch (notifErr) {
      // Non-blocking: notification failure should not break the webhook response
      console.warn('[read-ai-webhook] Failed to emit notification:', notifErr);
    }

    return new Response(
      JSON.stringify({
        success: true,
        meeting_note_id: meetingNote.id,
        calendar_event_matched: !!calendarEventId,
        calendar_event_marked_attended: !!calendarEventId,
        contacts_linked: linkedContactIds.length,
        action_items_received: actionItems.length,
        action_items_matched: matchedItems.length,
        tasks_created: createdTasks.length
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error processing Read.ai webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
