import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { get, post, put } from '../../lib/api';
import { useAction, useBranches, useDefaultBranchId } from '../../lib/hooks';
import { ymd } from '../../lib/format';
import { Button, Field, Input, Modal, Select, Textarea } from '../../components/ui';
import PhotoUpload from '../../components/PhotoUpload';

const schema = z.object({
  branchId: z.string().min(1, 'Choose a branch'),
  name: z.string().trim().min(2, 'Enter the full name'),
  phone: z.string().trim().regex(/^\+?\d{10,13}$/, 'Enter a valid 10-digit phone'),
  email: z.union([z.literal(''), z.string().trim().email('Invalid email')]),
  gender: z.string().optional(),
  dob: z.string().optional(),
  address: z.string().optional(),
  ecName: z.string().optional(),
  ecPhone: z.string().optional(),
  ecRelation: z.string().optional(),
  healthNotes: z.string().optional(),
  trainerId: z.string().optional(),
  source: z.string().optional(),
  companyId: z.string().optional(),
  photoUrl: z.string().optional(),
});

export default function MemberForm({ open, onClose, member, onSaved }) {
  const { data: branches } = useBranches();
  const defaultBranch = useDefaultBranchId();
  const { data: trainers } = useQuery({ queryKey: ['trainers'], queryFn: () => get('/users/trainers'), enabled: open });
  const { data: companies } = useQuery({ queryKey: ['companies'], queryFn: () => get('/companies'), enabled: open });

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
    values: {
      branchId: member?.branchId?._id || member?.branchId || defaultBranch,
      name: member?.name || '',
      phone: member?.phone || '',
      email: member?.email || '',
      gender: member?.gender || '',
      dob: member?.dob ? ymd(member.dob) : '',
      address: member?.address || '',
      ecName: member?.emergencyContact?.name || '',
      ecPhone: member?.emergencyContact?.phone || '',
      ecRelation: member?.emergencyContact?.relation || '',
      healthNotes: member?.healthNotes || '',
      trainerId: member?.trainerId?._id || member?.trainerId || '',
      source: member?.source || 'walk-in',
      companyId: member?.companyId?._id || member?.companyId || '',
      photoUrl: member?.photoUrl || '',
    },
  });

  const save = useAction((body) => (member ? put(`/members/${member._id}`, body) : post('/members', body)), {
    success: member ? 'Member updated' : 'Member registered',
    invalidate: ['members', 'member', 'dashboard'],
    onSuccess: (data) => {
      onSaved?.(data);
      onClose();
    },
  });

  const submit = (v) => {
    const body = {
      branchId: v.branchId,
      name: v.name,
      phone: v.phone,
      email: v.email,
      gender: v.gender || undefined,
      dob: v.dob || undefined,
      address: v.address,
      healthNotes: v.healthNotes,
      source: v.source,
      photoUrl: v.photoUrl,
      trainerId: v.trainerId || null,
      companyId: v.companyId || null,
      emergencyContact: { name: v.ecName, phone: v.ecPhone, relation: v.ecRelation },
    };
    save.mutate(body);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={member ? 'Edit member' : 'Register member'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(submit)} loading={save.isPending}>
            {member ? 'Save changes' : 'Register'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(submit)} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <PhotoUpload value={watch('photoUrl')} name={watch('name')} onChange={(url) => setValue('photoUrl', url, { shouldDirty: true })} />
        </div>
        <Field label="Full name" required error={errors.name?.message}>
          <Input {...register('name')} autoFocus />
        </Field>
        <Field label="Phone" required error={errors.phone?.message}>
          <Input {...register('phone')} inputMode="tel" placeholder="9876543210" />
        </Field>
        <Field label="Email" error={errors.email?.message} hint="Used for invoices and renewal reminders">
          <Input {...register('email')} type="email" />
        </Field>
        <Field label="Branch" required error={errors.branchId?.message}>
          <Select {...register('branchId')}>
            {branches?.map((b) => (
              <option key={b._id} value={b._id}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Gender">
          <Select {...register('gender')}>
            <option value="">—</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <Field label="Date of birth">
          <Input type="date" {...register('dob')} max={ymd()} />
        </Field>
        <Field label="Trainer">
          <Select {...register('trainerId')}>
            <option value="">No trainer</option>
            {trainers?.map((t) => (
              <option key={t._id} value={t._id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="How did they hear about us?">
          <Select {...register('source')}>
            {['walk-in', 'referral', 'instagram', 'facebook', 'website', 'phone', 'other'].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </Field>
        {companies?.length > 0 && (
          <Field label="Company (corporate tie-up)">
            <Select {...register('companyId')}>
              <option value="">None</option>
              {companies.filter((c) => c.isActive).map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} ({c.discountPercent}% off)
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Address" className="sm:col-span-2">
          <Input {...register('address')} />
        </Field>
        <div className="grid gap-4 sm:col-span-2 sm:grid-cols-3">
          <Field label="Emergency contact">
            <Input {...register('ecName')} placeholder="Name" />
          </Field>
          <Field label="Contact phone">
            <Input {...register('ecPhone')} inputMode="tel" />
          </Field>
          <Field label="Relation">
            <Input {...register('ecRelation')} />
          </Field>
        </div>
        <Field label="Health notes / injuries" className="sm:col-span-2">
          <Textarea {...register('healthNotes')} />
        </Field>
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  );
}
