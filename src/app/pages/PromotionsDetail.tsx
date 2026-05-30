import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { useBranchStore } from '../hooks/useBranchStore';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { ApiRequestError } from '../lib/branchApi';
import {
  branchStoreApi,
  listServiceOptions,
  serviceVariantLabel,
  vehicleTypesForSelectedServices,
  type PromoCode,
} from '../lib/branchStore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { ServiceGroupVehicleGrid } from '../components/ServiceGroupVehicleGrid';
import { collectServiceGroups } from '../lib/serviceCentricCatalog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';

function toggleId(ids: string[], id: string) {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

const MAX_PROMO_USES_PER_CUSTOMER = 1_000_000;

export default function PromotionsDetail() {
  const { confirm, dialog } = useConfirmDialog();
  const { branchId } = useParams<{ branchId: string }>();
  const { branches, getData, deleteBranchPromotion, saveBranchPromotion, deletePendingByKey, deleteErrorByKey } = useBranchStore();
  const branch = useMemo(() => branches.find((b) => b.id === branchId), [branches, branchId]);
  const data = branchId ? getData(branchId) : null;

  const serviceOptions = useMemo(() => (data ? listServiceOptions(data) : []), [data]);
  const groupedServiceOptions = useMemo(() => {
    const opts = data ? collectServiceGroups(data.vehicleServices) : [];
    // Sort by name inside the groups
    return opts.sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);
  const washingOptions = useMemo(() => groupedServiceOptions.filter(g => g.category !== 'Detailing'), [groupedServiceOptions]);
  const detailingOptions = useMemo(() => groupedServiceOptions.filter(g => g.category === 'Detailing'), [groupedServiceOptions]);

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

  if (!branchId || !branch || !data) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-slate-50 px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-700">Branch not found.</p>
        <Link
          to="/promotions"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to branches
        </Link>
      </div>
    );
  }

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
    const duplicateCode = data.promotions.some(
      (p) => p.id !== editingId && p.codeName.trim().toLowerCase() === normalizedCodeName
    );
    if (duplicateCode) {
      setCodeNameError('Promo code name already used in this branch');
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
    const id = editingId ?? branchStoreApi.generatePromoId();
    const p: PromoCode = {
      id,
      codeName,
      discountType: draft.discountType,
      discountValue,
      validityStart: draft.validityStart,
      validityEnd: draft.validityEnd,
      maxUsesPerCustomer,
      applicableServiceIds: [...draft.applicableServiceIds],
      applicableVehicleTypes: vehicleTypesForSelectedServices(data, draft.applicableServiceIds),
    };
    setIsSaving(true);
    try {
      await saveBranchPromotion(branchId, p);
      resetDraft();
    } catch (error) {
      if (error instanceof ApiRequestError && error.field === 'code_name') {
        setCodeNameError(error.message);
        setSaveError('Please use a unique promo code name.');
      } else if (error instanceof Error && error.message) {
        setSaveError(error.message);
      } else {
        setSaveError('Failed to save promo. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const edit = (p: PromoCode) => {
    setEditingId(p.id);
    setDraft({
      codeName: p.codeName,
      discountType: p.discountType,
      discountValue: String(p.discountValue),
      validityStart: p.validityStart,
      validityEnd: p.validityEnd,
      maxUsesPerCustomer: p.maxUsesPerCustomer,
      applicableServiceIds: [...p.applicableServiceIds],
    });
  };

  const remove = async (id: string) => {
    const row = data.promotions.find((x) => x.id === id);
    const ok = await confirm({
      title: 'Delete promotion?',
      description: `Delete promotion "${row?.codeName ?? id}"?`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await deleteBranchPromotion(branchId, id).catch(() => {});
    if (editingId === id) resetDraft();
  };

  const discountLabel = draft.discountType === 'percentage' ? 'Discount (%)' : 'Discount amount ($)';
  const formatShortDate = (dateStr: string) => {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${m}/${d}/${y.slice(-2)}`;
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-2">
      {dialog}
      {/* Page header */}


      {serviceOptions.length === 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            Add services under <strong>Services</strong> for this branch first to attach promos to specific services.
          </p>
        </div>
      )}

      {/* Form card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900">
              {editingId ? 'Edit promo code' : 'Add promo code'}
            </CardTitle>
            {editingId && (
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                Editing
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-5 px-6 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label>Discount type</Label>
              <Select
                value={draft.discountType}
                onValueChange={(v) => setDraft((d) => ({ ...d, discountType: v as 'percentage' | 'flat' }))}
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
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label>Valid from</Label>
              <Input
                type="date"
                value={draft.validityStart}
                onChange={(e) => setDraft((d) => ({ ...d, validityStart: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valid until</Label>
              <Input
                type="date"
                value={draft.validityEnd}
                onChange={(e) => setDraft((d) => ({ ...d, validityEnd: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 sm:max-w-xs">
              <Label>Max usage per customer</Label>
              <Input
                type="number"
                min={0}
                max={MAX_PROMO_USES_PER_CUSTOMER}
                value={draft.maxUsesPerCustomer}
                onChange={(e) => setDraft((d) => ({ ...d, maxUsesPerCustomer: Number(e.target.value) }))}
              />
            </div>
          </div>

          <Label>Applicable services</Label>
          <p className="text-xs text-muted-foreground">
            Pick vehicle-specific prices under each service. Vehicle scope is inferred from your selection.
          </p>
          {groupedServiceOptions.length === 0 ? (
            <p className="rounded border border-slate-200 p-3 text-sm text-slate-500">No services yet.</p>
          ) : (
            <div className="max-h-80 space-y-8 overflow-y-auto rounded-lg border border-slate-200 p-4">
              {washingOptions.length > 0 && (
                <div className="space-y-4">
                  <h3 className="border-b border-slate-100 pb-2 text-base font-semibold text-slate-800">Washing</h3>
                  {washingOptions.map((group) => {
                    const allVariantIds = group.variants.map((v) => v.serviceId);
                    const selectedIds = draft.applicableServiceIds.filter((id) => allVariantIds.includes(id));
                    const isAllSelected = selectedIds.length === allVariantIds.length && allVariantIds.length > 0;
                    const isSomeSelected = selectedIds.length > 0 && !isAllSelected;
                    return (
                      <ServiceGroupVehicleGrid
                        key={group.listKey}
                        group={group}
                        selectedServiceIds={draft.applicableServiceIds}
                        isAllSelected={isAllSelected}
                        isSomeSelected={isSomeSelected}
                        onToggleSelectAll={() => {
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
                        onToggleVariant={(serviceId) =>
                          setDraft((d) => ({
                            ...d,
                            applicableServiceIds: toggleId(d.applicableServiceIds, serviceId),
                          }))
                        }
                      />
                    );
                  })}
                </div>
              )}

              {detailingOptions.length > 0 && (
                <div className="space-y-4 pt-1">
                  <h3 className="border-b border-slate-100 pb-2 text-base font-semibold text-slate-800">Detailing</h3>
                  {detailingOptions.map((group) => {
                    const allVariantIds = group.variants.map((v) => v.serviceId);
                    const selectedIds = draft.applicableServiceIds.filter((id) => allVariantIds.includes(id));
                    const isAllSelected = selectedIds.length === allVariantIds.length && allVariantIds.length > 0;
                    const isSomeSelected = selectedIds.length > 0 && !isAllSelected;
                    return (
                      <ServiceGroupVehicleGrid
                        key={group.listKey}
                        group={group}
                        selectedServiceIds={draft.applicableServiceIds}
                        isAllSelected={isAllSelected}
                        isSomeSelected={isSomeSelected}
                        onToggleSelectAll={() => {
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
                        onToggleVariant={(serviceId) =>
                          setDraft((d) => ({
                            ...d,
                            applicableServiceIds: toggleId(d.applicableServiceIds, serviceId),
                          }))
                        }
                      />
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button onClick={savePromo} className="gap-1.5" disabled={isSaving}>
              <Plus className="size-4" />
              {isSaving ? 'Saving...' : editingId ? 'Update promo' : 'Save promo'}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetDraft}>Cancel</Button>
            )}
          </div>
          {saveError ? <p className="text-xs font-medium text-destructive">{saveError}</p> : null}
        </CardContent>
      </Card>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {data.promotions.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">No promo codes yet.</p>
        ) : (
          <Table className="min-w-[820px] table-fixed">
            <TableHeader>
              <TableRow className="border-b border-slate-200 bg-slate-50 hover:bg-slate-50">
                <TableHead className="w-[140px] font-medium text-slate-600">Code</TableHead>
                <TableHead className="w-[140px] font-medium text-slate-600">Discount</TableHead>
                <TableHead className="w-[140px] font-medium text-slate-600">Validity</TableHead>
                <TableHead className="min-w-[260px] font-medium text-slate-600">Services</TableHead>
                <TableHead className="w-[160px] text-right font-medium text-slate-600">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.promotions.map((p) => (
                <TableRow key={p.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                  <TableCell className="text-sm font-semibold text-slate-900">{p.codeName}</TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {p.discountType === 'percentage'
                      ? `${p.discountValue}% off`
                      : `$${p.discountValue.toFixed(2)} off`}
                    <div className="text-xs text-slate-400">Max / customer: {p.maxUsesPerCustomer}</div>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-[10px] uppercase tracking-wider text-slate-400">From</span>
                      <span>{formatShortDate(p.validityStart)}</span>
                      <span className="mt-1 text-[10px] uppercase tracking-wider text-slate-400">Until</span>
                      <span>{formatShortDate(p.validityEnd)}</span>
                    </div>
                  </TableCell>
                  <TableCell className="min-w-0 py-4 text-sm text-slate-600">
                    {p.applicableServiceIds.length ? (
                      <div className="flex flex-col gap-1">
                        {p.applicableServiceIds.map((id) => (
                          <div key={id} className="whitespace-normal break-words">
                            • {serviceVariantLabel(data, id)}
                          </div>
                        ))}
                      </div>
                    ) : (
                      'Any'
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" className="text-blue-700 hover:bg-blue-50" onClick={() => edit(p)}>
                        <Pencil className="size-4" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-red-50"
                        disabled={deletePendingByKey[`branch-promo:${branchId}:${p.id}`]}
                        onClick={() => remove(p.id)}
                      >
                        <Trash2 className="size-4" /> {deletePendingByKey[`branch-promo:${branchId}:${p.id}`] ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                    {deleteErrorByKey[`branch-promo:${branchId}:${p.id}`] ? (
                      <p className="text-xs text-destructive">{deleteErrorByKey[`branch-promo:${branchId}:${p.id}`]}</p>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
