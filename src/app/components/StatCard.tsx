import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend: string;
  trendUp: boolean;
  color: 'blue' | 'green' | 'purple' | 'orange';
}

const colorMap = {
  blue:   { icon: 'bg-blue-50 text-blue-600',   ring: 'ring-blue-100' },
  green:  { icon: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-100' },
  purple: { icon: 'bg-violet-50 text-violet-600', ring: 'ring-violet-100' },
  orange: { icon: 'bg-amber-50 text-amber-600',  ring: 'ring-amber-100' },
};

export function StatCard({ title, value, icon: Icon, trend, trendUp, color }: StatCardProps) {
  const c = colorMap[color];
  return (
    <div className="group rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        {/* Icon */}
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ${c.icon} ${c.ring}`}>
          <Icon className="size-5" strokeWidth={2} />
        </div>

        {/* Trend badge */}
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
            trendUp
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-600'
          }`}
        >
          {trendUp ? (
            <TrendingUp className="size-3" strokeWidth={2.5} />
          ) : (
            <TrendingDown className="size-3" strokeWidth={2.5} />
          )}
          {trend}
        </span>
      </div>

      <div className="mt-4">
        <p className="text-[13px] font-medium text-slate-500">{title}</p>
        <p className="mt-1 text-[2rem] font-bold tracking-tight text-slate-900 leading-none">{value}</p>
      </div>
    </div>
  );
}
