/**
 * Notification Service for Equilibrium
 * Handles Web Notifications, audio chime synthesis, and in-app alert events
 */

export interface InAppNotificationPayload {
  id: string;
  title: string;
  body: string;
  senderName: string;
  category?: string;
  amount?: number;
  yourShare?: number;
  timestamp: string;
  isSettlement?: boolean;
}

const STORAGE_KEY = 'eq_notifications_enabled';

/**
 * Check if the browser supports standard Web Notifications
 */
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/**
 * Get current browser notification permission
 */
export function getNotificationPermission(): NotificationPermission | 'unsupported' {
  if (!isNotificationSupported()) return 'unsupported';
  return Notification.permission;
}

/**
 * Check if notifications are enabled in user settings
 */
export function isNotificationsEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  const stored = localStorage.getItem(STORAGE_KEY);
  // Default to false until user explicitly toggles it on
  return stored === 'true';
}

/**
 * Set user notification preference
 */
export function setNotificationsEnabled(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, enabled ? 'true' : 'false');
  window.dispatchEvent(new CustomEvent('eq_notify_pref_changed', { detail: { enabled } }));
}

/**
 * Play a pleasant two-tone fintech alert chime using Web Audio API
 * Zero external mp3 dependencies, works completely offline
 */
export function playNotificationChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    // First note: 587.33 Hz (D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.2, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second note: 880 Hz (A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0.25, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch (err) {
    console.warn('Audio chime playback deferred:', err);
  }
}

/**
 * Request notification permission from the browser
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setNotificationsEnabled(true);
    } else {
      setNotificationsEnabled(false);
    }
    return permission;
  } catch (err) {
    console.warn('Notification permission request error:', err);
    return 'denied';
  }
}

/**
 * Dispatch both a native OS notification and an in-app Swiggy/Zomato banner
 */
export function notifyRoommateActivity(payload: InAppNotificationPayload): void {
  // 1. Play audio chime if enabled
  if (isNotificationsEnabled()) {
    playNotificationChime();
  }

  // 2. Dispatch in-app floating banner event
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('eq_inapp_notification', { detail: payload })
    );
  }

  // 3. Fire native Web Notification if permission granted and user enabled
  if (isNotificationsEnabled() && isNotificationSupported() && Notification.permission === 'granted') {
    try {
      const options: NotificationOptions = {
        body: payload.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: payload.id,
      };

      new Notification(payload.title, options);
    } catch (err) {
      console.warn('Failed to trigger native notification:', err);
    }
  }
}
