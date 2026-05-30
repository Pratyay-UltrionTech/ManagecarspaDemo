import { useMemo, useState } from 'react';
import { Check, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import type { VehicleServiceBlock } from '../lib/catalogShapeTypes';
import { coalesceServiceSequence } from '../lib/catalogShapeTypes';
import { detailsTextToStorage, storageToDetailsText } from '../lib/serviceDetailsFormat';
import {
  applyServiceGroupSave,
  collectServiceGroups,
  type CatalogServiceGroup,
} from '../lib/serviceCentricCatalog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Switch } from './ui/switch';
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
import { Separator } from './ui/separator';
import PriceInput from './PriceInput';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

type VariantDraftRow = {
  rowKey: string;
  serviceId?: string;
  vehicleType: string;
  price: string;
  freeCoffee: string;
  loyalty: boolean;
  recommended: boolean;
  active: boolean;
};

function newRowKey() {
  return `rw_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function nextSuggestedDisplaySequence(blocks: VehicleServiceBlock[]): number {
  let maxLt999 = 0;
  for (const b of blocks) {
    for (const s of b.services) {
      const n = coalesceServiceSequence(s.sequence);
      if (n < 999) maxLt999 = Math.max(maxLt999, n);
    }
  }
  return maxLt999 + 1;
}

function emptyVariantRow(vehicleTypes: string[]): VariantDraftRow {
  return {
    rowKey: newRowKey(),
    vehicleType: vehicleTypes[0] ?? '',
    price: '',
    freeCoffee: '0',
    loyalty: false,
    recommended: false,
    active: true,
  };
}

function groupsToRows(g: CatalogServiceGroup): VariantDraftRow[] {
  if (g.variants.length === 0) return [emptyVariantRow([])];
  return g.variants.map((v) => ({
    rowKey: newRowKey(),
    serviceId: v.serviceId,
    vehicleType: v.vehicleType,
    price: String(v.price),
    freeCoffee: String(v.freeCoffeeCount || 0),
    loyalty: v.eligibleForLoyaltyPoints,
    recommended: v.recommended,
    active: v.active,
  }));
}

export type ServiceCentricCatalogPanelProps = {
  blocks: VehicleServiceBlock[];
  onBlocksChange: (blocks: VehicleServiceBlock[]) => void;
  onCommitBlocks?: (blocks: VehicleServiceBlock[]) => Promise<void>;
  commitPending?: boolean;
  commitError?: string | null;
  generateServiceId: () => string;
  isBranch: boolean;
};

export function ServiceCentricCatalogPanel({
  blocks,
  onBlocksChange,
  onCommitBlocks,
  commitPending = false,
  commitError = null,
  generateServiceId,
  isBranch,
}: ServiceCentricCatalogPanelProps) {
  const { confirm, dialog } = useConfirmDialog();
  const vehicleTypes = useMemo(() => blocks.map((b) => b.vehicleType).filter(Boolean), [blocks]);
  const groups = useMemo(() => collectServiceGroups(blocks), [blocks]);

  const [svcName, setSvcName] = useState('');
  const [svcCategory, setSvcCategory] = useState('Washing');
  const [svcDuration, setSvcDuration] = useState('60');
  const [svcSequence, setSvcSequence] = useState('999');
  const [svcDetails, setSvcDetails] = useState('');
  const [variantRows, setVariantRows] = useState<VariantDraftRow[]>(() => [emptyVariantRow([])]);
  const [baselineServiceIds, setBaselineServiceIds] = useState<string[]>([]);
  const [persistedCatalogGroupId, setPersistedCatalogGroupId] = useState<string | null>(null);
  const [svcCategoryFilter, setSvcCategoryFilter] = useState<string>('All');
  const [svcNameError, setSvcNameError] = useState('');
  const [saveSummaryError, setSaveSummaryError] = useState('');

  const commitBlocks = async (nextBlocks: VehicleServiceBlock[]) => {
    if (onCommitBlocks) {
      await onCommitBlocks(nextBlocks);
      return;
    }
    onBlocksChange(nextBlocks);
  };

  const resetDraft = () => {
    setSvcName('');
    setSvcCategory('Washing');
    setSvcDuration('60');
    setSvcSequence(String(nextSuggestedDisplaySequence(blocks)));
    setSvcDetails('');
    setVariantRows([emptyVariantRow(vehicleTypes)]);
    setBaselineServiceIds([]);
    setPersistedCatalogGroupId(null);
    setSvcNameError('');
    setSaveSummaryError('');
  };

  const addVehicleTypeFromInput = async () => {
    const v = newVehicleInput.trim();
    if (!v) return;
    if (blocks.some((b) => b.vehicleType.toLowerCase() === v.toLowerCase())) return;
    const next = [...blocks, { vehicleType: v, services: [], addons: [] }];
    try {
      setSaveSummaryError('');
      await commitBlocks(next);
      setVariantRows((rs) => {
        if (rs.length === 1 && !rs[0].vehicleType.trim()) {
          return [{ ...rs[0], vehicleType: v }];
        }
        return rs;
      });
      setNewVehicleInput('');
    } catch {
      setSaveSummaryError('Unable to add vehicle type. Please resolve any catalog conflicts and try again.');
    }
  };

  const removeVehicleType = async (idx: number) => {
    const block = blocks[idx];
    if (!block) return;
    const ok = await confirm({
      title: 'Delete vehicle type?',
      description: `Remove vehicle type "${block.vehicleType}" and all services under it from this catalog? Add-ons on this vehicle are also removed.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    const next = blocks.filter((_, i) => i !== idx);
    try {
      setSaveSummaryError('');
      await commitBlocks(next);
      setVariantRows((rows) =>
        rows.map((r) =>
          r.vehicleType === block.vehicleType ? { ...r, vehicleType: '' } : r,
        ),
      );
    } catch {
      setSaveSummaryError('Unable to delete vehicle type. Please resolve any catalog conflicts and try again.');
    }
  };

  const beginEditGroup = (g: CatalogServiceGroup) => {
    setSvcName(g.name);
    let dur = 60;
    let seq = coalesceServiceSequence(g.displaySequence);
    const firstSid = g.variants[0]?.serviceId;
    if (firstSid) {
      for (const block of blocks) {
        const s = block.services.find((x) => x.id === firstSid);
        if (s) {
          dur = s.durationMinutes ?? 60;
          seq = coalesceServiceSequence(s.sequence);
          break;
        }
      }
    }
    setSvcDuration(String(dur));
    setSvcSequence(String(seq));
    setSvcCategory(g.category || 'Washing');
    setSvcDetails(storageToDetailsText(g.descriptionPoints, g.excludedPoints ?? []));
    setVariantRows(groupsToRows(g));
    setBaselineServiceIds(g.variants.map((v) => v.serviceId));
    setPersistedCatalogGroupId(g.catalogGroupId);
  };

  const saveService = () => {
    setSaveSummaryError('');
    const name = svcName.trim();
    if (!name) {
      setSaveSummaryError('Service name is required.');
      window.alert('Service name is required.');
      return;
    }
    const normalizedName = name.toLowerCase();
    const editingIds = new Set(baselineServiceIds);
    const duplicateServiceName = groups.some((g) => {
      if (g.name.trim().toLowerCase() !== normalizedName) return false;
      const sameEditingGroup = g.variants.some((v) => editingIds.has(v.serviceId));
      return !sameEditingGroup;
    });
    if (duplicateServiceName) {
      setSvcNameError('Service name already used');
      setSaveSummaryError('Service name already used. Choose a different name.');
      return;
    }
    setSvcNameError('');
    const durationMinutes = Number.parseInt(svcDuration, 10);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 30) {
      setSaveSummaryError('Base duration must be at least 30 minutes.');
      window.alert('Base duration is required and must be at least 30 minutes.');
      return;
    }
    const seqTrim = svcSequence.trim();
    let sequence = 999;
    if (seqTrim) {
      const p = parseInt(seqTrim, 10);
      if (Number.isFinite(p) && p >= 1) sequence = Math.min(p, 999999);
    }
    const { descriptionPoints, excludedPoints } = detailsTextToStorage(svcDetails);
    const parsedRows: {
      serviceId?: string;
      vehicleType: string;
      price: number;
      freeCoffee: number;
      eligibleForLoyaltyPoints: boolean;
      recommended: boolean;
      active: boolean;
    }[] = [];
    const seen = new Set<string>();
    for (const r of variantRows) {
      const vt = r.vehicleType.trim();
      if (!vt) continue;
      const price = parseFloat(r.price);
      if (Number.isNaN(price)) continue;
      const k = vt.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      parsedRows.push({
        serviceId: r.serviceId,
        vehicleType: vt,
        price,
        freeCoffee: parseInt(r.freeCoffee) || 0,
        eligibleForLoyaltyPoints: r.loyalty,
        recommended: r.recommended,
        active: r.active,
      });
    }
    if (variantRows.some((r) => !r.vehicleType.trim())) {
      setSaveSummaryError('Each service row must have a vehicle type selected.');
      window.alert('Each service row must have a vehicle type selected.');
      return;
    }
    if (variantRows.some((r) => Number.isNaN(parseFloat(r.price)))) {
      setSaveSummaryError('Each service row must have a valid price.');
      window.alert('Each service row must have a valid price.');
      return;
    }
    if (parsedRows.length === 0) {
      setSaveSummaryError('Add at least one valid vehicle row before saving.');
      window.alert('Add at least one valid vehicle row before saving the service.');
      return;
    }

    const next = applyServiceGroupSave(blocks, {
      baselineServiceIds: baselineServiceIds,
      persistedCatalogGroupId,
      name,
      category: svcCategory,
      descriptionPoints,
      excludedPoints,
      durationMinutes,
      sequence,
      rows: parsedRows,
      generateServiceId,
      mobile: !isBranch,
    });
    void commitBlocks(next)
      .then(() => resetDraft())
      .catch(() => {});
  };

  const deleteGroup = async (g: CatalogServiceGroup) => {
    const ok = await confirm({
      title: 'Delete service?',
      description: `Delete service "${g.name}" for all vehicle types? Promotions may still reference its ids.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    const ids = new Set(g.variants.map((v) => v.serviceId));
    const next = blocks.map((b) => ({
      ...b,
      services: b.services.filter((s) => !ids.has(s.id)),
    }));
    void commitBlocks(next)
      .then(() => {
        if (baselineServiceIds.some((id) => ids.has(id))) resetDraft();
      })
      .catch(() => {});
  };

  const [newVehicleInput, setNewVehicleInput] = useState('');

  return (
    <div className="space-y-6">
      {dialog}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 px-6 py-5">
          <CardTitle className="text-base font-semibold text-slate-900">Vehicle types</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 px-6 py-5">
          <div className="flex flex-wrap gap-2">
            <Input
              className="max-w-xs"
              placeholder="e.g. Sedan, SUV"
              value={newVehicleInput}
              onChange={(e) => setNewVehicleInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void addVehicleTypeFromInput();
                }
              }}
            />
            <Button
              type="button"
              onClick={() => {
                void addVehicleTypeFromInput();
              }}
              disabled={commitPending}
              className="gap-1"
            >
              <Plus className="size-4" />
              Add vehicle type
            </Button>
          </div>
          {vehicleTypes.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {blocks.map((block, idx) => (
                <span
                  key={block.vehicleType + idx}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm font-medium text-slate-700"
                >
                  {block.vehicleType}
                  <button
                    type="button"
                    className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 transition-colors"
                    aria-label={`Remove ${block.vehicleType}`}
                    onClick={() => removeVehicleType(idx)}
                  >
                    <X className="size-3.5" />
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Add at least one vehicle type before mapping prices.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 px-6 py-5">
          <CardTitle className="text-base font-semibold text-slate-900">Step 1: Create service</CardTitle>
          <p className="text-sm text-slate-500">Name and description apply to every vehicle variant below.</p>
        </CardHeader>
        <CardContent className="space-y-4 px-6 py-5">
          <div className="flex flex-col md:flex-row gap-4 max-w-2xl">
            <div className="space-y-1.5 flex-1">
              <Label htmlFor="sc-svc-name">Name</Label>
              <Input
                id="sc-svc-name"
                placeholder="e.g. Express Wash"
                value={svcName}
                onChange={(e) => {
                  setSvcName(e.target.value);
                  if (svcNameError) setSvcNameError('');
                }}
                className={svcNameError ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
              />
              {svcNameError ? <p className="text-xs font-medium text-destructive">{svcNameError}</p> : null}
            </div>
            <div className="space-y-1.5 w-48">
              <Label htmlFor="sc-svc-category">Category</Label>
              <Select value={svcCategory} onValueChange={setSvcCategory}>
                <SelectTrigger id="sc-svc-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Washing">Washing</SelectItem>
                  <SelectItem value="Detailing">Detailing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 max-w-2xl">
            <div className="space-y-1.5 max-w-xs flex-1">
              <Label htmlFor="sc-svc-duration">Base duration (minutes)</Label>
              <Input
                id="sc-svc-duration"
                type="number"
                min={30}
                step={30}
                value={svcDuration}
                onChange={(e) => setSvcDuration(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Snapped to a multiple of 30 (add-ons add +30 each at booking).</p>
            </div>
            <div className="space-y-1.5 w-full max-w-[200px]">
              <Label htmlFor="sc-svc-sequence">Display order</Label>
              <Input
                id="sc-svc-sequence"
                type="number"
                min={1}
                step={1}
                inputMode="numeric"
                value={svcSequence}
                onChange={(e) => setSvcSequence(e.target.value.replace(/\D/g, ''))}
              />
              <p className="text-xs text-muted-foreground">Lower = earlier in the user portal. Leave empty for 999.</p>
            </div>
          </div>
          <div className="flex flex-col gap-4 max-w-2xl">
            <div className="space-y-1.5">
              <Label htmlFor="sc-svc-details">Service details (one line per point)</Label>
              <Textarea
                id="sc-svc-details"
                rows={8}
                placeholder={'# Outside\n* Outside wash\n* Tyre shine\n- Clay bar treatment\n\n# Inside\n* Vacuum interior\n- Leather conditioning'}
                value={svcDetails}
                onChange={(e) => setSvcDetails(e.target.value)}
              />
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">
                {`Use:
# for section headings
* for included items
- for excluded items`}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="border-b border-slate-100 px-6 py-5">
          <CardTitle className="text-base font-semibold text-slate-900">Step 2: Vehicle variants</CardTitle>
          <p className="text-sm text-slate-500">Set price and options per vehicle for this service.</p>
        </CardHeader>
        <CardContent className="space-y-4 px-6 py-5">
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="bg-slate-50 hover:bg-slate-50">
                  <TableHead className="w-[140px] font-medium text-slate-600">Vehicle</TableHead>
                  <TableHead className="w-[120px] font-medium text-slate-600">Price</TableHead>
                  {isBranch ? (
                    <TableHead className="w-[110px] text-center font-medium text-slate-600">Coffee</TableHead>
                  ) : null}
                  <TableHead className="w-[120px] text-center font-medium text-slate-600">Loyalty counted</TableHead>
                  <TableHead className="w-[120px] text-center font-medium text-slate-600">Recommended</TableHead>
                  <TableHead className="w-[100px] text-center font-medium text-slate-600">Active</TableHead>
                  <TableHead className="w-[72px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {variantRows.map((row, idx) => (
                  <TableRow key={row.rowKey} className="border-b border-slate-100">
                    <TableCell>
                      <Select
                        value={row.vehicleType || undefined}
                        onValueChange={(v) => {
                          setVariantRows((rs) => rs.map((x, i) => (i === idx ? { ...x, vehicleType: v } : x)));
                        }}
                        disabled={vehicleTypes.length === 0}
                      >
                        <SelectTrigger className="bg-white">
                          <SelectValue placeholder={vehicleTypes.length ? 'Vehicle' : 'Add vehicle types first'} />
                        </SelectTrigger>
                        <SelectContent>
                          {vehicleTypes.map((v) => (
                            <SelectItem key={v} value={v}>
                              {v}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <PriceInput
                        value={row.price}
                        onChange={(val) => {
                          setVariantRows((rs) => rs.map((x, i) => (i === idx ? { ...x, price: val } : x)));
                        }}
                      />
                    </TableCell>
                    {isBranch ? (
                      <TableCell className="text-center">
                        <Input
                          type="number"
                          min={0}
                          className="w-16 mx-auto text-center tabular-nums"
                          value={row.freeCoffee}
                          onChange={(e) => {
                            setVariantRows((rs) =>
                              rs.map((x, i) => (i === idx ? { ...x, freeCoffee: e.target.value } : x)),
                            );
                          }}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell className="text-center">
                      <button
                        type="button"
                        className="inline-flex size-9 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                        onClick={() =>
                          setVariantRows((rs) =>
                            rs.map((x, i) => (i === idx ? { ...x, loyalty: !x.loyalty } : x)),
                          )
                        }
                        aria-label="Toggle loyalty counted"
                      >
                        {row.loyalty ? (
                          <Check className="size-5 text-emerald-600" />
                        ) : (
                          <X className="size-5 text-red-500" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-center">
                      <button
                        type="button"
                        className="inline-flex size-9 items-center justify-center rounded-md border border-slate-200 bg-white hover:bg-slate-50"
                        onClick={() =>
                          setVariantRows((rs) =>
                            rs.map((x, i) => (i === idx ? { ...x, recommended: !x.recommended } : x)),
                          )
                        }
                        aria-label="Toggle recommended"
                      >
                        {row.recommended ? (
                          <Star className="size-5 fill-amber-400 text-amber-500" />
                        ) : (
                          <X className="size-5 text-red-500" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={row.active}
                        onCheckedChange={(c) =>
                          setVariantRows((rs) =>
                            rs.map((x, i) => (i === idx ? { ...x, active: c === true } : x)),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="text-slate-500 hover:text-destructive"
                        aria-label="Remove row"
                        disabled={variantRows.length <= 1}
                        onClick={() => setVariantRows((rs) => rs.filter((_, i) => i !== idx))}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="gap-1"
              onClick={() => setVariantRows((rs) => [...rs, emptyVariantRow(vehicleTypes)])}
              disabled={vehicleTypes.length === 0}
            >
              <Plus className="size-4" />
              Add vehicle row
            </Button>
            <Button type="button" onClick={saveService} disabled={commitPending}>
              {commitPending ? 'Saving...' : baselineServiceIds.length ? 'Save changes' : 'Save service'}
            </Button>
            {baselineServiceIds.length || svcName || svcDetails.trim() ? (
              <Button type="button" variant="outline" onClick={resetDraft}>
                Cancel
              </Button>
            ) : null}
          </div>
          {saveSummaryError ? (
            <p className="text-sm font-medium text-destructive">{saveSummaryError}</p>
          ) : null}
          {commitError ? (
            <p className="text-sm font-medium text-destructive">{commitError}</p>
          ) : null}
        </CardContent>
      </Card>

      <Separator className="bg-slate-100" />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">Saved services</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Category</span>
            <Select value={svcCategoryFilter} onValueChange={setSvcCategoryFilter}>
              <SelectTrigger className="w-[140px] bg-white h-9 text-xs">
                <SelectValue placeholder="All" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="All">All</SelectItem>
                <SelectItem value="Washing">Washing</SelectItem>
                <SelectItem value="Detailing">Detailing</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <Table className="w-full min-w-[780px]">
            <TableHeader>
              <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
                <TableHead className="w-[28%] py-4 font-semibold text-slate-600">Service</TableHead>
                <TableHead className="w-[14%] py-4 font-semibold text-slate-600">Type</TableHead>
                <TableHead className="w-[42%] py-4 font-semibold text-slate-600">Vehicles</TableHead>
                <TableHead className="w-[16%] py-4 text-right font-semibold text-slate-600 pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="h-32 text-center text-slate-400">
                    No services yet. Use the steps above to create your catalog.
                  </TableCell>
                </TableRow>
              ) : (
                groups
                  .filter(g => svcCategoryFilter === 'All' || g.category?.toLowerCase() === svcCategoryFilter.toLowerCase())
                  .map((g) => {
                    const vehicleSummary = g.variants
                      .slice()
                      .sort((a, b) => a.vehicleType.localeCompare(b.vehicleType))
                      .map((v) => `${v.vehicleType} ($${v.price.toFixed(2)})`)
                      .join(' | ');

                    return (
                      <TableRow key={g.listKey} className="group hover:bg-slate-50/50 transition-colors">
                        <TableCell className="py-4 align-top">
                          <span className="inline-flex flex-wrap items-center gap-2">
                            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600 tabular-nums shrink-0">
                              #{g.displaySequence}
                            </span>
                            <span className="font-bold text-slate-900 break-words">{g.name}</span>
                          </span>
                        </TableCell>
                        <TableCell className="py-4 align-top">
                          <span className="inline-flex max-w-full rounded-full border border-slate-200/90 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600 leading-snug whitespace-nowrap">
                            {g.category?.trim() || 'Uncategorized'}
                          </span>
                        </TableCell>
                        <TableCell className="py-4 align-top text-slate-600">
                          {vehicleSummary || '—'}
                        </TableCell>
                        <TableCell className="py-4 text-right pr-6 align-top">
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9 rounded-lg border border-slate-200 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 shadow-sm"
                              onClick={() => beginEditGroup(g)}
                            >
                              <Pencil className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="size-9 rounded-lg border border-slate-200 bg-white text-red-500 hover:bg-red-50 hover:text-red-600 shadow-sm"
                              disabled={commitPending}
                              onClick={() => deleteGroup(g)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
