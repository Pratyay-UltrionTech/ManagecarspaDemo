import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { MobileServicesTeamTab } from '../components/MobileServicesTeamTab';

const MOBILE_SERVICES = '/mobile-services/services';

export default function MobileServicesTeamPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-2">


      <MobileServicesTeamTab />
    </div>
  );
}
