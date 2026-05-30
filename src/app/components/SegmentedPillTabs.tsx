import { cn } from './ui/utils';

type Props = {
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
  'aria-label'?: string;
};

/** Pill segmented control (lavender track, white active segment) — shared size for branch & mobile staff UIs. */
export function SegmentedPillTabs({ value, onValueChange, options, 'aria-label': ariaLabel }: Props) {
  return (
    <div
      className="flex w-full max-w-xl rounded-full bg-blue-100/75 p-1 shadow-[inset_0_1px_2px_rgba(15,23,42,0.06)]"
      role="tablist"
      aria-label={ariaLabel}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={value === opt.value}
          id={`segment-${opt.value}`}
          onClick={() => onValueChange(opt.value)}
          className={cn(
            'relative flex min-h-10 flex-1 items-center justify-center rounded-full px-3 text-sm font-medium transition-all duration-200 sm:px-4',
            value === opt.value
              ? 'bg-white text-foreground shadow-[0_1px_3px_rgba(15,23,42,0.08)] ring-1 ring-black/[0.05]'
              : 'text-slate-600 hover:text-foreground'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
