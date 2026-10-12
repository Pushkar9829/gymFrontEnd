import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import clsx from 'clsx';
import { api } from '../lib/api';

/**
 * Shows a private file (progress photo, signature). It is fetched with the login token and shown from memory,
 * because these files have no public link. `client` = staff (default) or the member app's client.
 */
export function PrivateImage({ id, url, client = api, alt = '', className, onClick }) {
  const [src, setSrc] = useState(null);
  const [failed, setFailed] = useState(false);
  const path = url || `/uploads/private/${id}`;
  useEffect(() => {
    let href = null;
    let alive = true;
    setFailed(false);
    client
      .get(path, { responseType: 'blob' })
      .then((r) => {
        if (!alive) return;
        href = URL.createObjectURL(r.data);
        setSrc(href);
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
      if (href) URL.revokeObjectURL(href);
    };
  }, [path, client]);
  if (failed)
    return (
      <span className={clsx('flex items-center justify-center bg-slate-100 text-slate-400', className)} title="Photo not available">
        <ImageOff className="size-5" />
      </span>
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

/** Uploads a progress photo for a member into private storage. Returns { _id }. */
export async function uploadPrivatePhoto(file, memberId) {
  const blob = await shrinkImage(file);
  const type = ['image/jpeg', 'image/png', 'image/webp'].includes(blob.type) ? blob.type : 'image/jpeg';
  const r = await api.post(`/uploads/private?memberId=${memberId}&kind=progress`, blob, { headers: { 'Content-Type': type } });
  return r.data.data;
}
