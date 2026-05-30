import type { AddonItem, BranchData, ServiceItem, VehicleServiceBlock } from './catalogShapeTypes';
import { findCatalogServiceById } from './branchStore';

function addonListForBranch(data: BranchData): AddonItem[] {
  if (data.branchAddons?.length) return data.branchAddons.filter((a) => a.active !== false);
  return Array.from(
    new Map(data.vehicleServices.flatMap((v) => v.addons ?? []).map((a) => [a.id, a])).values()
  ).filter((a) => a.active !== false);
}

/** Catalog prices are GST-inclusive; total is service + add-ons + tip (cents). */
export function branchCheckoutTotalCents(
  data: BranchData,
  serviceId: string | null | undefined,
  addonIds: string[],
  tipCents: number
): { servicePrice: number; addonsTotal: number; subtotal: number; tax: number; totalCents: number } {
  const svc = serviceId ? findCatalogServiceById(data, serviceId) : undefined;
  const addons = addonListForBranch(data);
  const servicePrice = svc ? Number(svc.price) || 0 : 0;
  let addonsTotal = 0;
  for (const id of addonIds) {
    const a = addons.find((x) => x.id === id);
    if (a) addonsTotal += Number(a.price) || 0;
  }
  const sub = servicePrice + addonsTotal;
  const totalCents = Math.round(sub * 100) + Math.max(0, Math.floor(tipCents || 0));
  return { servicePrice, addonsTotal, subtotal: sub, tax: 0, totalCents };
}

export function mobileCheckoutTotalCents(
  catalog: VehicleServiceBlock[],
  mobileAddons: AddonItem[],
  serviceId: string | null | undefined,
  addonIds: string[],
  tipCents: number
): { servicePrice: number; addonsTotal: number; subtotal: number; tax: number; totalCents: number } {
  let svc: ServiceItem | undefined;
  for (const vb of catalog) {
    svc = vb.services.find((s) => s.id === serviceId);
    if (svc) break;
  }
  const globalAddons = mobileAddons.filter((a) => a.active !== false);
  const legacyAddons = catalog.flatMap((vb) => vb.addons ?? []).filter((a) => a.active !== false);
  const addonSource = globalAddons.length ? globalAddons : legacyAddons;
  const servicePrice = svc ? Number(svc.price) || 0 : 0;
  let addonsTotal = 0;
  for (const id of addonIds) {
    const a = addonSource.find((x) => x.id === id);
    if (a) addonsTotal += Number(a.price) || 0;
  }
  const sub = servicePrice + addonsTotal;
  const totalCents = Math.round(sub * 100) + Math.max(0, Math.floor(tipCents || 0));
  return { servicePrice, addonsTotal, subtotal: sub, tax: 0, totalCents };
}
