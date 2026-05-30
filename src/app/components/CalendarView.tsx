import type { ViewMode, Resource, Booking } from '../types/legacy-ui';
import { DayView } from './DayView';
import { WeekView } from './WeekView';
import { MonthView } from './MonthView';

interface CalendarViewProps {
  selectedDate: Date;
  viewMode: ViewMode;
  bookings: Booking[];
  resources: Resource[];
  onBookingMove: (bookingId: string, newResource: string, newTime: string) => void;
  onBookingClick: (booking: Booking) => void;
}

export function CalendarView({ 
  selectedDate, 
  viewMode, 
  bookings, 
  resources, 
  onBookingMove,
  onBookingClick 
}: CalendarViewProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {viewMode === 'day' && (
        <DayView 
          selectedDate={selectedDate}
          bookings={bookings}
          resources={resources}
          onBookingMove={onBookingMove}
          onBookingClick={onBookingClick}
        />
      )}
      {viewMode === 'week' && (
        <WeekView 
          selectedDate={selectedDate}
          bookings={bookings}
          resources={resources}
          onBookingMove={onBookingMove}
          onBookingClick={onBookingClick}
        />
      )}
      {viewMode === 'month' && (
        <MonthView 
          selectedDate={selectedDate}
          bookings={bookings}
          onBookingClick={onBookingClick}
        />
      )}
    </div>
  );
}
