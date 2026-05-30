import type { ServiceItem, VehicleServiceBlock } from './catalogShapeTypes';
import { coalesceServiceSequence } from './catalogShapeTypes';

/** Synthetic key for services created before `catalogGroupId` existed (one id = one group). */
export function legacyServiceGroupKey(serviceId: string): string {
  return `legacy_${serviceId}`;
}

export function serviceItemGroupKey(s: ServiceItem): string {
  const g = s.catalogGroupId?.trim();
  if (g) return g;
  return legacyServiceGroupKey(s.id);
}

export type CatalogServiceVariantRow = {
  serviceId: string;
  vehicleType: string;
  price: number;
  freeCoffeeCount: number;
  eligibleForLoyaltyPoints: boolean;
  recommended: boolean;
  active: boolean;
};

export type CatalogServiceGroup = {
  /** Stable key for React lists (real `catalogGroupId` or `legacy_<serviceId>`). */
  listKey: string;
  /** Persisted group id, or null for legacy / ungrouped rows. */
  catalogGroupId: string | null;
  name: string;
  category: string;
  /** User portal ordering; lower first (from first variant row). */
  displaySequence: number;
  descriptionPoints: string[];
  excludedPoints: string[];
  variants: CatalogServiceVariantRow[];
};

export function collectServiceGroups(blocks: VehicleServiceBlock[]): CatalogServiceGroup[] {
  const variantMap = new Map<string, CatalogServiceVariantRow[]>();
  const firstMeta = new Map<
    string,
    {
      catalogGroupId: string | null;
      name: string;
      category: string;
      displaySequence: number;
      descriptionPoints: string[];
      excludedPoints: string[];
    }
  >();

  for (const block of blocks) {
    const vt = block.vehicleType;
    for (const s of block.services) {
      const key = serviceItemGroupKey(s);
      if (!variantMap.has(key)) {
        variantMap.set(key, []);
        const cg = s.catalogGroupId?.trim() ? String(s.catalogGroupId).trim() : null;
        const name = s.name || "";
        let cat = (s as any).category || (s as any).type || 'Washing';

        firstMeta.set(key, {
          catalogGroupId: cg,
          name: name,
          category: cat,
          displaySequence: coalesceServiceSequence(s.sequence),
          descriptionPoints: [...(s.descriptionPoints ?? [])],
          excludedPoints: [...(s.excludedPoints ?? [])],
        });
      }
      variantMap.get(key)!.push({
        serviceId: s.id,
        vehicleType: vt,
        price: s.price,
        freeCoffeeCount: s.freeCoffeeCount,
        eligibleForLoyaltyPoints: s.eligibleForLoyaltyPoints,
        recommended: s.recommended === true,
        active: s.active !== false,
      });
    }
  }

  const out: CatalogServiceGroup[] = [];
  for (const [listKey, variants] of variantMap) {
    const m = firstMeta.get(listKey)!;
    out.push({
      listKey,
      catalogGroupId: m.catalogGroupId,
      name: m.name,
      category: m.category,
      displaySequence: m.displaySequence,
      descriptionPoints: m.descriptionPoints,
      excludedPoints: m.excludedPoints,
      variants,
    });
  }
  out.sort((a, b) => {
    if (a.displaySequence !== b.displaySequence) return a.displaySequence - b.displaySequence;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return out;
}

export function generateCatalogGroupId(): string {
  return `cg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function cloneBlocks(blocks: VehicleServiceBlock[]): VehicleServiceBlock[] {
  return blocks.map((b) => ({
    ...b,
    services: b.services.map((s) => ({ ...s })),
    addons: b.addons.map((a) => ({ ...a })),
  }));
}

export function removeServicesWithIds(blocks: VehicleServiceBlock[], ids: Set<string>): VehicleServiceBlock[] {
  return blocks.map((b) => ({
    ...b,
    services: b.services.filter((s) => !ids.has(s.id)),
  }));
}

export type ServiceGroupSaveDraft = {
  /** Ids to remove before inserting updated rows (edit / replace). */
  baselineServiceIds: string[];
  /** Existing persisted group id, or null to allocate a new one on save. */
  persistedCatalogGroupId: string | null;
  name: string;
  category: string;
  descriptionPoints: string[];
  excludedPoints: string[];
  /** Base service duration (minutes, multiple of 30). */
  durationMinutes: number;
  /** Display order in user portal (lower first). */
  sequence: number;
  rows: {
    serviceId?: string;
    vehicleType: string;
    price: number;
    freeCoffee: number;
    eligibleForLoyaltyPoints: boolean;
    recommended: boolean;
    active: boolean;
  }[];
  generateServiceId: () => string;
  /** When true, `freeCoffee` is ignored (always 0). */
  mobile: boolean;
};

/**
 * Applies a service-centric save: removes baseline ids, then adds one catalog row per variant
 * (creating vehicle blocks when needed). Preserves add-ons on existing blocks.
 */
export function applyServiceGroupSave(blocks: VehicleServiceBlock[], draft: ServiceGroupSaveDraft): VehicleServiceBlock[] {
  let next = cloneBlocks(removeServicesWithIds(blocks, new Set(draft.baselineServiceIds)));
  const gid = draft.persistedCatalogGroupId?.trim() || generateCatalogGroupId();
  const name = draft.name.trim();
  const descriptionPoints = [...draft.descriptionPoints];
  const excludedPoints = [...draft.excludedPoints];

  const seenVehicles = new Set<string>();
  for (const row of draft.rows) {
    const vt = row.vehicleType.trim();
    if (!vt || Number.isNaN(row.price)) continue;
    const vKey = vt.toLowerCase();
    if (seenVehicles.has(vKey)) continue;
    seenVehicles.add(vKey);

    let blockIdx = next.findIndex((b) => b.vehicleType.toLowerCase() === vKey);
    if (blockIdx < 0) {
      next = [...next, { vehicleType: vt, services: [], addons: [] }];
      blockIdx = next.length - 1;
    }

    const sid = row.serviceId?.trim() || draft.generateServiceId();
    const item: ServiceItem = {
      id: sid,
      name,
      price: row.price,
      catalogGroupId: gid,
      freeCoffeeCount: draft.mobile ? 0 : (row.freeCoffee || 0),
      eligibleForLoyaltyPoints: row.eligibleForLoyaltyPoints,
      recommended: row.recommended,
      descriptionPoints,
      excludedPoints,
      active: row.active,
      durationMinutes: draft.durationMinutes,
      category: draft.category,
      sequence: draft.sequence,
    };

    const block = next[blockIdx]!;
    next[blockIdx] = { ...block, services: [...block.services, item] };
  }

  return next;
}
