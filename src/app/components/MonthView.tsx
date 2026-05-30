import type { Booking } from '../types/legacy-ui';

interface MonthViewProps {
  selectedDate: Date;
  bookings: Booking[];
  onBookingClick: (booking: Booking) => void;
}

const statusColors: Record<string, string> = {
  'Scheduled': 'bg-yellow-400',
  'Assigned': 'bg-sky-400',
  'In Progress': 'bg-blue-400',
  'Completed': 'bg-green-400',
  'Cancelled': 'bg-red-400',
};

export function MonthView({ selectedDate, bookings, onBookingClick }: MonthViewProps) {
  const getDaysInMonth = () => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];
    
    // Add empty cells for days before the first day of the month
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    
    return days;
  };

  const getBookingsForDate = (date: Date | null) => {
    if (!date) return [];
    const dateString = date.toISOString().split('T')[0];
    return bookings.filter(b => b.date === dateString);
  };

  const days = getDaysInMonth();
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="p-4">
      {/* Week Day Headers */}
      <div className="grid grid-cols-7 gap-2 mb-2">
        {weekDays.map(day => (
          <div key={day} className="text-center font-semibold text-gray-600 text-sm py-2">
            {day}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {days.map((date, index) => {
          const dayBookings = getBookingsForDate(date);
          const isToday = date && date.toDateString() === new Date().toDateString();
          
          return (
            <div
              key={index}
              className={`min-h-[120px] border rounded-lg p-2 ${
                date ? 'bg-white hover:bg-gray-50' : 'bg-gray-50'
              } ${isToday ? 'border-blue-500 border-2' : 'border-gray-200'}`}
            >
              {date && (
                <>
                  <div className={`text-sm font-semibold mb-2 ${
                    isToday ? 'text-blue-600' : 'text-gray-700'
                  }`}>
                    {date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayBookings.slice(0, 3).map(booking => (
                      <button
                        key={booking.id}
                        onClick={() => onBookingClick(booking)}
                        className={`w-full text-left px-2 py-1 rounded text-xs font-medium text-white truncate ${
                          statusColors[booking.status]
                        } hover:opacity-80 transition-opacity`}
                      >
                        {booking.time} - {booking.customerName}
                      </button>
                    ))}
                    {dayBookings.length > 3 && (
                      <div className="text-xs text-gray-500 px-2">
                        +{dayBookings.length - 3} more
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
