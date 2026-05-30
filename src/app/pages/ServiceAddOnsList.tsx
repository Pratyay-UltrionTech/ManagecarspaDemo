import { BranchPicker } from '../components/BranchPicker';

export default function ServiceAddOnsList() {
  return (
    <BranchPicker
      title="Create add-ons"
      description=""
      actionLabel="Edit add-ons"
      basePath="service-addons"
    />
  );
}
