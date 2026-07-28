import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TaskNotification {
  id: string;
  title: string;
  contact_name: string;
  contact_slug: string | null;
  due_date: string;
  status: 'overdue' | 'due_today' | 'due_soon';
  days_until_due: number;
  created_by: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Missing Supabase environment variables");
    }

    // Verify token — accept anon key (cron) or valid user JWT
    const token = authHeader.replace("Bearer ", "");
    if (token !== SUPABASE_ANON_KEY) {
      const supabaseAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY || "", {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: claims, error: authError } = await supabaseAuth.auth.getUser();
      if (authError || !claims.user) {
        return new Response(
          JSON.stringify({ error: "Invalid authentication" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const dueSoonDate = new Date(today);
    dueSoonDate.setDate(dueSoonDate.getDate() + 3);
    const dueSoonStr = dueSoonDate.toISOString().split('T')[0];

    // Get overdue + due-soon tasks
    const { data: tasks, error: tasksError } = await supabase
      .from("contact_tasks")
      .select(`
        id,
        title,
        due_date,
        created_by,
        contacts (
          id,
          name,
          slug,
          opportunity_id
        )
      `)
      .eq("is_completed", false)
      .not("due_date", "is", null)
      .lte("due_date", dueSoonStr)
      .order("due_date", { ascending: true });

    if (tasksError) throw tasksError;

    // Build notifications
    const notifications: TaskNotification[] = [];

    tasks?.forEach(task => {
      const dueDate = new Date(task.due_date);
      dueDate.setHours(0, 0, 0, 0);
      const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

      let status: 'overdue' | 'due_today' | 'due_soon';
      if (daysUntilDue < 0) status = 'overdue';
      else if (daysUntilDue === 0) status = 'due_today';
      else status = 'due_soon';

      const contact = task.contacts as any;

      notifications.push({
        id: task.id,
        title: task.title,
        contact_name: contact?.name || 'Unknown',
        contact_slug: contact?.slug || null,
        organization: contact?.opportunities?.organization,
        due_date: task.due_date,
        status,
        days_until_due: daysUntilDue,
        created_by: task.created_by
      });
    });

    // Group by creator
    const byCreator = new Map<string, TaskNotification[]>();
    notifications.forEach(n => {
      if (!n.created_by) return;
      const existing = byCreator.get(n.created_by) || [];
      existing.push(n);
      byCreator.set(n.created_by, existing);
    });

    // Create user_alerts + send push notifications per user
    let alertsCreated = 0;
    let pushesSent = 0;

    for (const [userId, items] of byCreator.entries()) {
      const overdue = items.filter(i => i.status === 'overdue');
      const dueToday = items.filter(i => i.status === 'due_today');

      // Only create alerts for overdue and due-today tasks
      const alertable = [...overdue, ...dueToday];
      if (alertable.length === 0) continue;

      // Check user notification preference
      const { data: prefs } = await supabase
        .from('user_notification_settings')
        .select('notify_overdue_tasks')
        .eq('user_id', userId)
        .maybeSingle();

      // Default to true if no prefs or column not set
      const pushEnabled = prefs?.notify_overdue_tasks !== false;

      // Create user_alerts — check for existing unread alert before inserting
      for (const task of alertable) {
        const daysOverdue = Math.abs(task.days_until_due);
        const message = task.status === 'overdue'
          ? `"${task.title}" for ${task.contact_name} is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue`
          : `"${task.title}" for ${task.contact_name} is due today`;

        // Check if unread alert already exists for this task
        const { data: existing } = await supabase
          .from('user_alerts')
          .select('id')
          .eq('user_id', userId)
          .eq('ref_id', task.id)
          .is('read_at', null)
          .maybeSingle();

        if (!existing) {
          const { error: alertError } = await supabase
            .from('user_alerts')
            .insert({
              user_id: userId,
              alert_type: task.status === 'overdue' ? 'overdue_task' : 'task_due_today',
              ref_type: 'contact_task',
              ref_id: task.id,
              message,
            });

          if (!alertError) alertsCreated++;
        }
      }

      // Send a single consolidated push notification if enabled
      if (pushEnabled && (overdue.length > 0 || dueToday.length > 0)) {
        const title = overdue.length > 0
          ? `⚠️ ${overdue.length} overdue task${overdue.length > 1 ? 's' : ''}`
          : `📅 ${dueToday.length} task${dueToday.length > 1 ? 's' : ''} due today`;

        const topTask = (overdue[0] || dueToday[0]);
        const body = overdue.length + dueToday.length === 1
          ? `${topTask.title} — ${topTask.contact_name}`
          : `${topTask.title} and ${overdue.length + dueToday.length - 1} more — ready when you are`;

        // Deep link to the first overdue contact or command center
        const deepLink = topTask.contact_slug
          ? `/people/${topTask.contact_slug}`
          : '/';

        try {
          await fetch(`${SUPABASE_URL}/functions/v1/profunda-notify`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              mode: 'send-notification',
              userId,
              title,
              body,
              data: { url: deepLink },
            }),
          });
          pushesSent++;
        } catch (e) {
          console.error(`[check-task-due-dates] Push failed for ${userId}:`, e);
        }

        // Update last notified timestamp
        await supabase
          .from('user_notification_settings')
          .update({ last_overdue_tasks_notified_at: new Date().toISOString() })
          .eq('user_id', userId);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        task_count: notifications.length,
        overdue: notifications.filter(n => n.status === 'overdue').length,
        due_today: notifications.filter(n => n.status === 'due_today').length,
        due_soon: notifications.filter(n => n.status === 'due_soon').length,
        alerts_created: alertsCreated,
        pushes_sent: pushesSent,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("[check-task-due-dates] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: "ERR_TASK_DUE_001" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
