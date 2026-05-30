import { API_BASE } from './apiBase';

const MOBILE_MANAGER_SESSION_KEY = 'carwash_mobile_manager_session_v1';

function readMobileManagerToken(): string | null {
  try {
    const raw = sessionStorage.getItem(MOBILE_MANAGER_SESSION_KEY);
    if (raw) {
      const m = JSON.parse(raw) as { accessToken?: string };
      return m?.accessToken ?? null;
    }
  } catch {}
  return null;
}

async function mobileManagerRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const token = readMobileManagerToken();
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      typeof data?.detail === 'string'
        ? data.detail
        : typeof data?.detail?.detail === 'string'
          ? data.detail.detail
          : `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return data as T;
}

export type MobileDriverLeaveRequest = {
  id: string;
  mobile_manager_id: string;
  driver_id: string;
  driver_name: string;
  leave_date: string;
  leave_type: 'full_day' | 'partial_day';
  start_time: string;
  end_time: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewed_by_manager_id: string | null;
  reviewed_at: string | null;
  created_at: string | null;
};

export async function mobileManagerListDriverLeaveRequests(): Promise<MobileDriverLeaveRequest[]> {
  return mobileManagerRequest<MobileDriverLeaveRequest[]>('/manager/mobile/leave-requests');
}

export async function mobileManagerUpdateDriverLeaveStatus(
  leaveRequestId: string,
  status: 'approved' | 'rejected'
): Promise<MobileDriverLeaveRequest> {
  return mobileManagerRequest<MobileDriverLeaveRequest>(
    `/manager/mobile/leave-requests/${encodeURIComponent(leaveRequestId)}`,
    { method: 'PATCH', body: JSON.stringify({ status }) }
  );
}
