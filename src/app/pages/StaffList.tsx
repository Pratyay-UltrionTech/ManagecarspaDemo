import { BranchPicker } from '../components/BranchPicker';

export default function StaffList() {
  return (
    <BranchPicker
      title="Branch Staff"
      description=""
      actionLabel="Edit / add branch staff"
      basePath="staff"
    />
  );
}
