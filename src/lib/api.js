import axios from 'axios';

const baseURL = `${import.meta.env.VITE_API_URL || ''}/api/v1`;

/**
 * Creates an API client with an in-memory access token and automatic refresh
 * (refresh token lives in an httpOnly cookie). kind: 'staff' | 'member'.
 */
function createClient(kind) {
  const refreshPath = kind === 'staff' ? '/auth/refresh' : '/auth/member/refresh';
  let accessToken = null;
  let refreshing = null;
  let onSession = () => {};
  let onLogout = () => {};

  const client = axios.create({ baseURL, withCredentials: true });

  client.interceptors.request.use((config) => {
    if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
    return config;
  });

  async function refresh() {
    refreshing ||= axios
      .post(`${baseURL}${refreshPath}`, null, { withCredentials: true })
      .then((r) => {
        accessToken = r.data.data.accessToken;
        onSession(r.data.data);
        return accessToken;
      })
      .finally(() => {
        refreshing = null;
      });
    return refreshing;
  }

  client.interceptors.response.use(
    (r) => r,
    async (error) => {
      const original = error.config;
      if (error.response?.status === 401 && !original._retried && !original.url.includes('/auth/')) {
        original._retried = true;
        try {
          await refresh();
          return client(original);
        } catch {
          accessToken = null;
          onLogout();
        }
      }
      return Promise.reject(error);
    },
  );

  return {
    client,
    setToken: (t) => (accessToken = t),
    refresh,
    bind: (handlers) => {
      onSession = handlers.onSession || onSession;
      onLogout = handlers.onLogout || onLogout;
    },
  };
}

export const staffApi = createClient('staff');
export const memberApi = createClient('member');
export const api = staffApi.client;

/** Unwraps { success, data } */
export const get = (url, params) => api.get(url, { params }).then((r) => r.data.data);
export const post = (url, body) => api.post(url, body).then((r) => r.data.data);
export const put = (url, body) => api.put(url, body).then((r) => r.data.data);
export const del = (url) => api.delete(url).then((r) => r.data.data);
export const patch = (url, body) => api.patch(url, body).then((r) => r.data.data);

export const errorMessage = (err) =>
  err?.response?.data?.message || (err?.code === 'ERR_NETWORK' ? 'Cannot reach the server' : err?.message) || 'Something went wrong';

/** Opens a PDF / CSV that needs auth in a new tab or as a download. */
export async function openFile(url, { download, client = api } = {}) {
  const r = await client.get(url, { responseType: 'blob' });
  const href = URL.createObjectURL(r.data);
  if (download) {
    const a = document.createElement('a');
    a.href = href;
    a.download = download;
    a.click();
  } else {
    window.open(href, '_blank');
  }
  setTimeout(() => URL.revokeObjectURL(href), 60000);
}
