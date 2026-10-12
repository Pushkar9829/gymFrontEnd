import { useState } from 'react';
import { FileText, Upload, Trash2, Loader2, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { api, del, errorMessage, openFile } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import { useAuth } from '../../store/auth';
import { fmtDate } from '../../lib/format';
import { shrinkImage } from '../../components/PrivateImage';
import { Card, Select } from '../../components/ui';

const KINDS = [
  ['id-proof', 'ID proof'],
  ['medical', 'Medical certificate'],
  ['waiver', 'Signed waiver'],
  ['photo', 'Photo'],
  ['other', 'Other'],
];
const MAX_MB = 5;
const TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

/** Member documents (ID proofs...). Stored privately: opened through the API with the login token, never a public link. */
export default function MemberDocuments({ member }) {
  const can = useAuth((s) => s.can);
  const [kind, setKind] = useState('id-proof');
  const [opening, setOpening] = useState(null);
  const add = useAction(
    async ({ file, kind: k }) => {
      // Photos of documents are shrunk in the browser; PDFs are sent as they are.
      const body = file.type === 'application/pdf' ? file : await shrinkImage(file, 2000);
      if (body.size > MAX_MB * 1024 * 1024) throw new Error(`File must be under ${MAX_MB} MB${file.type === 'application/pdf' ? ' (scan the PDF at a lower quality)' : ''}`);
      const type = TYPES.includes(body.type) ? body.type : 'image/jpeg';
      const r = await api.post(`/members/${member._id}/documents`, body, { params: { name: file.name.slice(0, 80), kind: k }, headers: { 'Content-Type': type } });
      return r.data.data;
    },
    { success: 'Document uploaded', invalidate: ['member'] },
  );
  const remove = useAction((id) => del(`/members/${member._id}/documents/${id}`), { success: 'Document removed', invalidate: ['member'] });

  function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!TYPES.includes(file.type)) return toast.error('Choose a PDF or a JPEG / PNG / WebP image');
    if (file.type === 'application/pdf' && file.size > MAX_MB * 1024 * 1024) return toast.error(`PDF must be under ${MAX_MB} MB`);
    add.mutate({ file, kind });
  }

  async function open(d) {
    setOpening(d._id);
    try {
      await openFile(`/uploads/private/${d.fileId}`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setOpening(null);
    }
  }

  const docs = member.documents || [];
  return (
    <Card title="Documents">
      {can('members.write') && (
        <div className="mb-3 flex flex-wrap gap-2">
          <Select value={kind} onChange={(e) => setKind(e.target.value)} className="w-auto" aria-label="Document type">
            {KINDS.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium shadow-sm ring-1 ring-slate-300 hover:bg-slate-50">
            {add.isPending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Upload
            <input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={onFile} disabled={add.isPending} aria-label="Upload document" />
          </label>
        </div>
      )}
      {docs.length ? (
        <ul className="space-y-2 text-sm">
          {docs.map((d) => (
            <li key={d._id} className="flex items-center justify-between gap-2">
              {d.fileId ? (
                <button type="button" onClick={() => open(d)} disabled={opening === d._id} className="flex min-w-0 items-center gap-2 text-left text-brand-700 hover:underline" title="Private file: opens for staff only">
                  {opening === d._id ? <Loader2 className="size-4 shrink-0 animate-spin" /> : <Lock className="size-4 shrink-0" />}
                  <span className="truncate">{d.name}</span>
                </button>
              ) : (
                <a href={d.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-2 text-brand-700 hover:underline">
                  <FileText className="size-4 shrink-0" />
                  <span className="truncate">{d.name}</span>
                </a>
              )}
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
