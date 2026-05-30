import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useBranchStore } from '../hooks/useBranchStore';
import { branchStoreApi } from '../lib/branchStore';
import { ServiceCentricCatalogPanel } from '../components/ServiceCentricCatalogPanel';

export default function ServicesBranchPage() {
  const { branchId } = useParams<{ branchId: string }>();
  const {
    branches,
    updateBranchData,
    getData,
    saveBranchVehicleCatalog,
    catalogSavePendingByBranchId,
    catalogSaveErrorByBranchId,
  } = useBranchStore();

  const branch = useMemo(() => branches.find((b) => b.id === branchId), [branches, branchId]);
  const data = branchId ? getData(branchId) : null;

  if (!branchId || !branch || !data) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-slate-200 bg-slate-50 px-6 py-10 text-center">
        <p className="text-sm font-medium text-slate-700">Branch not found.</p>
        <Link
          to="/services"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to branches
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/services"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline"
        >
          <ArrowLeft className="size-4" />
          All branches
        </Link>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{branch.name}</span>
          <span className="mx-1.5 text-slate-300">·</span>
          Service catalog
        </p>
      </div>
      <ServiceCentricCatalogPanel
        blocks={data.vehicleServices}
        onBlocksChange={(blocks) => updateBranchData(branchId, (d) => ({ ...d, vehicleServices: blocks }))}
        onCommitBlocks={(blocks) => saveBranchVehicleCatalog(branchId, blocks)}
        commitPending={catalogSavePendingByBranchId[branchId] === true}
        commitError={catalogSaveErrorByBranchId[branchId] ?? null}
        generateServiceId={() => branchStoreApi.generateServiceId()}
        isBranch
      />
    </div>
  );
}
