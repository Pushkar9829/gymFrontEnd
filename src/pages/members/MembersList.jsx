import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Plus, Search, Download, Upload, Undo2 } from 'lucide-react';
import { useApi, useAction } from '../../lib/hooks';
import { useAuth } from '../../store/auth';
import { openFile, post } from '../../lib/api';
import { inr, fmtDate, daysUntil } from '../../lib/format';
import { Badge, Button, Card, Input, PageHeader, Pagination, Select, Spinner, Table, EmptyState } from '../../components/ui';
import { MemberAvatar } from '../../components/MemberAvatar';
import MemberForm from './MemberForm';
import ImportMembers from './ImportMembers';

export default function MembersList() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') || '');
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const navigate = useNavigate();
  const can = useAuth((s) => s.can);

  const page = Number(params.get('page') || 1);
  const status = params.get('status') || '';
  const due = params.get('due') || '';
  const expiring = params.get('expiring') || '';
  const deleted = params.get('deleted') || '';
  const restore = useAction((id) => post(`/members/${id}/restore`), { success: 'Member restored', invalidate: ['members', 'dashboard'] });

  const { data, isLoading, isFetching } = useApi('members', '/members', {
    page,
    search: params.get('search') || '',
    status,
    due,
    expiringInDays: expiring,
    deleted,
  });

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries({ page: '', ...patch }).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next);
  };

  const filter = deleted ? 'deleted' : expiring ? 'expiring' : due ? 'due' : status;

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle={data ? `${data.total} member(s)` : ' '}
        actions={
          can('members.write') && (
            <>
              <Button variant="secondary" onClick={() => setShowImport(true)}>
                <Upload className="size-4" /> Import CSV
              </Button>
              <Button onClick={() => setShowForm(true)}>
                <Plus className="size-4" /> Register member
              </Button>
            </>
          )
        }
      />
      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
          <form
            className="relative min-w-56 flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              update({ search });
            }}
          >
            <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-slate-400" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone or member code" className="pl-9" />
          </form>
          <Select
            className="w-auto"
            value={filter}
            onChange={(e) => {
              const v = e.target.value;
              update({ status: ['active', 'expired', 'frozen', 'upcoming', 'none'].includes(v) ? v : '', due: v === 'due' ? 'true' : '', expiring: v === 'expiring' ? '7' : '', deleted: v === 'deleted' ? 'true' : '' });
            }}
          >
            <option value="">All members</option>
            <option value="active">Active</option>
            <option value="expiring">Expiring in 7 days</option>
            <option value="expired">Expired</option>
            <option value="frozen">Frozen</option>
            <option value="upcoming">Starting soon</option>
            <option value="due">With pending dues</option>
            <option value="none">No membership</option>
            {can('members.delete') && <option value="deleted">Deleted members</option>}
          </Select>
          {isFetching && <Spinner className="size-4" />}
        </div>
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <>
            <Table
              rows={data?.items}
              onRowClick={deleted ? undefined : (m) => navigate(`/admin/members/${m._id}`)}
              empty={<EmptyState title="No members found">Try a different search or filter.</EmptyState>}
              columns={[
                {
                  key: 'name',
                  label: 'Member',
                  render: (m) => (
                    <div className="flex items-center gap-3">
                      <MemberAvatar member={m} size="sm" />
                      <div>
                        <p className="font-medium text-slate-900">
                          {m.name} {m.isBlocked && <Badge status="deny">Blocked</Badge>}
                        </p>
                        <p className="text-xs text-slate-500">
                          #{m.memberCode} · {m.phone}
                        </p>
                      </div>
                    </div>
                  ),
                },
                { key: 'plan', label: 'Plan', render: (m) => m.currentPlanName || '—' },
                { key: 'status', label: 'Status', render: (m) => <Badge status={m.membershipStatus} /> },
                {
                  key: 'end',
                  label: 'Valid till',
                  render: (m) => {
                    if (!m.membershipEnd) return '—';
                    const d = daysUntil(m.membershipEnd);
                    return (
                      <span>
                        {fmtDate(m.membershipEnd)}
                        {m.membershipStatus === 'active' && d <= 7 && <span className="ml-1 text-xs font-medium text-amber-600">({d === 0 ? 'today' : `${d}d`})</span>}
                      </span>
                    );
                  },
                },
                { key: 'due', label: 'Due', render: (m) => (m.dueAmount ? <span className="font-medium text-rose-600">{inr(m.dueAmount)}</span> : '—') },
                { key: 'trainer', label: 'Trainer', className: 'hidden lg:table-cell', render: (m) => m.trainerId?.name || '—' },
                ...(deleted
                  ? [
                      {
                        key: 'restore',
                        label: '',
                        render: (m) => (
                          <Button size="sm" variant="secondary" loading={restore.isPending && restore.variables === m._id} onClick={() => restore.mutate(m._id)}>
                            <Undo2 className="size-3.5" /> Restore
                          </Button>
                        ),
                      },
                    ]
                  : []),
              ]}
            />
            <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={(p) => update({ page: String(p) })} />
          </>
        )}
      </Card>
      {can('reports.read') && (
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => openFile('/reports/memberships?export=xlsx&days=30', { download: 'memberships.xlsx' })}>
            <Download className="size-4" /> Export expiring / expired (Excel)
          </Button>
        </div>
      )}
      <ImportMembers open={showImport} onClose={() => setShowImport(false)} />
      <MemberForm open={showForm} onClose={() => setShowForm(false)} onSaved={(m) => navigate(`/admin/members/${m._id}`)} />
    </div>
  );
}
