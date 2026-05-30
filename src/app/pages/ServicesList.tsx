import { BranchPicker } from '../components/BranchPicker';

export default function ServicesList() {
  return (
    <BranchPicker
      title="Branch Services"
      description="Select a branch to create and edit wash packages for that location."
      actionLabel="Edit / add branch services"
      basePath="services"
    />
  );
}
