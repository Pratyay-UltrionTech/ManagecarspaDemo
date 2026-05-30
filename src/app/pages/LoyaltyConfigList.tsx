import { BranchPicker } from '../components/BranchPicker';

export default function LoyaltyConfigList() {
  return (
    <BranchPicker
      title="Configure loyalty"
      description='Set spend slabs and free rewards per branch. Spend totals use only services with "Count price toward loyalty" checked; every service can be chosen as a reward.'
      actionLabel="Configure loyalty"
      basePath="loyalty"
    />
  );
}
