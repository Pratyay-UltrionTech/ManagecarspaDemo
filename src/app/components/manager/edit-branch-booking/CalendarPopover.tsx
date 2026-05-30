import { useEffect, useState } from 'react';
import { format, parse } from 'date-fns';
import { Calendar } from '../../ui/calendar';
import { Button } from '../../ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '../../ui/popover';
import { cn } from '../../ui/utils';
import { DateSelectorHeader } from './DateSelectorHeader';

type Props = {
  slotDate: string;
  onDateChange: (isoDate: string) => void;
  /** Close popover when dialog job changes */
  resetKey?: string;
  /** When `false`, closes calendar (e.g. edit dialog hidden). Omit on standalone pages. */
  dialogOpen?: boolean;
  /** Portal into this node when set (e.g. dialog body) — avoids clipping with `overflow-hidden` parents. */
  portalContainer?: HTMLElement | null;
  className?: string;
  /** When true, date cannot be changed (e.g. work in progress). */
  disabled?: boolean;
};

export function CalendarPopover({
  slotDate,
  onDateChange,
  resetKey,
  dialogOpen,
  portalContainer,
  className,
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [resetKey]);

  useEffect(() => {
    if (dialogOpen === false) setOpen(false);
  }, [dialogOpen]);

  const selected = slotDate ? parse(slotDate, 'yyyy-MM-dd', new Date()) : undefined;

  return (
    <Popover
      open={disabled ? false : open}
      onOpenChange={(next) => {
        if (!disabled) setOpen(next);
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-auto min-h-0 w-full rounded-lg border-slate-200 bg-white px-3 py-2 text-left font-normal shadow-sm hover:bg-slate-50',
            disabled && 'cursor-not-allowed opacity-60',
            className
          )}
        >
          <DateSelectorHeader slotDate={slotDate} expanded={open} />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={6}
        container={portalContainer ?? undefined}
        className="z-[300] w-auto border-slate-200 p-1.5 shadow-lg"
      >
        <Calendar
          mode="single"
          selected={selected}
          className="p-1.5"
          disabled={{ before: new Date() }}
          onSelect={(d) => {
            if (!d) return;
            onDateChange(format(d, 'yyyy-MM-dd'));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
