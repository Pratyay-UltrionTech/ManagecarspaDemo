import { API_BASE } from './apiBase';

type TokenResponse = { access_token: string; token_type: string };
type BranchRef = { id: string; name: string };

function apiErrorMessage(data: unknown, status: number): string {
  if (!data || typeof data !== 'object') return `Request failed (${status})`;
  const d = (data as { detail?: unknown }).detail;
  if (typeof d === 'string') return d;
  if (d && typeof d === 'object' && typeof (d as { detail?: unknown }).detail === 'string') {
    return (d as { detail: string }).detail;
  }
  return `Request failed (${status})`;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(apiErrorMessage(data, res.status));
  }
  return data as T;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof data?.detail === 'string' ? data.detail : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export async function apiAdminLogin(username: string, password: string): Promise<TokenResponse> {
  return postJson<TokenResponse>('/auth/admin/login', { username, password });
}

export async function apiListBranches(): Promise<BranchRef[]> {
  return getJson<Array<{ id: string; name: string }>>('/public/branches');
}

export async function apiManagerLogin(
  branchId: string,
  loginId: string,
  password: string
): Promise<TokenResponse> {
  return postJson<TokenResponse>('/auth/manager/login', {
    branch_id: branchId,
    login_id: loginId,
    password,
  });
}

function normalizeMobilePin(raw: string): string {
  return String(raw ?? '')
    .replace(/\D/g, '')
    .slice(0, 6);
}

export type MobileManagerLoginResult = TokenResponse & {
  city_pin_code?: string;
  emp_name?: string;
  zip_code?: string;
};

/** When cityPinCode is omitted, the API must match exactly one active mobile manager for this login_id + password. */
export async function apiMobileManagerLogin(
  loginId: string,
  password: string,
  cityPinCode?: string
): Promise<MobileManagerLoginResult> {
  return postJson<MobileManagerLoginResult>('/auth/mobile/manager/login', {
    city_pin_code: cityPinCode ? normalizeMobilePin(cityPinCode) : '',
    login_id: loginId.trim(),
    password,
  });
}

export async function apiWasherLogin(
  branchId: string,
  loginId: string,
  password: string
): Promise<TokenResponse> {
  return postJson<TokenResponse>('/auth/washer/login', {
    branch_id: branchId,
    login_id: loginId,
    password,
  });
}

export type MobileWasherLoginResult = TokenResponse & { city_pin_code?: string };

/** Optional city PIN; omit to sign in with login ID + password only (returns city_pin_code on success). */
export async function apiMobileWasherLogin(
  loginId: string,
  password: string,
  cityPinCode?: string
): Promise<MobileWasherLoginResult> {
  return postJson<MobileWasherLoginResult>('/auth/mobile/washer/login', {
    city_pin_code: cityPinCode ? normalizeMobilePin(cityPinCode) : '',
    login_id: loginId.trim(),
    password,
  });
}

export async function apiWasherJobs(accessToken: string): Promise<any[]> {
  const res = await fetch(`${API_BASE}/washer/jobs`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json().catch(() => []);
  if (!res.ok) throw new Error('Failed to load jobs');
  return data as any[];
}

export async function apiPatchWasherJob(
  accessToken: string,
  bookingId: string,
  patch: { status?: string; notes?: string }
): Promise<any> {
  const res = await fetch(`${API_BASE}/washer/jobs/${bookingId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify(patch),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data?.detail === 'string'
        ? data.detail
        : typeof data?.detail?.detail === 'string'
          ? data.detail.detail
          : 'Failed to update job';
    throw new Error(msg);
  }
  return data;
}

export async function apiForgotPassword(scope: 'manager' | 'washer', identifier: string): Promise<void> {
  await postJson(`/auth/${scope}/forgot-password`, { identifier });
}

export async function apiVerifyOtp(scope: 'manager' | 'washer', identifier: string, otp: string): Promise<void> {
  await postJson(`/auth/${scope}/verify-otp`, { identifier, otp });
}

export async function apiResetPassword(scope: 'manager' | 'washer', identifier: string, newPassword: string): Promise<void> {
  await postJson(`/auth/${scope}/reset-password`, { identifier, new_password: newPassword });
}
