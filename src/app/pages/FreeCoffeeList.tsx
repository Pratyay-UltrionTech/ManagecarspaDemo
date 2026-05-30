import { BranchPicker } from '../components/BranchPicker';

export default function FreeCoffeeList() {
  return (
    <BranchPicker
      title="Configure free coffee rules"
      description="Rules for complimentary coffee or vouchers are independent per branch."
      actionLabel="Edit free coffee rules"
      basePath="free-coffee"
    />
  );
}
