import { useMemo, useState } from 'react';
import { useBranchStore } from '../hooks/useBranchStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Button } from '../components/ui/button';

type ServiceRecord = {
  id: string;
  customerName: string;
  serviceName: string;
  branchId: string;
  branchName: string;
  zipcode: string;
  date: string;
  startTime: string;
  endTime: string;
  status: string;
  phone: string;
  address: string;
  amount: number;
};

export default function ServiceHistoryPage() {
  const { branches, getData } = useBranchStore();
  const [branch, setBranch] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [zipcode, setZipcode] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const allRecords = useMemo(() => {
    const rows: ServiceRecord[] = [];
    for (const b of branches) {
      const data = getData(b.id);
      for (const booking of data.branchBookings) {
        rows.push({
          id: booking.id,
          customerName: booking.customerName,
          serviceName: booking.serviceSummary,
          branchId: b.id,
          branchName: b.name,
          zipcode: b.zipCode,
          date: booking.slotDate,
          startTime: booking.startTime,
          endTime: booking.endTime,
          status: booking.status,
          phone: booking.phone,
          address: booking.address,
          amount: 0,
        });
      }
    }
    return rows.sort((a, b) => `${b.date}${b.startTime}`.localeCompare(`${a.date}${a.startTime}`));
  }, [branches]);

  const records = useMemo(() => {
    return allRecords.filter((record) => {
      const matchesBranch = branch === 'all' || record.branchId === branch;
      const matchesFrom = !fromDate || record.date >= fromDate;
      const matchesTo = !toDate || record.date <= toDate;
      const matchesZip = !zipcode.trim() || record.zipcode.includes(zipcode.trim());
      return matchesBranch && matchesFrom && matchesTo && matchesZip;
    });
  }, [allRecords, branch, fromDate, toDate, zipcode]);

  const selected = selectedId ? records.find((r) => r.id === selectedId) ?? null : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Service history</h1>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
          View all bookings across branches and filter by branch, date range, and zipcode.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Use one or more filters to narrow down booking history.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="space-y-2">
            <Label>Branch</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
            >
              <option value="all">All branches</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="from-date">From date</Label>
            <Input id="from-date" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="to-date">To date</Label>
            <Input id="to-date" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="zipcode-filter">Zipcode</Label>
            <Input
              id="zipcode-filter"
              value={zipcode}
              onChange={(e) => setZipcode(e.target.value)}
              placeholder="Enter zipcode"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Customer services record</CardTitle>
          <CardDescription>{records.length} record(s) found.</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Zipcode</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground">
                    No records match selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                records.map((record) => (
                  <TableRow key={record.id}>
                    <TableCell>{record.date}</TableCell>
                    <TableCell>
                      {record.startTime} - {record.endTime}
                    </TableCell>
                    <TableCell>{record.customerName}</TableCell>
                    <TableCell>{record.serviceName}</TableCell>
                    <TableCell>{record.branchName}</TableCell>
                    <TableCell>{record.status}</TableCell>
                    <TableCell>{record.zipcode}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedId((prev) => (prev === record.id ? null : record.id))}
                      >
                        {selectedId === record.id ? 'Hide' : 'View'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {selected ? (
        <Card>
          <CardHeader>
            <CardTitle>Booking details</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
            <div><strong>ID:</strong> {selected.id}</div>
            <div><strong>Customer:</strong> {selected.customerName}</div>
            <div><strong>Phone:</strong> {selected.phone || '—'}</div>
            <div><strong>Status:</strong> {selected.status}</div>
            <div><strong>Date:</strong> {selected.date}</div>
            <div><strong>Time:</strong> {selected.startTime} - {selected.endTime}</div>
            <div className="sm:col-span-2"><strong>Address:</strong> {selected.address || '—'}</div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
