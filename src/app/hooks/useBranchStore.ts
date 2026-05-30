import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  type AppState,
  type Branch,
  type BranchData,
  branchStoreApi,
  getBranchData,
} from '../lib/branchStore';
import {
  deleteBranchAddonFromApi,
  deleteBranchFromApi,
  deleteBranchDayRuleFromApi,
  deleteBranchManagerFromApi,
  deleteBranchPromotionFromApi,
  deleteBranchWasherFromApi,
  fetchAppStateFromApi,
  saveBranchAddonToApi,
  saveBranchDayRuleToApi,
  saveBranchPromotionToApi,
  syncBranchDataToApi,
  upsertBranchToApi,
} from '../lib/branchApi';

let state: AppState = { branches: [], dataByBranchId: {} };
const listeners = new Set<() => void>();
let hydrated = false;
let hydrating = false;
let branchStoreConsumerCount = 0;
let refreshTimer: ReturnType<typeof setInterval> | null = null;
const REFRESH_INTERVAL_MS = 30_000;
let deletePendingByKey: Record<string, boolean> = {};
let deleteErrorByKey: Record<string, string> = {};
let catalogSavePendingByBranchId: Record<string, boolean> = {};
let catalogSaveErrorByBranchId: Record<string, string> = {};

function emit() {
  listeners.forEach((l) => l());
}

function setState(updater: (prev: AppState) => AppState) {
  state = updater(state);
  emit();
}

function setDeletePending(key: string, pending: boolean) {
  deletePendingByKey = { ...deletePendingByKey, [key]: pending };
  state = { ...state };
  emit();
}

function setDeleteError(key: string, message: string | null) {
  if (!message) {
    const next = { ...deleteErrorByKey };
    delete next[key];
    deleteErrorByKey = next;
  } else {
    deleteErrorByKey = { ...deleteErrorByKey, [key]: message };
  }
  state = { ...state };
  emit();
}

function errMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'Delete failed. Please try again.';
}

function setCatalogSavePending(branchId: string, pending: boolean) {
  catalogSavePendingByBranchId = { ...catalogSavePendingByBranchId, [branchId]: pending };
  state = { ...state };
  emit();
}

function setCatalogSaveError(branchId: string, message: string | null) {
  if (!message) {
    const next = { ...catalogSaveErrorByBranchId };
    delete next[branchId];
    catalogSaveErrorByBranchId = next;
  } else {
    catalogSaveErrorByBranchId = { ...catalogSaveErrorByBranchId, [branchId]: message };
  }
  state = { ...state };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): AppState {
  return state;
}

let lastRefreshTime = 0;

async function refreshFromApi() {
  const next = await fetchAppStateFromApi();
  const now = Date.now();
  if (JSON.stringify(next) === JSON.stringify(state)) {
    lastRefreshTime = now;
    return;
  }
  state = next;
  lastRefreshTime = now;
  emit();
}

function startAutoRefresh() {
  if (refreshTimer) return;
  refreshTimer = setInterval(() => {
    // Skip background tab polling to avoid unnecessary requests.
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
    if (hydrating) return;
    void refreshFromApi().catch(() => {});
  }, REFRESH_INTERVAL_MS);
}

function stopAutoRefresh() {
  if (!refreshTimer) return;
  clearInterval(refreshTimer);
  refreshTimer = null;
}

function ensureHydrated() {
  if (hydrated || hydrating || typeof window === 'undefined') return;
  hydrating = true;
  void refreshFromApi()
    .catch(() => {})
    .finally(() => {
      hydrated = true;
      hydrating = false;
      emit();
    });
}

export function useBranchStore() {
  ensureHydrated();
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    branchStoreConsumerCount += 1;
    startAutoRefresh();
    const onFocus = () => {
      if (hydrating) return;
      if (Date.now() - lastRefreshTime < 10000) return;
      void refreshFromApi().catch(() => {});
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', onFocus);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', onFocus);
      }
      branchStoreConsumerCount = Math.max(0, branchStoreConsumerCount - 1);
      if (branchStoreConsumerCount === 0) {
        stopAutoRefresh();
      }
    };
  }, []);

  const update = useCallback((updater: (prev: AppState) => AppState) => {
    setState(updater);
  }, []);

  const upsertBranch = useCallback((branch: Branch) => {
    setState((prev) => {
      const idx = prev.branches.findIndex((b) => b.id === branch.id);
      const branches =
        idx >= 0
          ? prev.branches.map((b) => (b.id === branch.id ? branch : b))
          : [...prev.branches, branch];
      return { ...prev, branches };
    });
    void upsertBranchToApi(branch)
      .then(() => refreshFromApi())
      .catch(() => {
        // Re-sync local optimistic state when server rejects (e.g., duplicate branch name).
        void refreshFromApi().catch(() => {});
      });
  }, []);

  const updateBranchData = useCallback(
    async (
      branchId: string,
      fn: (data: BranchData) => BranchData,
      options?: { syncBookings?: boolean }
    ) => {
      let prevData: BranchData = branchStoreApi.emptyBranchData();
      let nextData: BranchData = branchStoreApi.emptyBranchData();
      setState((prev) => {
        const raw = getBranchData(prev, branchId);
        prevData = structuredClone(raw);
        const data = structuredClone(raw);
        nextData = fn(data);
        return {
          ...prev,
          dataByBranchId: { ...prev.dataByBranchId, [branchId]: nextData },
        };
      });
      try {
        await syncBranchDataToApi(branchId, prevData, nextData, options);
        await refreshFromApi();
      } catch (error) {
        // Keep UI consistent with backend constraints on sync failures.
        await refreshFromApi().catch(() => {});
        throw error;
      }
    },
    []
  );

  const deleteBranch = useCallback((branchId: string) => {
    setState((prev) => {
      const branches = prev.branches.filter((b) => b.id !== branchId);
      const dataByBranchId = { ...prev.dataByBranchId };
      delete dataByBranchId[branchId];
      return { ...prev, branches, dataByBranchId };
    });
    void deleteBranchFromApi(branchId)
      .then(() => refreshFromApi())
      .catch(() => {
        void refreshFromApi().catch(() => {});
      });
  }, []);

  const deleteBranchManager = useCallback(async (branchId: string, managerId: string) => {
    const key = `branch-manager:${branchId}:${managerId}`;
    setDeleteError(key, null);
    setDeletePending(key, true);
    try {
      await deleteBranchManagerFromApi(branchId, managerId);
      await refreshFromApi();
    } catch (error) {
      setDeleteError(key, errMessage(error));
      throw error;
    } finally {
      setDeletePending(key, false);
    }
  }, []);

  const deleteBranchWasher = useCallback(async (branchId: string, washerId: string) => {
    const key = `branch-washer:${branchId}:${washerId}`;
    setDeleteError(key, null);
    setDeletePending(key, true);
    try {
      await deleteBranchWasherFromApi(branchId, washerId);
      await refreshFromApi();
    } catch (error) {
      setDeleteError(key, errMessage(error));
      throw error;
    } finally {
      setDeletePending(key, false);
    }
  }, []);

  const deleteBranchAddon = useCallback(async (branchId: string, addonId: string) => {
    const key = `branch-addon:${branchId}:${addonId}`;
    setDeleteError(key, null);
    setDeletePending(key, true);
    try {
      await deleteBranchAddonFromApi(branchId, addonId);
      await refreshFromApi();
    } catch (error) {
      setDeleteError(key, errMessage(error));
      throw error;
    } finally {
      setDeletePending(key, false);
    }
  }, []);

  const deleteBranchPromotion = useCallback(async (branchId: string, promoId: string) => {
    const key = `branch-promo:${branchId}:${promoId}`;
    setDeleteError(key, null);
    setDeletePending(key, true);
    try {
      await deleteBranchPromotionFromApi(branchId, promoId);
      await refreshFromApi();
    } catch (error) {
      setDeleteError(key, errMessage(error));
      throw error;
    } finally {
      setDeletePending(key, false);
    }
  }, []);

  const deleteBranchDayRule = useCallback(async (branchId: string, ruleId: string) => {
    const key = `branch-dayrule:${branchId}:${ruleId}`;
    setDeleteError(key, null);
    setDeletePending(key, true);
    try {
      await deleteBranchDayRuleFromApi(branchId, ruleId);
      await refreshFromApi();
    } catch (error) {
      setDeleteError(key, errMessage(error));
      throw error;
    } finally {
      setDeletePending(key, false);
    }
  }, []);

  const saveBranchPromotion = useCallback(async (branchId: string, promo: BranchData['promotions'][number]) => {
    await saveBranchPromotionToApi(branchId, promo);
    await refreshFromApi();
  }, []);

  const saveBranchAddon = useCallback(async (branchId: string, addon: BranchData['addons'][number]) => {
    await saveBranchAddonToApi(branchId, addon);
    await refreshFromApi();
  }, []);

  const saveBranchDayRule = useCallback(async (branchId: string, rule: BranchData['dayTimePricing'][number]) => {
    await saveBranchDayRuleToApi(branchId, rule);
    await refreshFromApi();
  }, []);

  const saveBranchVehicleCatalog = useCallback(async (branchId: string, blocks: BranchData['vehicleServices']) => {
    setCatalogSaveError(branchId, null);
    setCatalogSavePending(branchId, true);
    try {
      const prevData = structuredClone(getBranchData(state, branchId));
      const nextData = { ...structuredClone(prevData), vehicleServices: blocks };
      await syncBranchDataToApi(branchId, prevData, nextData);
      await refreshFromApi();
    } catch (error) {
      setCatalogSaveError(branchId, errMessage(error));
      throw error;
    } finally {
      setCatalogSavePending(branchId, false);
    }
  }, []);

  return useMemo(
    () => ({
      state: snap,
      branches: snap.branches,
      isLoading: hydrating || !hydrated,
      update,
      upsertBranch,
      updateBranchData,
      deleteBranch,
      deleteBranchManager,
      deleteBranchWasher,
      deleteBranchAddon,
      deleteBranchPromotion,
      deleteBranchDayRule,
      saveBranchPromotion,
      saveBranchAddon,
      saveBranchDayRule,
      saveBranchVehicleCatalog,
      deletePendingByKey,
      deleteErrorByKey,
      catalogSavePendingByBranchId,
      catalogSaveErrorByBranchId,
      getData: (branchId: string) => getBranchData(snap, branchId),
      refresh: refreshFromApi,
    }),
    [
      snap,
      update,
      upsertBranch,
      updateBranchData,
      deleteBranch,
      deleteBranchManager,
      deleteBranchWasher,
      deleteBranchAddon,
      deleteBranchPromotion,
      deleteBranchDayRule,
      saveBranchPromotion,
      saveBranchAddon,
      saveBranchDayRule,
      saveBranchVehicleCatalog,
    ]
  );
}
