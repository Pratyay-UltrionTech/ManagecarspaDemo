import type { Resource, Booking } from '../types/legacy-ui';
import { BookingBlock } from './BookingBlock';
import { TimeSlot } from './TimeSlot';

interface WeekViewProps {
  selectedDate: Date;
  bookings: Booking[];
  resources: Resource[];
  onBookingMove: (bookingId: string, newResource: string, newTime: string) => void;
  onBookingClick: (booking: Booking) => void;
}

const timeSlots = ['09:00 AM', '11:00 AM', '02:00 PM', '04:00 PM'];

export function WeekView({ selectedDate, bookings, resources, onBookingMove, onBookingClick }: WeekViewProps) {
  // Get the week dates starting from Monday
  const getWeekDates = () => {
    const dates = [];
    const current = new Date(selectedDate);
    const day = current.getDay();
    const diff = current.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    current.setDate(diff);

    for (let i = 0; i < 7; i++) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const weekDates = getWeekDates();

  const getBookingsForDateAndResource = (date: Date, resource: string, time: string) => {
    const dateString = date.toISOString().split('T')[0];
    return bookings.filter(b => 
      b.date === dateString && 
      b.assignedStaff === resource && 
      b.time === time
    );
  };

  return (
    <div className="overflow-x-auto">
      <div className="min-w-max">
        {/* Week Days Header */}
        <div className="flex border-b border-gray-200 bg-gray-50">
          <div className="w-32 flex-shrink-0 border-r border-gray-200 px-4 py-3">
            <span className="font-semibold text-gray-700 text-sm">Resource</span>
          </div>
          {weekDates.map(date => (
            <div key={date.toISOString()} className="flex-1 min-w-[140px] border-r border-gray-200 px-4 py-3 text-center">
              <div className="font-semibold text-gray-800 text-sm">
                {date.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
            </div>
          ))}
        </div>

        {/* Resource Rows */}
        {resources.map(resource => (
          <div key={resource.id}>
            {timeSlots.map(time => (
              <div key={`${resource.id}-${time}`} className="flex border-b border-gray-200">
                <div className="w-32 flex-shrink-0 border-r border-gray-200 px-4 py-2 bg-gray-50">
                  <div className="text-xs font-medium text-gray-800">{resource.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{time}</div>
                </div>
                {weekDates.map(date => {
                  const dayBookings = getBookingsForDateAndResource(date, resource.name, time);
                  return (
                    <TimeSlot
                      key={`${resource.id}-${date.toISOString()}-${time}`}
                      resource={resource.name}
                      time={time}
                      onDrop={onBookingMove}
                    >
                      <div className="flex flex-col gap-1">
                        {dayBookings.map(booking => (
                          <BookingBlock
                            key={booking.id}
                            booking={booking}
                            onClick={() => onBookingClick(booking)}
                            compact
                          />
                        ))}
                      </div>
                    </TimeSlot>
                  );
                })}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
