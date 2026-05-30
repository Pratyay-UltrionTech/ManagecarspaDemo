import { Card, CardHeader, CardTitle } from '../components/ui/card';
import { useNavigate } from 'react-router';
import { 
  DollarSign, 
  Calendar, 
  Clock, 
  Tag, 
  CreditCard, 
  Users, 
  Smartphone,
  ChevronRight
} from 'lucide-react';

const reportModules = [
  {
    id: 'revenue',
    title: 'Revenue Summary',
    icon: DollarSign,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    accentColor: 'emerald',
    gradient: 'from-emerald-50/40 to-white/40',
  },
  {
    id: 'bookings',
    title: 'Bookings Summary',
    icon: Calendar,
    color: 'text-indigo-600',
    bgColor: 'bg-indigo-50',
    accentColor: 'indigo',
    gradient: 'from-indigo-50/40 to-white/40',
  },
  {
    id: 'slots',
    title: 'Slot Utilisation',
    icon: Clock,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    accentColor: 'orange',
    gradient: 'from-orange-50/40 to-white/40',
  },
  {
    id: 'promos',
    title: 'Promo Code Redemption',
    icon: Tag,
    color: 'text-rose-600',
    bgColor: 'bg-rose-50',
    accentColor: 'rose',
    gradient: 'from-rose-50/40 to-white/40',
  },
  {
    id: 'payments',
    title: 'Payment Method Breakdown',
    icon: CreditCard,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    accentColor: 'blue',
    gradient: 'from-blue-50/40 to-white/40',
  },
  {
    id: 'washers',
    title: 'Washer Job Completion',
    icon: Users,
    color: 'text-violet-600',
    bgColor: 'bg-violet-50',
    accentColor: 'violet',
    gradient: 'from-violet-50/40 to-white/40',
  },
  {
    id: 'sources',
    title: 'Walk-in vs Online Bookings',
    icon: Smartphone,
    color: 'text-cyan-600',
    bgColor: 'bg-cyan-50',
    accentColor: 'cyan',
    gradient: 'from-cyan-50/40 to-white/40',
  },
];

export default function ReportsPage() {
  const navigate = useNavigate();

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Analytics Hub</h1>
        <p className="text-sm text-slate-500">
          Operational performance metrics and business insights.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {reportModules.map((m) => (
          <Card 
            key={m.id}
            className="group cursor-pointer border-slate-200 bg-white transition-all duration-200 hover:border-indigo-300 hover:bg-slate-50/50 hover:shadow-sm"
            onClick={() => navigate(`/reports/${m.id}`)}
          >
            <CardHeader className="flex flex-row items-center space-y-0 p-4">
              <div className={`mr-3 flex size-10 items-center justify-center rounded-lg ${m.bgColor} ${m.color} ring-1 ring-inset ring-black/5`}>
                <m.icon className="size-5" />
              </div>
              <CardTitle className="flex-1 text-sm font-medium text-slate-700 transition-colors group-hover:text-slate-900">
                {m.title}
              </CardTitle>
              <ChevronRight className="size-4 text-slate-300 transition-transform group-hover:translate-x-0.5" />
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Analytics Footer Insight */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6">
         <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="space-y-1 text-center md:text-left">
               <h3 className="text-base font-semibold text-slate-900">Executive Summary</h3>
               <p className="max-w-md text-xs text-slate-500">Generate a comprehensive performance report for your current business period.</p>
            </div>
            <button 
              className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-6 py-2 text-xs font-medium text-white transition-all hover:bg-slate-800 active:scale-95"
              onClick={() => {}}
            >
               Generate Report
            </button>
         </div>
      </div>
    </div>
  );
}
