import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { AdminSession } from '../lib/adminAuth';
import {
  clearAdminSessionStorage,
  readAdminSessionFromStorage,
  writeAdminSessionToStorage,
} from '../lib/adminSession';

let session: AdminSession | null = readAdminSessionFromStorage();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function setAdminSession(next: AdminSession | null) {
  session = next;
  if (next) writeAdminSessionToStorage(next);
  else clearAdminSessionStorage();
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): AdminSession | null {
  return session;
}

function getServerSnapshot(): AdminSession | null {
  return null;
}

export function useAdminSession() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = useCallback((s: AdminSession) => {
    setAdminSession(s);
  }, []);

  const logout = useCallback(() => {
    setAdminSession(null);
  }, []);

  return useMemo(
    () => ({
      session: snap,
      isLoggedIn: snap !== null,
      login,
      logout,
    }),
    [snap, login, logout]
  );
}
