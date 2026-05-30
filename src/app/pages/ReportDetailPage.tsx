import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { API_BASE } from '../lib/apiBase';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '../components/ui/dropdown-menu';
import { Tabs, TabsList, TabsTrigger } from '../components/ui/tabs';
import { toast } from 'sonner';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { Label } from '../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { SegmentedPillTabs } from '../components/SegmentedPillTabs';
import { 
  ArrowLeft,
  DollarSign, 
  Calendar, 
  Clock, 
  Tag, 
  CreditCard, 
  Users, 
  Smartphone,
  TrendingUp,
  Store,
  Truck,
  Download,
  Filter,
  AlertCircle
} from 'lucide-react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip,
  Legend
} from 'recharts';
import { useAdminSession } from '../hooks/useAdminSession';

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

interface ReportData {
  revenue: { total: number; currency: string };
  bookings: { total: number };
  utilization: { peak_hours: string[]; idle_hours: string[] };
  promo: { usage: Record<string, { count: number; discount: number }> };
  payment: { methods: Record<string, number> };
  washer_performance: Record<string, number>;
  source: { online: number; walk_in: number };
  period: { start: string; end: string };
}

export default function ReportDetailPage() {
  const { reportType } = useParams<{ reportType: string }>();
  const navigate = useNavigate();
  const { session } = useAdminSession();

  const [mobileMode, setMobileMode] = useState(false);
  const [period, setPeriod] = useState('month');
  const [branchId, setBranchId] = useState<string>('all');
  const [serviceType, setServiceType] = useState<string>('all');
  const [vehicleType, setVehicleType] = useState<string>('all');
  const [branches, setBranches] = useState<{id: string, name: string}[]>([]);
  const [availableServices, setAvailableServices] = useState<string[]>([]);
  const [availableVehicles, setAvailableVehicles] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMetadata();
  }, []);

  const fetchMetadata = async () => {
    try {
      const response = await fetch(`${API_BASE}/admin/reports/metadata`, {
        headers: { 'Authorization': `Bearer ${session?.accessToken}` }
      });
      if (response.ok) {
        const json = await response.json();
        if (json.error) {
          console.warn('Metadata error:', json.error);
        }
        setBranches(json.branches || []);
        setAvailableServices(json.services || []);
        setAvailableVehicles(json.vehicles || []);
      }
    } catch (err) {
      console.error('Failed to fetch metadata:', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 120000); // Poll every 2 minutes for balance
    return () => clearInterval(interval);
  }, [reportType, mobileMode, period, branchId, serviceType, vehicleType, session]);

  const fetchData = async () => {
    if (!session?.accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        period: period,
        mobile: mobileMode.toString(),
      });
      if (branchId !== 'all') params.append('branch_id', branchId);
      if (serviceType !== 'all') params.append('service_type', serviceType);
      if (vehicleType !== 'all') params.append('vehicle_type', vehicleType);

      const endpoint = `${API_BASE}/admin/reports/${reportType}`;
      const response = await fetch(`${endpoint}?${params}`, {
        headers: {
          'Authorization': `Bearer ${session.accessToken}`,
        }
      });
      
      if (response.status === 401 || response.status === 403) {
        navigate('/login');
        return;
      }

      const json = await response.json();
      
      if (response.ok) {
        if (json.error) {
          setError(json.message || 'The analytics engine encountered an unexpected error.');
        } else {
          setData(json);
        }
      } else {
        setError(`Server returned ${response.status}: ${json.detail || 'Access denied or invalid request.'}`);
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
      setError('A network error occurred. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'excel' | 'word') => {
    if (!data) return;
    const fileName = `${reportType}_report_${period}_${new Date().toISOString().split('T')[0]}`;
    
    toast.promise(
      new Promise((resolve) => {
        setTimeout(() => {
          let content = '';
          let type = '';
          let extension = '';

          if (format === 'excel') {
            // Generate CSV
            content = "Report Metadata\n";
            content += `Type,${reportType.toUpperCase()}\n`;
            content += `Period,${period}\n`;
            content += `Generated,${new Date().toLocaleString()}\n\n`;
            
            content += "Core Metrics\n";
            content += `Metric,Value\n`;
            content += `Total Revenue,${data.revenue.total}\n`;
            content += `Total Bookings,${data.bookings.total}\n\n`;

            if (reportType === 'washers') {
              content += "Staff Performance\nName,Jobs Completed\n";
              Object.entries(data.washer_performance).forEach(([name, count]) => {
                content += `${name},${count}\n`;
              });
            } else if (reportType === 'payments') {
              content += "Payment Distribution\nMethod,Count\n";
              Object.entries(data.payment.methods).forEach(([method, count]) => {
                content += `${method},${count}\n`;
              });
            } else if (reportType === 'promos') {
              content += "Promotion Usage\nCode,Usage,Total Discount\n";
              Object.entries(data.promo.usage).forEach(([code, stats]: any) => {
                content += `${code},${stats.count},${stats.discount}\n`;
              });
            }
            
            type = 'text/csv;charset=utf-8;';
            extension = 'csv';
          } else {
            // Generate HTML for Word
            content = `
              <html>
                <body style="font-family: sans-serif; color: #334155;">
                  <h1 style="color: #0f172a;">${getReportMeta().title}</h1>
                  <p><strong>Period:</strong> ${period}</p>
                  <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
                  <hr/>
                  <div style="margin-top: 20px;">
                    <h2>Summary</h2>
                    <p>Total Revenue: ${formatCurrency(data.revenue.total)}</p>
                    <p>Total Volume: ${data.bookings.total} bookings</p>
                  </div>
                </body>
              </html>
            `;
            type = 'application/msword';
            extension = 'doc';
          }

          const blob = new Blob([content], { type });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${fileName}.${extension}`;
          a.click();
          window.URL.revokeObjectURL(url);
          resolve(true);
        }, 1000);
      }),
      {
        loading: `Generating ${format.toUpperCase()} report...`,
        success: `${format.toUpperCase()} report downloaded!`,
        error: 'Export failed.',
      }
    );
  };

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);

  const getReportMeta = () => {
    switch (reportType) {
      case 'revenue': return { title: 'Revenue Summary', icon: DollarSign };
      case 'bookings': return { title: 'Bookings Summary', icon: Calendar };
      case 'slots': return { title: 'Slot Utilisation', icon: Clock };
      case 'promos': return { title: 'Promo Code Redemption', icon: Tag };
      case 'payments': return { title: 'Payment Method Breakdown', icon: CreditCard };
      case 'washers': return { title: 'Washer Job Completion', icon: Users };
      case 'sources': return { title: 'Walk-in vs Online Bookings', icon: Smartphone };
      default: return { title: 'Report', icon: Filter };
    }
  };

  const meta = getReportMeta();

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 text-center">
        <div className="h-16 w-16 rounded-full bg-red-50 flex items-center justify-center mb-6">
          <AlertCircle className="h-8 w-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-slate-900 italic">Report Unvailable</h3>
        <p className="text-sm text-slate-500 max-w-sm mt-2 mb-8 leading-relaxed">{error}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate('/reports')}>
            Back to Dashboard
          </Button>
          <Button onClick={() => fetchData()}>
            Retry Analysis
          </Button>
        </div>
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center">
            <meta.icon className="size-6 text-indigo-600" />
          </div>
          <p className="text-sm font-medium text-slate-400">Loading {meta.title}...</p>
        </div>
      </div>
    );
  }

  const isEmpty = data && data.bookings.total === 0;

  const getSummaryText = () => {
    if (!data) return 'loading...';
    const periodStr = period === 'today' ? 'today' : period === 'week' ? 'this week' : 'this month';
    const serviceStr = serviceType === 'all' ? 'all services' : `${serviceType} washing`;
    const vehicleStr = vehicleType === 'all' ? '' : `for ${vehicleType}s`;
    
    let locationStr = '';
    if (mobileMode) {
      locationStr = 'from mobile units';
    } else {
      if (branchId === 'all') {
        locationStr = 'across all branches';
      } else {
        const b = branches.find(x => x.id === branchId);
        locationStr = b ? `in ${b.name}` : 'in the selected branch';
      }
    }

    if (reportType === 'revenue' && data.revenue) {
      const revenueStr = formatCurrency(data.revenue.total);
      return `${revenueStr} earned ${periodStr} from ${serviceStr} ${vehicleStr} ${locationStr}`;
    }
    if (reportType === 'bookings' && data.bookings) {
      const bookingsStr = `${data.bookings.total} bookings`;
      return `${bookingsStr} registered ${periodStr} for ${serviceStr} ${locationStr}`;
    }
    
    if (reportType === 'washers') {
      const staffCount = Object.keys(data.washer_performance || {}).length;
      return `${staffCount} staff members ${locationStr} ${periodStr}`;
    }

    return `analysis for ${periodStr} ${locationStr}`;
  };

  return (
    <div className="space-y-8">
      {/* Header Area */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <button 
              onClick={() => navigate('/reports')}
              className="hover:text-slate-900 transition-colors"
            >
              Analytics
            </button>
            <span>/</span>
            <span className="text-slate-900">{meta.title}</span>
          </div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">{meta.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {getSummaryText()}
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchData()}>
            Refresh data
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Download className="size-4" /> Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExport('excel')}>Excel Spreadsheet</DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('word')}>Word Document</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Filters Card */}
      <Card className="border-slate-200/60 shadow-sm">
        <CardHeader className="pb-3 pt-4 px-5">
          <CardTitle className="text-sm font-medium text-slate-800">Report Filters</CardTitle>
          <CardDescription className="text-xs">Adjust parameters to refine the analytics data.</CardDescription>
        </CardHeader>
        <CardContent className="px-5 pb-5 pt-0">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Service Context</Label>
              <SegmentedPillTabs
                value={mobileMode ? 'mobile' : 'branch'}
                onValueChange={(v) => {
                  setMobileMode(v === 'mobile');
                  setBranchId('all');
                }}
                options={[
                  { value: 'branch', label: 'Branch' },
                  { value: 'mobile', label: 'Mobile' },
                ]}
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Time Period</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Today</SelectItem>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!mobileMode && (
              <div className="space-y-1.5">
                <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Location</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map(b => (
                      <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Service / Vehicle</Label>
              <div className="grid grid-cols-2 gap-2">
                <Select value={serviceType} onValueChange={setServiceType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Service" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {availableServices.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={vehicleType} onValueChange={setVehicleType}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Vehicle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {availableVehicles.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      {isEmpty ? (
        <div className="flex flex-col items-center justify-center min-h-[400px] rounded-xl border border-dashed border-slate-200 bg-slate-50/30 p-12 text-center">
          <div className="h-16 w-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-6">
            <Store className="h-8 w-8 text-slate-300" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 italic">No Data Found</h3>
          <p className="text-sm text-slate-500 max-w-sm mt-2 leading-relaxed">
            We couldn't find any records matching your selected filters for this period. Try adjusting your parameters or choosing a different time range.
          </p>
        </div>
      ) : (
        <div className="grid gap-6">
          {reportType === 'revenue' && (
            <Card className="border-slate-200/60 shadow-sm">
              <CardHeader className="p-5">
                <CardTitle className="text-sm font-medium">Revenue Performance</CardTitle>
                <CardDescription className="text-xs">Total earnings calculated from active bookings.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-10">
                 <div className="text-3xl font-semibold text-slate-900">{data ? formatCurrency(data.revenue.total) : '$0'}</div>
                 <p className="mt-1 text-xs text-muted-foreground">Generated from {data?.bookings.total} bookings</p>
              </CardContent>
            </Card>
          )}

        {reportType === 'bookings' && (
           <div className="grid gap-6 lg:grid-cols-2">
             <Card className="border-slate-200/60 shadow-sm">
               <CardHeader className="p-5">
                 <CardTitle className="text-sm font-medium">Booking Volume</CardTitle>
                 <CardDescription className="text-xs">Total count of orders processed.</CardDescription>
               </CardHeader>
               <CardContent className="flex flex-col items-center justify-center py-8">
                  <div className="text-4xl font-semibold text-slate-900">{data?.bookings.total}</div>
                  <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Bookings</p>
               </CardContent>
             </Card>
             <Card className="border-slate-200/60 shadow-sm">
               <CardHeader className="p-5">
                 <CardTitle className="text-sm font-medium">Peak Distribution</CardTitle>
                 <CardDescription className="text-xs">Highest traffic hours during this period.</CardDescription>
               </CardHeader>
               <CardContent className="p-5 pt-0">
                 <div className="space-y-1.5">
                   {data?.utilization.peak_hours.map((h, i) => (
                     <div key={h} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 text-xs">
                       <span className="font-medium text-slate-700">{h}</span>
                       <Badge variant={i === 0 ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                         {i === 0 ? 'Peak' : 'Normal'}
                       </Badge>
                     </div>
                   ))}
                 </div>
               </CardContent>
             </Card>
           </div>
        )}

        {reportType === 'slots' && (
          <Card className="border-slate-200/60 shadow-sm">
            <CardHeader className="p-5">
              <CardTitle className="text-sm font-medium">Slot Utilisation</CardTitle>
              <CardDescription className="text-xs">Breakdown of time window efficiency.</CardDescription>
            </CardHeader>
            <CardContent className="p-5 pt-0 space-y-5">
              <div className="grid gap-6 md:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">High Demand Slots</Label>
                  <div className="space-y-1.5">
                    {data?.utilization.peak_hours.map(h => (
                      <div key={h} className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-slate-600 w-10">{h}</span>
                        <Progress value={100} className="h-1" />
                        <span className="text-[10px] font-semibold text-slate-900">100%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Underutilised Slots</Label>
                  <div className="space-y-1.5">
                    {data?.utilization.idle_hours.slice(0, 3).map(h => (
                      <div key={h} className="flex items-center gap-2">
                        <span className="text-[10px] font-medium text-slate-600 w-10">{h}</span>
                        <Progress value={30} className="h-1" />
                        <span className="text-[10px] font-semibold text-slate-400">30%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {reportType === 'promos' && (
          <Card className="border-slate-200/60 shadow-sm">
            <CardHeader className="p-5">
              <CardTitle className="text-sm font-medium">Promotion Performance</CardTitle>
              <CardDescription className="text-xs">Usage statistics for active campaign codes.</CardDescription>
            </CardHeader>
            <CardContent className="p-0 border-t border-slate-100">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 text-xs h-10">Code</TableHead>
                    <TableHead className="text-center text-xs h-10">Usage</TableHead>
                    <TableHead className="text-right pr-5 text-xs h-10">Total Discount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data && Object.entries(data.promo.usage).map(([code, stats]) => (
                    <TableRow key={code} className="hover:bg-slate-50/50">
                      <TableCell className="pl-5 py-2.5 text-xs font-medium">{code}</TableCell>
                      <TableCell className="text-center py-2.5 text-xs">{stats.count} uses</TableCell>
                      <TableCell className="text-right pr-5 py-2.5 text-xs font-medium">{formatCurrency(stats.discount)}</TableCell>
                    </TableRow>
                  ))}
                  {(!data || Object.keys(data.promo.usage).length === 0) && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-6 text-xs text-muted-foreground">
                        No promotion data found for this period.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {reportType === 'payments' && (
           <div className="grid gap-6 lg:grid-cols-2">
             <Card className="border-slate-200/60 shadow-sm">
               <CardHeader className="p-5">
                 <CardTitle className="text-sm font-medium">Payment Methods</CardTitle>
                 <CardDescription className="text-xs">Distribution across available gateways.</CardDescription>
               </CardHeader>
               <CardContent className="p-5 pt-0">
                 <div className="h-[200px]">
                   <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={Object.entries(data?.payment.methods || {}).map(([name, value]) => ({ name, value }))}
                          cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={2} dataKey="value"
                        >
                          {Object.keys(data?.payment.methods || {}).map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                        <Legend verticalAlign="bottom" height={36} wrapperStyle={{ fontSize: '10px' }}/>
                      </PieChart>
                   </ResponsiveContainer>
                 </div>
               </CardContent>
             </Card>
             <Card className="border-slate-200/60 shadow-sm">
               <CardHeader className="p-5">
                 <CardTitle className="text-sm font-medium">Breakdown Details</CardTitle>
                 <CardDescription className="text-xs">Relative percentages of each method.</CardDescription>
               </CardHeader>
               <CardContent className="p-5 pt-0 space-y-3">
                 {Object.entries(data?.payment.methods || {}).map(([name, count]) => {
                   const total = Object.values(data?.payment.methods || {}).reduce((a, b) => a + b, 0);
                   const pct = total === 0 ? 0 : Math.round((count / total) * 100);
                   return (
                     <div key={name} className="space-y-1">
                       <div className="flex justify-between text-[10px] font-medium">
                         <span className="text-slate-600 uppercase tracking-tight">{name}</span>
                         <span>{pct}%</span>
                       </div>
                       <Progress value={pct} className="h-1" />
                     </div>
                   );
                 })}
               </CardContent>
             </Card>
           </div>
        )}

        {reportType === 'washers' && (
           <Card className="border-slate-200/60 shadow-sm">
             <CardHeader className="p-5">
               <CardTitle className="text-sm font-medium">{mobileMode ? 'Driver' : 'Washer'} Performance</CardTitle>
               <CardDescription className="text-xs">Number of services completed by each staff member.</CardDescription>
             </CardHeader>
             <CardContent className="p-0 border-t border-slate-100">
               <Table>
                 <TableHeader>
                   <TableRow className="hover:bg-transparent">
                     <TableHead className="pl-5 text-xs h-10">Staff Member</TableHead>
                     <TableHead className="text-right pr-5 text-xs h-10">Jobs Completed</TableHead>
                   </TableRow>
                 </TableHeader>
                 <TableBody>
                   {Object.entries(data?.washer_performance || {}).map(([name, count]) => (
                     <TableRow key={name} className="hover:bg-slate-50/50">
                       <TableCell className="pl-5 py-2.5 text-xs font-medium">{name}</TableCell>
                       <TableCell className="text-right pr-5 py-2.5 text-xs font-medium text-slate-900">{count}</TableCell>
                     </TableRow>
                   ))}
                   {(!data || Object.keys(data.washer_performance).length === 0) && (
                     <TableRow>
                       <TableCell colSpan={2} className="text-center py-6 text-xs text-muted-foreground">
                         No performance data recorded.
                       </TableCell>
                     </TableRow>
                   )}
                 </TableBody>
               </Table>
             </CardContent>
           </Card>
        )}

        {reportType === 'sources' && (
          <div className="grid gap-6 lg:grid-cols-2">
             <Card className="border-slate-200/60 shadow-sm">
               <CardHeader className="p-5">
                 <CardTitle className="text-sm font-medium">Acquisition Channels</CardTitle>
                 <CardDescription className="text-xs">Comparison between online and physical entry points.</CardDescription>
               </CardHeader>
               <CardContent className="flex flex-col items-center justify-center py-8 gap-6">
                 <div className="flex gap-10 text-center">
                    <div>
                      <div className="text-3xl font-semibold text-slate-900">
                        {data?.bookings.total ? Math.round((data?.source.online || 0) / data.bookings.total * 100) : 0}%
                      </div>
                      <div className="text-[10px] font-medium text-muted-foreground mt-1 uppercase">Online</div>
                    </div>
                    <div>
                      <div className="text-3xl font-semibold text-slate-300">
                        {data?.bookings.total ? Math.round((data?.source.walk_in || 0) / data.bookings.total * 100) : 0}%
                      </div>
                      <div className="text-[10px] font-medium text-muted-foreground mt-1 uppercase">Walk-in</div>
                    </div>
                 </div>
                 <div className="w-full max-w-xs">
                    <Progress value={data?.bookings.total ? (data?.source.online || 0) / data.bookings.total * 100 : 0} className="h-1" />
                 </div>
               </CardContent>
             </Card>
             <Card className="border-slate-200/60 shadow-sm">
               <CardHeader className="p-5">
                 <CardTitle className="text-sm font-medium">Strategic Summary</CardTitle>
                 <CardDescription className="text-xs">Observations based on channel data.</CardDescription>
               </CardHeader>
               <CardContent className="p-5 pt-0 space-y-3">
                 <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-600 border border-slate-100">
                   <strong>Growth:</strong> Online bookings represent {data?.bookings.total ? Math.round((data?.source.online || 0) / data.bookings.total * 100) : 0}% of volume.
                 </div>
                 <div className="rounded-lg border border-slate-100 p-3 text-xs text-slate-500">
                   <strong>Operations:</strong> Walk-in traffic accounted for {data?.source.walk_in || 0} orders.
                 </div>
               </CardContent>
             </Card>
          </div>
        )}
      </div>
      )}
    </div>
  );
}
