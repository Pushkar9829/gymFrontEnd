import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, BellOff, Download, Share } from 'lucide-react';
import { memberApi, errorMessage } from '../../lib/api';
import { useInstallPrompt, promptInstall, isStandalone, isIos, pushSupported, currentPushSubscription, enablePush, disablePush } from '../../lib/pwa';
import { Button } from '../../components/ui';
import { portalGet } from './PortalHome';

/** Member Home: install the app and turn notifications on/off. Shows nothing when neither applies. */
export default function AppSetup() {
  const install = useInstallPrompt();
  const { data: push } = useQuery({ queryKey: ['portal', 'push-config'], queryFn: () => portalGet('/me/push/config') });
  const [subscribed, setSubscribed] = useState(null);
  const [busy, setBusy] = useState(false);
  const standalone = isStandalone();
  const iosHint = isIos() && !standalone;
  const canPush = Boolean(push?.enabled && push.publicKey && pushSupported() && Notification.permission !== 'denied');

  useEffect(() => {
    if (!canPush) return;
    currentPushSubscription()
      .then((s) => setSubscribed(Boolean(s)))
      .catch(() => setSubscribed(false));
  }, [canPush]);

  if (!install && !iosHint && !canPush) return null;

  async function turnOn() {
    setBusy(true);
    try {
      await enablePush(push.publicKey, memberApi.client);
      setSubscribed(true);
      toast.success('Notifications are on');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  async function turnOff() {
    setBusy(true);
    await disablePush(memberApi.client);
    setSubscribed(false);
    setBusy(false);
    toast.success('Notifications are off on this phone');
  }

  return (
    <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      {install && (
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-brand-50 p-2 text-brand-700">
            <Download className="size-5" />
          </span>
          <span className="flex-1 text-sm">
            <b className="block">Get the app</b>
            <span className="text-xs text-slate-500">Open your membership from the home screen</span>
          </span>
          <Button size="sm" onClick={() => promptInstall()}>
            Install app
          </Button>
        </div>
      )}
      {iosHint && !install && (
        <p className="flex items-start gap-2 text-sm text-slate-600">
          <Share className="mt-0.5 size-4 shrink-0 text-brand-700" />
          <span>
            Add this app to your iPhone: tap <b>Share</b>, then <b>Add to Home Screen</b>.
          </span>
        </p>
      )}
      {canPush && subscribed !== null && (
        <div className="flex items-center gap-3">
          <span className="rounded-lg bg-amber-50 p-2 text-amber-700">{subscribed ? <Bell className="size-5" /> : <BellOff className="size-5" />}</span>
          <span className="flex-1 text-sm">
            <b className="block">{subscribed ? 'Notifications are on' : 'Get reminders on this phone'}</b>
            <span className="text-xs text-slate-500">Renewals, classes, PT sessions and replies from the gym</span>
          </span>
          {subscribed ? (
            <Button size="sm" variant="secondary" loading={busy} onClick={turnOff}>
              Turn off
            </Button>
          ) : (
            <Button size="sm" loading={busy} onClick={turnOn}>
              Turn on notifications
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
