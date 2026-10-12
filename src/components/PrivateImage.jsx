import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';
import { loadPrivateImage, peekPrivateImage } from '../lib/privateFiles';

/**
 * Shows a private file (progress photo, signature, profile photo). It is fetched with the login token and shown from memory,
 * because these files have no public link. `client` = staff (default) or the member app's client.
 * `thumb` loads the small version (profile photos) and keeps it in memory for lists.
 */
export function PrivateImage({ id, url, thumb = false, client = api, alt = '', className, onClick, fallback }) {
  const base = url || `/uploads/private/${id}`;
  const path = thumb ? `${base}?thumb=1` : base;
  const [state, setState] = useState(() => ({ path, src: thumb ? peekPrivateImage(path) : null, failed: false }));
  useEffect(() => {
    let href = null;
    let alive = true;
    const cached = thumb ? peekPrivateImage(path) : null;
    setState({ path, src: cached, failed: false });
    if (cached) return undefined;
    const load = thumb
      ? loadPrivateImage(client, path)
      : client.get(path, { responseType: 'blob' }).then((r) => {
          href = URL.createObjectURL(r.data);
          return href;
        });
    load.then((src) => alive && setState({ path, src, failed: false })).catch(() => alive && setState({ path, src: null, failed: true }));
    return () => {
      alive = false;
      if (href) URL.revokeObjectURL(href); // cached thumbnails stay for other lists
    };
  }, [path, client, thumb]);
  const src = state.path === path ? state.src : null;
  if (state.path === path && state.failed)
    return (
      fallback || (
        <span className={clsx('flex items-center justify-center bg-slate-100 text-slate-400', className)} title="Photo not available">
          <ImageOff className="size-5" />
        </span>
      )
    );
  if (!src) return <span className={clsx('block animate-pulse bg-slate-100', className)} />;
  const img = <img src={src} alt={alt} className={clsx('object-cover', className)} />;
  return onClick ? (
    <button type="button" onClick={onClick} className="block" aria-label={alt || 'Open photo'}>
      {img}
    </button>
  ) : (
    img
  );
}

/** Shrinks a photo in the browser (longest side 1600 px, JPEG) so uploads stay small on mobile data. */
export async function shrinkImage(file, max = 1600) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024 && file.type === 'image/jpeg') return file;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b || file), 'image/jpeg', 0.85));
}

/** Square, centre-cropped small JPEG (profile photo thumbnail for lists). Null if the browser cannot read the image. */
export async function makeThumb(file, size = 128) {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  canvas.getContext('2d').drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.8));
}

const imageType = (blob) => (['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) ? blob.type : 'image/jpeg');

/** Uploads a progress photo for a member into private storage. Returns { _id }. */
export async function uploadPrivatePhoto(file, memberId) {
  const blob = await shrinkImage(file);
  const r = await api.post(`/uploads/private?memberId=${memberId}&kind=progress`, blob, { headers: { 'Content-Type': imageType(blob) } });
  return r.data.data;
}

/** Uploads a member's profile photo (private) and its 128 px thumbnail. Returns { photoFileId }. */
export async function uploadMemberPhoto(memberId, file) {
  const blob = await shrinkImage(file, 1024);
  const r = await api.post(`/members/${memberId}/photo`, blob, { headers: { 'Content-Type': imageType(blob) } });
  const small = await makeThumb(file);
  // Without a thumbnail the server sends the full photo, so a failure here is not fatal.
  if (small) await api.put(`/members/${memberId}/photo/thumb`, small, { headers: { 'Content-Type': 'image/jpeg' } }).catch(() => {});
  return r.data.data;
}
