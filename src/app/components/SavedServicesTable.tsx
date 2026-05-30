import { useMemo, useState } from 'react';
import { Pencil, Trash2, Star, Sparkles, ShieldCheck, Award, Zap, Diamond } from 'lucide-react';
import { Button } from './ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { Switch } from './ui/switch';
import { useMobileServicesStore } from '../hooks/useMobileServicesStore';
import { collectServiceGroups, type CatalogServiceGroup } from '../lib/serviceCentricCatalog';
import { storageToDetailsText } from '../lib/serviceDetailsFormat';

export function SavedServicesTable() {
  const { vehicleCatalog, updateVehicleCatalog } = useMobileServicesStore();
  const groups = useMemo(() => collectServiceGroups(vehicleCatalog), [vehicleCatalog]);
  
  const [categoryFilter, setCategoryFilter] = useState<string>('All');

  const filteredGroups = useMemo(() => {
    if (categoryFilter === 'All') return groups;
    return groups.filter(g => g.category?.toLowerCase() === categoryFilter.toLowerCase());
  }, [groups, categoryFilter]);

  const handleToggleActive = (group: CatalogServiceGroup, checked: boolean) => {
    const ids = new Set(group.variants.map(v => v.serviceId));
    updateVehicleCatalog(blocks => blocks.map(block => ({
      ...block,
      services: block.services.map(s => ids.has(s.id) ? { ...s, active: checked } : s)
    })));
  };

  const handleEdit = (group: CatalogServiceGroup) => {
    // Attempt to find duration from the actual service items in the catalog
    let duration = 60;
    for (const block of vehicleCatalog) {
      const s = block.services.find(x => group.variants.some(v => v.serviceId === x.id));
      if (s && s.durationMinutes) {
        duration = s.durationMinutes;
        break;
      }
    }

    window.dispatchEvent(new CustomEvent('editServiceRequested', { 
      detail: {
        id: group.catalogGroupId || group.variants[0]?.serviceId,
        name: group.name,
        category: group.category,
        baseDuration: String(duration),
        description: storageToDetailsText(group.descriptionPoints, group.excludedPoints ?? []),
        fullVariants: group.variants.map(v => ({
          id: v.serviceId,
          vehicle: v.vehicleType,
          price: String(v.price),
          freeCoffee: v.freeCoffeeCount,
          loyaltyCounted: v.eligibleForLoyaltyPoints,
          recommended: v.recommended,
          active: v.active,
        }))
      } 
    }));
  };

  const handleDelete = (group: CatalogServiceGroup) => {
    if (confirm(`Delete service "${group.name}" for all vehicle types?`)) {
      const ids = new Set(group.variants.map(v => v.serviceId));
      updateVehicleCatalog(blocks => blocks.map(block => ({
        ...block,
        services: block.services.filter(s => !ids.has(s.id))
      })));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900">Saved Services</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-500">Category</span>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px] bg-white">
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
        <Table className="w-full table-fixed min-w-[1000px]">
          <TableHeader>
            <TableRow className="bg-slate-50/50 hover:bg-slate-50/50">
              <TableHead className="w-[15%] py-4 font-semibold text-slate-600">Service Name</TableHead>
              <TableHead className="w-[8%] py-4 font-semibold text-slate-600 text-center">Vehicle</TableHead>
              <TableHead className="w-[10%] py-4 font-semibold text-slate-600 text-center leading-tight">Base<br/>Duration</TableHead>
              <TableHead className="w-[8%] py-4 font-semibold text-slate-600 text-center">Variants</TableHead>
              <TableHead className="w-[10%] py-4 font-semibold text-slate-600 text-center">Price</TableHead>
              <TableHead className="w-[6%] py-4 font-semibold text-slate-600 text-center">Coffee</TableHead>
              <TableHead className="w-[9%] py-4 font-semibold text-slate-600 text-center">Loyalty</TableHead>
              <TableHead className="w-[10%] py-4 text-center font-semibold text-slate-600 leading-tight">Recom-<br/>mended</TableHead>
              <TableHead className="w-[12%] py-4 text-center font-semibold text-slate-600 leading-tight">Active<br/>Status</TableHead>
              <TableHead className="w-[12%] py-4 text-right font-semibold text-slate-600 pr-6"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredGroups.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-32 text-center text-slate-400">
                  No services found.
                </TableCell>
              </TableRow>
            ) : (
              filteredGroups.map((group) => {
                const nameLower = group.name.toLowerCase();
                const isDetailing = group.category === 'Detailing';
                
                let Icon = Sparkles;
                if (isDetailing) {
                  if (nameLower.includes('ultimate') || nameLower.includes('ceramic')) Icon = Diamond;
                  else Icon = ShieldCheck;
                } else {
                  if (nameLower.includes('platinum') || nameLower.includes('gold')) Icon = Award;
                  else if (nameLower.includes('premium') || nameLower.includes('silver')) Icon = Zap;
                }

                const minPrice = Math.min(...group.variants.map(v => v.price));
                const isRecommended = group.variants.some(v => v.recommended);
                const isActive = group.variants.some(v => v.active);
                
                // Duration search
                let duration = 60;
                for (const block of vehicleCatalog) {
                  const s = block.services.find(x => group.variants.some(v => v.serviceId === x.id));
                  if (s && s.durationMinutes) {
                    duration = s.durationMinutes;
                    break;
                  }
                }

                return (
                  <TableRow key={group.listKey} className="group hover:bg-slate-50/50 transition-colors">
                    <TableCell className="py-4">
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-semibold text-slate-600 tabular-nums">
                          #{group.displaySequence}
                        </span>
                        <span className="font-bold text-slate-900 break-words">{group.name}</span>
                      </span>
                    </TableCell>
                    <TableCell className="py-4 text-center text-slate-600 font-medium">
                      {group.variants[0]?.vehicleType || 'All'}
                    </TableCell>
                    <TableCell className="py-4 text-center text-slate-600 font-medium">
                      {duration} min
                    </TableCell>
                    <TableCell className="py-4 text-center text-slate-600 font-bold">
                      {group.variants.length}
                    </TableCell>
                    <TableCell className="py-4 text-center text-slate-900 font-bold">
                      ${minPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="py-4 text-center text-slate-600 font-bold">
                      {Math.max(...group.variants.map(v => v.freeCoffeeCount))}
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <div className="flex justify-center">
                        {group.variants.some(v => v.eligibleForLoyaltyPoints) ? (
                          <div className="size-6 rounded-full bg-emerald-100 flex items-center justify-center">
                            <Zap className="size-3.5 text-emerald-600 fill-emerald-600" />
                          </div>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      {isRecommended ? (
                        <Star className="mx-auto size-5 fill-amber-400 text-amber-500" />
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </TableCell>
                    <TableCell className="py-4 text-center">
                      <div className="flex justify-center">
                        <Switch 
                          checked={isActive} 
                          onCheckedChange={(checked) => handleToggleActive(group, checked)}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="py-4 text-right pr-6">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 rounded-lg border border-slate-200 bg-white text-blue-600 hover:bg-blue-50 hover:text-blue-700 shadow-sm"
                          onClick={() => handleEdit(group)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9 rounded-lg border border-slate-200 bg-white text-red-500 hover:bg-red-50 hover:text-red-600 shadow-sm"
                          onClick={() => handleDelete(group)}
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
  );
}