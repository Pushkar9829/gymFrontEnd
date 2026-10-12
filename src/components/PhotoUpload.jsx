import { useEffect } from 'react';
import axios from 'axios';
import { Camera } from 'lucide-react';
import { toast } from 'sonner';
import { post } from '../lib/api';
import { Avatar } from './ui';
import { MemberAvatar } from './MemberAvatar';

/**
 * Uploads straight from the browser to Cloudinary using a server-signed request.
 * Only for public branding images (gym logo); member photos and documents are private files.
 */
export async function uploadFile(file, folder = 'branding') {
  const sig = await post('/uploads/signature', { folder });
  const fd = new FormData();
  fd.append('file', file);
  fd.append('api_key', sig.apiKey);
  fd.append('timestamp', sig.timestamp);
  fd.append('folder', sig.folder);
  fd.append('allowed_formats', sig.allowed_formats);
  fd.append('signature', sig.signature);
  const r = await axios.post(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, fd);
  return r.data.secure_url;
}

/**
 * Member photo picker. The photo is uploaded (privately) when the form is saved.
 * value: null = unchanged, { file, preview } = new photo, 'remove' = remove the current photo.
 */
export default function PhotoUpload({ member, name, value, onChange }) {
  const preview = value?.preview;
  useEffect(() => () => preview && URL.revokeObjectURL(preview), [preview]);
  const hasCurrent = Boolean(member?.photoFileId || member?.photoUrl);

  function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('Choose an image file');
    if (file.size > 15 * 1024 * 1024) return toast.error('Image must be under 15 MB');
    onChange({ file, preview: URL.createObjectURL(file) });
  }
  const shown = preview || (value !== 'remove' && hasCurrent);
  return (
    <div className="flex items-center gap-4">
      {preview ? (
        <img src={preview} alt="New photo" className="size-16 shrink-0 rounded-full object-cover" />
      ) : value === 'remove' || !member ? (
        <Avatar name={name || '?'} size="lg" />
      ) : (
        <MemberAvatar member={{ ...member, name: name || member.name }} size="lg" />
      )}
      <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-slate-300 hover:bg-slate-50">
        <Camera className="size-4" />
        {shown ? 'Change photo' : 'Add photo'}
        {/* capture lets phones/tablets open the camera directly */}
        <input type="file" accept="image/*" capture="user" className="hidden" onChange={onFile} aria-label="Member photo" />
      </label>
      {shown && (
        <button type="button" className="text-sm text-slate-500 hover:text-rose-600" onClick={() => onChange(hasCurrent ? 'remove' : null)}>
          Remove
        </button>
      )}
    </div>
  );
}
