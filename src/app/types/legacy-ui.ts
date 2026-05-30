/** Types for legacy UI components not wired to current admin routes. */

export type BookingStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';

export interface Booking {
  id: string;
  customerName: string;
  phone: string;
  vehicle: string;
  service: string;
  location: string;
  date: string;
  time: string;
  assignedStaff: string;
  status: BookingStatus;
  paymentStatus: 'Paid' | 'Pending' | 'Refunded';
}

export interface Resource {
  name: string;
}

export type ViewMode = 'day' | 'week' | 'month';

export interface Service {
  name: string;
  description: string;
  duration: string;
  priceSedan: number;
  priceSUV: number;
  priceTruck: number;
  status: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  joinedDate: string;
  totalSpent: number;
  loyaltyPoints: number;
  vehicles: number;
  vehiclesList?: string[];
}
