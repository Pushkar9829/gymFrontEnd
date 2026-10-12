import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Download, Users } from 'lucide-react';
import { useApi } from '../lib/hooks';
import { openFile } from '../lib/api';
import { fmtDateTime, fmtTime, ymd } from '../lib/format';
import { useAuth } from '../store/auth';
import StaffAttendance from './StaffAttendance';
import { Badge, Button, Card, EmptyState, Input, PageHeader, Pagination, Select, Spinner, Table, Tabs } from '../components/ui';
import { MemberAvatar } from '../components/MemberAvatar';

function Live() {
  const { data, isLoading } = useApi('attendance-live', '/attendance/live', {}, { refetchInterval: 30000 });
  const navigate = useNavigate();
  if (isLoading) return <Spinner />;
  return (
    <Card title={`In the gym now · ${data?.count ?? 0}`} padded={false}>
      <Table
        rows={data?.items}
        onRowClick={(r) => navigate(`/admin/members/${r.memberId?._id}`)}
        empty={<EmptyState icon={Users} title="Nobody checked in right now" />}
        columns={[
          { key: 'm', label: 'Member', render: (r) => <MemberCell m={r.memberId} trial={r.isTrial} /> },
          { key: 'in', label: 'Checked in', render: (r) => fmtTime(r.checkInAt) },
          { key: 'method', label: 'Via', render: (r) => r.method },
          { key: 'plan', label: 'Plan', render: (r) => r.memberId?.currentPlanName || '—' },
        ]}
      />
    </Card>
  );
}

const MemberCell = ({ m, trial }) =>
  m ? (
    <div className="flex items-center gap-2">
      <MemberAvatar member={m} size="sm" />
      <div>
        <p className="font-medium text-slate-900">
          {m.name} {trial && <Badge status="trial">Trial</Badge>}
        </p>
        <p className="text-xs text-slate-500">#{m.memberCode}</p>
      </div>
    </div>
  ) : (
    '—'
  );

function Visits() {
  const [date, setDate] = useState(ymd());
  const [page, setPage] = useState(1);
  const branchId = useAuth((s) => s.branchId);
  const { data, isLoading } = useApi('attendance', '/attendance', { date, page });
  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <Input type="date" value={date} onChange={(e) => (setDate(e.target.value), setPage(1))} className="w-auto" />
        <span className="text-sm text-slate-500">{data?.total ?? 0} visit(s)</span>
        <div className="flex-1" />
        <Button variant="ghost" size="sm" onClick={() => openFile(`/attendance?export=xlsx&date=${date}${branchId ? `&branchId=${branchId}` : ''}`, { download: `attendance-${date}.xlsx` })}>
          <Download className="size-4" /> Excel
        </Button>
      </div>
      {isLoading ? (
        <div className="p-6">
          <Spinner />
        </div>
      ) : (
        <>
          <Table
            rows={data?.items}
            empty={<EmptyState title="No visits on this day" />}
            columns={[
              { key: 'm', label: 'Member', render: (r) => <MemberCell m={r.memberId} trial={r.isTrial} /> },
              { key: 'in', label: 'In', render: (r) => fmtTime(r.checkInAt) },
              { key: 'out', label: 'Out', render: (r) => fmtTime(r.checkOutAt) },
              { key: 'method', label: 'Via', render: (r) => r.deviceId?.name || r.method },
            ]}
          />
          <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} />
        </>
      )}
    </Card>
  );
}

function EntryLog({ initialResult }) {
  const [result, setResult] = useState(initialResult);
  const [date, setDate] = useState(ymd());
  const [page, setPage] = useState(1);
  const { data, isLoading } = useApi('access-logs', '/attendance/access-logs', { result, date, page }, { refetchInterval: 30000 });
  return (
    <Card padded={false}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <Input type="date" value={date} onChange={(e) => (setDate(e.target.value), setPage(1))} className="w-auto" />
        <Select value={result} onChange={(e) => (setResult(e.target.value), setPage(1))} className="w-auto">
          <option value="">All attempts</option>
          <option value="deny">Denied only</option>
          <option value="allow">Allowed only</option>
        </Select>
      </div>
      {isLoading ? (
        <div className="p-6">
          <Spinner />
        </div>
      ) : (
        <>
          <Table
            rows={data?.items}
            empty={<EmptyState title="No entry attempts" />}
            columns={[
              { key: 'at', label: 'Time', render: (r) => fmtDateTime(r.at) },
              { key: 'm', label: 'Member', render: (r) => (r.memberId ? <MemberCell m={r.memberId} /> : <span className="text-slate-500">Unknown ID {r.pin}</span>) },
              { key: 'result', label: 'Result', render: (r) => <Badge status={r.result}>{r.result === 'allow' ? 'Allowed' : 'Denied'}</Badge> },
              { key: 'reason', label: 'Reason', className: 'whitespace-normal min-w-56', render: (r) => <span className="text-sm">{r.reason}</span> },
              { key: 'via', label: 'Via', render: (r) => r.deviceId?.name || (r.byUser ? `${r.source} · ${r.byUser.name}` : r.source) },
            ]}
          />
          <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} />
        </>
      )}
    </Card>
  );
}

export default function Attendance() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab') || 'live';
  return (
    <div>
      <PageHeader title="Attendance" subtitle="Live occupancy, daily visits and every entry attempt (biometric, QR and manual)" />
      <Tabs
        value={tab === 'denied' ? 'log' : tab}
        onChange={(v) => setParams({ tab: v })}
        tabs={[
          { value: 'live', label: 'In gym now' },
          { value: 'visits', label: 'Visits' },
          { value: 'log', label: 'Entry log' },
          { value: 'staff', label: 'Staff' },
        ]}
      />
      {tab === 'live' && <Live />}
      {tab === 'visits' && <Visits />}
      {(tab === 'log' || tab === 'denied') && <EntryLog initialResult={tab === 'denied' ? 'deny' : ''} />}
      {tab === 'staff' && <StaffAttendance />}
    </div>
  );
}
