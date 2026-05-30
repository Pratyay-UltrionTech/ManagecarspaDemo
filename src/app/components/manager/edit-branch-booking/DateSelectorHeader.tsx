import { format, parse } from 'date-fns';
import { CalendarDays, ChevronDown } from 'lucide-react';
import { cn } from '../../ui/utils';

type Props = {
  slotDate: string;
  /** Popover / calendar expanded — rotates chevron */
  expanded: boolean;
  className?: string;
};

export function DateSelectorHeader({ slotDate, expanded, className }: Props) {
  const label = slotDate
    ? format(parse(slotDate, 'yyyy-MM-dd', new Date()), 'MMMM d, yyyy')
    : '—';

  return (
    <span className={cn('flex w-full min-w-0 items-center gap-2.5 text-left', className)}>
      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-blue-50 text-blue-600">
        <CalendarDays className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Select date & slot
        </span>
        <span className="block truncate text-base font-bold tabular-nums text-foreground">{label}</span>
      </span>
      <ChevronDown
        className={cn(
          'ml-auto size-4 shrink-0 text-muted-foreground transition-transform',
          expanded && 'rotate-180',
        )}
        aria-hidden
      />
    </span>
  );
}
