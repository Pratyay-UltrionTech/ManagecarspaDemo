import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { LoyaltyProgramConfig, LoyaltySpendTier } from '../lib/catalogShapeTypes';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
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

type Props = {
  serviceOptions: { id: string; label: string }[];
  value: LoyaltyProgramConfig;
  onChange: (next: LoyaltyProgramConfig) => void;
  generateTierId: () => string;
};

function slabUpperBound(t: LoyaltySpendTier): number {
  return t.maxSpendInWindow === null ? Number.POSITIVE_INFINITY : t.maxSpendInWindow;
}

function slabsOverlap(a: LoyaltySpendTier, b: LoyaltySpendTier): boolean {
  if (a.id === b.id) return false;
  const aLo = a.minSpendInWindow;
  const aHi = slabUpperBound(a);
  const bLo = b.minSpendInWindow;
  const bHi = slabUpperBound(b);
  return aLo <= bHi && bLo <= aHi;
}

/** Text + commit-on-blur so values like 120 are not clamped to min on each keystroke (type="number" + Math.max bug). */
function SlabMinInput({
  tierId,
  committed,
  onCommit,
}: {
  tierId: string;
  committed: number;
  onCommit: (min: number) => void;
}) {
  const [draft, setDraft] = useState(() => String(committed));
  useEffect(() => {
    setDraft(String(committed));
  }, [tierId, committed]);

  const flush = () => {
    const t = draft.trim();
    if (t === '' || t === '.' || t === '-') {
      onCommit(0);
      setDraft('0');
      return;
    }
    const v = parseFloat(t);
    if (Number.isNaN(v)) {
      setDraft(String(committed));
      return;
    }
    const n = Math.max(0, v);
    onCommit(n);
    setDraft(String(n));
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className="min-w-[100px] tabular-nums"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={flush}
    />
  );
}

function SlabMaxInput({
  tierId,
  minSpend,
  committed,
  onCommit,
}: {
  tierId: string;
  minSpend: number;
  committed: number;
  onCommit: (max: number) => void;
}) {
  const [draft, setDraft] = useState(() => String(committed));
  useEffect(() => {
    setDraft(String(committed));
  }, [tierId, committed]);

  const flush = () => {
    const t = draft.trim();
    if (t === '' || t === '.' || t === '-') {
      onCommit(minSpend);
      setDraft(String(minSpend));
      return;
    }
    const v = parseFloat(t);
    if (Number.isNaN(v)) {
      setDraft(String(committed));
      return;
    }
    const n = Math.max(minSpend, v);
    onCommit(n);
    setDraft(String(n));
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className="min-w-[100px] tabular-nums"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={flush}
    />
  );
}

export function LoyaltyProgramEditor({ serviceOptions, value, onChange, generateTierId }: Props) {
  const { confirm, dialog } = useConfirmDialog();
  const setQualifyingCount = (raw: string) => {
    const n = parseInt(raw, 10);
    const c = Number.isNaN(n) ? 1 : Math.max(1, n);
    onChange({ ...value, qualifyingServiceCount: c });
  };

  const updateTier = (id: string, patch: Partial<LoyaltySpendTier>) => {
    onChange({
      ...value,
      tiers: value.tiers.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    });
  };

  const removeTier = async (id: string) => {
    const ok = await confirm({
      title: 'Delete loyalty tier?',
      description: 'Remove this loyalty spend tier?',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    onChange({ ...value, tiers: value.tiers.filter((t) => t.id !== id) });
  };

  const addTier = () => {
    const firstId = serviceOptions[0]?.id ?? '';
    let defaultMin = 100;
    let defaultMax = 200;
    if (value.tiers.length > 0) {
      const hasOpenEnded = value.tiers.some((t) => t.maxSpendInWindow === null);
      if (hasOpenEnded) {
        const maxMin = Math.max(...value.tiers.map((t) => t.minSpendInWindow));
        defaultMin = maxMin + 100;
        defaultMax = defaultMin + 100;
      } else {
        const hi = Math.max(...value.tiers.map((t) => t.maxSpendInWindow!));
        defaultMin = hi + 1;
        defaultMax = defaultMin + 100;
      }
    }
    onChange({
      ...value,
      tiers: [
        ...value.tiers,
        {
          id: generateTierId(),
          minSpendInWindow: defaultMin,
          maxSpendInWindow: defaultMax,
          rewardServiceId: firstId,
        },
      ],
    });
  };

  const overlappingSlabs = value.tiers.some((t, i) =>
    value.tiers.some((u, j) => i < j && slabsOverlap(t, u))
  );

  return (
    <div className="space-y-6">
      {dialog}
      <Card className="border-blue-100/70 shadow-sm">
        <CardHeader className="border-b border-blue-100/60 bg-gradient-to-r from-blue-50/60 via-white to-white">
          <CardTitle className="text-lg">How rewards are evaluated</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="space-y-2 max-w-xs">
            <Label htmlFor="loyalty-window-n">Services in spend window</Label>
            <Input
              id="loyalty-window-n"
              type="number"
              min={1}
              step={1}
              value={value.qualifyingServiceCount}
              onChange={(e) => setQualifyingCount(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Example: 10 means &quot;sum of prices from the last 10 completed services&quot;.
            </p>
          </div>

          {serviceOptions.length === 0 ? (
            <p className="rounded-lg border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
              No services in this catalog yet. Add vehicle types and services under Create services first.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-foreground">Spend slabs</h3>
                <Button type="button" size="sm" className="gap-1" onClick={addTier}>
                  <Plus className="size-4" />
                  Add slab
                </Button>
              </div>

              {overlappingSlabs ? (
                <p className="text-xs text-amber-800">
                  Some slabs overlap on the number line. A customer&apos;s total could match more than
                  one row — narrow ranges or remove overlaps.
                </p>
              ) : null}

              {value.tiers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No slabs yet.</p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-blue-100/80 bg-card">
                  <Table className="min-w-[640px]">
                    <TableHeader>
                      <TableRow className="border-b border-blue-100/80 bg-slate-50/90 hover:bg-slate-50/90">
                        <TableHead className="whitespace-nowrap text-blue-950/70">Min ($)</TableHead>
                        <TableHead className="whitespace-nowrap text-blue-950/70">Max ($)</TableHead>
                        <TableHead className="min-w-[520px] text-blue-950/70">Free service reward</TableHead>
                        <TableHead className="w-[120px] text-blue-950/70">No max</TableHead>
                        <TableHead className="w-[100px] text-right text-blue-950/70">Remove</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {value.tiers.map((tier) => {
                        const rewardValid = serviceOptions.some((o) => o.id === tier.rewardServiceId);
                        const unbounded = tier.maxSpendInWindow === null;
                        return (
                          <TableRow
                            key={tier.id}
                            className="border-b border-blue-100/40 transition-colors hover:bg-blue-50/40"
                          >
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-1 pt-1">
                                <span className="text-sm text-muted-foreground">$</span>
                                <SlabMinInput
                                  tierId={tier.id}
                                  committed={tier.minSpendInWindow}
                                  onCommit={(min) => {
                                    const maxNum = tier.maxSpendInWindow;
                                    // If min moves above current max, bump max so the slab stays valid
                                    // (never set max === min — that was collapsing the range on blur).
                                    let nextMax = maxNum;
                                    if (maxNum !== null && maxNum < min) {
                                      nextMax = min + 100;
                                    }
                                    updateTier(tier.id, {
                                      minSpendInWindow: min,
                                      maxSpendInWindow: nextMax,
                                    });
                                  }}
                                />
                              </div>
                            </TableCell>
                            <TableCell className="whitespace-nowrap">
                              <div className="flex items-center gap-1 pt-1">
                                <span className="text-sm text-muted-foreground">$</span>
                                {unbounded ? (
                                  <Input
                                    type="text"
                                    className="min-w-[100px] tabular-nums"
                                    disabled
                                    value=""
                                    placeholder="—"
                                  />
                                ) : (
                                  <SlabMaxInput
                                    tierId={tier.id}
                                    minSpend={tier.minSpendInWindow}
                                    committed={tier.maxSpendInWindow ?? tier.minSpendInWindow}
                                    onCommit={(max) =>
                                      updateTier(tier.id, { maxSpendInWindow: max })
                                    }
                                  />
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="pt-1">
                                <Select
                                  value={rewardValid ? tier.rewardServiceId : undefined}
                                  onValueChange={(v) => updateTier(tier.id, { rewardServiceId: v })}
                                >
                                  <SelectTrigger className="w-full bg-white">
                                    <SelectValue placeholder="Select service" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {serviceOptions.map((o) => (
                                      <SelectItem key={o.id} value={o.id}>
                                        {o.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                {!rewardValid && tier.rewardServiceId ? (
                                  <p className="mt-1 text-xs text-amber-700">
                                    Previous service was removed or is no longer loyalty-eligible — pick a
                                    new reward.
                                  </p>
                                ) : null}
                              </div>
                            </TableCell>
                            <TableCell>
                              <label className="flex cursor-pointer items-center gap-2 pt-2 text-sm">
                                <Checkbox
                                  checked={unbounded}
                                  onCheckedChange={(c) => {
                                    const open = c === true;
                                    if (open) {
                                      updateTier(tier.id, { maxSpendInWindow: null });
                                    } else {
                                      updateTier(tier.id, {
                                        maxSpendInWindow: Math.max(
                                          tier.minSpendInWindow,
                                          tier.maxSpendInWindow ?? tier.minSpendInWindow + 100
                                        ),
                                      });
                                    }
                                  }}
                                />
                                <span className="text-muted-foreground">No max</span>
                              </label>
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="mt-1 text-destructive hover:bg-destructive/10"
                                onClick={() => removeTier(tier.id)}
                              >
                                <Trash2 className="size-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
