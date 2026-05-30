import { useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useBranchStore } from '../hooks/useBranchStore';
import { branchStoreApi, listLoyaltyRewardServiceOptions } from '../lib/branchStore';
import { LoyaltyProgramEditor } from '../components/LoyaltyProgramEditor';

export default function LoyaltyConfigBranchPage() {
  const { branchId } = useParams<{ branchId: string }>();
  const { branches, updateBranchData, getData } = useBranchStore();
  const branch = useMemo(() => branches.find((b) => b.id === branchId), [branches, branchId]);
  const data = branchId ? getData(branchId) : null;

  const serviceOptions = useMemo(
    () => (data ? listLoyaltyRewardServiceOptions(data) : []),
    [data]
  );

  if (!branchId || !branch || !data) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-blue-100/80 bg-blue-50/30 px-6 py-10 text-center">
        <p className="text-sm font-medium text-foreground">Branch not found.</p>
        <Link
          to="/loyalty"
          className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900 hover:underline"
        >
          <ArrowLeft className="size-4" />
          Back to branches
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-2">


      <LoyaltyProgramEditor
        serviceOptions={serviceOptions}
        value={data.loyaltyProgram}
        onChange={(next) => updateBranchData(branchId, (d) => ({ ...d, loyaltyProgram: next }))}
        generateTierId={() => branchStoreApi.generateLoyaltyTierId()}
      />
    </div>
  );
}
