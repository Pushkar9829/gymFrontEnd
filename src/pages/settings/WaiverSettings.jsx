import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle } from 'lucide-react';
import { get, put } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import { useAuth } from '../../store/auth';
import { fmtDateTime } from '../../lib/format';
import { Badge, Button, Card, Field, PageLoader, Textarea, Toggle } from '../../components/ui';

const EXAMPLE = `I am joining the gym of my own free will and I am fit to exercise. I have told the gym about any medical condition.

I will follow the instructions of the trainers and the gym rules, use the equipment safely and put it back after use.

I understand that exercise has risks. The gym is not responsible for injuries caused by not following instructions, or for loss of my belongings.`;

/** Waiver text (versioned) and when members must sign it. */
export default function WaiverSettings() {
  const can = useAuth((s) => s.can);
  const editable = can('settings.write');
  const { data } = useQuery({ queryKey: ['waivers'], queryFn: () => get('/waivers') });
  const [f, setF] = useState(null);
  useEffect(() => {
    if (data) setF({ text: data.current?.text || '', requireResign: false, askMembers: data.settings.askMembers, requireForEntry: data.settings.requireForEntry });
  }, [data]);
  const save = useAction(
    () =>
      put('/waivers', {
        ...(f.text.trim() && f.text.trim() !== data.current?.text ? { text: f.text.trim(), requireResign: f.requireResign } : {}),
        askMembers: f.askMembers,
        requireForEntry: f.requireForEntry,
      }),
    { success: (r) => (r.created ? `Waiver version ${r.created.version} saved` : 'Waiver settings saved'), invalidate: ['waivers', 'member'] },
  );
  if (!f) return <PageLoader />;
  const s = data.settings;
  const textChanged = f.text.trim() !== (data.current?.text || '') && f.text.trim().length > 0;
  const firstVersion = !data.current;
  const everyoneMustSign = firstVersion || (textChanged && f.requireResign);
  const unsigned = everyoneMustSign ? data.unsignedIfResign : data.unsigned;
  const turningOn = f.requireForEntry && (!s.requireForEntry || everyoneMustSign);
  const hasText = Boolean(data.current) || f.text.trim().length >= 20;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Waiver / joining form" className="lg:col-span-2">
        <div className="space-y-4">
          <Field label="Waiver text" hint={data.current ? `Now on version ${s.currentVersion}. Saving a changed text creates version ${s.currentVersion + 1}; old signed copies keep their own text.` : 'Members read this and sign with a finger in the app or on the desk tablet.'}>
            <Textarea rows={12} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} disabled={!editable} placeholder={EXAMPLE} />
          </Field>
          {editable && !f.text && (
            <Button size="sm" variant="ghost" onClick={() => setF({ ...f, text: EXAMPLE })}>
              Start from an example
            </Button>
          )}
          {textChanged && data.current && (
            <div className="rounded-lg bg-slate-50 p-3">
              <Toggle checked={f.requireResign} onChange={(v) => setF({ ...f, requireResign: v })} disabled={!editable} label="Members who signed an older version must sign again" />
              <p className="mt-1 text-xs text-slate-500">Off: only members who never signed are asked. On: everyone signs the new version.</p>
            </div>
          )}
          <div>
            <Toggle checked={f.askMembers} onChange={(v) => setF({ ...f, askMembers: v })} disabled={!editable || !hasText} label="Ask members to sign (member app and member page)" />
          </div>
          <div>
            <Toggle checked={f.requireForEntry} onChange={(v) => setF({ ...f, requireForEntry: v })} disabled={!editable || !hasText} label="Require a signed waiver for entry" />
          </div>
          {turningOn && unsigned > 0 && (
            <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200" role="alert">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                <b>{unsigned} active member(s)</b> have not signed{everyoneMustSign && data.current ? ' this version' : ''}. They will be refused entry (biometric, QR and desk) until they sign in the app or at the desk.
              </span>
            </p>
          )}
          {!hasText && <p className="text-xs text-slate-500">Add the waiver text to switch these on.</p>}
          {editable && (
            <div className="flex justify-end">
              <Button loading={save.isPending} disabled={f.text.trim().length > 0 && f.text.trim().length < 20} onClick={() => save.mutate()}>
                Save waiver
              </Button>
            </div>
          )}
        </div>
      </Card>
      <Card title="Versions">
        {data.versions.length ? (
          <ul className="space-y-2 text-sm">
            {data.versions.map((v) => (
              <li key={v.version} className="flex items-start justify-between gap-2">
                <span>
                  <b>Version {v.version}</b> {v.version === s.currentVersion && <Badge status="active">Current</Badge>}
                  <span className="block text-xs text-slate-500">
                    {fmtDateTime(v.createdAt)}
                    {v.createdBy?.name && ` · ${v.createdBy.name}`}
                    {v.requireResign && v.version > 1 && ' · everyone signs again'}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No waiver yet.</p>
        )}
        {data.current && <p className="mt-3 text-xs text-slate-500">{data.unsigned} active member(s) still have to sign.</p>}
      </Card>
    </div>
  );
}
