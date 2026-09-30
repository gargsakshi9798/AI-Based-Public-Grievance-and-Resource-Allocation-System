const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const ACCESS_KEY = 'pg_access_token';
const REFRESH_KEY = 'pg_refresh_token';

export function getAccessToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(REFRESH_KEY);
}

export function setTokens({ accessToken, refreshToken }) {
  if (accessToken) localStorage.setItem(ACCESS_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

class ApiError extends Error {
  constructor(message, status, payload) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

let refreshPromise = null;

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) throw new ApiError('Session expired. Please sign in again.', 401);

  const res = await fetch(`${API_URL}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.accessToken) {
    clearTokens();
    throw new ApiError(data.message || 'Session expired. Please sign in again.', 401, data);
  }
  setTokens({ accessToken: data.accessToken, refreshToken: data.refreshToken });
  return data.accessToken;
}

function validationMessage(data) {
  if (data?.errors?.length) {
    return data.errors.map((e) => e.message).join(' ');
  }
  return data?.message || 'Request failed';
}

export async function api(path, options = {}) {
  const { auth = true, headers = {}, retry = true, ...rest } = options;
  const token = getAccessToken();

  const finalHeaders = { ...headers };
  if (!(rest.body instanceof FormData) && !finalHeaders['Content-Type']) {
    finalHeaders['Content-Type'] = 'application/json';
  }
  if (auth && token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
  });

  if (res.status === 401 && auth && retry) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    await refreshPromise;
    return api(path, { ...options, retry: false });
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(validationMessage(data), res.status, data);
  }
  return data;
}

export { ApiError };
