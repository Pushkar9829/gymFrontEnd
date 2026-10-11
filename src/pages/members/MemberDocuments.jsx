import { useState } from 'react';
import { FileText, Upload, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { del, post, errorMessage } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import { useAuth } from '../../store/auth';
import { fmtDate } from '../../lib/format';
import { uploadFile } from '../../components/PhotoUpload';
import { Card, Select } from '../../components/ui';

const KINDS = [
  ['id-proof', 'ID proof'],
  ['medical', 'Medical certificate'],
  ['waiver', 'Signed waiver'],
  ['photo', 'Photo'],
  ['other', 'Other'],
];

export default function MemberDocuments({ member }) {
  const can = useAuth((s) => s.can);
  const [kind, setKind] = useState('id-proof');
  const [busy, setBusy] = useState(false);
  const add = useAction((b) => post(`/members/${member._id}/documents`, b), { success: 'Document uploaded', invalidate: ['member'] });
  const remove = useAction((id) => del(`/members/${member._id}/documents/${id}`), { success: 'Document removed', invalidate: ['member'] });

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast.error('File must be under 10 MB');
    setBusy(true);
    try {
      const url = await uploadFile(file, 'documents');
      add.mutate({ name: file.name.slice(0, 80), kind, url });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const docs = member.documents || [];
  return (
    <Card title="Documents">
      {can('members.write') && (
        <div className="mb-3 flex gap-2">
          <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-auto">
            {KINDS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium shadow-sm ring-1 ring-slate-300 hover:bg-slate-50">
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} disabled={busy} />
          </label>
        </div>
      )}
      {docs.length ? (
        <ul className="space-y-2 text-sm">
          {docs.map((d) => (
            <li key={d._id} className="flex items-center justify-between gap-2">
              <a href={d.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-brand-700 hover:underline">
                <FileText className="size-4 shrink-0" />
                <span className="truncate">{d.name}</span>
              </a>
              <span className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                {KINDS.find(([v]) => v === d.kind)?.[1]} · {fmtDate(d.uploadedAt)}
                {can('members.write') && (
                  <button onClick={() => window.confirm('Remove this document?') && remove.mutate(d._id)} className="text-slate-400 hover:text-rose-600" aria-label="Remove">
                    <Trash2 className="size-4" />
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">No documents uploaded.</p>
      )}
    </Card>
  );
}
