import { supabase } from '@/integrations/supabase/client';

/**
 * Convert base64url-encoded VAPID public key to Uint8Array for PushManager.subscribe
 */
export function base64UrlToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Check if push notifications are supported in this browser
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/**
 * Get the current notification permission state
 */
export function getPermissionState(): NotificationPermission | 'unsupported' {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Fetch VAPID public key from the edge function (so we don't need env vars in frontend)
 */
async function fetchVapidKey(): Promise<string> {
  const { data, error } = await supabase.functions.invoke('profunda-notify', {
    body: { mode: 'get-vapid-key' },
  });

  if (error) {
    throw new Error(error.message || 'Failed to fetch VAPID key');
  }

  return data.vapidPublicKey;
}

/**
 * Initialize push notifications: register SW, request permission, subscribe, and save to DB
 */
export async function initPushNotifications(): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: 'Push notifications not supported in this browser' };
  }

  try {
    // Request permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return { success: false, error: 'Notification permission denied' };
    }

    // Fetch VAPID key from backend
    const vapidKey = await fetchVapidKey();

    // Get service worker registration
    const registration = await navigator.serviceWorker.ready as ServiceWorkerRegistration & { pushManager: PushManager };

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    // Subscribe if not already subscribed
    if (!subscription) {
      const applicationServerKey = base64UrlToUint8Array(vapidKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });
    }

    // Extract keys from subscription
    const subscriptionJson = subscription.toJSON();
    const keys = subscriptionJson.keys;

    if (!keys?.p256dh || !keys?.auth) {
      return { success: false, error: 'Failed to get subscription keys' };
    }

    // Save subscription to database via edge function
    const { error } = await supabase.functions.invoke('profunda-notify', {
      body: {
        mode: 'register-subscription',
        endpoint: subscription.endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: navigator.userAgent,
      },
    });

    if (error) {
      console.error('[notifications] Failed to register subscription:', error);
      return { success: false, error: 'Failed to save subscription' };
    }

    return { success: true };
  } catch (err) {
    console.error('[notifications] Init error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Unregister push notifications: unsubscribe and remove from DB
 */
export async function unregisterPushNotifications(): Promise<{ success: boolean; error?: string }> {
  if (!isPushSupported()) {
    return { success: false, error: 'Push notifications not supported' };
  }

  try {
    const registration = await navigator.serviceWorker.ready as ServiceWorkerRegistration & { pushManager: PushManager };
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      // Remove from database first
      await supabase.functions.invoke('profunda-notify', {
        body: {
          mode: 'unregister-subscription',
          endpoint: subscription.endpoint,
        },
      });

      // Then unsubscribe locally
      await subscription.unsubscribe();
    }

    return { success: true };
  } catch (err) {
    console.error('[notifications] Unregister error:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Enqueue a push notification (client-safe triggers only: weekly_plan, event_week)
 * This builds the message server-side and sends to the current user only
 */
export async function enqueuePushNotification(
  trigger: 'weekly_plan' | 'event_week'
): Promise<{ success: boolean; skipped?: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke('profunda-notify', {
      body: {
        mode: 'enqueue-notification',
        trigger,
      },
    });

    if (error) {
      console.warn('[notifications] Enqueue error:', error);
      return { success: false, error: error.message };
    }

    if (data?.skipped) {
      return { success: true, skipped: true };
    }

    return { success: true };
  } catch (err) {
    console.warn('[notifications] Enqueue exception:', err);
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Send a test notification (dev only)
 */
export async function sendTestNotification(): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.functions.invoke('profunda-notify', {
      body: {
        mode: 'send-test',
      },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Unknown error' };
  }
}

/**
 * Check if the user has an active push subscription
 */
export async function hasActiveSubscription(): Promise<boolean> {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready as ServiceWorkerRegistration & { pushManager: PushManager };
    const subscription = await registration.pushManager.getSubscription();
    return subscription !== null;
  } catch {
    return false;
  }
}
