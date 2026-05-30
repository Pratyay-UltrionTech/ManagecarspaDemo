import { X, User, Car, Wrench, DollarSign, CreditCard, UserCog, FileText, Clock } from 'lucide-react';
import type { Booking } from '../types/legacy-ui';

function formatPhone(phone: string | undefined | null): string {
  if (!phone) return '—';
  const p = phone.trim();
  if (p.startsWith('+')) return p;
  if (p.startsWith('61')) return `+${p}`;
  if (p.startsWith('0')) return `+61${p.slice(1)}`;
  return `+61${p}`;
}

interface BookingDetailsPanelProps {
  booking: Booking;
  isOpen: boolean;
  onClose: () => void;
}

const statusColors: Record<string, string> = {
  'Scheduled': 'bg-yellow-100 text-yellow-700',
  'Assigned': 'bg-sky-100 text-sky-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Completed': 'bg-green-100 text-green-700',
  'Cancelled': 'bg-red-100 text-red-700',
};

const paymentColors: Record<string, string> = {
  'Paid': 'bg-green-100 text-green-700',
  'Pending': 'bg-orange-100 text-orange-700',
  'Refunded': 'bg-gray-100 text-gray-700',
};

export function BookingDetailsPanel({ booking, isOpen, onClose }: BookingDetailsPanelProps) {
  if (!isOpen) return null;

  const getTimelineProgress = () => {
    const steps = ['Scheduled', 'In Progress', 'Completed'];
    const currentIndex = steps.indexOf(booking.status);
    return currentIndex;
  };

  const timelineProgress = getTimelineProgress();

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity z-40 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      ></div>

      {/* Side Panel */}
      <div className={`fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-xl transform transition-transform duration-300 ease-in-out z-50 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="h-full flex flex-col">
          {/* Header */}
          <div className="bg-blue-500 px-6 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-white">
                Booking Details
              </h3>
              <p className="text-blue-100 text-sm mt-1">{booking.id}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-blue-600 rounded-lg p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content - Scrollable */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Booking Timeline */}
            <div className="bg-gray-50 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Clock className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-gray-800">Booking Timeline</h4>
              </div>
              <div className="relative">
                <div className="flex justify-between items-center">
                  {['Scheduled', 'In Progress', 'Completed'].map((step, index) => (
                    <div key={step} className="flex flex-col items-center flex-1">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm mb-2 ${
                        booking.status === 'Cancelled' 
                          ? 'bg-gray-200 text-gray-500'
                          : index <= timelineProgress 
                          ? 'bg-blue-500 text-white' 
                          : 'bg-gray-200 text-gray-500'
                      }`}>
                        {index + 1}
                      </div>
                      <span className={`text-xs font-medium ${
                        booking.status === 'Cancelled'
                          ? 'text-gray-400'
                          : index <= timelineProgress 
                          ? 'text-blue-600' 
                          : 'text-gray-500'
                      }`}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
                {/* Progress Line */}
                <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200 -z-10" style={{ left: '5%', right: '5%' }}>
                  <div 
                    className={`h-full ${booking.status === 'Cancelled' ? 'bg-gray-300' : 'bg-blue-500'} transition-all duration-500`}
                    style={{ width: `${(timelineProgress / 2) * 100}%` }}
                  ></div>
                </div>
              </div>
              {booking.status === 'Cancelled' && (
                <div className="mt-4 p-3 bg-red-50 rounded-lg">
                  <p className="text-sm text-red-700 font-medium">This booking has been cancelled</p>
                </div>
              )}
            </div>

            {/* Current Status */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-2">Current Status</p>
                <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${statusColors[booking.status]}`}>
                  {booking.status}
                </span>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-500 mb-2">Payment Status</p>
                <span className={`px-3 py-1.5 inline-flex text-sm font-semibold rounded-full ${paymentColors[booking.paymentStatus]}`}>
                  {booking.paymentStatus}
                </span>
              </div>
            </div>

            {/* Customer Info */}
            <div className="bg-gray-50 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-gray-800">Customer Information</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium text-gray-900">{booking.customerName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">{formatPhone(booking.phone)}</p>
                </div>
                {booking.customerEmail && (
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">{booking.customerEmail}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Vehicle Info */}
            <div className="bg-gray-50 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Car className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-gray-800">Vehicle Details</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Model</p>
                  <p className="font-medium text-gray-900">{booking.vehicleModel || booking.vehicle}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">License Plate</p>
                  <p className="font-medium text-gray-900">{booking.licensePlate}</p>
                </div>
                {booking.vehicleColor && (
                  <div>
                    <p className="text-sm text-gray-500">Color</p>
                    <p className="font-medium text-gray-900">{booking.vehicleColor}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Service Details */}
            <div className="bg-gray-50 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Wrench className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-gray-800">Service Details</h4>
              </div>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Selected Service</p>
                  <p className="font-medium text-gray-900 text-lg">{booking.service}</p>
                </div>
                
                {booking.addOns && booking.addOns.length > 0 && (
                  <div>
                    <p className="text-sm text-gray-500 mb-2">Add-ons</p>
                    <div className="flex flex-wrap gap-2">
                      {booking.addOns.map((addon, index) => (
                        <span key={index} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                          {addon}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <p className="text-sm text-gray-500">Location</p>
                    <p className="font-medium text-gray-900">{booking.location}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Date & Time</p>
                    <p className="font-medium text-gray-900">{booking.date} at {booking.time}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Price Breakdown */}
            {booking.priceBreakdown && (
              <div className="bg-gray-50 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <DollarSign className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-gray-800">Price Breakdown</h4>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Service</span>
                    <span className="font-medium text-gray-900">${booking.priceBreakdown.service.toFixed(2)}</span>
                  </div>
                  {booking.priceBreakdown.addOns > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Add-ons</span>
                      <span className="font-medium text-gray-900">${booking.priceBreakdown.addOns.toFixed(2)}</span>
                    </div>
                  )}
                  {booking.priceBreakdown.tax > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Tax</span>
                      <span className="font-medium text-gray-900">${booking.priceBreakdown.tax.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="border-t border-gray-300 pt-3 flex justify-between">
                    <span className="font-semibold text-gray-800">Total</span>
                    <span className="font-bold text-gray-900 text-xl">${booking.priceBreakdown.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Assigned Staff */}
            <div className="bg-gray-50 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <UserCog className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-gray-800">Assigned Staff</h4>
              </div>
              <p className="font-medium text-gray-900 text-lg">{booking.assignedStaff}</p>
            </div>

            {/* Notes */}
            {booking.notes && (
              <div className="bg-gray-50 rounded-lg p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <h4 className="font-semibold text-gray-800">Notes</h4>
                </div>
                <p className="text-gray-700 leading-relaxed">{booking.notes}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 px-6 py-4 bg-gray-50">
            <div className="flex justify-end gap-3">
              <button
                onClick={onClose}
                className="px-5 py-2.5 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors font-medium"
              >
                Close
              </button>
              <button
                className="px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
              >
                Edit Booking
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
