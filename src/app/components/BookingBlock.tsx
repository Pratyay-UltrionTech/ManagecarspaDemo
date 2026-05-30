import { useDrag } from 'react-dnd';
import type { Booking } from '../types/legacy-ui';

interface BookingBlockProps {
  booking: Booking;
  onClick: () => void;
  compact?: boolean;
}

const statusColors: Record<string, string> = {
  'Scheduled': 'bg-yellow-100 border-yellow-400 text-yellow-800',
  'Assigned': 'bg-sky-100 border-sky-400 text-sky-800',
  'In Progress': 'bg-blue-100 border-blue-400 text-blue-800',
  'Completed': 'bg-green-100 border-green-400 text-green-800',
  'Cancelled': 'bg-red-100 border-red-400 text-red-800',
};

export function BookingBlock({ booking, onClick, compact = false }: BookingBlockProps) {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'booking',
    item: { id: booking.id, booking },
    canDrag: booking.status !== 'Completed' && booking.status !== 'Cancelled',
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }), [booking]);

  return (
    <div
      ref={drag}
      onClick={onClick}
      className={`rounded-lg border-2 p-2 cursor-pointer transition-all ${
        statusColors[booking.status]
      } ${isDragging ? 'opacity-50' : 'opacity-100'} ${
        booking.status !== 'Completed' && booking.status !== 'Cancelled' 
          ? 'hover:shadow-md' 
          : 'cursor-default'
      }`}
      style={{ opacity: isDragging ? 0.5 : 1 }}
    >
      {compact ? (
        <div className="text-xs">
          <div className="font-semibold truncate">{booking.id}</div>
          <div className="truncate">{booking.customerName}</div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-xs">{booking.id}</span>
            <span className="text-xs opacity-75">{booking.time}</span>
          </div>
          <div className="text-xs font-medium mb-1 truncate">{booking.customerName}</div>
          <div className="text-xs opacity-90 truncate">{booking.service}</div>
          <div className="text-xs opacity-75 mt-1 truncate">{booking.assignedStaff}</div>
        </>
      )}
    </div>
  );
}
