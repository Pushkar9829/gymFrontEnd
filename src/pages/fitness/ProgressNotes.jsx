import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2, Eye, EyeOff, Columns2, ImagePlus, Loader2, X } from 'lucide-react';
import { del, get, patch, post, errorMessage } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import { useAuth } from '../../store/auth';
import { fmtDate } from '../../lib/format';
import { PrivateImage, uploadPrivatePhoto } from '../../components/PrivateImage';
import { Badge, Button, Card, EmptyState, Field, Modal, Select, Textarea, Toggle } from '../../components/ui';

const MAX_PHOTOS = 4;
const measureLabel = (m) => [fmtDate(m.date), m.weightKg && `${m.weightKg} kg`, m.bodyFatPercent && `${m.bodyFatPercent}% fat`, m.waistCm && `waist ${m.waistCm} cm`].filter(Boolean).join(' · ');

function AddNoteModal({ member, measurements, onClose }) {
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState([]); // { _id, preview }
  const [measurementId, setMeasurementId] = useState('');
  const [visible, setVisible] = useState(true);
  const [uploading, setUploading] = useState(false);
  const save = useAction(() => post('/fitness/progress', { memberId: member._id, text: text.trim(), photoIds: photos.map((p) => p._id), measurementId: measurementId || null, visibleToMember: visible }), {
    success: 'Progress note added',
    invalidate: ['fitness'],
    onSuccess: onClose,
  });
  async function onFiles(e) {
    const files = [...(e.target.files || [])].slice(0, MAX_PHOTOS - photos.length);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image`);
          continue;
        }
        const r = await uploadPrivatePhoto(file, member._id);
        setPhotos((p) => [...p, { _id: r._id, preview: URL.createObjectURL(file) }]);
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }
  return (
    <Modal
      open
      onClose={onClose}
      title="Add progress note"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={save.isPending} disabled={uploading || text.trim().length < 2} onClick={() => save.mutate()}>
            Save note
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Note">
          <Textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="What changed, what to work on next…" />
        </Field>
        <div>
          <p className="mb-1 text-sm font-medium text-slate-700">Photos ({photos.length}/{MAX_PHOTOS})</p>
          <div className="flex flex-wrap gap-2">
            {photos.map((p) => (
              <span key={p._id} className="relative">
                <img src={p.preview} alt="New progress photo" className="size-20 rounded-lg object-cover" />
                <button type="button" onClick={() => setPhotos(photos.filter((x) => x._id !== p._id))} className="absolute -top-1.5 -right-1.5 rounded-full bg-white p-0.5 text-slate-500 shadow ring-1 ring-slate-200" aria-label="Remove photo">
                  <X className="size-3.5" />
                </button>
              </span>
            ))}
            {photos.length < MAX_PHOTOS && (
              <label className="flex size-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg text-xs text-slate-500 ring-1 ring-slate-300 ring-dashed hover:bg-slate-50">
                {uploading ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
                Add photo
                <input type="file" accept="image/*" multiple className="hidden" onChange={onFiles} disabled={uploading} aria-label="Add photos" />
              </label>
            )}
          </div>
          <p className="mt-1 text-xs text-slate-500">Photos are private: only staff who can see this member, and the member when shown to them.</p>
        </div>
        {measurements?.length > 0 && (
          <Field label="Link to a measurement (optional)">
            <Select value={measurementId} onChange={(e) => setMeasurementId(e.target.value)}>
              <option value="">None</option>
              {[...measurements].reverse().map((m) => (
                <option key={m._id} value={m._id}>
                  {measureLabel(m)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Toggle checked={visible} onChange={setVisible} label="Member can see this note and photos in the app" />
      </div>
    </Modal>
  );
}

function CompareModal({ photos, onClose }) {
  const [a, setA] = useState(photos[0]?.id || '');
  const [b, setB] = useState(photos[photos.length - 1]?.id || '');
  const label = (p) => `${fmtDate(p.date)}${p.n > 1 ? ` (photo ${p.i + 1})` : ''}`;
  return (
    <Modal open onClose={onClose} title="Before / after" size="xl">
      <div className="grid grid-cols-2 gap-3">
        {[
          ['Before', a, setA],
          ['After', b, setB],
        ].map(([title, value, set]) => (
          <div key={title} className="min-w-0">
            <Field label={title}>
              <Select value={value} onChange={(e) => set(e.target.value)}>
                {photos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {label(p)}
                  </option>
                ))}
              </Select>
            </Field>
            {value && <PrivateImage key={value} id={value} alt={title} className="mt-2 aspect-[3/4] w-full rounded-lg bg-slate-100 object-contain" />}
          </div>
        ))}
      </div>
    </Modal>
  );
}

/** Timeline of a member's progress notes with private photos (member page > Fitness). */
export default function ProgressNotes({ member, measurements }) {
  const { can, user } = useAuth();
  const write = can('fitness.write');
  const [modal, setModal] = useState(null);
  const { data: notes } = useQuery({ queryKey: ['fitness', 'progress', member._id], queryFn: () => get('/fitness/progress', { memberId: member._id }) });
  const toggle = useAction(({ id, visibleToMember }) => patch(`/fitness/progress/${id}`, { visibleToMember }), { success: (_d, v) => (v.visibleToMember ? 'Member can see this note now' : 'Note hidden from the member'), invalidate: ['fitness'] });
  const remove = useAction((id) => del(`/fitness/progress/${id}`), { success: 'Note deleted', invalidate: ['fitness'] });
  const mayEdit = (n) => write && (String(n.createdBy?._id) === String(user._id) || ['owner', 'manager'].includes(user.role));
  // Oldest first for the compare lists.
  const photos = [...(notes || [])].reverse().flatMap((n) => n.photoIds.map((id, i) => ({ id, date: n.createdAt, i, n: n.photoIds.length })));

  return (
    <Card
      title="Progress notes"
      className="lg:col-span-2"
      actions={
        <>
          {photos.length >= 2 && (
            <Button size="sm" variant="secondary" onClick={() => setModal('compare')}>
              <Columns2 className="size-4" /> Compare photos
            </Button>
          )}
          {write && (
            <Button size="sm" onClick={() => setModal('add')}>
              <Plus className="size-4" /> Add note
            </Button>
          )}
        </>
      }
    >
      {!notes?.length ? (
        <EmptyState title="No progress notes yet">
          Add a note with photos after a check-in to track the client's progress.
          {write && (
            <div>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => setModal('add')}>
                <Plus className="size-4" /> Add note
              </Button>
            </div>
          )}
        </EmptyState>
      ) : (
        <ol className="relative space-y-5 border-l border-slate-200 pl-5">
          {notes.map((n) => (
            <li key={n._id} className="relative">
              <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full bg-brand-600 ring-4 ring-white" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-slate-500">
                  {fmtDate(n.createdAt)} · {n.createdBy?.name}
                  {n.measurementId && ` · ${measureLabel(n.measurementId)}`}
                </p>
                <span className="flex items-center gap-1">
                  {n.visibleToMember ? <Badge status="active">Member can see</Badge> : <Badge status="cancelled">Staff only</Badge>}
                  {mayEdit(n) && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => toggle.mutate({ id: n._id, visibleToMember: !n.visibleToMember })} aria-label={n.visibleToMember ? 'Hide from member' : 'Show to member'} title={n.visibleToMember ? 'Hide from member' : 'Show to member'}>
                        {n.visibleToMember ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => window.confirm('Delete this note and its photos?') && remove.mutate(n._id)} aria-label="Delete note" title="Delete">
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </span>
              </div>
              <p className="mt-1 text-sm whitespace-pre-line text-slate-800">{n.text}</p>
              {n.photoIds?.length > 0 && (
                <div className="mt-2 grid max-w-md grid-cols-4 gap-2">
                  {n.photoIds.map((id) => (
                    <PrivateImage key={id} id={id} alt="Progress photo" className="aspect-square w-full rounded-lg" onClick={() => setModal({ photo: id })} />
                  ))}
                </div>
              )}
            </li>
          ))}
        </ol>
      )}
      {modal === 'add' && <AddNoteModal member={member} measurements={measurements} onClose={() => setModal(null)} />}
      {modal === 'compare' && <CompareModal photos={photos} onClose={() => setModal(null)} />}
      {modal?.photo && (
        <Modal open onClose={() => setModal(null)} title="Progress photo" size="lg">
          <PrivateImage id={modal.photo} alt="Progress photo" className="w-full rounded-lg object-contain" />
        </Modal>
      )}
    </Card>
  );
}
