import { useNavigate } from 'react-router';
import { Users, Snowflake, CalendarDays, HeartPulse, AlarmClock, UserX, ScanLine, ShieldX, IndianRupee, Wallet, PhoneCall, Fingerprint } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import dayjs from 'dayjs';
import { useApi } from '../lib/hooks';
import { inr, fromNow, fmtTime, ymd } from '../lib/format';
import { useAuth } from '../store/auth';
import SetupChecklist from './SetupChecklist';
import { PendingList } from './Approvals';
import { HandoverCard } from './Handover';
import { Card, PageHeader, PageLoader, StatCard, Button } from '../components/ui';

// A trainer's day: their classes today and PT clients with sessions left.
function TrainerDay() {
  const navigate = useNavigate();
  const today = ymd();
  const { data: classes } = useApi(['classes', 'sessions', 'mine'], '/classes/sessions', { from: today, to: today, mine: true });
  const { data: pt } = useApi(['pt', 'purchases', 'mine'], '/pt/purchases', { state: 'active', limit: 8 });
  return (
    <div className="mb-5 grid gap-4 lg:grid-cols-2">
      <Card title="My classes today" actions={<Button size="sm" variant="secondary" onClick={() => navigate('/admin/classes')}>Timetable</Button>}>
        {classes?.length ? (
          <ul className="space-y-2 text-sm">
            {classes.map((c) => (
              <li key={c._id} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2">
                  <CalendarDays className="size-4 text-slate-400" />
                  {fmtTime(c.startsAt)} · {c.name}
                </span>
                <span className="text-slate-500">{c.status === 'cancelled' ? 'Cancelled' : `${c.bookedCount}/${c.capacity} booked`}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No classes for you today.</p>
        )}
      </Card>
      <Card title="My PT clients" actions={<Button size="sm" variant="secondary" onClick={() => navigate('/admin/pt')}>Log a session</Button>}>
        {pt?.items?.length ? (
          <ul className="space-y-2 text-sm">
            {pt.items.map((p) => (
              <li key={p._id} className="flex items-center justify-between gap-3">
                <button className="flex items-center gap-2 font-medium text-brand-700 hover:underline" onClick={() => navigate(`/admin/members/${p.memberId?._id}`)}>
                  <HeartPulse className="size-4 text-slate-400" />
                  {p.memberId?.name}
                </button>
                <span className="text-slate-500">{p.sessionsTotal - p.sessionsUsed} sessions left</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No active PT clients.</p>
        )}
      </Card>
    </div>
  );
}

export default function Dashboard() {
  const { data, isLoading } = useApi('dashboard', '/reports/dashboard', {}, { refetchInterval: 60000 });
  const navigate = useNavigate();
  const { can, user } = useAuth();
  if (isLoading || !data) return <PageLoader />;
  const { members, attendance, money, followUpsDue, alerts, devices } = data;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={dayjs().format('dddd, DD MMMM YYYY')}
        actions={
          can('attendance.write') && (
            <Button onClick={() => navigate('/admin/check-in')}>
              <ScanLine className="size-4" /> Check-in
            </Button>
          )
        }
      />

      {can('handover.read') && <HandoverCard />}
      <SetupChecklist />
      {user.role === 'trainer' && <TrainerDay />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Active members" value={members.active} icon={Users} tone="green" onClick={() => navigate('/admin/members?status=active')} />
        <StatCard label="Expiring in 7 days" value={members.expiringIn7Days} icon={AlarmClock} tone="amber" onClick={() => navigate('/admin/members?expiring=7')} />
        <StatCard label="Expired (30 days)" value={members.expiredLast30Days} icon={UserX} tone="red" onClick={() => navigate('/admin/members?status=expired')} />
        <StatCard label="Frozen" value={members.frozen} icon={Snowflake} tone="indigo" onClick={() => navigate('/admin/members?status=frozen')} />
        <StatCard label="Check-ins today" value={attendance.checkinsToday} icon={ScanLine} tone="brand" onClick={() => navigate('/admin/attendance')} />
        <StatCard label="Entries denied today" value={attendance.deniedToday} icon={ShieldX} tone="red" onClick={() => navigate('/admin/attendance?tab=denied')} />
        {money && <StatCard label="Collected today" value={inr(money.collectedToday)} hint={`This month ${inr(money.collectedThisMonth)}`} icon={IndianRupee} tone="green" onClick={() => navigate('/admin/payments')} />}
        {money && <StatCard label="Pending dues" value={inr(money.totalDues)} icon={Wallet} tone="amber" onClick={() => navigate('/admin/members?due=true')} />}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <Card title="Check-ins (last 14 days)" className="lg:col-span-2">
          <div className="relative h-64">
            {!attendance.last14Days.some((d) => d.count) && (
              <p className="absolute inset-0 z-10 flex items-center justify-center text-sm text-slate-500">No check-ins in the last 14 days yet.</p>
            )}
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attendance.last14Days.map((d) => ({ ...d, label: dayjs(d.day).format('DD MMM') }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={30} />
                <Tooltip cursor={{ fill: '#f1f5f9' }} />
                <Bar dataKey="count" name="Check-ins" fill="#0f766e" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Today">
            <ul className="space-y-3 text-sm">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-slate-600">
                  <PhoneCall className="size-4" /> Lead follow-ups due
                </span>
                <button className="font-semibold text-brand-700 hover:underline" onClick={() => navigate('/admin/leads?followUpDue=true')}>
                  {followUpsDue}
                </button>
              </li>
              {data.openComplaints != null && (
                <li className="flex items-center justify-between">
                  <span className="text-slate-600">Open complaints</span>
                  <button className={data.openComplaints ? 'font-semibold text-rose-600 hover:underline' : 'font-semibold text-brand-700 hover:underline'} onClick={() => navigate('/admin/feedback')}>
                    {data.openComplaints}
                  </button>
                </li>
              )}
              {data.dayClose && (
                <li className="flex items-center justify-between">
                  <span className="text-slate-600">Day closing</span>
                  <button
                    className={data.dayClose.closed >= data.dayClose.total ? 'font-semibold text-emerald-700 hover:underline' : 'font-semibold text-amber-600 hover:underline'}
                    onClick={() => navigate('/admin/cash')}
                  >
                    {data.dayClose.total === 1
                      ? data.dayClose.closed
                        ? `Closed${data.dayClose.difference < 0 ? ` · short ${inr(-data.dayClose.difference)}` : ''}`
                        : 'Not closed yet'
                      : `${data.dayClose.closed} of ${data.dayClose.total} branches closed`}
                  </button>
                </li>
              )}
              {data.lockersOverdue != null && (
                <li className="flex items-center justify-between">
                  <span className="text-slate-600">Lockers overdue</span>
                  <button className={data.lockersOverdue ? 'font-semibold text-rose-600 hover:underline' : 'font-semibold text-brand-700 hover:underline'} onClick={() => navigate('/admin/lockers?status=overdue')}>
                    {data.lockersOverdue}
                  </button>
                </li>
              )}
              {data.trials && (
                <li className="flex items-center justify-between">
                  <span className="text-slate-600">Trial visitors today</span>
                  <button className="font-semibold text-brand-700 hover:underline" onClick={() => navigate('/admin/trials')}>
                    {data.trials.visitsToday} of {data.trials.active} on a pass
                  </button>
                </li>
              )}
              <li className="flex items-center justify-between">
                <span className="text-slate-600">New members this month</span>
                <span className="font-semibold">{members.newThisMonth}</span>
              </li>
              {money && (
                <li className="flex items-center justify-between">
                  <span className="text-slate-600">Expenses this month</span>
                  <span className="font-semibold">{inr(money.expensesThisMonth)}</span>
                </li>
              )}
            </ul>
          </Card>
          <Card title="Biometric devices">
            {devices.length ? (
              <ul className="space-y-2 text-sm">
                {devices.map((d) => (
                  <li key={d.name} className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Fingerprint className="size-4 text-slate-400" />
                      {d.name}
                    </span>
                    <span className={d.online ? 'text-emerald-600' : 'text-rose-600'}>{d.online ? 'Online' : `Offline · ${fromNow(d.lastSeenAt)}`}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-500">No device added yet.</p>
            )}
          </Card>
        </div>
      </div>

      {data.approvals?.pending > 0 && (
        <Card
          title={`Discount approvals waiting (${data.approvals.pending})`}
          className="mt-4"
          padded={false}
          actions={
            <Button size="sm" variant="secondary" onClick={() => navigate('/admin/approvals')}>
              See all
            </Button>
          }
        >
          <PendingList items={data.approvals.items} />
        </Card>
      )}

      <Card title="Recent alerts" className="mt-4" padded={false}>
        {alerts.length ? (
          <ul className="divide-y divide-slate-100">
            {alerts.map((a) => (
              <li key={a._id} className="flex items-start justify-between gap-3 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">{a.subject}</p>
                  {a.body && <p className="text-xs text-slate-500">{a.body}</p>}
                </div>
                <span className="shrink-0 text-xs text-slate-400">{fromNow(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="px-4 py-6 text-center text-sm text-slate-500">No unread alerts</p>
        )}
      </Card>
    </div>
  );
}
