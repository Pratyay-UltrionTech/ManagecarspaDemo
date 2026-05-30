import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from './ui/button';
import PriceInput from './PriceInput';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface VehicleVariant {
  id: string;
  vehicle: string;
  price: string;
  freeCoffee: number;
  loyaltyCounted: boolean;
  recommended: boolean;
  active: boolean;
}

const STORAGE_KEY = 'car_wash_services';

export function CreateServiceForm() {
  const [name, setName] = useState('');
  const [baseDuration, setBaseDuration] = useState('60');
  const [description, setDescription] = useState('');
  const [serviceCategory, setServiceCategory] = useState<'Washing' | 'Detailing'>('Washing');
  const [variants, setVariants] = useState<VehicleVariant[]>([]);
  const [error, setError] = useState('');
  const [vehicleTypeInput, setVehicleTypeInput] = useState('');
  const [vehicleTypes, setVehicleTypes] = useState<string[]>(['Sedan', 'SUV', 'Hatchback']);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Listen for edit requests from SavedServicesTable
  useState(() => {
    const handleEditRequest = (e: any) => {
      const service = e.detail;
      if (service) {
        setEditingId(service.id);
        setName(service.name);
        setServiceCategory((service.category || service.type) as 'Washing' | 'Detailing');
        setBaseDuration(service.baseDuration || '60');
        setDescription(service.description || '');
        
        // Map variants back to form state
        if (service.fullVariants) {
          setVariants(service.fullVariants);
        } else {
          // Fallback for old data: create one variant if possible
          setVariants([{
            id: Date.now().toString(),
            vehicle: service.vehicleTypes[0] || 'Sedan',
            price: String(service.startingPrice),
            freeCoffee: service.freeCoffees || 0,
            loyaltyCounted: service.loyalty || false,
            recommended: service.recommended || false,
            active: service.active || true,
          }]);
        }
        
        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    };

    window.addEventListener('editServiceRequested' as any, handleEditRequest);
    return () => window.removeEventListener('editServiceRequested' as any, handleEditRequest);
  });

  const handleAddVariant = () => {
    const newVariant: VehicleVariant = {
      id: Date.now().toString(),
      vehicle: '',
      price: '',
      freeCoffee: 0,
      loyaltyCounted: false,
      recommended: false,
      active: true,
    };
    setVariants([...variants, newVariant]);
  };

  const handleRemoveVariant = (id: string) => {
    setVariants(variants.filter(v => v.id !== id));
  };

  const handleVariantChange = (id: string, field: string, value: any) => {
    setVariants(variants.map(v => 
      v.id === id ? { ...v, [field]: value } : v
    ));
  };

  const handleAddVehicleType = () => {
    if (vehicleTypeInput.trim() && !vehicleTypes.includes(vehicleTypeInput.trim())) {
      setVehicleTypes([...vehicleTypes, vehicleTypeInput.trim()]);
      setVehicleTypeInput('');
    }
  };

  const handleRemoveVehicleType = (type: string) => {
    setVehicleTypes(vehicleTypes.filter(v => v !== type));
  };

  const handleSaveService = () => {
    setError('');
    
    // Validation
    if (!name.trim()) {
      setError('Service name is required');
      return;
    }
    if (variants.length === 0) {
      setError('Add at least one vehicle variant');
      return;
    }
    if (variants.some(v => !v.vehicle || parseFloat(v.price) <= 0)) {
      setError('All variants must have a vehicle type and price');
      return;
    }

    // Create/Update service
    const serviceData = {
      id: editingId || Date.now().toString(),
      name: name.trim(),
      category: serviceCategory,
      type: serviceCategory,
      baseDuration,
      description,
      vehicleTypes: variants.map(v => v.vehicle).filter(v => v),
      variants: variants.length,
      startingPrice: Math.min(...variants.map(v => parseFloat(v.price) || 0)),
      freeCoffees: Math.max(...variants.map(v => v.freeCoffee)),
      loyalty: variants.some(v => v.loyaltyCounted),
      recommended: variants.some(v => v.recommended),
      active: true,
      fullVariants: variants, // Store full data for editing
    };

    // Get existing services from localStorage
    const stored = localStorage.getItem(STORAGE_KEY);
    let services = [];
    if (stored) {
      try {
        services = JSON.parse(stored);
      } catch (e) {
        console.error('Failed to parse stored services', e);
      }
    }

    // Add or Update service
    if (editingId) {
      services = services.map((s: any) => s.id === editingId ? serviceData : s);
    } else {
      services.push(serviceData);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(services));

    // Dispatch event to notify SavedServicesTable
    window.dispatchEvent(new Event('servicesUpdated'));

    // Reset form
    setName('');
    setBaseDuration('60');
    setDescription('');
    setServiceCategory('Washing');
    setVariants([]);
    setEditingId(null);
    alert(editingId ? 'Service updated successfully!' : 'Service created successfully!');
  };

  const handleCancelEdit = () => {
    setName('');
    setBaseDuration('60');
    setDescription('');
    setServiceCategory('Washing');
    setVariants([]);
    setEditingId(null);
  };

  return (
    <div className="space-y-6 border border-slate-200 rounded-lg p-6 bg-white shadow-sm">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md text-sm">
          {error}
        </div>
      )}

      {/* Vehicle Types Section */}
      <div className="space-y-3 border border-slate-200 rounded-lg p-4 bg-slate-50">
        <label className="block text-sm font-semibold text-slate-900">Vehicle types</label>
        
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. Sedan, SUV"
            value={vehicleTypeInput}
            onChange={(e) => setVehicleTypeInput(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter') {
                handleAddVehicleType();
              }
            }}
            className="flex-1 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
          <button
            onClick={handleAddVehicleType}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md font-medium text-sm"
          >
            + Add vehicle type
          </button>
        </div>

        {/* Vehicle Type Tags */}
        <div className="flex flex-wrap gap-2">
          {vehicleTypes.map((type) => (
            <div key={type} className="bg-white border border-slate-300 rounded-md px-3 py-1.5 flex items-center gap-2 text-sm">
              <span className="text-slate-700">{type}</span>
              <button
                onClick={() => handleRemoveVehicleType(type)}
                className="text-slate-500 hover:text-slate-700 font-bold text-lg leading-none"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Service Category Dropdown */}
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Service Category
        </label>
        <Select value={serviceCategory} onValueChange={(value) => setServiceCategory(value as 'Washing' | 'Detailing')}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Washing">Washing</SelectItem>
            <SelectItem value="Detailing">Detailing</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Step 1: Create Service */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="text-lg font-semibold text-slate-900">
            {editingId ? 'Step 1: Edit service' : 'Step 1: Create service'}
          </h3>
          {editingId && (
            <Button variant="ghost" size="sm" onClick={handleCancelEdit} className="text-slate-500">
              Cancel Edit
            </Button>
          )}
        </div>
        <p className="text-sm text-slate-600">Name and description apply to every vehicle variant below.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Name
            </label>
            <input
              type="text"
              placeholder="e.g. Express Wash"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Base duration (minutes)
            </label>
            <input
              type="number"
              value={baseDuration}
              onChange={(e) => setBaseDuration(e.target.value)}
              className="w-32 px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-slate-500 mt-1">Snapped to a multiple of 30 (add-ons add 1 30 each at booking).</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Description (one line per point)
            </label>
            <textarea
              placeholder="Quick exterior cleaning&#10;Hand dry finish"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      <hr className="border-slate-200" />

      {/* Step 2: Vehicle Variants */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-slate-900">Step 2: Vehicle variants</h3>
        <p className="text-sm text-slate-600">Set price and options per vehicle for this service.</p>

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <Table>
            <TableHeader>
              <TableRow className="border-b border-slate-200 bg-slate-50/90">
                <TableHead className="text-slate-700">VEHICLE</TableHead>
                <TableHead className="text-slate-700">PRICE</TableHead>
                <TableHead className="text-slate-700">COFFEE</TableHead>
                <TableHead className="text-slate-700">LOYALTY COUNTED</TableHead>
                <TableHead className="text-slate-700">RECOMMENDED</TableHead>
                <TableHead className="text-slate-700">ACTIVE</TableHead>
                <TableHead className="text-slate-700"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {variants.map((variant) => (
                <TableRow key={variant.id} className="border-b border-slate-100">
                  <TableCell>
                    <Select value={variant.vehicle} onValueChange={(value) => handleVariantChange(variant.id, 'vehicle', value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Vehicle" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicleTypes.map((type) => (
                          <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <PriceInput
                      value={variant.price}
                      onChange={(val) => handleVariantChange(variant.id, 'price', val)}
                    />
                  </TableCell>
                  <TableCell>
                    <input
                      type="number"
                      min="0"
                      value={variant.freeCoffee}
                      onChange={(e) => handleVariantChange(variant.id, 'freeCoffee', parseInt(e.target.value) || 0)}
                      className="w-16 px-2 py-1 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleVariantChange(variant.id, 'loyaltyCounted', !variant.loyaltyCounted)}
                      className={`px-3 py-1 rounded-md font-medium text-sm ${
                        variant.loyaltyCounted
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {variant.loyaltyCounted ? '✓' : '✕'}
                    </button>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleVariantChange(variant.id, 'recommended', !variant.recommended)}
                      className={`px-3 py-1 rounded-md font-medium text-sm ${
                        variant.recommended ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {variant.recommended ? '⭐' : '-'}
                    </button>
                  </TableCell>
                  <TableCell>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={variant.active}
                        onChange={() => handleVariantChange(variant.id, 'active', !variant.active)}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                    </label>
                  </TableCell>
                  <TableCell>
                    <button
                      onClick={() => handleRemoveVariant(variant.id)}
                      className="text-red-600 hover:text-red-700 p-1"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={handleAddVariant}
            className="text-slate-700"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add vehicle row
          </Button>
          <Button
            onClick={handleSaveService}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {editingId ? 'Update service' : 'Save service'}
          </Button>
        </div>
      </div>
    </div>
  );
}
