import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, FileSignature, FileText } from 'lucide-react';
import { memberApi, errorMessage, openFile } from '../../lib/api';
import { fmtDateTime } from '../../lib/format';
import { Button, Card, EmptyState, PageLoader } from '../../components/ui';
import WaiverSignForm from '../../components/WaiverSignForm';
import { portalGet } from './PortalHome';

export default function PortalWaiver() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['portal', 'waiver'], queryFn: () => portalGet('/me/waiver') });
  const { data: me } = useQuery({ queryKey: ['portal'], queryFn: () => portalGet('/me') });
  const [busy, setBusy] = useState(false);
  if (isLoading || !data) return <PageLoader />;

  async function sign(signature) {
    setBusy(true);
    try {
      await memberApi.client.post('/me/waiver/sign', { version: data.current.version, signature });
      toast.success('Thank you. Waiver signed.');
      await qc.invalidateQueries({ queryKey: ['portal'] });
      navigate('/portal');
    } catch (err) {
      toast.error(errorMessage(err));
      await qc.invalidateQueries({ queryKey: ['portal', 'waiver'] });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Link to="/portal" className="inline-flex items-center gap-1 text-sm text-slate-500">
        <ArrowLeft className="size-4" /> {data.pending ? 'Later' : 'Home'}
      </Link>
      <h1 className="text-lg font-semibold">Gym waiver</h1>
      {!data.current ? (
        <Card>
          <EmptyState icon={FileSignature} title="Nothing to sign">
            The gym has not added a waiver yet.
          </EmptyState>
        </Card>
      ) : data.pending ? (
        <Card title="Please read and sign">
          {data.requiredForEntry && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">The gym needs your signature before you can enter.</p>}
          <WaiverSignForm waiver={data.current} name={me?.member?.name} onSign={sign} busy={busy} />
        </Card>
      ) : (
        <Card>
          <div className="flex flex-col items-center gap-2 text-center">
            <FileSignature className="size-10 text-emerald-600" />
            <p className="font-semibold text-slate-800">Waiver signed</p>
            <p className="text-sm text-slate-500">
              Version {data.signed?.version} on {fmtDateTime(data.signed?.signedAt)}
            </p>
            <Button size="sm" variant="secondary" onClick={() => openFile('/me/waiver/pdf', { client: memberApi.client })}>
              <FileText className="size-4" /> Download copy
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
