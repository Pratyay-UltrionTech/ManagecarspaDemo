import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import type {
  AddonItem,
  DayTimePriceRule,
  LoyaltyProgramConfig,
  PromoCode,
  VehicleServiceBlock,
} from '../lib/catalogShapeTypes';
import {
  emptyMobileOpsForPin,
  type MobileOpsForPin,
  type MobileServicesState,
  type MobileServiceManager,
  type MobileServiceStaff,
  loadMobileServicesState,
  saveMobileServicesState,
  normalizePinCode,
  isValidPinCode,
} from '../lib/mobileServicesStore';
import {
  deleteMobileAddonFromApi,
  deleteMobileDayRuleFromApi,
  deleteMobileDriverFromApi,
  deleteMobileManagerFromApi,
  deleteMobilePromotionFromApi,
  fetchMobileServicesStateFromApi,
  saveMobileAddonToApi,
  saveMobileDayRuleToApi,
  saveMobilePromotionToApi,
  syncMobileServicesStateToApi,
} from '../lib/mobileApi';

let state: MobileServicesState = loadMobileServicesState();
const listeners = new Set<() => void>();
let hydrating = false;
let hydrated = false;
let deletePendingByKey: Record<string, boolean> = {};
let deleteErrorByKey: Record<string, string> = {};
let catalogSavePending = false;
let catalogSaveError: string | null = null;

function emit() {
  listeners.forEach((l) => l());
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

function setCatalogSavePending(pending: boolean) {
  catalogSavePending = pending;
  state = { ...state };
  emit();
}

function setCatalogSaveError(message: string | null) {
  catalogSaveError = message;
  state = { ...state };
  emit();
}

function setState(updater: (prev: MobileServicesState) => MobileServicesState) {
  const prev = state;
  state = updater(state);
  saveMobileServicesState(state);
  emit();
  if (!hydrating) {
    // Slot/catalog changes only — job writes use explicit PATCH to avoid stale queued syncs.
    void syncMobileServicesStateToApi(prev, state, { syncJobs: false }).catch(() => {});
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): MobileServicesState {
  return state;
}

export function useMobileServicesStore() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (hydrated || hydrating) return;
    hydrating = true;
    void fetchMobileServicesStateFromApi()
      .then((next) => {
        state = next;
        saveMobileServicesState(state);
        emit();
      })
      .catch(() => {
        // keep local fallback if API is unavailable
      })
      .finally(() => {
        hydrating = false;
        hydrated = true;
      });
  }, []);

  const upsertManager = useCallback((manager: MobileServiceManager, previousPin: string | null) => {
    const pin = normalizePinCode(manager.pinCode);
    const prevNorm = previousPin ? normalizePinCode(previousPin) : null;
    setState((prev) => {
      const managersByPin = { ...prev.managersByPin };
      const mobileOpsByPin = { ...prev.mobileOpsByPin };
      if (prevNorm && prevNorm !== pin) {
        delete managersByPin[prevNorm];
        if (mobileOpsByPin[prevNorm] && !mobileOpsByPin[pin]) {
          mobileOpsByPin[pin] = mobileOpsByPin[prevNorm]!;
        }
        delete mobileOpsByPin[prevNorm];
      }
      managersByPin[pin] = { ...manager, pinCode: pin };
      return { ...prev, managersByPin, mobileOpsByPin };
    });
  }, []);

  const removeManager = useCallback((pinCode: string) => {
    const pin = normalizePinCode(pinCode);
    setState((prev) => {
      const managersByPin = { ...prev.managersByPin };
      delete managersByPin[pin];
      const mobileOpsByPin = { ...prev.mobileOpsByPin };
      delete mobileOpsByPin[pin];
      const staff = prev.staff.filter((s) => s.cityPinCode !== pin);
      return { ...prev, managersByPin, staff, mobileOpsByPin };
    });
  }, []);

  const upsertStaff = useCallback((member: MobileServiceStaff) => {
    setState((prev) => {
      const city = normalizePinCode(member.cityPinCode);
      let svc = normalizePinCode(member.servicePinCode);
      if (!isValidPinCode(city) || !prev.managersByPin[city]) return prev;
      if (!isValidPinCode(svc)) svc = city;
      const rest = prev.staff.filter((s) => s.id !== member.id);
      return {
        ...prev,
        staff: [...rest, { ...member, cityPinCode: city, servicePinCode: svc }],
      };
    });
  }, []);

  const removeStaff = useCallback((id: string) => {
    setState((prev) => ({
      ...prev,
      staff: prev.staff.filter((s) => s.id !== id),
    }));
  }, []);

  const deleteMobileManager = useCallback(async (managerId: string) => {
    const key = `mobile-manager:${managerId}`;
    setDeleteError(key, null);
    setDeletePending(key, true);
    try {
      await deleteMobileManagerFromApi(managerId);
      const next = await fetchMobileServicesStateFromApi();
      state = next;
      saveMobileServicesState(state);
      emit();
    } catch (error) {
      setDeleteError(key, errMessage(error));
      throw error;
    } finally {
      setDeletePending(key, false);
    }
  }, []);

  const deleteMobileStaff = useCallback(async (staffId: string) => {
    const key = `mobile-staff:${staffId}`;
    setDeleteError(key, null);
    setDeletePending(key, true);
    try {
      await deleteMobileDriverFromApi(staffId);
      const next = await fetchMobileServicesStateFromApi();
      state = next;
      saveMobileServicesState(state);
      emit();
    } catch (error) {
      setDeleteError(key, errMessage(error));
      throw error;
    } finally {
      setDeletePending(key, false);
    }
  }, []);

  const deleteMobileAddon = useCallback(async (addonId: string) => {
    const key = `mobile-addon:${addonId}`;
    setDeleteError(key, null);
    setDeletePending(key, true);
    try {
      await deleteMobileAddonFromApi(addonId);
      const next = await fetchMobileServicesStateFromApi();
      state = next;
      saveMobileServicesState(state);
      emit();
    } catch (error) {
      setDeleteError(key, errMessage(error));
      throw error;
    } finally {
      setDeletePending(key, false);
    }
  }, []);

  const deleteMobilePromotion = useCallback(async (promoId: string) => {
    const key = `mobile-promo:${promoId}`;
    setDeleteError(key, null);
    setDeletePending(key, true);
    try {
      await deleteMobilePromotionFromApi(promoId);
      const next = await fetchMobileServicesStateFromApi();
      state = next;
      saveMobileServicesState(state);
      emit();
    } catch (error) {
      setDeleteError(key, errMessage(error));
      throw error;
    } finally {
      setDeletePending(key, false);
    }
  }, []);

  const deleteMobileDayRule = useCallback(async (ruleId: string) => {
    const key = `mobile-dayrule:${ruleId}`;
    setDeleteError(key, null);
    setDeletePending(key, true);
    try {
      await deleteMobileDayRuleFromApi(ruleId);
      const next = await fetchMobileServicesStateFromApi();
      state = next;
      saveMobileServicesState(state);
      emit();
    } catch (error) {
      setDeleteError(key, errMessage(error));
      throw error;
    } finally {
      setDeletePending(key, false);
    }
  }, []);

  const saveMobileAddon = useCallback(async (addon: AddonItem) => {
    await saveMobileAddonToApi(addon);
    const next = await fetchMobileServicesStateFromApi();
    state = next;
    saveMobileServicesState(state);
    emit();
  }, []);

  const saveMobilePromotion = useCallback(async (promo: PromoCode) => {
    await saveMobilePromotionToApi(promo);
    const next = await fetchMobileServicesStateFromApi();
    state = next;
    saveMobileServicesState(state);
    emit();
  }, []);

  const saveMobileDayRule = useCallback(async (rule: DayTimePriceRule) => {
    await saveMobileDayRuleToApi(rule);
    const next = await fetchMobileServicesStateFromApi();
    state = next;
    saveMobileServicesState(state);
    emit();
  }, []);

  const saveVehicleCatalog = useCallback(async (vehicleCatalog: MobileServicesState['vehicleCatalog']) => {
    setCatalogSaveError(null);
    setCatalogSavePending(true);
    try {
      const prevState = state;
      const nextState: MobileServicesState = {
        ...state,
        vehicleCatalog,
      };
      await syncMobileServicesStateToApi(prevState, nextState);
      const next = await fetchMobileServicesStateFromApi();
      state = next;
      saveMobileServicesState(state);
      emit();
    } catch (error) {
      setCatalogSaveError(errMessage(error));
      throw error;
    } finally {
      setCatalogSavePending(false);
    }
  }, []);

  const reloadFromApi = useCallback(async () => {
    const next = await fetchMobileServicesStateFromApi();
    state = next;
    saveMobileServicesState(state);
    emit();
  }, []);

  const updateMobileOpsForPin = useCallback(
    (cityPin: string, fn: (prev: MobileOpsForPin) => MobileOpsForPin) => {
      const pin = normalizePinCode(cityPin);
      if (!isValidPinCode(pin)) return;
      setState((prev) => {
        const cur = prev.mobileOpsByPin[pin];
        const base = cur ?? emptyMobileOpsForPin();
        const next = fn(base);
        return {
          ...prev,
          mobileOpsByPin: { ...prev.mobileOpsByPin, [pin]: next },
        };
      });
    },
    []
  );

  const updateMobileOpsForPinAsync = useCallback(
    async (cityPin: string, fn: (prev: MobileOpsForPin) => MobileOpsForPin) => {
      const pin = normalizePinCode(cityPin);
      if (!isValidPinCode(pin)) return;
      const prevState = structuredClone(state);
      const cur = prevState.mobileOpsByPin[pin] ?? emptyMobileOpsForPin();
      const nextOps = fn(structuredClone(cur));
      const nextState: MobileServicesState = {
        ...prevState,
        mobileOpsByPin: { ...prevState.mobileOpsByPin, [pin]: nextOps },
      };
      try {
        await syncMobileServicesStateToApi(prevState, nextState, { syncJobs: true });
        state = nextState;
        saveMobileServicesState(state);
        emit();
        await reloadFromApi();
      } catch (error) {
        await reloadFromApi().catch(() => {});
        throw error;
      }
    },
    [reloadFromApi]
  );

  const updateVehicleCatalog = useCallback(
    (fn: (prev: VehicleServiceBlock[]) => VehicleServiceBlock[]) => {
      setState((prev) => ({ ...prev, vehicleCatalog: fn(prev.vehicleCatalog) }));
    },
    []
  );

  const updateMobileAddons = useCallback((fn: (prev: AddonItem[]) => AddonItem[]) => {
    setState((prev) => ({ ...prev, mobileAddons: fn(prev.mobileAddons ?? []) }));
  }, []);

  const updateMobilePromotions = useCallback((fn: (prev: PromoCode[]) => PromoCode[]) => {
    setState((prev) => ({ ...prev, promotions: fn(prev.promotions) }));
  }, []);

  const updateMobileDayPricing = useCallback(
    (fn: (prev: DayTimePriceRule[]) => DayTimePriceRule[]) => {
      setState((prev) => ({ ...prev, dayTimePricing: fn(prev.dayTimePricing) }));
    },
    []
  );

  const updateLoyaltyProgram = useCallback(
    (fn: (prev: LoyaltyProgramConfig) => LoyaltyProgramConfig) => {
      setState((prev) => ({ ...prev, loyaltyProgram: fn(prev.loyaltyProgram) }));
    },
    []
  );

  const managersList = useMemo(
    () =>
      Object.values(snap.managersByPin).sort((a, b) => a.pinCode.localeCompare(b.pinCode)),
    [snap.managersByPin]
  );

  const cityPins = useMemo(() => managersList.map((m) => m.pinCode), [managersList]);

  return useMemo(
    () => ({
      state: snap,
      managersByPin: snap.managersByPin,
      mobileOpsByPin: snap.mobileOpsByPin,
      managersList,
      cityPins,
      staff: snap.staff,
      vehicleCatalog: snap.vehicleCatalog,
      mobileAddons: snap.mobileAddons ?? [],
      promotions: snap.promotions,
      dayTimePricing: snap.dayTimePricing,
      loyaltyProgram: snap.loyaltyProgram,
      upsertManager,
      removeManager,
      upsertStaff,
      removeStaff,
      updateMobileOpsForPin,
      updateMobileOpsForPinAsync,
      updateVehicleCatalog,
      updateMobileAddons,
      updateMobilePromotions,
      updateMobileDayPricing,
      updateLoyaltyProgram,
      deleteMobileManager,
      deleteMobileStaff,
      deleteMobileAddon,
      deleteMobilePromotion,
      deleteMobileDayRule,
      saveMobileAddon,
      saveMobilePromotion,
      saveMobileDayRule,
      saveVehicleCatalog,
      deletePendingByKey,
      deleteErrorByKey,
      catalogSavePending,
      catalogSaveError,
      reloadFromApi,
      catalogReady: hydrated,
    }),
    [
      snap,
      managersList,
      cityPins,
      upsertManager,
      removeManager,
      upsertStaff,
      removeStaff,
      updateMobileOpsForPin,
      updateMobileOpsForPinAsync,
      updateVehicleCatalog,
      updateMobileAddons,
      updateMobilePromotions,
      updateMobileDayPricing,
      updateLoyaltyProgram,
      deleteMobileManager,
      deleteMobileStaff,
      deleteMobileAddon,
      deleteMobilePromotion,
      deleteMobileDayRule,
      saveMobileAddon,
      saveMobilePromotion,
      saveMobileDayRule,
      saveVehicleCatalog,
      reloadFromApi,
    ]
  );
}
