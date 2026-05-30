import { useState } from 'react';
import { useBranchStore } from '../hooks/useBranchStore';
import type { Branch } from '../lib/branchStore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { Loader2, Pencil, Save, Trash2 } from 'lucide-react';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

export default function CreateBranch() {
  const MAX_BAY_COUNT = 50;
  const { branches, isLoading, upsertBranch, deleteBranch, getData } = useBranchStore();
  const { confirm, dialog } = useConfirmDialog();
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: '',
    location: '',
    zipCode: '',
    bayCount: 1,
    openTime: '08:00',
    closeTime: '18:00',
  });

  const resetForm = () => {
    setForm({
      name: '',
      location: '',
      zipCode: '',
      bayCount: 1,
      openTime: '08:00',
      closeTime: '18:00',
    });
    setEditingId(null);
  };

  const handleSave = () => {
    if (!form.name.trim() || !form.location.trim() || !form.zipCode.trim()) {
      window.alert('Name, address, and zip code are required.');
      return;
    }
    if (!/^\d{4,6}$/.test(form.zipCode.trim())) {
      window.alert('Zip code must be 4-6 digits.');
      return;
    }
    const bayCount = Math.max(1, Number(form.bayCount) || 1);
    if (bayCount > MAX_BAY_COUNT) {
      window.alert(`Bay count cannot exceed ${MAX_BAY_COUNT}.`);
      return;
    }
    const normalizedName = form.name.trim().toLowerCase();
    const duplicate = branches.some(
      (b) => b.id !== editingId && String(b.name || '').trim().toLowerCase() === normalizedName
    );
    if (duplicate) {
      window.alert('Branch name already exists. Please use a unique name.');
      return;
    }
    const branch: Branch = {
      id: editingId ?? '',
      name: form.name.trim(),
      location: form.location.trim(),
      zipCode: form.zipCode.trim(),
      bayCount,
      openTime: form.openTime,
      closeTime: form.closeTime,
    };
    upsertBranch(branch);
    resetForm();
  };

  const startEdit = (b: Branch) => {
    setEditingId(b.id);
    setForm({
      name: b.name,
      location: b.location,
      zipCode: b.zipCode ?? '',
      bayCount: b.bayCount,
      openTime: b.openTime,
      closeTime: b.closeTime,
    });
  };

  const handleDelete = async (b: Branch) => {
    const activeBookings = (getData(b.id).branchBookings ?? []).filter((x) =>
      ['scheduled', 'checked_in', 'in_progress'].includes(String(x.status))
    );
    if (activeBookings.length > 0) {
      window.alert('There are active bookings for this branch. It cannot be deleted.');
      return;
    }
    const ok = await confirm({
      title: 'Delete branch?',
      description: `Delete branch "${b.name}"? This removes all staff, services, and settings stored for this branch. This cannot be undone.`,
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    if (editingId === b.id) resetForm();
    deleteBranch(b.id);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-2">
      {dialog}


      <Card className="overflow-hidden border-slate-200 shadow-[0_1px_0_rgba(15,23,42,0.04)]">
        <CardHeader className="border-b border-slate-100 px-6 py-5 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="text-lg">{editingId ? 'Edit branch' : 'New branch'}</CardTitle>
              {editingId ? (
                <CardDescription className="text-sm leading-relaxed">
                  Update details below, then save to apply changes to this branch.
                </CardDescription>
              ) : null}
            </div>
            {editingId ? (
              <span className="inline-flex items-center rounded-full border border-blue-200/80 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                Editing
              </span>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-5 px-6 py-6 md:px-8">
          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-700">
              Branch details
            </h3>
            <div className="grid max-w-4xl gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">Branch name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Downtown"
                  autoComplete="organization"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="location">Branch address</Label>
                <Textarea
                  id="location"
                  rows={3}
                  value={form.location}
                  onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                  placeholder="Street, building, area, city…"
                  autoComplete="street-address"
                  className="min-h-[96px] sm:min-h-[84px]"
                />
              </div>
              <div className="space-y-2 sm:max-w-xs">
                <Label htmlFor="zip">Zip / postal code</Label>
                <Input
                  id="zip"
                  value={form.zipCode}
                  onChange={(e) => setForm((f) => ({ ...f, zipCode: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                  placeholder="e.g. 2000"
                  autoComplete="postal-code"
                  maxLength={6}
                />
              </div>
              <div className="space-y-2 sm:max-w-[200px]">
                <Label htmlFor="bays">Bay count</Label>
                <Input
                  id="bays"
                  type="number"
                  min={1}
                  max={MAX_BAY_COUNT}
                  value={form.bayCount}
                  onChange={(e) => setForm((f) => ({ ...f, bayCount: Number(e.target.value) }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="open">Open time</Label>
                <Input
                  id="open"
                  type="time"
                  value={form.openTime}
                  onChange={(e) => setForm((f) => ({ ...f, openTime: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="close">Close time</Label>
                <Input
                  id="close"
                  type="time"
                  value={form.closeTime}
                  onChange={(e) => setForm((f) => ({ ...f, closeTime: e.target.value }))}
                />
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col-reverse gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 md:flex-row md:justify-end md:px-8">
          {editingId && (
            <Button type="button" variant="outline" className="w-full md:w-auto" onClick={resetForm}>
              Cancel edit
            </Button>
          )}
          <Button type="button" onClick={handleSave} className="w-full gap-2 md:w-auto">
            <Save className="size-4" />
            Save branch
          </Button>
        </CardFooter>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground">All branches</h2>
          </div>
          {branches.length > 0 ? (
            <p className="text-xs font-medium tabular-nums text-muted-foreground sm:pb-0.5">
              {branches.length} {branches.length === 1 ? 'branch' : 'branches'}
            </p>
          ) : null}
        </div>

        {isLoading && branches.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-6 py-14 text-center">
            <Loader2 className="mb-3 size-8 animate-spin text-blue-500" aria-hidden />
            <p className="text-sm font-medium text-foreground">Loading branches…</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">Syncing with the server.</p>
          </div>
        ) : branches.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-blue-200/70 bg-blue-50/20 px-6 py-14 text-center">
            <p className="text-sm font-medium text-foreground">No branches yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Use the form above to add your first branch. It will appear in this list.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-card shadow-sm">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="border-b border-slate-200 bg-slate-50/90 hover:bg-slate-50/90">
                  <TableHead className="w-[16%] text-blue-950/70">Name</TableHead>
                  <TableHead className="min-w-0 text-blue-950/70">Address</TableHead>
                  <TableHead className="w-[6rem] text-blue-950/70">Zip</TableHead>
                  <TableHead className="w-[4.5rem] text-right text-blue-950/70">Bays</TableHead>
                  <TableHead className="w-[9rem] text-blue-950/70">Hours</TableHead>
                  <TableHead className="w-[200px] text-right text-blue-950/70">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {branches.map((b) => (
                  <TableRow
                    key={b.id}
                    className="border-b border-slate-100 transition-colors hover:bg-blue-50/40"
                  >
                    <TableCell className="font-semibold text-foreground">{b.name}</TableCell>
                    <TableCell className="min-w-0 whitespace-pre-wrap text-muted-foreground">{b.location}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{b.zipCode || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums text-foreground">{b.bayCount}</TableCell>
                    <TableCell className="whitespace-nowrap tabular-nums text-muted-foreground">
                      {b.openTime} – {b.closeTime}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      <div className="flex flex-wrap justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => startEdit(b)}
                          className="gap-1.5 text-blue-700 hover:bg-blue-100/80 hover:text-blue-900"
                        >
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(b)}
                          className="gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    </div>
  );
}
