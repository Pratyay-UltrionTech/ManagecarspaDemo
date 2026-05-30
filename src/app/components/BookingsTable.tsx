import { Eye, Edit, XCircle } from 'lucide-react';
import type { Booking } from '../types/legacy-ui';
import { useConfirmDialog } from '../hooks/useConfirmDialog';

function formatPhone(phone: string | undefined | null): string {
  if (!phone) return '—';
  const p = phone.trim();
  if (p.startsWith('+')) return p;
  if (p.startsWith('61')) return `+${p}`;
  if (p.startsWith('0')) return `+61${p.slice(1)}`;
  return `+61${p}`;
}

interface BookingsTableProps {
  bookings: Booking[];
  onViewBooking: (booking: Booking) => void;
  onStaffChange: (bookingId: string, newStaff: string) => void;
  onStatusChange: (bookingId: string, newStatus: 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled') => void;
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

const staffList = [
  'John Smith',
  'Mike Driver',
  'David Martinez',
  'Sarah Lee',
  'Tom Driver',
  'Anna Johnson',
  'Chris Brown',
];

export function BookingsTable({ bookings, onViewBooking, onStaffChange, onStatusChange }: BookingsTableProps) {
  const { confirm, dialog } = useConfirmDialog();
  const handleEdit = (booking: Booking) => {
    console.log('Edit booking:', booking.id);
    // Implement edit functionality
  };

  const handleCancel = async (booking: Booking) => {
    const ok = await confirm({
      title: 'Cancel booking?',
      description: `Are you sure you want to cancel booking ${booking.id}?`,
      confirmLabel: 'Cancel booking',
    });
    if (!ok) return;
    onStatusChange(booking.id, 'Cancelled');
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {dialog}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Booking ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Customer Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Phone Number
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Vehicle
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Service
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Branch / Mobile
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Time
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Assigned Staff
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Payment
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {bookings.map((booking) => (
              <tr key={booking.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="font-medium text-gray-900">{booking.id}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-gray-700">{booking.customerName}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-gray-700">{formatPhone(booking.phone)}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-gray-700">{booking.vehicle}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-gray-700">{booking.service}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-gray-700">{booking.location}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-gray-700">{booking.date}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-gray-700">{booking.time}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={booking.assignedStaff}
                    onChange={(e) => onStaffChange(booking.id, e.target.value)}
                    className="text-sm border border-gray-300 rounded-lg px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    disabled={booking.status === 'Cancelled' || booking.status === 'Completed'}
                  >
                    {staffList.map((staff) => (
                      <option key={staff} value={staff}>
                        {staff}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <select
                    value={booking.status}
                    onChange={(e) => onStatusChange(booking.id, e.target.value as any)}
                    className={`text-xs font-semibold rounded-full px-3 py-1 border-0 outline-none focus:ring-2 focus:ring-blue-500 ${statusColors[booking.status]}`}
                    disabled={booking.status === 'Cancelled' || booking.status === 'Completed'}
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Completed">Completed</option>
                    <option value="Cancelled">Cancelled</option>
                  </select>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${paymentColors[booking.paymentStatus]}`}>
                    {booking.paymentStatus}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onViewBooking(booking)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="View Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleEdit(booking)}
                      className="p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleCancel(booking)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Cancel"
                      disabled={booking.status === 'Cancelled' || booking.status === 'Completed'}
                    >
                      <XCircle className={`w-4 h-4 ${(booking.status === 'Cancelled' || booking.status === 'Completed') ? 'opacity-30' : ''}`} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
