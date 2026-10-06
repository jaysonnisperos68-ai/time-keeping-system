const KEY = 'tk_token';
export const getToken = () => localStorage.getItem(KEY);
export const setToken = (t) => (t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY));

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && getToken()) {
      setToken(null);
      window.location.assign('/login');
    }
    throw new Error(data.error || 'Request failed');
  }
  return data;
}

export const fmtTime = (iso) => (iso ? new Date(iso).toLocaleTimeString() : '—');
export const fmtDate = (iso) => new Date(iso).toLocaleDateString();
export const fmtHours = (h) => (h == null ? '—' : `${h.toFixed(2)} h`);
