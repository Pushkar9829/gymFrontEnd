import { useRef, useState } from 'react';
import { toast } from 'sonner';
import SignaturePad from './SignaturePad';
import { Button } from './ui';

/** Waiver text + "I agree" + signature box. onSign(dataUrl) does the saving. Used in the app and at the desk. */
export default function WaiverSignForm({ waiver, name, onSign, busy, signLabel = 'Sign waiver' }) {
  const pad = useRef(null);
  const [agree, setAgree] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  function submit() {
    if (pad.current.isEmpty()) return toast.error('Please sign in the box');
    onSign(pad.current.toDataURL());
  }
  return (
    <div className="space-y-3">
      <div className="max-h-72 overflow-y-auto rounded-lg bg-slate-50 p-3 text-sm leading-relaxed whitespace-pre-line text-slate-700 ring-1 ring-slate-200" aria-label="Waiver text">
        {waiver.text}
      </div>
      <p className="text-xs text-slate-500">Version {waiver.version}</p>
      <label className="flex items-start gap-2 text-sm text-slate-700">
        <input type="checkbox" className="mt-0.5 size-4 rounded border-slate-300" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>
          I{name ? `, ${name},` : ''} have read and agree to the above.
        </span>
      </label>
      <SignaturePad ref={pad} onChange={setHasInk} />
      <Button className="w-full" size="lg" disabled={!agree || !hasInk} loading={busy} onClick={submit}>
        {signLabel}
      </Button>
    </div>
  );
}
