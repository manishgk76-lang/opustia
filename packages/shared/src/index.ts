/**
 * Cross-application vocabulary. The API remains the source of truth for
 * validation; these types help the React clients stay aligned with it.
 */
export const USER_ROLES = ["CUSTOMER", "PROFESSIONAL", "ADMIN"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const BOOKING_STATUSES = [
  "REQUESTED",
  "ACCEPTED",
  "CONFIRMED",
  "ON_THE_WAY",
  "ARRIVED",
  "SERVICE_STARTED",
  "COMPLETED",
  "CANCELLED",
  "DISPUTED",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const CANCELLATION_REASONS = [
  "Change of plans",
  "Booked by mistake",
  "Found another service provider",
  "Schedule conflict",
  "Pricing or quote too high",
  "Professional unavailable",
  "Emergency",
  "Other",
] as const;
export type CancellationReason = (typeof CANCELLATION_REASONS)[number];

export const PAYMENT_STATUSES = ["PENDING", "SUCCESS", "FAILED", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export interface ApiSuccess<T> {
  success: true;
  data: T;
  message?: string;
  meta?: PaginationMeta;
}

export interface ApiFailure {
  success: false;
  message: string;
  code?: string;
  details?: Record<string, string[]>;
}

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  icon?: string | null;
}

export interface ServiceSummary {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  basePrice?: number | null;
  warrantyDays?: number | null;
}

export interface ProfessionalSummary {
  id: string;
  userId: string;
  displayName: string;
  businessName?: string | null;
  avatarUrl?: string | null;
  averageRating?: number | null;
  reviewCount: number;
  reliabilityScore?: number | null;
  verified: boolean;
  serviceAreaNames?: string[];
}

export interface PaymentSummary {
  id: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  transactionId?: string;
  verifiedAt?: string;
}

export interface ReviewSummary {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
}

export interface BookingSummary {
  id: string;
  customerId: string;
  professionalId?: string | null;
  service: string;
  date: string;
  time: string;
  address: string;
  problem?: string;
  status: BookingStatus;
  cancellationReason?: string;
  cancelledBy?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
  professional?: ProfessionalSummary;
  payment?: PaymentSummary;
  review?: ReviewSummary;
}

export interface BookingTimelineEvent {
  id: string;
  type: string;
  status?: BookingStatus | null;
  note?: string | null;
  createdAt: string;
}
