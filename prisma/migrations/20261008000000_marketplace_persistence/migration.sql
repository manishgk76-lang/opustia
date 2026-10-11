CREATE TYPE "QuoteStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CLARIFICATION_REQUESTED');
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
CREATE TYPE "DisputeStatus" AS ENUM ('OPEN', 'UNDER_REVIEW', 'RESOLVED', 'REJECTED');
CREATE TYPE "DisputeReason" AS ENUM ('NO_SHOW', 'PRICING', 'POOR_SERVICE', 'WRONG_SERVICE', 'PROPERTY_DAMAGE', 'PAYMENT', 'FRAUD', 'ABUSE', 'OTHER');

ALTER TABLE "Category" ADD COLUMN "icon" TEXT NOT NULL DEFAULT '✨';
ALTER TABLE "Service" ADD CONSTRAINT "Service_categoryId_name_key" UNIQUE ("categoryId", "name");

CREATE TABLE "Professional" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "businessName" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reviewsCount" INTEGER NOT NULL DEFAULT 0,
  "completedJobs" INTEGER NOT NULL DEFAULT 0,
  "onTime" INTEGER NOT NULL DEFAULT 0,
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "priceFrom" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Professional_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Professional_userId_key" ON "Professional"("userId");
CREATE INDEX "Professional_categoryId_verified_rating_idx" ON "Professional"("categoryId", "verified", "rating");
ALTER TABLE "Professional" ADD CONSTRAINT "Professional_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Professional" ADD CONSTRAINT "Professional_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Booking" ADD COLUMN "professionalId" TEXT;
ALTER TABLE "Booking" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "Booking" ADD COLUMN "arrivalOtpHash" TEXT;
ALTER TABLE "Booking" ADD COLUMN "otpExpiresAt" TIMESTAMP(3);
ALTER TABLE "Booking" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
CREATE UNIQUE INDEX "Booking_idempotencyKey_key" ON "Booking"("idempotencyKey");
CREATE INDEX "Booking_professionalId_scheduledAt_status_idx" ON "Booking"("professionalId", "scheduledAt", "status");
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "BookingEvent" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "actorId" TEXT,
  "type" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "BookingEvent_bookingId_createdAt_idx" ON "BookingEvent"("bookingId", "createdAt");
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BookingEvent" ADD CONSTRAINT "BookingEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "Quote" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "status" "QuoteStatus" NOT NULL DEFAULT 'PENDING',
  "labour" DOUBLE PRECISION NOT NULL,
  "parts" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "additional" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "total" DOUBLE PRECISION NOT NULL,
  "description" TEXT NOT NULL,
  "estimatedMinutes" INTEGER NOT NULL,
  "warrantyDays" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3),
  CONSTRAINT "Quote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Quote_bookingId_createdAt_idx" ON "Quote"("bookingId", "createdAt");
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'INR',
  "provider" TEXT NOT NULL DEFAULT 'razorpay-test',
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "transactionId" TEXT,
  "providerSignature" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "verifiedAt" TIMESTAMP(3),
  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Payment_bookingId_key" ON "Payment"("bookingId");
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Review" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,
  "rating" INTEGER NOT NULL,
  "comment" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Review" ADD CONSTRAINT "Review_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Favorite" (
  "userId" TEXT NOT NULL,
  "professionalId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Favorite_pkey" PRIMARY KEY ("userId", "professionalId")
);
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "Professional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Dispute" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reason" "DisputeReason" NOT NULL,
  "description" TEXT NOT NULL,
  "status" "DisputeStatus" NOT NULL DEFAULT 'OPEN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "Notification" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "bookingId" TEXT,
  "read" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
