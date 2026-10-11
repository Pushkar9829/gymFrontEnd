import { useState } from 'react';
import axios from 'axios';
import { Camera, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { post, errorMessage } from '../lib/api';
import { Avatar } from './ui';

/** Uploads straight from the browser to Cloudinary using a server-signed request. */
export async function uploadFile(file, folder) {
  const sig = await post('/uploads/signature', { folder });
  const fd = new FormData();
  fd.append('file', file);
  fd.append('api_key', sig.apiKey);
  fd.append('timestamp', sig.timestamp);
  fd.append('folder', sig.folder);
  fd.append('signature', sig.signature);
  const r = await axios.post(`https://api.cloudinary.com/v1_1/${sig.cloudName}/auto/upload`, fd);
  return r.data.secure_url;
}

export default function PhotoUpload({ value, name, onChange }) {
  const [busy, setBusy] = useState(false);
  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Choose an image file');
    if (file.size > 5 * 1024 * 1024) return toast.error('Image must be under 5 MB');
    setBusy(true);
    try {
      onChange(await uploadFile(file, 'members'));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="flex items-center gap-4">
      <Avatar name={name || '?'} src={value} size="lg" />
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-300 hover:bg-slate-50">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
        {value ? 'Change photo' : 'Add photo'}
        {/* capture lets phones/tablets open the camera directly */}
        <input type="file" accept="image/*" capture="user" className="hidden" onChange={onFile} disabled={busy} />
      </label>
      {value && (
        <button type="button" className="text-sm text-slate-500 hover:text-rose-600" onClick={() => onChange('')}>
          Remove
        </button>
      )}
    </div>
  );
}
