import { ServiceCentricCatalogPanel } from '../components/ServiceCentricCatalogPanel';
import { useMobileServicesStore } from '../hooks/useMobileServicesStore';
import { mobileServicesStoreApi } from '../lib/mobileServicesStore';

export default function MobileServicesServicesPage() {
  const { vehicleCatalog, updateVehicleCatalog, saveVehicleCatalog, catalogSavePending, catalogSaveError } = useMobileServicesStore();
  const { generateServiceId } = mobileServicesStoreApi;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Services</h1>
      </div>
      <ServiceCentricCatalogPanel
        blocks={vehicleCatalog}
        onBlocksChange={updateVehicleCatalog}
        onCommitBlocks={saveVehicleCatalog}
        commitPending={catalogSavePending}
        commitError={catalogSaveError}
        generateServiceId={generateServiceId}
        isBranch={false}
      />
    </div>
  );
}
