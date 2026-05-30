import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { PromoCode, VehicleServiceBlock } from '../lib/catalogShapeTypes';
import {
  listMobileServiceOptions,
  mobileServicesStoreApi,
  mobileServiceVariantLabel,
  vehicleTypesForSelectedMobileServices,
} from '../lib/mobileServicesStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { collectServiceGroups } from '../lib/serviceCentricCatalog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

const MAX_PROMO_USES_PER_CUSTOMER = 1_000_000;

type Props = {
  vehicleCatalog: VehicleServiceBlock[];
  promotions: PromoCode[];
  updateMobilePromotions: (fn: (prev: PromoCode[]) => PromoCode[]) => void;
  saveMobilePromotion?: (promo: PromoCode) => Promise<void>;
  deleteMobilePromotion?: (promoId: string) => Promise<void>;
  deletePendingByKey?: Record<string, boolean>;
  deleteErrorByKey?: Record<string, string>;
};

export function MobileServicesPromoTab({
  vehicleCatalog,
  promotions,
  updateMobilePromotions,
  saveMobilePromotion,
  deleteMobilePromotion,
  deletePendingByKey = {},
  deleteErrorByKey = {},
}: Props) {
  const { confirm, dialog } = useConfirmDialog();
  const serviceOptions = useMemo(() => listMobileServiceOptions(vehicleCatalog), [vehicleCatalog]);
  const groupedServiceOptions = useMemo(() => collectServiceGroups(vehicleCatalog), [vehicleCatalog]);

  const [draft, setDraft] = useState({
    codeName: '',
    discountType: 'flat' as 'percentage' | 'flat',
    discountValue: '',
    validityStart: '',
    validityEnd: '',
    maxUsesPerCustomer: 1,
    applicableServiceIds: [] as string[],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [codeNameError, setCodeNameError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const resetDraft = () => {
    setDraft({
      codeName: '',
      discountType: 'flat',
      discountValue: '',
      validityStart: '',
      validityEnd: '',
      maxUsesPerCustomer: 1,
      applicableServiceIds: [],
    });
    setEditingId(null);
    setCodeNameError('');
  };

  const savePromo = async () => {
    const codeName = draft.codeName.trim();
    if (!codeName) {
      setCodeNameError('Promo code name is required');
      setSaveError('Please fix the highlighted fields before saving.');
      return;
    }
    const normalizedCodeName = codeName.toLowerCase();
    const duplicateCode = promotions.some(
      (p) => p.id !== editingId && p.codeName.trim().toLowerCase() === normalizedCodeName
    );
    if (duplicateCode) {
      setCodeNameError('Promo code name already used');
      setSaveError('Please use a unique promo code name.');
      return;
    }
    setCodeNameError('');
    setSaveError('');
    const discountValue = parseFloat(draft.discountValue);
    if (Number.isNaN(discountValue) || discountValue < 0) {
      setSaveError('Discount value must be a valid non-negative number.');
      return;
    }
    if (!draft.validityStart || !draft.validityEnd) {
      setSaveError('Promotion start and end dates are required.');
      return;
    }
    if (draft.validityStart < new Date().toISOString().slice(0, 10)) {
      setSaveError('Promotion start date cannot be in the past.');
      return;
    }
    if (draft.validityEnd < draft.validityStart) {
      setSaveError('Promotion end date must be on or after start date.');
      return;
    }
    if (draft.discountType === 'percentage' && discountValue >= 100) {
      setSaveError('Percentage discount must be less than 100%.');
      return;
    }
    const maxUsesPerCustomer = Number(draft.maxUsesPerCustomer);
    if (!Number.isFinite(maxUsesPerCustomer) || maxUsesPerCustomer < 0) {
      setSaveError('Max usage per customer must be a valid non-negative number.');
      return;
    }
    if (!Number.isInteger(maxUsesPerCustomer) || maxUsesPerCustomer > MAX_PROMO_USES_PER_CUSTOMER) {
      setSaveError(`Please keep max usage per customer at ${MAX_PROMO_USES_PER_CUSTOMER.toLocaleString()} or less.`);
      return;
    }
    const id = editingId ?? mobileServicesStoreApi.generatePromoId();
    const p: PromoCode = {
      id,
      codeName,
      discountType: draft.discountType,
      discountValue,
      validityStart: draft.validityStart,
      validityEnd: draft.validityEnd,
      maxUsesPerCustomer,
      applicableServiceIds: [...draft.applicableServiceIds],
      applicableVehicleTypes: vehicleTypesForSelectedMobileServices(vehicleCatalog, draft.applicableServiceIds),
    };
    try {
      setIsSaving(true);
      if (saveMobilePromotion) {
        await saveMobilePromotion(p);
      } else {
        updateMobilePromotions((list) => {
          const rest = list.filter((x) => x.id !== id);
          return [...rest, p];
        });
      }
      resetDraft();
    } catch (error) {
      if (error instanceof Error && error.message) setSaveError(error.message);
      else setSaveError('Failed to save promo code. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const edit = (promo: PromoCode) => {
    setEditingId(promo.id);
    setDraft({
      codeName: promo.codeName,
      discountType: promo.discountType,
      discountValue: String(promo.discountValue),
      validityStart: promo.validityStart,
      validityEnd: promo.validityEnd,
      maxUsesPerCustomer: promo.maxUsesPerCustomer,
      applicableServiceIds: [...promo.applicableServiceIds],
    });
  };

  const remove = async (id: string) => {
    const row = promotions.find((x) => x.id === id);
    const ok = await confirm({
      title: 'Delete promo code?',
      description: `Delete promo code "${row?.codeName ?? id}"?`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    if (deleteMobilePromotion) {
      await deleteMobilePromotion(id).catch(() => {});
    } else {
      updateMobilePromotions((list) => list.filter((x) => x.id !== id));
    }
    if (editingId === id) resetDraft();
  };

  const discountLabel =
    draft.discountType === 'percentage' ? 'Discount (%)' : 'Discount amount ($)';

  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${m}/${d}/${y.slice(-2)}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {dialog}

      {serviceOptions.length === 0 && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Add vehicle types and services under <strong>Vehicles &amp; pricing</strong> first, then
          attach promos to specific services here.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Edit promo code' : 'Add promo code'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Promo code name</Label>
              <Input
                value={draft.codeName}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, codeName: e.target.value }));
                  if (codeNameError) setCodeNameError('');
                }}
                placeholder="SUMMER20"
                className={codeNameError ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
              />
              {codeNameError ? <p className="text-xs font-medium text-destructive">{codeNameError}</p> : null}
            </div>
            <div className="space-y-2">
              <Label>Discount type</Label>
              <Select
                value={draft.discountType}
                onValueChange={(v) =>
                  setDraft((d) => ({ ...d, discountType: v as 'percentage' | 'flat' }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flat">Flat amount ($)</SelectItem>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{discountLabel}</Label>
              <Input
                type="number"
                min={0}
                max={draft.discountType === 'percentage' ? 99.99 : undefined}
                step={draft.discountType === 'percentage' ? 1 : 0.01}
                value={draft.discountValue}
                onChange={(e) => {
                  const next = e.target.value;
                  const n = Number.parseFloat(next);
                  if (draft.discountType === 'percentage' && Number.isFinite(n) && n >= 100) {
                    setDraft((d) => ({ ...d, discountValue: '99' }));
                    return;
                  }
                  setDraft((d) => ({ ...d, discountValue: next }));
                }}
                placeholder={draft.discountType === 'percentage' ? '20' : '5'}
              />
            </div>
            <div className="space-y-2">
              <Label>Valid from</Label>
              <Input
                type="date"
                value={draft.validityStart}
                onChange={(e) => setDraft((d) => ({ ...d, validityStart: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Valid until</Label>
              <Input
                type="date"
                value={draft.validityEnd}
                onChange={(e) => setDraft((d) => ({ ...d, validityEnd: e.target.value }))}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Max usage per customer</Label>
              <Input
                type="number"
                min={0}
                max={MAX_PROMO_USES_PER_CUSTOMER}
                value={draft.maxUsesPerCustomer}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, maxUsesPerCustomer: Number(e.target.value) }))
                }
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Applicable services</Label>
            <p className="text-xs text-muted-foreground">
              From your mobile vehicle catalog. Vehicle scope is inferred from the service lines you select.
            </p>
            {groupedServiceOptions.length === 0 ? (
              <p className="rounded-md border p-3 text-sm text-muted-foreground">No services yet.</p>
            ) : (
              <div className="max-h-60 space-y-4 overflow-y-auto rounded-md border p-3">
                {groupedServiceOptions.map((group) => {
                  const allVariantIds = group.variants.map((v) => v.serviceId);
                  const selectedIds = draft.applicableServiceIds.filter((id) => allVariantIds.includes(id));
                  const isAllSelected = selectedIds.length === allVariantIds.length && allVariantIds.length > 0;
                  const isSomeSelected = selectedIds.length > 0 && !isAllSelected;

                  return (
                    <div key={group.listKey} className="space-y-2">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-foreground">
                        <Checkbox
                          checked={isAllSelected}
                          className={isSomeSelected ? 'opacity-70' : ''}
                          onCheckedChange={() => {
                            if (isAllSelected) {
                              setDraft((d) => ({
                                ...d,
                                applicableServiceIds: d.applicableServiceIds.filter((id) => !allVariantIds.includes(id)),
                              }));
                            } else {
                              const otherIds = draft.applicableServiceIds.filter((id) => !allVariantIds.includes(id));
                              setDraft((d) => ({
                                ...d,
                                applicableServiceIds: [...otherIds, ...allVariantIds],
                              }));
                            }
                          }}
                        />
                        {group.name}
                      </label>
                      <div className="ml-6 grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {group.variants.map((v) => (
                          <label key={v.serviceId} className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                            <Checkbox
                              checked={draft.applicableServiceIds.includes(v.serviceId)}
                              onCheckedChange={() =>
                                setDraft((d) => ({
                                  ...d,
                                  applicableServiceIds: toggleId(d.applicableServiceIds, v.serviceId),
                                }))
                              }
                            />
                            {v.vehicleType} (${v.price.toFixed(2)})
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" onClick={savePromo} className="gap-1" disabled={isSaving}>
              <Plus className="h-4 w-4" />
              {isSaving ? 'Saving...' : editingId ? 'Update' : 'Save'} promo
            </Button>
            {editingId ? (
              <Button type="button" variant="outline" onClick={resetDraft}>
                Cancel
              </Button>
            ) : null}
          </div>
          {saveError ? <p className="text-xs font-medium text-destructive">{saveError}</p> : null}
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-xl border border-blue-100/80 bg-card shadow-sm">
        {promotions.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">No mobile promo codes yet.</p>
        ) : (
          <Table className="min-w-[820px] table-fixed">
            <TableHeader>
              <TableRow className="border-b border-blue-100/80 bg-slate-50/90 hover:bg-slate-50/90">
                <TableHead className="w-[140px] text-blue-950/70">Code</TableHead>
                <TableHead className="w-[140px] text-blue-950/70">Discount</TableHead>
                <TableHead className="w-[140px] text-blue-950/70">Validity</TableHead>
                <TableHead className="min-w-[260px] text-blue-950/70">Services</TableHead>
                <TableHead className="w-[160px] text-right text-blue-950/70">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {promotions.map((p) => {
                return (
                <TableRow
                  key={p.id}
                  className="border-b border-blue-100/40 transition-colors hover:bg-blue-50/40"
                >
                  <TableCell className="min-w-0 align-top text-sm font-medium whitespace-normal break-words text-foreground">
                    {p.codeName}
                  </TableCell>
                  <TableCell className="min-w-0 align-top text-sm whitespace-normal break-words text-muted-foreground">
                    {p.discountType === 'percentage'
                      ? `${p.discountValue}% off`
                      : `$${p.discountValue.toFixed(2)} off`}
                    <div className="text-xs text-muted-foreground/90">Max / customer: {p.maxUsesPerCustomer}</div>
                  </TableCell>
                  <TableCell className="min-w-0 align-top tabular-nums text-sm text-muted-foreground">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase tracking-wider opacity-60">From</span>
                      <span>{formatShortDate(p.validityStart)}</span>
                      <span className="mt-1 text-[10px] uppercase tracking-wider opacity-60">Until</span>
                      <span>{formatShortDate(p.validityEnd)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-0 py-4 align-top text-sm text-muted-foreground">
                    {p.applicableServiceIds.length ? (
                      <div className="flex flex-col gap-1">
                        {p.applicableServiceIds.map((id) => (
                          <div key={id} className="whitespace-normal break-words">
                            • {mobileServiceVariantLabel(vehicleCatalog, id)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      'Any'
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-blue-700 hover:bg-blue-100/80"
                        onClick={() => edit(p)}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={deletePendingByKey[`mobile-promo:${p.id}`]}
                        onClick={() => remove(p.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletePendingByKey[`mobile-promo:${p.id}`] ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                    {deleteErrorByKey[`mobile-promo:${p.id}`] ? (
                      <p className="text-xs text-destructive">{deleteErrorByKey[`mobile-promo:${p.id}`]}</p>
                    ) : null}
                  </TableCell>
                </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
