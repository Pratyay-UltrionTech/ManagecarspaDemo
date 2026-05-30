import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useBranchStore } from '../hooks/useBranchStore';
import { branchStoreApi, type FreeCoffeeRule } from '../lib/branchStore';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

export default function FreeCoffeeDetail() {
  const { confirm, dialog } = useConfirmDialog();
  const { branchId } = useParams<{ branchId: string }>();
  const { branches, updateBranchData, getData } = useBranchStore();
  const branch = useMemo(() => branches.find((b) => b.id === branchId), [branches, branchId]);
  const data = branchId ? getData(branchId) : null;

  const [kind, setKind] = useState<'on_service' | 'after_n_services'>('on_service');
  const [serviceName, setServiceName] = useState('');
  const [servicesCount, setServicesCount] = useState(5);
  const [notes, setNotes] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  if (!branchId || !branch || !data) {
    return (
      <div className="text-gray-600">
        <p>Branch not found.</p>
        <Link to="/free-coffee" className="text-blue-600 underline mt-2 inline-block">
          Back to free coffee rules
        </Link>
      </div>
    );
  }

  const saveRule = () => {
    const id = editingId ?? branchStoreApi.generateCoffeeId();
    const rule: FreeCoffeeRule = {
      id,
      kind,
      notes: notes.trim(),
      ...(kind === 'on_service'
        ? { serviceName: serviceName.trim() || undefined }
        : { servicesCount: Math.max(1, Number(servicesCount) || 1) }),
    };
    if (kind === 'on_service' && !rule.serviceName) return;

    updateBranchData(branchId, (d) => {
      const rest = d.freeCoffeeRules.filter((x) => x.id !== id);
      return { ...d, freeCoffeeRules: [...rest, rule] };
    });
    setKind('on_service');
    setServiceName('');
    setServicesCount(5);
    setNotes('');
    setEditingId(null);
  };

  const edit = (r: FreeCoffeeRule) => {
    setEditingId(r.id);
    setKind(r.kind);
    setServiceName(r.serviceName ?? '');
    setServicesCount(r.servicesCount ?? 5);
    setNotes(r.notes);
  };

  const remove = async (id: string) => {
    const ok = await confirm({
      title: 'Delete free coffee rule?',
      description: 'Delete this free coffee rule?',
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    updateBranchData(branchId, (d) => ({
      ...d,
      freeCoffeeRules: d.freeCoffeeRules.filter((x) => x.id !== id),
    }));
    if (editingId === id) {
      setEditingId(null);
      setKind('on_service');
      setServiceName('');
      setServicesCount(5);
      setNotes('');
    }
  };

  return (
    <div className="space-y-8 max-w-3xl">
      {dialog}
      <div>
        <Link
          to="/free-coffee"
          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          All branches
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Free coffee rules — {branch.name}</h1>
        <p className="text-gray-500 font-mono text-sm mt-1">{branch.id}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{editingId ? 'Edit rule' : 'Add rule'}</CardTitle>
          <CardDescription>
            Free coffee on a specific service, or a voucher after a number of completed services — for
            this branch only.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2 max-w-xs">
            <Label>Rule type</Label>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as 'on_service' | 'after_n_services')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="on_service">Free coffee on a service</SelectItem>
                <SelectItem value="after_n_services">Voucher after N services</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {kind === 'on_service' ? (
            <div className="space-y-2">
              <Label>Service name</Label>
              <Input
                value={serviceName}
                onChange={(e) => setServiceName(e.target.value)}
                placeholder="e.g. Premium wash"
              />
            </div>
          ) : (
            <div className="space-y-2 max-w-xs">
              <Label>Number of services before voucher</Label>
              <Input
                type="number"
                min={1}
                value={servicesCount}
                onChange={(e) => setServicesCount(Number(e.target.value))}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional details for staff"
              rows={3}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={saveRule} className="gap-1">
              <Plus className="w-4 h-4" />
              {editingId ? 'Update' : 'Save'} rule
            </Button>
            {editingId && (
              <Button
                variant="outline"
                onClick={() => {
                  setEditingId(null);
                  setKind('on_service');
                  setServiceName('');
                  setServicesCount(5);
                  setNotes('');
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {data.freeCoffeeRules.length === 0 ? (
        <p className="text-sm text-gray-500">No free coffee rules for this branch yet.</p>
      ) : (
        <ul className="space-y-3">
          {data.freeCoffeeRules.map((r) => (
            <li
              key={r.id}
              className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col sm:flex-row sm:justify-between gap-3"
            >
              <div>
                <p className="font-semibold text-gray-900">
                  {r.kind === 'on_service'
                    ? `Coffee on service: ${r.serviceName}`
                    : `Voucher after ${r.servicesCount} services`}
                </p>
                {r.notes && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{r.notes}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => edit(r)}>
                  Edit
                </Button>
                <Button variant="ghost" size="sm" onClick={() => remove(r.id)}>
                  <Trash2 className="w-4 h-4 text-red-600" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
