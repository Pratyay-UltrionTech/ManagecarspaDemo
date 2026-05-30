import { useMemo } from 'react';
import { useMobileServicesStore } from '../hooks/useMobileServicesStore';
import { listLoyaltyRewardMobileServiceOptions, mobileServicesStoreApi } from '../lib/mobileServicesStore';
import { LoyaltyProgramEditor } from '../components/LoyaltyProgramEditor';

export default function MobileServicesLoyaltyPage() {
  const { vehicleCatalog, loyaltyProgram, updateLoyaltyProgram } = useMobileServicesStore();

  const serviceOptions = useMemo(
    () => listLoyaltyRewardMobileServiceOptions(vehicleCatalog),
    [vehicleCatalog]
  );

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-2">


      <LoyaltyProgramEditor
        serviceOptions={serviceOptions}
        value={loyaltyProgram}
        onChange={(next) => updateLoyaltyProgram(() => next)}
        generateTierId={() => mobileServicesStoreApi.generateLoyaltyTierId()}
      />
    </div>
  );
}
