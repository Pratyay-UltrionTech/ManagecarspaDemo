import type { Resource, Booking } from '../types/legacy-ui';
import { BookingBlock } from './BookingBlock';
import { TimeSlot } from './TimeSlot';

interface DayViewProps {
  selectedDate: Date;
  bookings: Booking[];
  resources: Resource[];
  onBookingMove: (bookingId: string, newResource: string, newTime: string) => void;
  onBookingClick: (booking: Booking) => void;
}

const timeSlots = [
  '08:00 AM', '09:00 AM', '10:00 AM', '11:00 AM',
  '12:00 PM', '01:00 PM', '02:00 PM', '03:00 PM',
  '04:00 PM', '05:00 PM', '06:00 PM'
];

export function DayView({ selectedDate, bookings, resources, onBookingMove, onBookingClick }: DayViewProps) {
  const dateString = selectedDate.toISOString().split('T')[0];
  const dayBookings = bookings.filter(b => b.date === dateString);

  const getBookingForSlot = (resource: string, time: string) => {
    return dayBookings.find(b => b.assignedStaff === resource && b.time === time);
  };

  return (
    <div className="flex h-[700px]">
      {/* Resources Column */}
      <div className="w-48 border-r border-gray-200 bg-gray-50">
        <div className="h-14 border-b border-gray-200 flex items-center px-4">
          <span className="font-semibold text-gray-700">Resources</span>
        </div>
        {resources.map(resource => (
          <div 
            key={resource.id} 
            className="h-16 border-b border-gray-200 flex items-center px-4"
          >
            <div>
              <p className="font-medium text-gray-800 text-sm">{resource.name}</p>
              <p className="text-xs text-gray-500 capitalize">{resource.type}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Time Slots Grid */}
      <div className="flex-1 overflow-x-auto">
        <div className="min-w-max">
          {/* Time Headers */}
          <div className="h-14 border-b border-gray-200 flex bg-gray-50">
            {timeSlots.map(time => (
              <div key={time} className="w-32 flex-shrink-0 border-r border-gray-200 flex items-center justify-center">
                <span className="text-sm font-medium text-gray-600">{time}</span>
              </div>
            ))}
          </div>

          {/* Resource Rows */}
          {resources.map(resource => (
            <div key={resource.id} className="h-16 border-b border-gray-200 flex">
              {timeSlots.map(time => {
                const booking = getBookingForSlot(resource.name, time);
                return (
                  <TimeSlot
                    key={`${resource.id}-${time}`}
                    resource={resource.name}
                    time={time}
                    onDrop={onBookingMove}
                  >
                    {booking && (
                      <BookingBlock
                        booking={booking}
                        onClick={() => onBookingClick(booking)}
                      />
                    )}
                  </TimeSlot>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
