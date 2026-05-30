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
  WEEKDAYS,
  type DayTimePriceRule,
} from '../lib/branchStore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
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

function toggleDay(days: string[], day: string) {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
}

export default function DayTimePricingDetail() {
  const { confirm, dialog } = useConfirmDialog();
  const { branchId } = useParams<{ branchId: string }>();
  const { branches, getData, deleteBranchDayRule, saveBranchDayRule, deletePendingByKey, deleteErrorByKey } = useBranchStore();
  const branch = useMemo(() => branches.find((b) => b.id === branchId), [branches, branchId]);
  const data = branchId ? getData(branchId) : null;

  const serviceOptions = useMemo(() => (data ? listServiceOptions(data) : []), [data]);
  const groupedServiceOptions = useMemo(() => {
    const opts = data ? collectServiceGroups(data.vehicleServices) : [];
    return opts.sort((a, b) => a.name.localeCompare(b.name));
  }, [data]);
  const washingOptions = useMemo(
    () => groupedServiceOptions.filter((g) => g.category !== 'Detailing'),
    [groupedServiceOptions],
  );
  const detailingOptions = useMemo(
    () => groupedServiceOptions.filter((g) => g.category === 'Detailing'),
    [groupedServiceOptions],
  );

  const [draft, setDraft] = useState({
    title: '',
    description: '',
    discountType: 'flat' as 'percentage' | 'flat',
    discountValue: '',
    applicableServiceIds: [] as string[],
    applicableDays: [] as string[],
    timeWindowStart: '',
    timeWindowEnd: '',
    validityStart: '',
    validityEnd: '',
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [titleError, setTitleError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  if (!branchId || !branch || !data) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-slate-50 px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-700">Branch not found.</p>
        <Link to="/day-time-pricing" className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
          <ArrowLeft className="size-4" /> Back
        </Link>
      </div>
    );
  }

  const resetDraft = () => {
    setDraft({
      title: '',
      description: '',
      discountType: 'flat',
      discountValue: '',
      applicableServiceIds: [],
      applicableDays: [],
      timeWindowStart: '',
      timeWindowEnd: '',
      validityStart: '',
      validityEnd: '',
    });
    setEditingId(null);
    setTitleError('');
  };

  const saveRule = async () => {
    const title = draft.title.trim();
    if (!title) {
      setTitleError('Rule title is required');
      setSaveError('Please fix the highlighted fields before saving.');
      return;
    }
    const normalizedTitle = title.toLowerCase();
    const duplicateTitle = data.dayTimePricing.some(
      (r) => r.id !== editingId && r.title.trim().toLowerCase() === normalizedTitle
    );
    if (duplicateTitle) {
      setTitleError('Day/time pricing title already used in this branch');
      setSaveError('Please use a unique title.');
      return;
    }
    setTitleError('');
    setSaveError('');
    const discountValue = parseFloat(draft.discountValue);
    if (Number.isNaN(discountValue) || discountValue < 0) {
      setSaveError('Discount value must be a valid non-negative number.');
      return;
    }
    if (!draft.validityStart || !draft.validityEnd) {
      setSaveError('Validity start and end dates are required.');
      return;
    }
    if (draft.validityEnd < draft.validityStart) {
      setSaveError('Validity end date must be on or after start date.');
      return;
    }
    if (draft.discountType === 'percentage' && discountValue > 100) {
      setSaveError('Percentage discount cannot exceed 100%.');
      return;
    }
    const id = editingId ?? branchStoreApi.generateDayPriceId();
    const r: DayTimePriceRule = {
      id,
      title,
      description: draft.description.trim(),
      discountType: draft.discountType,
      discountValue,
      applicableServiceIds: [...draft.applicableServiceIds],
      applicableVehicleTypes: vehicleTypesForSelectedServices(data, draft.applicableServiceIds),
      applicableDays: [...draft.applicableDays],
      timeWindowStart: draft.timeWindowStart,
      timeWindowEnd: draft.timeWindowEnd,
      validityStart: draft.validityStart,
      validityEnd: draft.validityEnd,
    };
    setIsSaving(true);
    try {
      await saveBranchDayRule(branchId, r);
      resetDraft();
    } catch (error) {
      if (error instanceof ApiRequestError && error.field === 'title') {
        setTitleError(error.message);
        setSaveError('Please use a unique title.');
      } else if (error instanceof Error && error.message) {
        setSaveError(error.message);
      } else {
        setSaveError('Failed to save day/time pricing rule. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const edit = (r: DayTimePriceRule) => {
    setEditingId(r.id);
    setDraft({
      title: r.title,
      description: r.description,
      discountType: r.discountType,
      discountValue: String(r.discountValue),
      applicableServiceIds: [...r.applicableServiceIds],
      applicableDays: [...r.applicableDays],
      timeWindowStart: r.timeWindowStart,
      timeWindowEnd: r.timeWindowEnd,
      validityStart: r.validityStart,
      validityEnd: r.validityEnd,
    });
  };

  const remove = async (id: string) => {
    const row = data.dayTimePricing.find((x) => x.id === id);
    const ok = await confirm({
      title: 'Delete day/time rule?',
      description: `Delete day/time rule "${row?.title ?? id}"?`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await deleteBranchDayRule(branchId, id).catch(() => {});
    if (editingId === id) resetDraft();
  };

  const discountLabel = draft.discountType === 'percentage' ? 'Discount (%)' : 'Discount amount ($)';
  const formatTime = (t: string) => (t ? t : 'any');
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
            Add services under <strong>Services</strong> for this branch to attach rules to specific service lines.
          </p>
        </div>
      )}

      {/* Form card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 px-6 py-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-slate-900">
              {editingId ? 'Edit special pricing' : 'Add special pricing'}
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
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Promotion title</Label>
              <Input
                value={draft.title}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, title: e.target.value }));
                  if (titleError) setTitleError('');
                }}
                placeholder="e.g. Monday Wash Special"
                className={titleError ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
              />
              {titleError ? <p className="text-xs font-medium text-destructive">{titleError}</p> : null}
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>
                Description{' '}
                <span className="font-normal text-slate-400">(optional)</span>
              </Label>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Short note for staff or customers"
                rows={2}
              />
            </div>
            <div className="space-y-1.5">
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
            <div className="space-y-1.5">
              <Label>{discountLabel}</Label>
              <Input
                type="number"
                min={0}
                step={draft.discountType === 'percentage' ? 1 : 0.01}
                value={draft.discountValue}
                onChange={(e) => setDraft((d) => ({ ...d, discountValue: e.target.value }))}
                placeholder={draft.discountType === 'percentage' ? '10' : '5'}
              />
            </div>
          </div>

          <div className="space-y-1.5">
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
          </div>

          <div className="space-y-1.5">
            <Label>
              Applicable days{' '}
              <span className="font-normal text-slate-400">(leave empty for any day)</span>
            </Label>
            <div className="flex flex-wrap gap-3 rounded-lg border border-slate-200 p-3">
              {WEEKDAYS.map((day) => (
                <label key={day} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                  <Checkbox
                    checked={draft.applicableDays.includes(day)}
                    onCheckedChange={() =>
                      setDraft((d) => ({
                        ...d,
                        applicableDays: toggleDay(d.applicableDays, day),
                      }))
                    }
                  />
                  {day}
                </label>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Time window start</Label>
              <Input
                type="time"
                value={draft.timeWindowStart}
                onChange={(e) => setDraft((d) => ({ ...d, timeWindowStart: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Time window end</Label>
              <Input
                type="time"
                value={draft.timeWindowEnd}
                onChange={(e) => setDraft((d) => ({ ...d, timeWindowEnd: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Validity start</Label>
              <Input
                type="date"
                value={draft.validityStart}
                onChange={(e) => setDraft((d) => ({ ...d, validityStart: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Validity end</Label>
              <Input
                type="date"
                value={draft.validityEnd}
                onChange={(e) => setDraft((d) => ({ ...d, validityEnd: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button onClick={saveRule} className="gap-1.5" disabled={isSaving}>
              <Plus className="size-4" />
              {isSaving ? 'Saving...' : editingId ? 'Update rule' : 'Save rule'}
            </Button>
            {editingId && (
              <Button variant="outline" onClick={resetDraft}>
                Cancel
              </Button>
            )}
          </div>
          {saveError ? <p className="text-xs font-medium text-destructive">{saveError}</p> : null}
        </CardContent>
      </Card>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        {data.dayTimePricing.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-slate-500">No day / time pricing rules yet.</p>
        ) : (
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow className="border-b border-slate-200 bg-slate-50 hover:bg-slate-50">
                <TableHead className="w-[14%] font-medium text-slate-600">Title</TableHead>
                <TableHead className="w-[11%] font-medium text-slate-600">Discount</TableHead>
                <TableHead className="w-[18%] min-w-0 font-medium text-slate-600">Days / Time</TableHead>
                <TableHead className="w-[14%] font-medium text-slate-600">Validity</TableHead>
                <TableHead className="min-w-0 font-medium text-slate-600">Services</TableHead>
                <TableHead className="w-[140px] text-right font-medium text-slate-600">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.dayTimePricing.map((r) => (
                <TableRow key={r.id} className="border-b border-slate-100 transition-colors hover:bg-slate-50">
                  <TableCell className="font-semibold text-slate-900">
                    {r.title}
                    {r.description ? (
                      <div className="text-xs text-slate-400">{r.description}</div>
                    ) : null}
                  </TableCell>
                  <TableCell className="tabular-nums text-slate-600">
                    {r.discountType === 'percentage'
                      ? `${r.discountValue}% off`
                      : `$${r.discountValue.toFixed(2)} off`}
                  </TableCell>
                  <TableCell className="min-w-0 text-slate-600">
                    {r.applicableDays.length ? r.applicableDays.join(', ') : 'Any day'}
                    <div className="text-xs text-slate-400">
                      {formatTime(r.timeWindowStart)} – {formatTime(r.timeWindowEnd)}
                      {!r.timeWindowStart && !r.timeWindowEnd ? ' (all day)' : ''}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums text-slate-600">
                    {formatShortDate(r.validityStart)} — {formatShortDate(r.validityEnd)}
                  </TableCell>
                  <TableCell
                    className="min-w-0 text-slate-600"
                    title={
                      r.applicableServiceIds.length
                        ? r.applicableServiceIds.map((id) => serviceVariantLabel(data, id)).join(', ')
                        : 'Any'
                    }
                  >
                    {r.applicableServiceIds.length ? (
                      <div className="flex flex-col gap-0.5">
                        {r.applicableServiceIds.map((id) => (
                          <span key={id} className="whitespace-normal break-words">
                            • {serviceVariantLabel(data, id)}
                          </span>
                        ))}
                      </div>
                    ) : (
                      'Any'
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" className="text-blue-700 hover:bg-blue-50" onClick={() => edit(r)}>
                        <Pencil className="size-4" /> Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-red-50"
                        disabled={deletePendingByKey[`branch-dayrule:${branchId}:${r.id}`]}
                        onClick={() => remove(r.id)}
                      >
                        <Trash2 className="size-4" /> {deletePendingByKey[`branch-dayrule:${branchId}:${r.id}`] ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                    {deleteErrorByKey[`branch-dayrule:${branchId}:${r.id}`] ? (
                      <p className="text-xs text-destructive">{deleteErrorByKey[`branch-dayrule:${branchId}:${r.id}`]}</p>
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
