import { BranchPicker } from '../components/BranchPicker';

export default function PromotionsList() {
  return (
    <BranchPicker
      title="Promotions"
      description="Promo codes and usage rules are stored per branch only."
      actionLabel="Add / edit promo codes"
      basePath="promotions"
    />
  );
}
