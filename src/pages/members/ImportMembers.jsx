import { useState } from 'react';
import { Upload } from 'lucide-react';
import { post } from '../../lib/api';
import { useAction, useBranches, useDefaultBranchId } from '../../lib/hooks';
import { csvToMembers } from '../../lib/csv';
import { Button, Field, Modal, Select } from '../../components/ui';

const SAMPLE = 'name,phone,email,gender,dob,address\nRahul Sharma,9876543210,rahul@example.com,male,1995-04-12,Sector 5\n';

export default function ImportMembers({ open, onClose }) {
  const { data: branches } = useBranches();
  const defaultBranch = useDefaultBranchId();
  const [branchId, setBranchId] = useState('');
  const [parsed, setParsed] = useState(null);
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState(null);

  const save = useAction((body) => post('/members/import', body), {
    success: (d) => `${d.created} member(s) imported`,
    invalidate: ['members', 'dashboard'],
    onSuccess: setResult,
  });

  const reset = () => {
    setParsed(null);
    setFileName('');
    setResult(null);
  };

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setFileName(file.name);
    setParsed(csvToMembers(await file.text()));
  }

  const downloadSample = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([SAMPLE], { type: 'text/csv' }));
    a.download = 'members-sample.csv';
    a.click();
  };

  return (
    <Modal
      open={open}
      onClose={() => (reset(), onClose())}
      title="Import members from CSV"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => (reset(), onClose())}>
            Close
          </Button>
          <Button
            disabled={!parsed?.members.length || !!result}
            loading={save.isPending}
            onClick={() => save.mutate({ branchId: branchId || defaultBranch, rows: parsed.members.slice(0, 1000) })}
          >
            Import {parsed?.members.length || ''} member(s)
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <p className="text-slate-600">
          Columns: <b>name</b>, <b>phone</b> (required), email, gender, dob (YYYY-MM-DD or DD-MM-YYYY), address. Up to 1000 rows. Members with an existing phone are skipped. Memberships are added afterwards
          from each member's page.{' '}
          <button className="font-medium text-brand-700 hover:underline" onClick={downloadSample}>
            Download sample
          </button>
        </p>
        <Field label="Branch">
          <Select value={branchId || defaultBranch} onChange={(e) => setBranchId(e.target.value)}>
            {branches?.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-6 text-slate-500 hover:border-brand-400">
          <Upload className="size-6" />
          <span>{fileName || 'Choose a .csv file'}</span>
          <input type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </label>
        {parsed && (
          <div className="rounded-lg bg-slate-50 p-3">
            <p>
              Ready to import: <b>{parsed.members.length}</b>
            </p>
            {parsed.errors.length > 0 && (
              <ul className="mt-2 max-h-32 list-disc overflow-y-auto pl-5 text-rose-600">
                {parsed.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </div>
        )}
        {result && (
          <div className="rounded-lg bg-emerald-50 p-3 text-emerald-800">
            <p>
              Imported <b>{result.created}</b> member(s).
            </p>
            {result.skipped.length > 0 && (
              <ul className="mt-2 max-h-32 list-disc overflow-y-auto pl-5 text-amber-700">
                {result.skipped.map((s) => (
                  <li key={s.row}>
                    Row {s.row} ({s.phone}): {s.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
