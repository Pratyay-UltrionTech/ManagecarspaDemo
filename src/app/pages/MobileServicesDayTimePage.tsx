import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useMobileServicesStore } from '../hooks/useMobileServicesStore';
import { MobileServicesDayPricingTab } from '../components/MobileServicesDayPricingTab';

const MOBILE_SERVICES = '/mobile-services/services';

export default function MobileServicesDayTimePage() {
  const {
    vehicleCatalog,
    dayTimePricing,
    saveMobileDayRule,
    deleteMobileDayRule,
    deletePendingByKey,
    deleteErrorByKey,
    catalogReady,
  } = useMobileServicesStore();

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-2">
      {!catalogReady && vehicleCatalog.length === 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
          <svg className="h-4 w-4 animate-spin shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Loading service catalog…
        </div>
      ) : null}
      <MobileServicesDayPricingTab
        vehicleCatalog={vehicleCatalog}
        dayTimePricing={dayTimePricing}
        saveMobileDayRule={saveMobileDayRule}
        deleteMobileDayRule={deleteMobileDayRule}
        deletePendingByKey={deletePendingByKey}
        deleteErrorByKey={deleteErrorByKey}
      />
    </div>
  );
}
