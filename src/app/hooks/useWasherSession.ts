import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { WasherSession } from '../lib/washerSession';
import {
  clearWasherSessionStorage,
  readWasherSessionFromStorage,
  writeWasherSessionToStorage,
} from '../lib/washerSession';

let session: WasherSession | null = readWasherSessionFromStorage();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): WasherSession | null {
  return session;
}

function getServerSnapshot(): WasherSession | null {
  return null;
}

export function setWasherSession(next: WasherSession | null) {
  session = next;
  if (next) writeWasherSessionToStorage(next);
  else clearWasherSessionStorage();
  emit();
}

export function useWasherSession() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const login = useCallback((s: WasherSession) => {
    setWasherSession(s);
  }, []);

  const logout = useCallback(() => {
    setWasherSession(null);
  }, []);

  return useMemo(
    () => ({
      session: snap,
      isWasher: snap !== null,
      login,
      logout,
    }),
    [snap, login, logout]
  );
}

