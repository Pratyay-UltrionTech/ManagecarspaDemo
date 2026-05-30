import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { useMobileServicesStore } from '../hooks/useMobileServicesStore';
import { MobileServicesPromoTab } from '../components/MobileServicesPromoTab';

const MOBILE_SERVICES = '/mobile-services/services';

export default function MobileServicesPromoCodesPage() {
  const {
    vehicleCatalog,
    promotions,
    updateMobilePromotions,
    saveMobilePromotion,
    deleteMobilePromotion,
    deletePendingByKey,
    deleteErrorByKey,
  } = useMobileServicesStore();

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-2">


      <MobileServicesPromoTab
        vehicleCatalog={vehicleCatalog}
        promotions={promotions}
        updateMobilePromotions={updateMobilePromotions}
        saveMobilePromotion={saveMobilePromotion}
        deleteMobilePromotion={deleteMobilePromotion}
        deletePendingByKey={deletePendingByKey}
        deleteErrorByKey={deleteErrorByKey}
      />
    </div>
  );
}
