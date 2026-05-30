import type { CatalogServiceGroup } from '../lib/serviceCentricCatalog';
import { Checkbox } from './ui/checkbox';

type Props = {
  group: CatalogServiceGroup;
  selectedServiceIds: string[];
  isAllSelected: boolean;
  isSomeSelected: boolean;
  onToggleSelectAll: () => void;
  onToggleVariant: (serviceId: string) => void;
};

/**
 * Nested service (bold) + two-column vehicle/price checkboxes — promos & day-time pricing forms.
 */
export function ServiceGroupVehicleGrid({
  group,
  selectedServiceIds,
  isAllSelected,
  isSomeSelected,
  onToggleSelectAll,
  onToggleVariant,
}: Props) {
  return (
    <div className="space-y-2.5 pb-6 last:pb-0">
      <label className="flex cursor-pointer items-center gap-3">
        <Checkbox
          checked={isAllSelected}
          className={isSomeSelected ? 'opacity-70' : ''}
          onCheckedChange={() => onToggleSelectAll()}
        />
        <span className="text-base font-bold text-slate-900">{group.name}</span>
      </label>
      <div className="pl-7 sm:pl-8">
        <div className="flex flex-wrap gap-x-8 gap-y-2.5">
          {group.variants.map((v) => (
            <label
              key={v.serviceId}
              className="flex min-w-[220px] max-w-full cursor-pointer items-center gap-2.5 text-sm font-normal text-slate-500"
            >
              <Checkbox
                checked={selectedServiceIds.includes(v.serviceId)}
                onCheckedChange={() => onToggleVariant(v.serviceId)}
              />
              <span className="min-w-0 leading-snug">
                {v.vehicleType} (${v.price.toFixed(2)})
              </span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}
