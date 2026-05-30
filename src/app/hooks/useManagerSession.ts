import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { ManagerSession } from '../lib/managerSession';
import {
  clearManagerSessionStorage,
  readManagerSessionFromStorage,
  writeManagerSessionToStorage,
} from '../lib/managerSession';

let session: ManagerSession | null = readManagerSessionFromStorage();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): ManagerSession | null {
  return session;
}

function getServerSnapshot(): ManagerSession | null {
  return null;
}

export function setManagerSession(next: ManagerSession | null) {
  session = next;
  if (next) writeManagerSessionToStorage(next);
  else clearManagerSessionStorage();
  emit();
}

export function useManagerSession() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = useCallback((s: ManagerSession) => {
    setManagerSession(s);
  }, []);

  const logout = useCallback(() => {
    setManagerSession(null);
  }, []);

  return useMemo(
    () => ({
      session: snap,
      isManager: snap !== null,
      login,
      logout,
    }),
    [snap, login, logout]
  );
}
