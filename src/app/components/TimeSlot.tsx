import { useDrop } from 'react-dnd';
import { ReactNode } from 'react';

interface TimeSlotProps {
  resource: string;
  time: string;
  onDrop: (bookingId: string, newResource: string, newTime: string) => void;
  children?: ReactNode;
}

export function TimeSlot({ resource, time, onDrop, children }: TimeSlotProps) {
  const [{ isOver, canDrop }, drop] = useDrop(() => ({
    accept: 'booking',
    drop: (item: any) => {
      onDrop(item.id, resource, time);
    },
    canDrop: (item: any) => {
      // Don't allow dropping on the same slot
      return !(item.booking.assignedStaff === resource && item.booking.time === time);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  }), [resource, time]);

  return (
    <div
      ref={drop}
      className={`w-32 flex-1 min-w-[140px] border-r border-gray-200 p-2 transition-colors ${
        isOver && canDrop 
          ? 'bg-blue-50 border-blue-300' 
          : isOver && !canDrop 
          ? 'bg-red-50' 
          : 'hover:bg-gray-50'
      }`}
    >
      {children}
    </div>
  );
}
