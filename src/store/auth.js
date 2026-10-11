import { create } from 'zustand';
import { staffApi, memberApi } from '../lib/api';

const readBranch = () => {
  try {
    return localStorage.getItem('gym.branch') || '';
  } catch {
    return '';
  }
};

export const useAuth = create((set, get) => ({
  user: null,
  status: 'loading', // loading | authed | guest
  branchId: readBranch(), // '' = all branches I can see

  setSession: ({ accessToken, user }) => {
    staffApi.setToken(accessToken);
    set({ user, status: 'authed' });
  },
  clear: () => {
    staffApi.setToken(null);
    set({ user: null, status: 'guest' });
  },
  setBranch: (branchId) => {
    try {
      localStorage.setItem('gym.branch', branchId);
    } catch {
      /* private mode */
    }
    set({ branchId });
  },
  can: (perm) => {
    const perms = get().user?.permissions || [];
    return perms.includes('*') || perms.includes(perm);
  },
  async bootstrap() {
    try {
      await staffApi.refresh();
    } catch {
      get().clear();
    }
  },
  async logout() {
    try {
      await staffApi.client.post('/auth/logout');
    } finally {
      get().clear();
    }
  },
}));

staffApi.bind({
  onSession: (data) => useAuth.getState().setSession(data),
  onLogout: () => useAuth.getState().clear(),
});

export const useMemberAuth = create((set, get) => ({
  member: null,
  status: 'loading',
  setSession: ({ accessToken, member }) => {
    memberApi.setToken(accessToken);
    set({ member, status: 'authed' });
  },
  clear: () => {
    memberApi.setToken(null);
    set({ member: null, status: 'guest' });
  },
  async bootstrap() {
    try {
      await memberApi.refresh();
    } catch {
      get().clear();
    }
  },
  async logout() {
    try {
      await memberApi.client.post('/auth/member/logout');
    } finally {
      get().clear();
    }
  },
}));

memberApi.bind({
  onSession: (data) => useMemberAuth.getState().setSession(data),
  onLogout: () => useMemberAuth.getState().clear(),
});
