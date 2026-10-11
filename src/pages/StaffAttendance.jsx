import { useState } from 'react';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';
import { Clock } from 'lucide-react';
import { get, post } from '../lib/api';
import { useAction } from '../lib/hooks';
import { fmtDate, fmtTime } from '../lib/format';
import { Button, Card, EmptyState, Input, Pagination, Table } from '../components/ui';

/** Clock in / out button for the admin top bar. */
export function ClockButton() {
  const { data } = useQuery({ queryKey: ['staff-attendance', 'today'], queryFn: () => get('/staff-attendance/me/today'), refetchInterval: 5 * 60000 });
  const clockIn = useAction(() => post('/staff-attendance/clock-in'), { success: 'Clocked in', invalidate: ['staff-attendance'] });
  const clockOut = useAction(() => post('/staff-attendance/clock-out'), { success: 'Clocked out', invalidate: ['staff-attendance'] });
  if (data === undefined) return null;
  if (!data)
    return (
      <Button size="sm" variant="secondary" loading={clockIn.isPending} onClick={() => clockIn.mutate()}>
        <Clock className="size-4" /> Clock in
      </Button>
    );
  if (data.checkOutAt)
    return (
      <span className="flex items-center gap-1.5 px-2 text-sm text-slate-500" title="One shift per day is recorded">
        <Clock className="size-4" />
        <span className="hidden sm:inline">
          Shift done · {fmtTime(data.checkInAt)}–{fmtTime(data.checkOutAt)}
        </span>
      </span>
    );
  return (
    <Button size="sm" variant="ghost" loading={clockOut.isPending} onClick={() => clockOut.mutate()} title={`In since ${fmtTime(data.checkInAt)}`}>
      <Clock className="size-4 text-emerald-600" />
      <span className="hidden sm:inline">{data.checkOutAt ? `Out ${fmtTime(data.checkOutAt)}` : `In ${fmtTime(data.checkInAt)} · Clock out`}</span>
    </Button>
  );
}

export default function StaffAttendance() {
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [page, setPage] = useState(1);
  const from = `${month}-01`;
  const to = dayjs(from).endOf('month').format('YYYY-MM-DD');
  const { data: summary } = useQuery({ queryKey: ['staff-attendance', 'summary', month], queryFn: () => get('/staff-attendance/summary', { month }) });
  const { data: rows } = useQuery({ queryKey: ['staff-attendance', 'rows', month, page], queryFn: () => get('/staff-attendance', { from, to, page }) });
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input type="month" value={month} onChange={(e) => (setMonth(e.target.value), setPage(1))} className="w-auto" />
        <span className="text-sm text-slate-500">Staff punch the biometric device with their staff ID, or use Clock in / out at the top.</span>
      </div>
      <Card title="Monthly summary" padded={false}>
        <Table
          rows={summary?.rows}
          empty={<EmptyState title="No staff attendance this month" />}
          columns={[
            { key: 'name', label: 'Staff', render: (r) => <b>{r.name}</b> },
            { key: 'role', label: 'Role', render: (r) => <span className="capitalize">{r.role}</span> },
            { key: 'days', label: 'Days present', render: (r) => r.daysPresent },
            { key: 'hours', label: 'Hours', render: (r) => r.hours },
            { key: 'miss', label: 'Missing check-out', render: (r) => (r.missingCheckOut ? <span className="text-amber-600">{r.missingCheckOut}</span> : '—') },
          ]}
        />
      </Card>
      <Card title="Daily log" padded={false}>
        <Table
          rows={rows?.items}
          empty={<EmptyState title="No entries" />}
          columns={[
            { key: 'd', label: 'Date', render: (r) => fmtDate(r.checkInAt) },
            { key: 'u', label: 'Staff', render: (r) => r.userId?.name },
            { key: 'in', label: 'In', render: (r) => fmtTime(r.checkInAt) },
            { key: 'out', label: 'Out', render: (r) => fmtTime(r.checkOutAt) },
            { key: 'm', label: 'Via', render: (r) => r.method },
          ]}
        />
        <Pagination page={rows?.page} pages={rows?.pages} total={rows?.total} onChange={setPage} />
      </Card>
    </div>
  );
}
