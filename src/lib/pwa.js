import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';

/*
 * Installable member app: "Install app" prompt, service worker (scope /portal only, so the staff app
 * is never controlled by it) with an update button, and Web Push subscription.
 */
const SW_URL = '/sw.js';
const SCOPE = '/portal';

let installEvent = null;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

/** Call once at start-up: the browser fires beforeinstallprompt early, often before the Home page shows. */
export function initPwa() {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e;
    emit();
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    emit();
  });
}

/** The saved install prompt (null when the browser does not offer one). */
export function useInstallPrompt() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => installEvent,
  );
}

export async function promptInstall() {
  if (!installEvent) return false;
  const e = installEvent;
  installEvent = null;
  emit();
  e.prompt();
  const choice = await e.userChoice.catch(() => null);
  return choice?.outcome === 'accepted';
}

export const isStandalone = () => window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
export const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent || '');
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

let registering = null;
/** Registers the member app service worker; offers an "Update" button when a new version is ready. */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return Promise.resolve(null);
  registering ||= navigator.serviceWorker
    .register(SW_URL, { scope: SCOPE })
    .then((reg) => {
      const offer = (worker) =>
        toast('A new version of the app is ready', {
          duration: Infinity,
          action: { label: 'Update', onClick: () => worker.postMessage({ type: 'SKIP_WAITING' }) },
        });
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w);
        });
      });
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
      return reg;
    })
    .catch(() => {
      registering = null;
      return null;
    });
  return registering;
}

function activeWorker(reg) {
  if (reg.active) return Promise.resolve(reg);
  const w = reg.installing || reg.waiting;
  return new Promise((resolve) => {
    w?.addEventListener('statechange', () => w.state === 'activated' && resolve(reg));
    setTimeout(() => resolve(reg), 10000);
  });
}

const keyBytes = (base64) => {
  const pad = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

export async function currentPushSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration(SCOPE);
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Asks permission, subscribes this browser and saves it for the logged-in member. */
export async function enablePush(publicKey, client) {
  if (!pushSupported()) throw new Error('This browser does not support notifications');
  const reg = await registerServiceWorker();
  if (!reg) throw new Error('Could not set up notifications on this browser');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them in the browser settings.');
  await activeWorker(reg);
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(publicKey) }));
  await client.post('/me/push/subscribe', sub.toJSON());
  return sub;
}

/** Stops notifications on this browser (also used on log out, so a shared phone gets no one else's messages). */
export async function disablePush(client) {
  const sub = await currentPushSubscription().catch(() => null);
  if (!sub) return;
  await client.post('/me/push/unsubscribe', { endpoint: sub.endpoint }).catch(() => undefined);
  await sub.unsubscribe().catch(() => undefined);
}
