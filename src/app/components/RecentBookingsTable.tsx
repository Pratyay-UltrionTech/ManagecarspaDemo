const bookings = [
  {
    id: 'BK-001',
    customer: 'Sarah Johnson',
    service: 'Premium Wash',
    date: '2026-03-22',
    status: 'Completed',
    payment: 'Paid',
  },
  {
    id: 'BK-002',
    customer: 'Michael Chen',
    service: 'Basic Wash',
    date: '2026-03-22',
    status: 'In Progress',
    payment: 'Paid',
  },
  {
    id: 'BK-003',
    customer: 'Emma Williams',
    service: 'Deluxe Detailing',
    date: '2026-03-22',
    status: 'Scheduled',
    payment: 'Pending',
  },
  {
    id: 'BK-004',
    customer: 'David Brown',
    service: 'Express Wash',
    date: '2026-03-21',
    status: 'Completed',
    payment: 'Paid',
  },
  {
    id: 'BK-005',
    customer: 'Lisa Anderson',
    service: 'Interior Cleaning',
    date: '2026-03-21',
    status: 'Completed',
    payment: 'Paid',
  },
  {
    id: 'BK-006',
    customer: 'James Martinez',
    service: 'Premium Wash',
    date: '2026-03-21',
    status: 'Cancelled',
    payment: 'Refunded',
  },
];

const statusColors: Record<string, string> = {
  'Completed': 'bg-green-100 text-green-700',
  'In Progress': 'bg-blue-100 text-blue-700',
  'Scheduled': 'bg-yellow-100 text-yellow-700',
  'Assigned': 'bg-sky-100 text-sky-700',
  'Cancelled': 'bg-red-100 text-red-700',
};

const paymentColors: Record<string, string> = {
  'Paid': 'bg-green-100 text-green-700',
  'Pending': 'bg-orange-100 text-orange-700',
  'Refunded': 'bg-gray-100 text-gray-700',
};

export function RecentBookingsTable() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Recent Bookings</h3>
      </div>
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
                Service
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                Payment Status
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
                  <span className="text-gray-700">{booking.customer}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-gray-700">{booking.service}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-gray-700">{booking.date}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${statusColors[booking.status]}`}>
                    {booking.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${paymentColors[booking.payment]}`}>
                    {booking.payment}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
