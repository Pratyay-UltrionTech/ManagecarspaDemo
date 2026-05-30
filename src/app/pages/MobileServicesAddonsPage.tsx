import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { useMobileServicesStore } from '../hooks/useMobileServicesStore';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import type { AddonItem } from '../lib/catalogShapeTypes';
import { mobileServicesStoreApi } from '../lib/mobileServicesStore';
import PriceInput from '../components/PriceInput';
import { pointsToText, textToPoints } from '../lib/branchServiceFormUtils';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Switch } from '../components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Separator } from '../components/ui/separator';

const MOBILE_SERVICES = '/mobile-services/services';

export default function MobileServicesAddonsPage() {
  const { mobileAddons, updateMobileAddons, saveMobileAddon, deleteMobileAddon, deletePendingByKey, deleteErrorByKey } = useMobileServicesStore();
  const { confirm, dialog } = useConfirmDialog();

  const [addonName, setAddonName] = useState('');
  const [addonPrice, setAddonPrice] = useState('');
  const [addonPoints, setAddonPoints] = useState('');
  const [addonActive, setAddonActive] = useState(true);
  const [editingAddonId, setEditingAddonId] = useState<string | null>(null);
  const [addonNameError, setAddonNameError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const resetAddonForm = () => {
    setAddonName('');
    setAddonPrice('');
    setAddonPoints('');
    setAddonActive(true);
    setEditingAddonId(null);
    setAddonNameError('');
  };

  const saveAddon = async () => {
    const name = addonName.trim();
    const price = parseFloat(addonPrice);
    if (!name || Number.isNaN(price)) return;
    const normalizedName = name.toLowerCase();
    const duplicateName = mobileAddons.some(
      (a) => a.id !== editingAddonId && a.name.trim().toLowerCase() === normalizedName
    );
    if (duplicateName) {
      setAddonNameError('Add-on name already used');
      setSaveError('Please use a unique add-on name.');
      return;
    }
    setAddonNameError('');
    setSaveError('');

    const item: AddonItem = {
      id: editingAddonId ?? mobileServicesStoreApi.generateAddonId(),
      name,
      price,
      descriptionPoints: textToPoints(addonPoints),
      active: addonActive,
    };
    try {
      setIsSaving(true);
      await saveMobileAddon(item);
      resetAddonForm();
    } catch (error) {
      if (error instanceof Error && error.message) setSaveError(error.message);
      else setSaveError('Failed to save add-on. Please try again.');
      return;
    } finally {
      setIsSaving(false);
    }
  };

  const editAddon = (addon: AddonItem) => {
    setEditingAddonId(addon.id);
    setAddonName(addon.name);
    setAddonPrice(String(addon.price));
    setAddonPoints(pointsToText(addon.descriptionPoints));
    setAddonActive(addon.active);
  };

  const deleteAddon = async (addonId: string) => {
    const ok = await confirm({
      title: 'Delete add-on?',
      description: 'Remove this add-on? This action cannot be undone.',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    await deleteMobileAddon(addonId).catch(() => {});
    if (editingAddonId === addonId) resetAddonForm();
  };

  const toggleAddonActive = (addonId: string, active: boolean) => {
    updateMobileAddons((list) => list.map((a) => (a.id === addonId ? { ...a, active } : a)));
  };

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-2">
      {dialog}


      <div className="space-y-8">
        <Card className="overflow-hidden border-slate-200 shadow-sm">
          <CardHeader className="border-b border-slate-100 px-6 py-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <CardTitle className="text-lg">{editingAddonId ? 'Edit add-on' : 'Add add-on'}</CardTitle>
              </div>
              {editingAddonId ? (
                <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                  Editing
                </span>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-5 px-6 py-6">
            <div className="grid max-w-xl gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="m-addon-name">Add-on name</Label>
                <Input
                  id="m-addon-name"
                  value={addonName}
                  onChange={(e) => {
                    setAddonName(e.target.value);
                    if (addonNameError) setAddonNameError('');
                  }}
                  className={addonNameError ? 'border-destructive ring-destructive focus-visible:ring-destructive' : ''}
                />
                {addonNameError ? <p className="text-xs font-medium text-destructive">{addonNameError}</p> : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-addon-price">Price</Label>
                <PriceInput
                  id="m-addon-price"
                  value={addonPrice}
                  onChange={setAddonPrice}
                  className="w-full"
                />
              </div>
              <div className="flex items-center justify-between gap-4 sm:col-span-2 rounded-lg border border-slate-200 bg-slate-50/50 px-4 py-3">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-foreground">Active</p>
                  <p className="text-xs text-muted-foreground">Turn off to hide this add-on from the booking menu.</p>
                </div>
                <Switch checked={addonActive} onCheckedChange={setAddonActive} />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="m-addon-points">What&apos;s included (one point per line)</Label>
                <Textarea
                  id="m-addon-points"
                  rows={3}
                  value={addonPoints}
                  onChange={(e) => setAddonPoints(e.target.value)}
                />
              </div>
            </div>
            <Separator className="bg-blue-100/80" />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={saveAddon} disabled={isSaving}>
                {isSaving ? 'Saving...' : editingAddonId ? 'Save changes' : 'Add add-on'}
              </Button>
              {editingAddonId ? (
                <Button type="button" variant="outline" onClick={resetAddonForm}>
                  Cancel
                </Button>
              ) : null}
            </div>
            {saveError ? <p className="text-xs font-medium text-destructive">{saveError}</p> : null}
          </CardContent>
        </Card>

        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-700">All add-ons</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-card shadow-sm">
            {mobileAddons.length === 0 ? (
              <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                No add-ons yet. Use the form above.
              </p>
            ) : (
              <Table className="min-w-[640px]">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 bg-slate-50/90 hover:bg-slate-50/90">
                    <TableHead className="min-w-0 text-blue-950/70">Name</TableHead>
                    <TableHead className="w-[7rem] text-right text-blue-950/70">Price</TableHead>
                    <TableHead className="w-[6rem] text-center text-blue-950/70">Active</TableHead>
                    <TableHead className="w-[180px] text-right text-blue-950/70">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mobileAddons.map((a) => (
                    <TableRow
                      key={a.id}
                      className="border-b border-slate-100 transition-colors hover:bg-blue-50/40"
                    >
                      <TableCell className="font-medium text-foreground">{a.name}</TableCell>
                      <TableCell className="whitespace-nowrap text-right tabular-nums">${a.price.toFixed(2)}</TableCell>
                      <TableCell className="text-center">
                        <Switch
                          checked={a.active}
                          onCheckedChange={(c) => toggleAddonActive(a.id, c === true)}
                          aria-label="Toggle active"
                        />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-blue-700 hover:bg-blue-100/80"
                            onClick={() => editAddon(a)}
                          >
                            <Pencil className="size-4" />
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10"
                            disabled={deletePendingByKey[`mobile-addon:${a.id}`]}
                            onClick={() => deleteAddon(a.id)}
                          >
                            <Trash2 className="size-4" />
                            {deletePendingByKey[`mobile-addon:${a.id}`] ? 'Deleting...' : 'Delete'}
                          </Button>
                        </div>
                        {deleteErrorByKey[`mobile-addon:${a.id}`] ? (
                          <p className="text-xs text-destructive">{deleteErrorByKey[`mobile-addon:${a.id}`]}</p>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
