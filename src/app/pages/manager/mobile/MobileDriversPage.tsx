import { useMemo } from 'react';
import { useMobileManagerSession } from '../../../hooks/useMobileManagerSession';
import { useMobileServicesStore } from '../../../hooks/useMobileServicesStore';
import { isValidPinCode, normalizePinCode } from '../../../lib/mobileServicesStore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../../components/ui/table';
import { cn } from '../../../components/ui/utils';

function formatZipList(zips: string[]): string {
  if (!zips.length) return '—';
  return zips.join(', ');
}

export default function MobileDriversPage() {
  const { session } = useMobileManagerSession();
  const { staff } = useMobileServicesStore();
  const pin = session?.cityPinCode ? normalizePinCode(session.cityPinCode) : '';

  const drivers = useMemo(
    () =>
      staff
        .filter((s) => normalizePinCode(s.cityPinCode) === pin)
        .sort((a, b) => (a.empName || '').localeCompare(b.empName || '', undefined, { sensitivity: 'base' })),
    [staff, pin]
  );

  if (!session || !isValidPinCode(pin)) return null;

  const cell =
    'max-w-[14rem] min-w-[7rem] align-middle break-words px-3 py-3 text-sm sm:px-4 [&:first-child]:pl-4 [&:last-child]:pr-4';

  return (
    <div className="min-w-0 space-y-6">
      <h1 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">Drivers</h1>

      <Card className="overflow-x-auto rounded-2xl border border-slate-200/70 bg-card shadow-sm shadow-slate-900/[0.03]">
        <CardHeader className="border-b border-slate-100 bg-slate-50/40 px-4 py-4 sm:px-6 sm:py-5">
          <CardTitle className="text-base font-semibold text-foreground">Drivers</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-0">
          {drivers.length === 0 ? (
            <p className="px-6 py-10 text-center text-sm text-muted-foreground">
              No drivers yet. Ask admin to add mobile staff under Mobile services → Staff.
            </p>
          ) : (
            <div className="overflow-x-auto overscroll-x-contain">
              <Table className="min-w-[52rem] border-collapse">
                <TableHeader>
                  <TableRow className="border-b border-slate-200 bg-slate-50/95 hover:bg-slate-50/95">
                    <TableHead className={cn(cell, 'whitespace-nowrap font-semibold text-foreground')}>Name</TableHead>
                    <TableHead className={cn(cell, 'whitespace-nowrap font-semibold text-foreground')}>Status</TableHead>
                    <TableHead className={cn(cell, 'min-w-[12rem] font-semibold text-foreground')}>Address</TableHead>
                    <TableHead className={cn(cell, 'min-w-[11rem] font-semibold text-foreground')}>Serviceable ZIPs</TableHead>
                    <TableHead className={cn(cell, 'min-w-[10rem] font-semibold text-foreground')}>Email</TableHead>
                    <TableHead className={cn(cell, 'whitespace-nowrap font-semibold text-foreground')}>Mobile</TableHead>
                    <TableHead className={cn(cell, 'whitespace-nowrap font-semibold text-foreground')}>DOJ</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drivers.map((d, i) => (
                    <TableRow
                      key={d.id}
                      className={cn(
                        'border-b border-slate-100 transition-colors hover:bg-slate-50/60',
                        i % 2 === 1 && 'bg-slate-50/35'
                      )}
                    >
                      <TableCell className={cn(cell, 'font-medium text-foreground')}>{d.empName?.trim() || '—'}</TableCell>
                      <TableCell className={cell}>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                            d.active ? 'bg-emerald-600 text-white' : 'bg-slate-500 text-white'
                          )}
                        >
                          {d.active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell className={cn(cell, 'text-foreground')}>
                        <span className="whitespace-pre-wrap">{d.address?.trim() || '—'}</span>
                      </TableCell>
                      <TableCell className={cn(cell, 'text-foreground')}>{formatZipList(d.serviceableZipCodes)}</TableCell>
                      <TableCell className={cn(cell, 'break-all text-foreground')}>{d.email?.trim() || '—'}</TableCell>
                      <TableCell className={cn(cell, 'tabular-nums text-foreground')}>
                        {d.mobile?.trim() || '—'}
                      </TableCell>
                      <TableCell className={cn(cell, 'tabular-nums text-foreground')}>{d.doj?.trim() || '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
