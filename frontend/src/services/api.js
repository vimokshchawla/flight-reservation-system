// Service layer: every call to the backend goes through here. UI components never talk to MySQL.
const BASE = (import.meta.env?.VITE_API_URL || '/api').replace(/\/$/, '');
export const SESSION_KEY = 'frs_session';

async function request(path, { method = 'GET', body, params } = {}) {
  const qs = params ? `?${new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== ''))}` : '';
  const headers = { 'Content-Type': 'application/json' };
  try {
    const token = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null')?.token;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch { /* storage unavailable */ }
  let res;
  try {
    res = await fetch(`${BASE}${path}${qs}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  } catch {
    throw Object.assign(new Error('Cannot reach the server. Make sure the backend is running on port 5000.'), { status: 0 });
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.message || `Request failed (${res.status})`), { status: res.status, data });
  return data;
}

export const flightService = {
  config: () => request('/config'),
  airports: () => request('/airports'),
  popular: () => request('/flights/popular'),
  search: ({ from, to, date }) => request('/flights/search', { params: { from, to, date } }),
  get: (id) => request(`/flights/${id}`),
};

export const bookingService = {
  create: (payload) => request('/bookings', { method: 'POST', body: payload }),
  pending: (ids) => request('/bookings/pending', { params: { ids: ids.join(',') } }),
  lookup: (ref, email) => request('/bookings/lookup', { params: { ref, email } }),
  mine: () => request('/bookings/mine'),
  cancel: (id, email) => request(`/bookings/${id}/cancel`, { method: 'POST', body: { email } }),
};

export const paymentService = {
  pay: ({ booking_ids, method, simulate_failure }) => request('/payments', { method: 'POST', body: { booking_ids, method, simulate_failure } }),
};

export const authService = {
  login: (username, password) => request('/auth/login', { method: 'POST', body: { username, password } }),
  register: (data) => request('/auth/register', { method: 'POST', body: data }),
};

export const adminService = {
  dashboard: () => request('/admin/dashboard'),
  lookups: () => request('/admin/lookups'),
  list: (resource) => request(`/admin/${resource}`),
  create: (resource, data) => request(`/admin/${resource}`, { method: 'POST', body: data }),
  update: (resource, id, data) => request(`/admin/${resource}/${id}`, { method: 'PUT', body: data }),
  remove: (resource, id) => request(`/admin/${resource}/${id}`, { method: 'DELETE' }),
  cancelBooking: (id) => request(`/admin/bookings/${id}/cancel`, { method: 'POST' }),
};
