import { X, User, Car, Calendar, CreditCard, Gift } from 'lucide-react';
import type { Customer } from '../types/legacy-ui';

interface CustomerProfilePanelProps {
  customer: Customer;
  isOpen: boolean;
  onClose: () => void;
}

const mockBookingHistory = [
  { id: 'BK-045', date: '2026-03-22', service: 'Premium Wash', amount: 49.99, status: 'Completed' },
  { id: 'BK-042', date: '2026-03-15', service: 'Basic Wash', amount: 29.99, status: 'Completed' },
  { id: 'BK-038', date: '2026-03-08', service: 'Deluxe Detailing', amount: 149.99, status: 'Completed' },
];

const mockPaymentHistory = [
  { id: 'PAY-123', date: '2026-03-22', amount: 49.99, method: 'Credit Card', status: 'Paid' },
  { id: 'PAY-120', date: '2026-03-15', amount: 29.99, method: 'Cash', status: 'Paid' },
  { id: 'PAY-115', date: '2026-03-08', amount: 149.99, method: 'Credit Card', status: 'Paid' },
];

const mockRewards = [
  { name: 'Free Basic Wash', points: 500, status: 'Available' },
  { name: '10% Discount', points: 300, status: 'Redeemed' },
  { name: 'Free Air Freshener', points: 100, status: 'Available' },
];

export function CustomerProfilePanel({ customer, isOpen, onClose }: CustomerProfilePanelProps) {
  if (!isOpen) return null;

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
                Customer Profile
              </h3>
              <p className="text-blue-100 text-sm mt-1">{customer.id}</p>
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
            {/* Customer Info */}
            <div className="bg-gray-50 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-gray-800">Customer Information</h4>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Name</p>
                  <p className="font-medium text-gray-900">{customer.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <p className="font-medium text-gray-900">{customer.phone}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <p className="font-medium text-gray-900">{customer.email}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Member Since</p>
                  <p className="font-medium text-gray-900">{customer.joinedDate}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Total Spent</p>
                  <p className="font-medium text-gray-900">${customer.totalSpent?.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Loyalty Points</p>
                  <p className="font-medium text-yellow-600">{customer.loyaltyPoints} pts</p>
                </div>
              </div>
            </div>

            {/* Vehicles */}
            <div className="bg-gray-50 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Car className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-gray-800">Vehicles ({customer.vehicles})</h4>
              </div>
              <div className="space-y-2">
                {customer.vehiclesList?.map((vehicle, index) => (
                  <div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                    <p className="font-medium text-gray-900">{vehicle}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Booking History */}
            <div className="bg-gray-50 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-gray-800">Recent Booking History</h4>
              </div>
              <div className="space-y-3">
                {mockBookingHistory.map((booking) => (
                  <div key={booking.id} className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{booking.id}</p>
                        <p className="text-sm text-gray-600">{booking.service}</p>
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                        {booking.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{booking.date}</span>
                      <span className="font-medium text-gray-900">${booking.amount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Payment History */}
            <div className="bg-gray-50 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-gray-800">Payment History</h4>
              </div>
              <div className="space-y-3">
                {mockPaymentHistory.map((payment) => (
                  <div key={payment.id} className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-semibold text-gray-900">{payment.id}</p>
                        <p className="text-sm text-gray-600">{payment.method}</p>
                      </div>
                      <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                        {payment.status}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">{payment.date}</span>
                      <span className="font-medium text-gray-900">${payment.amount}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Loyalty Rewards */}
            <div className="bg-gray-50 rounded-lg p-5">
              <div className="flex items-center gap-2 mb-4">
                <Gift className="w-5 h-5 text-blue-600" />
                <h4 className="font-semibold text-gray-800">Loyalty Rewards</h4>
              </div>
              <div className="space-y-3">
                {mockRewards.map((reward, index) => (
                  <div key={index} className="bg-white rounded-lg p-3 border border-gray-200">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="font-medium text-gray-900">{reward.name}</p>
                        <p className="text-sm text-gray-500">{reward.points} points</p>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        reward.status === 'Available' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {reward.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
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
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
