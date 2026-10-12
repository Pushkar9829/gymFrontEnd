import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { get, errorMessage } from './api';
import { useAuth } from '../store/auth';

/** GET with the globally selected branch applied. */
export function useApi(key, url, params = {}, options = {}) {
  const branchId = useAuth((s) => s.branchId);
  const p = { ...(branchId && !params.branchId ? { branchId } : {}), ...params };
  for (const k of Object.keys(p)) if (p[k] === '' || p[k] == null) delete p[k];
  return useQuery({ queryKey: [...[].concat(key), p], queryFn: () => get(url, p), ...options });
}

/** Mutation that toasts errors / success and invalidates query keys. onError runs after the error toast. */
export function useAction(fn, { success, invalidate = [], onSuccess, onError } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: async (data, vars) => {
      if (success) toast.success(typeof success === 'function' ? success(data, vars) : success);
      await Promise.all(invalidate.map((k) => qc.invalidateQueries({ queryKey: [].concat(k) })));
      onSuccess?.(data, vars);
    },
    onError: (err, vars) => {
      toast.error(errorMessage(err));
      onError?.(err, vars);
    },
  });
}

export function useBranches() {
  return useQuery({ queryKey: ['branches'], queryFn: () => get('/branches'), staleTime: 5 * 60 * 1000 });
}

/** Branch to use for "create" forms: the selected one, else the first allowed. */
export function useDefaultBranchId() {
  const branchId = useAuth((s) => s.branchId);
  const { data } = useBranches();
  return branchId || data?.[0]?._id || '';
}
