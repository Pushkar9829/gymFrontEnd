import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { get } from '../lib/api';
import { Input } from './ui';

/** Search a member by name / phone / code and pick one. */
export default function MemberPicker({ value, onChange, placeholder = 'Search member: name / phone / code', autoFocus }) {
  const [q, setQ] = useState('');
  const { data } = useQuery({ queryKey: ['member-picker', q], queryFn: () => get('/members', { search: q, limit: 6 }), enabled: q.length >= 2 && !value });
  if (value)
    return (
      <p className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-sm">
        <span>
          <b>{value.name}</b> <span className="text-slate-500">#{value.memberCode}</span>
        </span>
        <button type="button" className="text-slate-500 hover:text-slate-700" onClick={() => onChange(null)} aria-label="Change member">
          <X className="size-4" />
        </button>
      </p>
    );
  return (
    <div>
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} />
      {q.length >= 2 && data?.items && (
        <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg bg-white ring-1 ring-slate-200">
          {data.items.map((m) => (
            <li key={m._id}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => onChange(m)}>
                {m.name} <span className="text-slate-400">#{m.memberCode} · {m.phone}</span>
              </button>
            </li>
          ))}
          {!data.items.length && <li className="px-3 py-2 text-sm text-slate-500">No member found</li>}
        </ul>
      )}
    </div>
  );
}
