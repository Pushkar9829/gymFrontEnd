import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileSignature, FileText, X } from 'lucide-react';
import { get, post, openFile } from '../../lib/api';
import { useAction } from '../../lib/hooks';
import { useAuth } from '../../store/auth';
import { fmtDate } from '../../lib/format';
import { Badge, Button } from '../../components/ui';
import WaiverSignForm from '../../components/WaiverSignForm';

export function useMemberWaiver(memberId) {
  return useQuery({ queryKey: ['member', memberId, 'waiver'], queryFn: () => get(`/members/${memberId}/waiver`) });
}

/** "Waiver signed v3 on …" / "Not signed" badge for the member page. */
export function WaiverBadge({ waiver }) {
  if (!waiver?.current) return null;
  const last = waiver.signatures?.[0];
  if (!waiver.pending && last) return <Badge status="active">Waiver signed v{last.version} on {fmtDate(last.signedAt)}</Badge>;
  if (last) return <Badge status="expired">Waiver v{last.version} – sign the new version</Badge>;
  return <Badge status="deny">Waiver not signed</Badge>;
}

/** Full-screen signing at the desk: the member signs on the reception tablet / phone. */
function DeskSign({ member, waiver, onClose }) {
  const sign = useAction((signature) => post(`/members/${member._id}/waiver/sign`, { version: waiver.current.version, signature }), {
    success: 'Waiver signed',
    invalidate: ['member', 'members'],
    onSuccess: onClose,
  });
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-white" role="dialog" aria-modal="true" aria-label="Sign waiver">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3">
        <p className="font-semibold text-slate-900">Gym waiver · {member.name}</p>
        <button onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100" aria-label="Close">
          <X className="size-5" />
        </button>
      </div>
      <div className="mx-auto max-w-2xl px-4 py-4">
        <p className="mb-3 text-sm text-slate-500">Hand the screen to the member. They read, tick and sign with a finger.</p>
        <WaiverSignForm waiver={waiver.current} name={member.name} busy={sign.isPending} onSign={(d) => sign.mutate(d)} />
      </div>
    </div>
  );
}

/** Buttons on the member page: sign at the desk, download the signed PDF. */
export function WaiverActions({ member, waiver }) {
  const can = useAuth((s) => s.can);
  const [open, setOpen] = useState(false);
  if (!waiver?.current) return null;
  const signed = waiver.signatures?.length > 0;
  return (
    <>
      {waiver.pending && can('members.write') && !member.isDeleted && (
        <Button variant="secondary" onClick={() => setOpen(true)}>
          <FileSignature className="size-4" /> Sign waiver
        </Button>
      )}
      {signed && (
        <Button variant="secondary" onClick={() => openFile(`/members/${member._id}/waiver/pdf`, { download: `waiver-${member.memberCode}.pdf` })}>
          <FileText className="size-4" /> Waiver PDF
        </Button>
      )}
      {open && <DeskSign member={member} waiver={waiver} onClose={() => setOpen(false)} />}
    </>
  );
}
