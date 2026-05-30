import { useMemo, useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import type { DayTimePriceRule, VehicleServiceBlock } from '../lib/catalogShapeTypes';
import { WEEKDAYS } from '../lib/catalogShapeTypes';
import {
  listMobileServiceOptions,
  mobileServicesStoreApi,
  mobileServiceVariantLabel,
  vehicleTypesForSelectedMobileServices,
} from '../lib/mobileServicesStore';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
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

function toggleDay(days: string[], day: string) {
  return days.includes(day) ? days.filter((d) => d !== day) : [...days, day];
}

type Props = {
  vehicleCatalog: VehicleServiceBlock[];
  dayTimePricing: DayTimePriceRule[];
  saveMobileDayRule: (rule: DayTimePriceRule) => Promise<void>;
  deleteMobileDayRule: (ruleId: string) => Promise<void>;
  deletePendingByKey?: Record<string, boolean>;
  deleteErrorByKey?: Record<string, string>;
};

export function MobileServicesDayPricingTab({
  vehicleCatalog,
  dayTimePricing,
  saveMobileDayRule,
  deleteMobileDayRule,
  deletePendingByKey = {},
  deleteErrorByKey = {},
}: Props) {
  const { confirm, dialog } = useConfirmDialog();
  const serviceOptions = useMemo(() => listMobileServiceOptions(vehicleCatalog), [vehicleCatalog]);
  const groupedServiceOptions = useMemo(() => collectServiceGroups(vehicleCatalog), [vehicleCatalog]);

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
    const duplicateTitle = dayTimePricing.some(
      (r) => r.id !== editingId && r.title.trim().toLowerCase() === normalizedTitle
    );
    if (duplicateTitle) {
      setTitleError('Day/time pricing title already used');
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
    const id = editingId ?? mobileServicesStoreApi.generateDayPriceId();
    const r: DayTimePriceRule = {
      id,
      title,
      description: draft.description.trim(),
      discountType: draft.discountType,
      discountValue,
      applicableServiceIds: [...draft.applicableServiceIds],
      applicableVehicleTypes: vehicleTypesForSelectedMobileServices(vehicleCatalog, draft.applicableServiceIds),
      applicableDays: [...draft.applicableDays],
      timeWindowStart: draft.timeWindowStart,
      timeWindowEnd: draft.timeWindowEnd,
      validityStart: draft.validityStart,
      validityEnd: draft.validityEnd,
    };
    try {
      setIsSaving(true);
      await saveMobileDayRule(r);
      resetDraft();
    } catch (error) {
      if (error instanceof Error && error.message) setSaveError(error.message);
      else setSaveError('Failed to save day/time rule. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const edit = (rule: DayTimePriceRule) => {
    setEditingId(rule.id);
    setDraft({
      title: rule.title,
      description: rule.description,
      discountType: rule.discountType,
      discountValue: String(rule.discountValue),
      applicableServiceIds: [...rule.applicableServiceIds],
      applicableDays: [...rule.applicableDays],
      timeWindowStart: rule.timeWindowStart,
      timeWindowEnd: rule.timeWindowEnd,
      validityStart: rule.validityStart,
      validityEnd: rule.validityEnd,
    });
  };

  const remove = async (id: string) => {
    const row = dayTimePricing.find((x) => x.id === id);
    const ok = await confirm({
      title: 'Delete day/time rule?',
      description: `Delete day/time rule "${row?.title ?? id}"?`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await deleteMobileDayRule(id).catch(() => {});
    if (editingId === id) resetDraft();
  };

  const discountLabel =
    draft.discountType === 'percentage' ? 'Discount (%)' : 'Discount amount ($)';

  const formatTime = (t: string) => (t ? t : 'any');

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
          Add vehicle types and services under <strong>Vehicles &amp; pricing</strong> first.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Edit day / time rule' : 'Add day / time discount'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Title</Label>
              <Input
                value={draft.title}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, title: e.target.value }));
                  if (titleError) setTitleError('');
                }}
                placeholder="e.g. Monday mobile wash special"
                className={titleError ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
              />
              {titleError ? <p className="text-xs font-medium text-destructive">{titleError}</p> : null}
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label>Description</Label>
              <Textarea
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="Short note for staff"
                rows={2}
              />
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
                step={draft.discountType === 'percentage' ? 1 : 0.01}
                value={draft.discountValue}
                onChange={(e) => setDraft((d) => ({ ...d, discountValue: e.target.value }))}
                placeholder={draft.discountType === 'percentage' ? '10' : '5'}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Applicable services</Label>
            <p className="text-xs text-muted-foreground">
              Vehicle scope is inferred from the service lines you select.
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

          <div className="space-y-2">
            <Label>Applicable days</Label>
            <p className="text-xs text-muted-foreground">
              Leave none selected for any day, or pick specific days.
            </p>
            <div className="flex flex-wrap gap-3 rounded-md border p-3">
              {WEEKDAYS.map((day) => (
                <label key={day} className="flex cursor-pointer items-center gap-2 text-sm">
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
            <div className="space-y-2">
              <Label>Time window start</Label>
              <Input
                type="time"
                value={draft.timeWindowStart}
                onChange={(e) => setDraft((d) => ({ ...d, timeWindowStart: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">Leave empty for all day.</p>
            </div>
            <div className="space-y-2">
              <Label>Time window end</Label>
              <Input
                type="time"
                value={draft.timeWindowEnd}
                onChange={(e) => setDraft((d) => ({ ...d, timeWindowEnd: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Validity start</Label>
              <Input
                type="date"
                value={draft.validityStart}
                onChange={(e) => setDraft((d) => ({ ...d, validityStart: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Validity end</Label>
              <Input
                type="date"
                value={draft.validityEnd}
                onChange={(e) => setDraft((d) => ({ ...d, validityEnd: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="button" onClick={saveRule} className="gap-1" disabled={isSaving}>
              <Plus className="h-4 w-4" />
              {isSaving ? 'Saving...' : editingId ? 'Update' : 'Save'} rule
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
        {dayTimePricing.length === 0 ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">No mobile day/time rules yet.</p>
        ) : (
          <Table className="min-w-[880px]">
            <TableHeader>
              <TableRow className="border-b border-blue-100/80 bg-slate-50/90 hover:bg-slate-50/90">
                <TableHead className="w-[14%] text-blue-950/70">Title</TableHead>
                <TableHead className="w-[11%] text-blue-950/70">Discount</TableHead>
                <TableHead className="w-[18%] min-w-0 text-blue-950/70">Days / Time</TableHead>
                <TableHead className="w-[14%] text-blue-950/70">Validity</TableHead>
                <TableHead className="min-w-0 text-blue-950/70">Services</TableHead>
                <TableHead className="w-[180px] text-right text-blue-950/70">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dayTimePricing.map((r) => (
                <TableRow
                  key={r.id}
                  className="border-b border-blue-100/40 transition-colors hover:bg-blue-50/40"
                >
                  <TableCell className="font-medium text-foreground">
                    {r.title}
                    {r.description ? <div className="text-xs text-muted-foreground/90">{r.description}</div> : null}
                  </TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {r.discountType === 'percentage'
                      ? `${r.discountValue}% off`
                      : `$${r.discountValue.toFixed(2)} off`}
                  </TableCell>
                  <TableCell className="min-w-0 text-muted-foreground">
                    {r.applicableDays.length ? r.applicableDays.join(', ') : 'Any day'}
                    <div className="text-xs text-muted-foreground/90">
                      {formatTime(r.timeWindowStart)} - {formatTime(r.timeWindowEnd)}
                      {!r.timeWindowStart && !r.timeWindowEnd ? ' (all day)' : ''}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums whitespace-nowrap text-muted-foreground">
                    {formatShortDate(r.validityStart)} — {formatShortDate(r.validityEnd)}
                  </TableCell>
                  <TableCell
                    className="min-w-0 py-3 text-muted-foreground"
                    title={
                      r.applicableServiceIds.length
                        ? r.applicableServiceIds.map((id) => mobileServiceVariantLabel(vehicleCatalog, id)).join(', ')
                        : 'Any'
                    }
                  >
                    {r.applicableServiceIds.length ? (
                      <div className="flex flex-col gap-0.5">
                        {r.applicableServiceIds.map((id) => (
                          <span key={id} className="whitespace-normal break-words">
                            • {mobileServiceVariantLabel(vehicleCatalog, id)}
                          </span>
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
                        onClick={() => edit(r)}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:bg-destructive/10"
                        disabled={deletePendingByKey[`mobile-dayrule:${r.id}`]}
                        onClick={() => remove(r.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                        {deletePendingByKey[`mobile-dayrule:${r.id}`] ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                    {deleteErrorByKey[`mobile-dayrule:${r.id}`] ? (
                      <p className="text-xs text-destructive">{deleteErrorByKey[`mobile-dayrule:${r.id}`]}</p>
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
