import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Badge } from '../components/ui/badge';

interface RevenueSummary {
  total_revenue: number;
  booking_count: number;
  period: string;
  start_date: string;
  end_date: string;
  filters: {
    branch_id: string | null;
    mobile: boolean;
    service_type: string | null;
    vehicle_type: string | null;
  };
}

export default function RevenueSummaryPage() {
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    branch_id: '',
    mobile: false,
    service_type: '',
    vehicle_type: '',
    period: 'month',
    start_date: '',
    end_date: '',
  });

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.branch_id) params.append('branch_id', filters.branch_id);
      params.append('mobile', filters.mobile.toString());
      if (filters.service_type) params.append('service_type', filters.service_type);
      if (filters.vehicle_type) params.append('vehicle_type', filters.vehicle_type);
      params.append('period', filters.period);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);

      const response = await fetch(`/api/v1/admin/revenue-summary?${params}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch revenue summary:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, []);

  const handleFilterChange = (key: string, value: any) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Revenue Summary</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          View earnings with filters for branch, service type, vehicle type, and time period.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Customize your revenue summary view</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="branch">Branch ID (optional)</Label>
              <Input
                id="branch"
                placeholder="Enter branch ID"
                value={filters.branch_id}
                onChange={(e) => handleFilterChange('branch_id', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="service">Service Type (optional)</Label>
              <Input
                id="service"
                placeholder="e.g., SUV washing"
                value={filters.service_type}
                onChange={(e) => handleFilterChange('service_type', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vehicle">Vehicle Type (optional)</Label>
              <Input
                id="vehicle"
                placeholder="e.g., SUV"
                value={filters.vehicle_type}
                onChange={(e) => handleFilterChange('vehicle_type', e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="period">Time Period</Label>
              <Select value={filters.period} onValueChange={(value) => handleFilterChange('period', value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filters.period === 'custom' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start">Start Date</Label>
                <Input
                  id="start"
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end">End Date</Label>
                <Input
                  id="end"
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="mobile"
              checked={filters.mobile}
              onCheckedChange={(checked) => handleFilterChange('mobile', checked)}
            />
            <Label htmlFor="mobile">Include Mobile Services</Label>
          </div>

          <Button onClick={fetchSummary} disabled={loading}>
            {loading ? 'Loading...' : 'Generate Summary'}
          </Button>
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle>Revenue Summary</CardTitle>
            <CardDescription>
              {filters.mobile ? 'Mobile Services' : 'Branch Services'} • {summary.start_date} to {summary.end_date}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="text-3xl font-bold text-green-600">
                  {formatCurrency(summary.total_revenue)}
                </div>
                <div className="text-sm text-muted-foreground">Total Revenue</div>
              </div>
              <div className="space-y-2">
                <div className="text-3xl font-bold text-blue-600">
                  {summary.booking_count}
                </div>
                <div className="text-sm text-muted-foreground">Completed Bookings</div>
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium">Applied Filters</h4>
              <div className="flex flex-wrap gap-2">
                {summary.filters.branch_id && (
                  <Badge variant="secondary">Branch: {summary.filters.branch_id}</Badge>
                )}
                {summary.filters.service_type && (
                  <Badge variant="secondary">Service: {summary.filters.service_type}</Badge>
                )}
                {summary.filters.vehicle_type && (
                  <Badge variant="secondary">Vehicle: {summary.filters.vehicle_type}</Badge>
                )}
                <Badge variant="secondary">Period: {summary.period}</Badge>
                <Badge variant="secondary">{summary.filters.mobile ? 'Mobile' : 'Branch'}</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}