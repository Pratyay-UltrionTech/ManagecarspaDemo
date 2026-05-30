import { BranchPicker } from '../components/BranchPicker';

export default function DayTimePricingList() {
  return (
    <BranchPicker
      title="Day / time based pricing"
      description="Set different prices or coupons by day, time window, and vehicle type — only for the selected branch."
      actionLabel="Edit day/time pricing"
      basePath="day-time-pricing"
    />
  );
}
