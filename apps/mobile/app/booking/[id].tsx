import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, Booking, CouponValidationResult, Invoice, Quote, SosAlertResult } from '../../lib/api';
import { readSession } from '../../store/auth';

const CANCELLATION_OPTIONS = [
  'Change of plans',
  'Booked by mistake',
  'Found another service provider',
  'Schedule conflict',
  'Pricing or quote too high',
  'Other',
];

const STEPS = ['Requested', 'Accepted', 'Confirmed', 'En Route', 'In Progress', 'Completed', 'Paid'];

export default function BookingDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [b, setB] = useState<Booking | null>(null);
  const [q, setQ] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [otp, setOtp] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('Change of plans');
  const [customReason, setCustomReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking'>('upi');
  const [paying, setPaying] = useState(false);
  const [paymentError, setPaymentError] = useState('');

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState<Invoice | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  // Reschedule State
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('11:00');
  const [rescheduleReason, setRescheduleReason] = useState('Schedule conflict');
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');

  // Promo Coupon State
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponError, setCouponError] = useState('');

  // Safety SOS State
  const [showSosModal, setShowSosModal] = useState(false);
  const [sendingSos, setSendingSos] = useState(false);
  const [sosResult, setSosResult] = useState<SosAlertResult | null>(null);
  const [sosError, setSosError] = useState('');


  const openInvoiceModal = async () => {
    setShowInvoiceModal(true);
    const session = await readSession();
    if (session && b) {
      setLoadingInvoice(true);
      try {
        const inv = await api.getBookingInvoice(session.accessToken, b.id);
        setInvoiceData(inv);
      } catch {}
      setLoadingInvoice(false);
    }
  };

  const load = async () => {
    const session = await readSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    try {
      const bookings = await api.getBookings(session.accessToken);
      const booking = bookings.find((x) => x.id === id) || null;
      setB(booking);
      if (booking) setQ(await api.getQuotes(session.accessToken, booking.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load booking');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const accept = async (quote: Quote) => {
    const session = await readSession();
    if (!session) return;
    try {
      await api.resolveQuote(session.accessToken, quote.id, 'ACCEPTED');
      setMessage('Quote accepted. The professional can now start travelling.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to accept quote');
    }
  };

  const createOtp = async () => {
    const session = await readSession();
    if (!session || !b) return;
    try {
      const result = await api.createArrivalOtp(session.accessToken, b.id);
      setOtp(result.otp);
      setMessage('Share this one-time code with the professional only when they arrive.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create arrival code');
    }
  };

  const review = async () => {
    const session = await readSession();
    if (!session || !b) return;
    try {
      await api.submitReview(session.accessToken, b.id, rating, comment);
      setMessage('Thanks — your review was submitted.');
      setComment('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to submit review');
    }
  };

  
  const handleReschedule = async () => {
    const session = await readSession();
    if (!session || !b) return;
    if (!rescheduleDate) {
      setRescheduleError('Please specify a new date (YYYY-MM-DD)');
      return;
    }
    setRescheduling(true);
    setRescheduleError('');
    try {
      await api.rescheduleBooking(session.accessToken, b.id, rescheduleDate, rescheduleTime, rescheduleReason);
      setShowRescheduleModal(false);
      setMessage(`Booking slot rescheduled to ${rescheduleDate} at ${rescheduleTime}`);
      await load();
    } catch (e) {
      setRescheduleError(e instanceof Error ? e.message : 'Unable to reschedule booking');
    } finally {
      setRescheduling(false);
    }
  };

  const applyCoupon = async (codeToApply?: string) => {
    const session = await readSession();
    if (!session) return;
    const code = (codeToApply || couponInput).trim();
    if (!code) return;
    setValidatingCoupon(true);
    setCouponError('');
    setCouponMessage('');
    try {
      const res = await api.validateCoupon(session.accessToken, code, payableAmount);
      setAppliedCoupon(res);
      setCouponMessage(`Promo code "${res.code}" applied! Saved ₹${res.discount}`);
    } catch (e) {
      setAppliedCoupon(null);
      setCouponError(e instanceof Error ? e.message : 'Invalid coupon code');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const triggerSos = async () => {
    const session = await readSession();
    if (!session || !b) return;
    setSendingSos(true);
    setSosError('');
    try {
      const res = await api.triggerSafetySos(session.accessToken, b.id, b.latitude, b.longitude, 'Live Safety SOS triggered by customer');
      setSosResult(res);
    } catch (e) {
      setSosError(e instanceof Error ? e.message : 'Unable to broadcast SOS alert');
    } finally {
      setSendingSos(false);
    }
  };

  const confirmCancel = async () => {
    const session = await readSession();
    if (!session || !b) return;
    setCancelling(true);
    setError('');
    try {
      const finalReason = cancelReason === 'Other' ? (customReason.trim() || 'Other reason') : cancelReason;
      await api.updateBookingStatus(session.accessToken, b.id, 'CANCELLED', finalReason);
      setShowCancelModal(false);
      setMessage('Your booking has been cancelled.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  const acceptedQuote = q.find((x) => x.status === 'ACCEPTED') || q[0];
  const payableAmount = acceptedQuote?.total || 499;

  const handlePay = async () => {
    const session = await readSession();
    if (!session || !b) return;
    setPaying(true);
    setPaymentError('');
    try {
      const order = await api.createPaymentOrder(session.accessToken, b.id, appliedCoupon ? appliedCoupon.payableAmount : payableAmount, appliedCoupon?.code);
      await api.verifyPayment(session.accessToken, order.id);
      setShowPaymentModal(false);
      setMessage(`Payment of ₹${(appliedCoupon ? appliedCoupon.payableAmount : payableAmount).toLocaleString('en-IN')} completed successfully!`);
      await load();
    } catch (e) {
      setPaymentError(e instanceof Error ? e.message : 'Payment failed. Please try again.');
    } finally {
      setPaying(false);
    }
  };

  const isPaid = b?.payment?.status === 'SUCCESS';
  let activeStep = 0;
  if (isPaid) activeStep = 6;
  else if (b?.status === 'COMPLETED') activeStep = 5;
  else if (['ARRIVED', 'SERVICE_STARTED'].includes(b?.status || '')) activeStep = 4;
  else if (b?.status === 'ON_THE_WAY') activeStep = 3;
  else if (b?.status === 'CONFIRMED') activeStep = 2;
  else if (b?.status === 'ACCEPTED') activeStep = 1;

  const warrantyDays = acceptedQuote?.warrantyDays || 30;
  const bookingCompletedDate = new Date(b?.updatedAt || b?.createdAt || Date.now());
  const warrantyExpiryDate = new Date(bookingCompletedDate.getTime() + warrantyDays * 24 * 60 * 60 * 1000);
  const isWarrantyActive = new Date() <= warrantyExpiryDate;
  const daysRemaining = Math.max(0, Math.ceil((warrantyExpiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
  const warrantyExpiryStr = warrantyExpiryDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Pressable onPress={() => router.back()} style={s.backBtn}>
        <Text style={s.backText}>‹ Back</Text>
      </Pressable>

      {loading ? (
        <View style={s.centerBox}>
          <ActivityIndicator color="#000000" size="large" />
        </View>
      ) : error ? (
        <View style={s.errorBox}>
          <Text style={s.error}>{error}</Text>
        </View>
      ) : !b ? (
        <Text style={s.muted}>Booking not found.</Text>
      ) : (
        <>
          {/* Header Card */}
          <View style={s.headerCard}>
            <View style={s.headerTopRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.title}>{b.service}</Text>
                <Text style={s.scheduleText}>{b.date} · {b.time}</Text>
                <Text style={s.addressText}>📍 {b.address}</Text>
              </View>
              <View style={[s.statusBadge, b.status === 'CANCELLED' && s.statusCancelled, isPaid && s.statusPaid]}>
                <Text style={[s.statusBadgeText, b.status === 'CANCELLED' && s.statusTextCancelled, isPaid && s.statusTextPaid]}>
                  {isPaid ? 'PAID & COMPLETED' : b.status.replaceAll('_', ' ')}
                </Text>
              </View>
            </View>

            {b.status !== 'CANCELLED' && (
              <View style={s.actionRow}>
                <Pressable style={s.chatPillBtn} onPress={() => router.push(`/chat/${b.id}`)}>
                  <Text style={s.chatPillBtnText}>💬 Live Chat with Professional</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Stepper Progress */}
          {b.status !== 'CANCELLED' && (
            <View style={s.stepperCard}>
              <Text style={s.cardMiniHeading}>SERVICE PROGRESSION</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.stepperScroll}>
                {STEPS.map((step, idx) => {
                  const isDone = idx < activeStep;
                  const isCurrent = idx === activeStep;
                  return (
                    <View key={step} style={s.stepItem}>
                      <View style={[s.stepCircle, isDone && s.stepCircleDone, isCurrent && s.stepCircleCurrent]}>
                        <Text style={[s.stepNumber, (isDone || isCurrent) && s.stepNumberActive]}>
                          {isDone ? '✓' : idx + 1}
                        </Text>
                      </View>
                      <Text style={[s.stepLabel, (isDone || isCurrent) && s.stepLabelActive]}>{step}</Text>
                      {idx < STEPS.length - 1 && (
                        <View style={[s.stepLine, isDone && s.stepLineDone]} />
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {message ? (
            <View style={s.messageBox}>
              <Text style={s.messageText}>✓ {message}</Text>
            </View>
          ) : null}

          {b.status === 'CANCELLED' && (
            <View style={s.cancelledCard}>
              <Text style={s.cancelledTitle}>Booking Cancelled</Text>
              <Text style={s.cancelledReason}>Reason: {b.cancellationReason || 'No reason specified'}</Text>
              {b.cancelledBy ? (
                <Text style={s.cancelledMeta}>Cancelled by: {b.cancelledBy.toLowerCase()}</Text>
              ) : null}
              <Pressable
                style={s.reorderPill}
                onPress={() =>
                  router.push(
                    `/booking/new?reorder=true&professionalId=${b.professionalId || ''}&service=${encodeURIComponent(
                      b.service
                    )}&address=${encodeURIComponent(b.address)}&problem=${encodeURIComponent(b.problem || '')}`
                  )
                }
              >
                <Text style={s.reorderPillText}>↻ Rebook This Service</Text>
              </Pressable>
            </View>
          )}

          
          {['REQUESTED', 'ACCEPTED', 'CONFIRMED'].includes(b.status) && (
            <View style={s.slotActionRow}>
              <Pressable
                style={s.rescheduleButton}
                onPress={() => {
                  setRescheduleDate(b.date);
                  setRescheduleTime(b.time);
                  setShowRescheduleModal(true);
                }}
              >
                <Text style={s.rescheduleButtonText}>📅 Reschedule Service Slot</Text>
              </Pressable>
              <Pressable style={s.cancelButton} onPress={() => setShowCancelModal(true)}>
                <Text style={s.cancelButtonText}>Cancel booking</Text>
              </Pressable>
            </View>
          )}


          {/* Service Location & Navigation Card */}
          <View style={s.card}>
            <View style={s.cardHeaderRow}>
              <Text style={s.cardIcon}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>Service Location</Text>
                <Text style={s.cardBody}>{b.address}</Text>
                {b.latitude != null && b.longitude != null ? (
                  <Text style={s.cardMutedMeta}>
                    GPS: {b.latitude.toFixed(4)}° N, {b.longitude.toFixed(4)}° E
                  </Text>
                ) : null}
              </View>
            </View>
            <Pressable
              style={s.secondaryPillBtn}
              onPress={() =>
                Linking.openURL(
                  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.address)}`
                )
              }
            >
              <Text style={s.secondaryPillBtnText}>🗺️ Open in Google Maps ➔</Text>
            </Pressable>
          </View>

          {/* Live Transit Tracker */}
          {b.status === 'ON_THE_WAY' && (
            <View style={s.transitCard}>
              <View style={s.transitHeader}>
                <Text style={s.transitIcon}>🚗</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.transitTitle}>Professional is En Route</Text>
                  <Text style={s.transitSub}>Live Transit & Arrival Tracking</Text>
                </View>
                
                <Pressable style={s.sosHeaderPill} onPress={() => setShowSosModal(true)}>
                  <Text style={s.sosHeaderPillText}>🚨 Safety SOS</Text>
                </Pressable>

                <View style={s.etaBadge}>
                  <Text style={s.etaBadgeText}>~6 mins away</Text>
                </View>
              </View>

              <View style={s.transitTrack}>
                <View style={s.transitFill} />
              </View>
              <View style={s.transitMetaRow}>
                <Text style={s.transitMetaText}>Dispatched</Text>
                <Text style={s.transitMetaHighlight}>1.4 km remaining</Text>
                <Text style={s.transitMetaText}>Your location</Text>
              </View>

              <Pressable style={s.darkCta} onPress={createOtp}>
                <Text style={s.darkCtaText}>{otp ? 'Generate a new code' : 'Generate Arrival OTP'}</Text>
              </Pressable>
              {otp && (
                <View style={s.otpContainer}>
                  <Text style={s.otpLabel}>ONE-TIME ARRIVAL CODE</Text>
                  <Text style={s.otpValue}>{otp}</Text>
                  <Text style={s.otpInstructions}>
                    Share this 6-digit code with the professional only upon arrival to start the service.
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Quotes Section */}
          <View style={s.sectionHeader}>
            <Text style={s.sectionTitle}>Official Quotes</Text>
            <Text style={s.sectionCount}>{q.length}</Text>
          </View>

          {q.length === 0 ? (
            <View style={s.card}>
              <Text style={s.muted}>No quote submitted yet. The professional will provide one here before work begins.</Text>
            </View>
          ) : (
            q.map((quote) => (
              <View key={quote.id} style={s.card}>
                <View style={s.quoteTopRow}>
                  <Text style={s.quoteAmount}>₹{quote.total.toLocaleString('en-IN')}</Text>
                  <View style={[s.quoteStatusPill, quote.status === 'ACCEPTED' && s.quoteStatusAccepted]}>
                    <Text style={[s.quoteStatusText, quote.status === 'ACCEPTED' && s.quoteStatusTextAccepted]}>
                      {quote.status}
                    </Text>
                  </View>
                </View>
                <Text style={s.quoteDesc}>{quote.description}</Text>
                <Text style={s.quoteMeta}>
                  ⏱️ {quote.estimatedMinutes} mins · 🛡️ {quote.warrantyDays}-day warranty protection included
                </Text>
                {quote.status === 'PENDING' && b.status !== 'CANCELLED' ? (
                  <Pressable style={s.darkCta} onPress={() => accept(quote)}>
                    <Text style={s.darkCtaText}>Accept Quote & Authorize Work</Text>
                  </Pressable>
                ) : null}
              </View>
            ))
          )}

          {/* Payment Section for Completed Bookings */}
          {b.status === 'COMPLETED' && (
            <View style={s.card}>
              <Text style={s.cardHeading}>Payment & Settle Invoice</Text>
              {isPaid ? (
                <View style={s.paidBox}>
                  <View style={s.paidTopRow}>
                    <View style={s.verifiedPill}>
                      <Text style={s.verifiedPillText}>✓ Paid & Verified</Text>
                    </View>
                    <Text style={s.paidAmount}>₹{b.payment?.amount.toLocaleString('en-IN')}</Text>
                  </View>
                  <Text style={s.receiptMeta}>Txn Ref: {b.payment?.transactionId || 'OPUSTIA_PAYMENT_TXN'}</Text>
                  {b.payment?.verifiedAt && (
                    <Text style={s.receiptMeta}>
                      Settled: {new Date(b.payment.verifiedAt).toLocaleString('en-IN')}
                    </Text>
                  )}
                  <Text style={s.paidSandboxNotice}>
                    Secure payment processed via Razorpay sandbox.
                  </Text>

                  <View style={s.paidActionRow}>
                    <Pressable style={s.darkSmallPill} onPress={openInvoiceModal}>
                      <Text style={s.darkSmallPillText}>🧾 View Tax Invoice & Warranty</Text>
                    </Pressable>
                    <Pressable
                      style={s.lightSmallPill}
                      onPress={() =>
                        router.push(
                          `/booking/new?reorder=true&professionalId=${b.professionalId || ''}&service=${encodeURIComponent(
                            b.service
                          )}&address=${encodeURIComponent(b.address)}&problem=${encodeURIComponent(b.problem || '')}`
                        )
                      }
                    >
                      <Text style={s.lightSmallPillText}>↻ Book Again</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={s.unpaidBox}>
                  <Text style={s.unpaidNotice}>Service completed. Please review breakdown and settle the invoice.</Text>
                  {acceptedQuote && (
                    <View style={s.breakdownCard}>
                      <View style={s.breakdownRow}>
                        <Text style={s.breakdownLabel}>Professional Labour</Text>
                        <Text style={s.breakdownValue}>₹{acceptedQuote.labour.toLocaleString('en-IN')}</Text>
                      </View>
                      {acceptedQuote.parts > 0 && (
                        <View style={s.breakdownRow}>
                          <Text style={s.breakdownLabel}>Materials & Spare Parts</Text>
                          <Text style={s.breakdownValue}>₹{acceptedQuote.parts.toLocaleString('en-IN')}</Text>
                        </View>
                      )}
                      {acceptedQuote.discount > 0 && (
                        <View style={s.breakdownRow}>
                          <Text style={s.breakdownLabel}>Promotional Discount</Text>
                          <Text style={s.breakdownDiscount}>-₹{acceptedQuote.discount.toLocaleString('en-IN')}</Text>
                        </View>
                      )}
                      <View style={[s.breakdownRow, s.breakdownTotalRow]}>
                        <Text style={s.breakdownTotalLabel}>Total Due</Text>
                        <Text style={s.breakdownTotalValue}>₹{payableAmount.toLocaleString('en-IN')}</Text>
                      </View>
                    </View>
                  )}
                  <Pressable style={s.darkCta} onPress={() => setShowPaymentModal(true)}>
                    <Text style={s.darkCtaText}>Pay Now · ₹{payableAmount.toLocaleString('en-IN')}</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}

          {/* Service Warranty Section */}
          {(b.status === 'COMPLETED' || isPaid) && (
            <View style={s.card}>
              <View style={s.warrantyHeader}>
                <Text style={s.warrantyShield}>🛡️</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={s.cardTitle}>Opustia Service Protection</Text>
                  <Text style={s.cardMutedMeta}>
                    {warrantyDays}-Day Quality Guarantee Included
                  </Text>
                </View>
                <View style={[s.warrantyStatusBadge, isWarrantyActive ? s.warrantyActiveBadge : s.warrantyExpiredBadge]}>
                  <Text style={[s.warrantyStatusText, isWarrantyActive ? s.warrantyActiveText : s.warrantyExpiredText]}>
                    {isWarrantyActive ? 'Active' : 'Expired'}
                  </Text>
                </View>
              </View>

              <View style={s.warrantyBody}>
                <Text style={s.warrantyDetailText}>
                  {isWarrantyActive
                    ? `Your service is protected against defects and workmanship issues until ${warrantyExpiryStr} (${daysRemaining} day${daysRemaining === 1 ? '' : 's'} remaining).`
                    : `The standard ${warrantyDays}-day warranty coverage expired on ${warrantyExpiryStr}.`}
                </Text>
                {isWarrantyActive && (
                  <Pressable
                    style={s.secondaryPillBtn}
                    onPress={() => router.push(`/dispute/${b.id}`)}
                  >
                    <Text style={s.secondaryPillBtnText}>Claim Warranty / Request Free Rework ➔</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}

          {['CONFIRMED', 'ON_THE_WAY', 'SERVICE_STARTED', 'COMPLETED'].includes(b.status) && (
            <Pressable style={s.supportPill} onPress={() => router.push(`/dispute/${b.id}`)}>
              <Text style={s.supportPillText}>Need help or want to raise a concern with this booking? ➔</Text>
            </Pressable>
          )}

          {/* Review Section */}
          {b.status === 'COMPLETED' && (
            <View style={s.card}>
              <Text style={s.cardHeading}>Customer Feedback & Rating</Text>
              {b.review ? (
                <View style={s.reviewDisplay}>
                  <View style={s.reviewStarsRow}>
                    {[1, 2, 3, 4, 5].map((val) => (
                      <Text key={val} style={val <= b.review!.rating ? s.starOn : s.star}>★</Text>
                    ))}
                    <Text style={s.reviewRatingText}>{b.review.rating} / 5</Text>
                  </View>
                  {b.review.comment ? (
                    <Text style={s.reviewComment}>"{b.review.comment}"</Text>
                  ) : null}
                  <Text style={s.reviewDate}>
                    Reviewed on {new Date(b.review.createdAt).toLocaleDateString('en-IN')}
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={s.muted}>How was the service provided by the professional?</Text>
                  <View style={s.starsRow}>
                    {[1, 2, 3, 4, 5].map((value) => (
                      <Pressable key={value} onPress={() => setRating(value)}>
                        <Text style={value <= rating ? s.starOn : s.star}>★</Text>
                      </Pressable>
                    ))}
                  </View>
                  <TextInput
                    value={comment}
                    onChangeText={setComment}
                    placeholder="Tell us about your experience (optional)"
                    multiline
                    style={s.input}
                    placeholderTextColor="#888"
                  />
                  <Pressable style={s.darkCta} onPress={review}>
                    <Text style={s.darkCtaText}>Submit Review</Text>
                  </Pressable>
                </>
              )}
            </View>
          )}
        </>
      )}

      {/* Payment Checkout Modal */}
      <Modal visible={showPaymentModal} transparent animationType="fade" onRequestClose={() => setShowPaymentModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeaderRow}>
              <Text style={s.modalTitle}>Checkout Payment</Text>
              <View style={s.sandboxPill}>
                <Text style={s.sandboxPillText}>TEST MODE</Text>
              </View>
            </View>
            <Text style={s.modalSub}>Select payment method to settle {b?.service}</Text>

            <View style={s.modalAmountBox}>
              <Text style={s.modalAmountLabel}>Total Due</Text>
              <View style={{ alignItems: 'flex-end' }}>
                {appliedCoupon ? (
                  <Text style={{ fontSize: 13, color: '#16a34a', fontWeight: '700' }}>
                    -₹{appliedCoupon.discount} ({appliedCoupon.code})
                  </Text>
                ) : null}
                <Text style={s.modalAmountValue}>
                  ₹{(appliedCoupon ? appliedCoupon.payableAmount : payableAmount).toLocaleString('en-IN')}
                </Text>
              </View>
            </View>

            {paymentError ? <Text style={s.error}>{paymentError}</Text> : null}

            {/* Promo Coupon Engine */}
            <View style={s.couponBox}>
              <Text style={s.couponHeading}>Have a Promo Coupon?</Text>
              <View style={s.couponInputRow}>
                <TextInput
                  value={couponInput}
                  onChangeText={setCouponInput}
                  placeholder="Enter code (e.g. FIRST50)"
                  placeholderTextColor="#888888"
                  style={s.couponInput}
                  autoCapitalize="characters"
                />
                <Pressable
                  style={[s.couponApplyBtn, (!couponInput.trim() || validatingCoupon) && { opacity: 0.6 }]}
                  onPress={() => applyCoupon()}
                  disabled={!couponInput.trim() || validatingCoupon}
                >
                  <Text style={s.couponApplyBtnText}>{validatingCoupon ? '…' : 'Apply'}</Text>
                </Pressable>
              </View>

              {/* Quick Coupon Chips */}
              <View style={s.couponChipsRow}>
                {['FIRST50', 'OPUSTIA100', 'FESTIVE20'].map((code) => (
                  <Pressable
                    key={code}
                    style={s.couponChip}
                    onPress={() => {
                      setCouponInput(code);
                      applyCoupon(code);
                    }}
                  >
                    <Text style={s.couponChipText}>🏷️ {code}</Text>
                  </Pressable>
                ))}
              </View>

              {couponMessage ? <Text style={s.couponSuccessText}>✓ {couponMessage}</Text> : null}
              {couponError ? <Text style={s.couponErrorText}>⚠️ {couponError}</Text> : null}
            </View>


            <Text style={s.methodHeading}>Select Method</Text>

            <Pressable
              style={[s.methodOption, paymentMethod === 'upi' && s.methodSelected]}
              onPress={() => setPaymentMethod('upi')}
            >
              <Text style={s.methodIcon}>📱</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.methodName}>UPI / QR</Text>
                <Text style={s.methodDesc}>Google Pay, PhonePe, Paytm, BHIM</Text>
              </View>
              <View style={[s.radioCircle, paymentMethod === 'upi' && s.radioCircleOn]} />
            </Pressable>

            <Pressable
              style={[s.methodOption, paymentMethod === 'card' && s.methodSelected]}
              onPress={() => setPaymentMethod('card')}
            >
              <Text style={s.methodIcon}>💳</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.methodName}>Credit / Debit Card</Text>
                <Text style={s.methodDesc}>Visa, MasterCard, RuPay</Text>
              </View>
              <View style={[s.radioCircle, paymentMethod === 'card' && s.radioCircleOn]} />
            </Pressable>

            <Pressable
              style={[s.methodOption, paymentMethod === 'netbanking' && s.methodSelected]}
              onPress={() => setPaymentMethod('netbanking')}
            >
              <Text style={s.methodIcon}>🏦</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.methodName}>Net Banking</Text>
                <Text style={s.methodDesc}>All major Indian banks</Text>
              </View>
              <View style={[s.radioCircle, paymentMethod === 'netbanking' && s.radioCircleOn]} />
            </Pressable>

            <View style={s.modalActionRow}>
              <Pressable style={s.modalCancelBtn} onPress={() => setShowPaymentModal(false)} disabled={paying}>
                <Text style={s.modalCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={s.modalConfirmBtn} onPress={handlePay} disabled={paying}>
                <Text style={s.modalConfirmBtnText}>
                  {paying ? 'Processing…' : `Pay ₹${(appliedCoupon ? appliedCoupon.payableAmount : payableAmount).toLocaleString('en-IN')}`}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancellation Modal */}
      <Modal visible={showCancelModal} transparent animationType="fade" onRequestClose={() => setShowCancelModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Cancel booking?</Text>
            <Text style={s.modalSub}>Please select why you are cancelling this booking.</Text>

            {CANCELLATION_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                style={[s.cancelOption, cancelReason === opt && s.cancelOptionSelected]}
                onPress={() => setCancelReason(opt)}
              >
                <Text style={cancelReason === opt ? s.cancelOptionTextSelected : s.cancelOptionText}>{opt}</Text>
              </Pressable>
            ))}

            {cancelReason === 'Other' && (
              <TextInput
                value={customReason}
                onChangeText={setCustomReason}
                placeholder="Describe your reason"
                style={[s.input, { marginTop: 10 }]}
                placeholderTextColor="#888"
              />
            )}

            <View style={s.modalActionRow}>
              <Pressable style={s.modalCancelBtn} onPress={() => setShowCancelModal(false)}>
                <Text style={s.modalCancelBtnText}>Keep Booking</Text>
              </Pressable>
              <Pressable style={s.modalDangerBtn} onPress={confirmCancel} disabled={cancelling}>
                <Text style={s.modalDangerBtnText}>{cancelling ? 'Cancelling...' : 'Confirm Cancellation'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      
      {/* Reschedule Slot Modal */}
      <Modal visible={showRescheduleModal} transparent animationType="fade" onRequestClose={() => setShowRescheduleModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Reschedule Service Slot</Text>
            <Text style={s.modalSub}>Select a new date and time slot for {b?.service}.</Text>

            <Text style={s.inputLabel}>NEW DATE (YYYY-MM-DD)</Text>
            <TextInput
              value={rescheduleDate}
              onChangeText={setRescheduleDate}
              placeholder="e.g. 2026-10-12"
              placeholderTextColor="#888888"
              style={s.textInputPill}
            />

            <Text style={[s.inputLabel, { marginTop: 12 }]}>TIME SLOT</Text>
            <View style={s.slotPillsRow}>
              {['09:00', '11:30', '14:00', '16:30', '18:00'].map((slot) => {
                const isSel = rescheduleTime === slot;
                return (
                  <Pressable
                    key={slot}
                    style={[s.slotPill, isSel && s.slotPillSelected]}
                    onPress={() => setRescheduleTime(slot)}
                  >
                    <Text style={[s.slotPillText, isSel && s.slotPillTextSelected]}>{slot}</Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[s.inputLabel, { marginTop: 12 }]}>REASON FOR RESCHEDULE</Text>
            <View style={s.slotPillsRow}>
              {['Schedule conflict', 'Running late', 'Change of plans'].map((r) => {
                const isSel = rescheduleReason === r;
                return (
                  <Pressable
                    key={r}
                    style={[s.slotPill, isSel && s.slotPillSelected]}
                    onPress={() => setRescheduleReason(r)}
                  >
                    <Text style={[s.slotPillText, isSel && s.slotPillTextSelected]}>{r}</Text>
                  </Pressable>
                );
              })}
            </View>

            {rescheduleError ? <Text style={[s.error, { marginTop: 8 }]}>{rescheduleError}</Text> : null}

            <View style={s.modalActionRow}>
              <Pressable style={s.modalCancelBtn} onPress={() => setShowRescheduleModal(false)}>
                <Text style={s.modalCancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={s.modalConfirmBtn} onPress={handleReschedule} disabled={rescheduling}>
                <Text style={s.modalConfirmBtnText}>{rescheduling ? 'Updating…' : 'Confirm New Slot'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* 24x7 Safety SOS Modal */}
      <Modal visible={showSosModal} transparent animationType="fade" onRequestClose={() => setShowSosModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.sosModalCard}>
            <View style={s.sosHeaderRow}>
              <Text style={s.sosShieldIcon}>🚨</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.sosModalTitle}>24x7 Emergency Safety SOS</Text>
                <Text style={s.sosModalSubtitle}>Direct connection to emergency dispatch and safety team</Text>
              </View>
              <Pressable style={s.sosCloseBtn} onPress={() => setShowSosModal(false)}>
                <Text style={s.sosCloseBtnText}>✕</Text>
              </Pressable>
            </View>

            {/* GPS Location Broadcast Badge */}
            <View style={s.sosGpsCard}>
              <Text style={s.sosGpsLabel}>📍 YOUR CURRENT SERVICE ADDRESS</Text>
              <Text style={s.sosGpsAddress}>{b?.address}</Text>
              {b?.latitude != null && b?.longitude != null ? (
                <Text style={s.sosGpsCoords}>GPS Coordinates: {b.latitude.toFixed(4)}° N, {b.longitude.toFixed(4)}° E</Text>
              ) : null}
            </View>

            {/* Instant Emergency Dialers */}
            <Text style={s.sosHelplineHeading}>ONE-TAP EMERGENCY DIALERS</Text>

            <Pressable
              style={s.sosDialerBtnPolice}
              onPress={() => Linking.openURL('tel:112')}
            >
              <Text style={s.sosDialerIcon}>👮</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.sosDialerTitle}>Police & Emergency Services</Text>
                <Text style={s.sosDialerSubtitle}>National Emergency Number: 112</Text>
              </View>
              <Text style={s.sosCallNowText}>Call 112 ➔</Text>
            </Pressable>

            <Pressable
              style={s.sosDialerBtnWomen}
              onPress={() => Linking.openURL('tel:1091')}
            >
              <Text style={s.sosDialerIcon}>🛡️</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.sosDialerTitle}>National Women Safety Helpline</Text>
                <Text style={s.sosDialerSubtitle}>Toll-free emergency line: 1091</Text>
              </View>
              <Text style={s.sosCallNowText}>Call 1091 ➔</Text>
            </Pressable>

            <Pressable
              style={s.sosDialerBtnOpustia}
              onPress={() => Linking.openURL('tel:18008896787')}
            >
              <Text style={s.sosDialerIcon}>📞</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.sosDialerTitle}>Opustia Rapid Safety Desk</Text>
                <Text style={s.sosDialerSubtitle}>24x7 Priority Consumer Helpline: 1800-889-OPUS</Text>
              </View>
              <Text style={s.sosCallNowText}>Call Desk ➔</Text>
            </Pressable>

            {/* Dispatch Incident Alert Button */}
            <Pressable
              style={s.sosAlertBtn}
              onPress={triggerSos}
              disabled={sendingSos}
            >
              <Text style={s.sosAlertBtnText}>
                {sendingSos ? 'Transmitting Alert…' : 'Transmit Live SOS Alert to Opustia Trust Desk'}
              </Text>
            </Pressable>

            {sosResult ? (
              <View style={s.sosSuccessNotice}>
                <Text style={s.sosSuccessNoticeTitle}>✓ Live Safety Alert Dispatched</Text>
                <Text style={s.sosSuccessNoticeText}>Ref: {sosResult.sosReference}. Priority safety officer notified.</Text>
              </View>
            ) : null}

            {sosError ? <Text style={s.error}>{sosError}</Text> : null}
          </View>
        </View>
      </Modal>

      {/* Invoice & Warranty Certificate Modal */}
      <Modal visible={showInvoiceModal} transparent animationType="fade" onRequestClose={() => setShowInvoiceModal(false)}>
        <View style={s.modalOverlay}>
          <ScrollView contentContainerStyle={{ paddingVertical: 24, alignItems: 'center' }} style={{ width: '100%' }}>
            <View style={s.invoiceCard}>
              {loadingInvoice ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ActivityIndicator color="#000000" size="large" />
                  <Text style={{ marginTop: 12, color: '#666', fontWeight: '600' }}>Generating official GST invoice...</Text>
                </View>
              ) : invoiceData ? (
                <View>
                  {/* Letterhead */}
                  <View style={s.invoiceHeader}>
                    <View>
                      <Text style={s.invoiceBrand}>OPUSTIA</Text>
                      <Text style={s.invoiceSubtitle}>Home Services Marketplace</Text>
                      <Text style={s.invoiceMetaText}>GSTIN: 29AAFCO1234M1Z5</Text>
                      <Text style={s.invoiceMetaText}>100ft Road, Indiranagar, Bengaluru</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <View style={s.taxBadge}>
                        <Text style={s.taxBadgeText}>TAX INVOICE</Text>
                      </View>
                      <Text style={s.invoiceNumText}>{invoiceData.invoiceNumber}</Text>
                      <Text style={s.invoiceDateText}>
                        Date: {new Date(invoiceData.invoiceDate).toLocaleDateString('en-IN')}
                      </Text>
                    </View>
                  </View>

                  <View style={s.invoiceDivider} />

                  {/* Parties */}
                  <View style={s.invoicePartyRow}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={s.partyLabel}>BILLED TO:</Text>
                      <Text style={s.partyName}>{invoiceData.customer.name}</Text>
                      <Text style={s.partyDetail}>{invoiceData.customer.address}</Text>
                      <Text style={s.partyDetail}>{invoiceData.customer.email}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.partyLabel}>SERVICE PROVIDED BY:</Text>
                      <Text style={s.partyName}>{invoiceData.professional.businessName || invoiceData.professional.name}</Text>
                      <Text style={s.partyDetail}>{invoiceData.professional.serviceArea || 'Bengaluru'}</Text>
                      <Text style={s.partyDetail}>Status: Opustia Verified Partner</Text>
                    </View>
                  </View>

                  {/* Itemized Table */}
                  <View style={s.tableHeader}>
                    <Text style={[s.colDesc, s.tableHeaderText]}>Description & SAC</Text>
                    <Text style={[s.colQty, s.tableHeaderText]}>Qty</Text>
                    <Text style={[s.colAmt, s.tableHeaderText]}>Amount (₹)</Text>
                  </View>

                  {invoiceData.lineItems.map((item, idx) => (
                    <View key={idx} style={s.tableRow}>
                      <View style={s.colDesc}>
                        <Text style={s.itemDesc}>{item.description}</Text>
                        <Text style={s.itemSac}>SAC: {item.sacCode}</Text>
                      </View>
                      <Text style={s.colQty}>1</Text>
                      <Text style={s.colAmt}>₹{item.amount.toLocaleString('en-IN')}</Text>
                    </View>
                  ))}

                  {/* Summary Rows */}
                  <View style={s.summaryContainer}>
                    <View style={s.summaryRow}>
                      <Text style={s.summaryLabel}>Taxable Subtotal</Text>
                      <Text style={s.summaryValue}>₹{invoiceData.taxableAmount.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={s.summaryRow}>
                      <Text style={s.summaryLabel}>CGST (9.0%)</Text>
                      <Text style={s.summaryValue}>₹{invoiceData.cgst.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={s.summaryRow}>
                      <Text style={s.summaryLabel}>SGST (9.0%)</Text>
                      <Text style={s.summaryValue}>₹{invoiceData.sgst.toLocaleString('en-IN')}</Text>
                    </View>
                    <View style={[s.summaryRow, s.summaryTotalRow]}>
                      <Text style={s.summaryTotalLabel}>Grand Total (INR)</Text>
                      <Text style={s.summaryTotalValue}>₹{invoiceData.totalAmount.toLocaleString('en-IN')}</Text>
                    </View>
                  </View>

                  {/* Payment Verification Seal */}
                  <View style={s.sealBox}>
                    <Text style={s.sealIcon}>✅</Text>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={s.sealTitle}>PAYMENT COMPLETED & VERIFIED</Text>
                      <Text style={s.sealText}>Mode: Razorpay Secured Payment</Text>
                      <Text style={s.sealText}>Txn ID: {invoiceData.payment.transactionId || 'OPUSTIA_SANDBOX_TXN'}</Text>
                      {invoiceData.payment.verifiedAt && (
                        <Text style={s.sealText}>
                          Settled: {new Date(invoiceData.payment.verifiedAt).toLocaleString('en-IN')}
                        </Text>
                      )}
                    </View>
                  </View>

                  {/* Official Opustia Warranty Certificate */}
                  <View style={s.certificateBox}>
                    <View style={s.certHeader}>
                      <Text style={s.certBadge}>🛡️ OPUSTIA PROTECTION</Text>
                      <Text style={s.certWarrantyDays}>{invoiceData.warrantyDays}-Day Guarantee</Text>
                    </View>
                    <Text style={s.certTitle}>Official Service Warranty Certificate</Text>
                    <Text style={s.certBody}>
                      Guaranteed protection against defects and rework requirements until{' '}
                      {new Date(invoiceData.warrantyExpiresAt).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}. Free inspection and service rework are guaranteed under the Opustia Quality Pledge.
                    </Text>
                  </View>

                  {/* Action Buttons */}
                  <View style={s.invoiceModalActions}>
                    {Platform.OS === 'web' && (
                      <Pressable
                        style={s.printPillBtn}
                        onPress={() => {
                          if (typeof window !== 'undefined') window.print();
                        }}
                      >
                        <Text style={s.printPillBtnText}>🖨️ Print / Save PDF</Text>
                      </Pressable>
                    )}
                    <Pressable style={s.closePillBtn} onPress={() => setShowInvoiceModal(false)}>
                      <Text style={s.closePillBtnText}>Close</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ color: '#000', fontWeight: '600' }}>Unable to load invoice at this time.</Text>
                  <Pressable style={[s.closePillBtn, { marginTop: 14 }]} onPress={() => setShowInvoiceModal(false)}>
                    <Text style={s.closePillBtnText}>Close</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#ffffff' },
  content: {
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 60,
  },
  centerBox: { paddingVertical: 40, alignItems: 'center' },
  backBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    marginBottom: 16,
  },
  backText: { color: '#000000', fontWeight: '700', fontSize: 13 },

  headerCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  title: { fontSize: 24, fontWeight: '800', color: '#000000', letterSpacing: -0.2 },
  scheduleText: { fontSize: 13, fontWeight: '600', color: '#555555', marginTop: 4 },
  addressText: { fontSize: 13, color: '#777777', marginTop: 3 },

  statusBadge: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  statusBadgeText: { color: '#000000', fontWeight: '800', fontSize: 11, letterSpacing: 0.5 },
  statusCancelled: { backgroundColor: '#fee2e2' },
  statusTextCancelled: { color: '#dc2626' },
  statusPaid: { backgroundColor: '#000000' },
  statusTextPaid: { color: '#ffffff' },

  actionRow: { marginTop: 16, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 14 },
  chatPillBtn: {
    backgroundColor: '#000000',
    paddingVertical: 12,
    borderRadius: 9999,
    alignItems: 'center',
  },
  chatPillBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },

  stepperCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 18,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardMiniHeading: { fontSize: 11, fontWeight: '800', color: '#888888', letterSpacing: 1, marginBottom: 14 },
  stepperScroll: { flexDirection: 'row', alignItems: 'center' },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 9999,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleDone: { backgroundColor: '#000000' },
  stepCircleCurrent: { backgroundColor: '#000000', borderWidth: 2, borderColor: '#666' },
  stepNumber: { fontSize: 11, fontWeight: '800', color: '#888888' },
  stepNumberActive: { color: '#ffffff' },
  stepLabel: { marginLeft: 8, marginRight: 10, fontSize: 12, fontWeight: '600', color: '#888888' },
  stepLabelActive: { color: '#000000', fontWeight: '800' },
  stepLine: { width: 16, height: 2, backgroundColor: '#e5e5e5', marginRight: 10 },
  stepLineDone: { backgroundColor: '#000000' },

  messageBox: {
    backgroundColor: '#000000',
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  messageText: { color: '#ffffff', fontWeight: '700', fontSize: 13, textAlign: 'center' },

  errorBox: {
    backgroundColor: '#fee2e2',
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  error: { color: '#dc2626', fontWeight: '700', fontSize: 13 },
  muted: { color: '#777777', fontSize: 13, lineHeight: 18 },

  cancelledCard: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cancelledTitle: { fontSize: 16, fontWeight: '800', color: '#991b1b', marginBottom: 4 },
  cancelledReason: { color: '#b91c1c', fontSize: 13, marginTop: 2 },
  cancelledMeta: { color: '#dc2626', fontSize: 11, marginTop: 4, fontStyle: 'italic' },
  reorderPill: {
    backgroundColor: '#000000',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 9999,
    alignItems: 'center',
    marginTop: 12,
  },
  reorderPillText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },

  cancelActionBox: { marginBottom: 16 },
  cancelButton: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 12,
    borderRadius: 9999,
    alignItems: 'center',
  },
  cancelButtonText: { color: '#777777', fontWeight: '700', fontSize: 13 },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 18,
    marginBottom: 16,
    overflow: 'hidden',
  },
  cardHeaderRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  cardIcon: { fontSize: 24 },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#000000' },
  cardHeading: { fontSize: 17, fontWeight: '800', color: '#000000', marginBottom: 12 },
  cardBody: { fontSize: 13, color: '#555555', marginTop: 3, lineHeight: 18 },
  cardMutedMeta: { fontSize: 12, color: '#888888', marginTop: 4, fontWeight: '600' },

  secondaryPillBtn: {
    backgroundColor: '#f8fafc',
    borderRadius: 9999,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    marginTop: 14,
  },
  secondaryPillBtnText: { color: '#000000', fontWeight: '700', fontSize: 13 },

  // Transit Tracker
  transitCard: {
    backgroundColor: '#000000',
    borderRadius: 24,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
  },
  transitHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  transitIcon: { fontSize: 28 },
  transitTitle: { fontSize: 17, fontWeight: '800', color: '#ffffff' },
  transitSub: { fontSize: 12, color: '#aaaaaa', marginTop: 2 },
  etaBadge: { backgroundColor: '#ffffff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999 },
  etaBadgeText: { color: '#000000', fontWeight: '800', fontSize: 11 },
  transitTrack: { height: 6, backgroundColor: '#333333', borderRadius: 9999, overflow: 'hidden', marginBottom: 6 },
  transitFill: { width: '70%', height: '100%', backgroundColor: '#ffffff', borderRadius: 9999 },
  transitMetaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  transitMetaText: { fontSize: 11, color: '#888888' },
  transitMetaHighlight: { fontSize: 12, fontWeight: '800', color: '#ffffff' },

  darkCta: {
    backgroundColor: '#000000',
    paddingVertical: 14,
    borderRadius: 9999,
    alignItems: 'center',
    marginTop: 12,
  },
  darkCtaText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },

  otpContainer: {
    marginTop: 14,
    backgroundColor: '#1a1a1a',
    borderRadius: 18,
    padding: 16,
    alignItems: 'center',
  },
  otpLabel: { fontSize: 10, fontWeight: '800', color: '#888888', letterSpacing: 1 },
  otpValue: { fontSize: 32, fontWeight: '800', color: '#ffffff', letterSpacing: 6, marginTop: 4 },
  otpInstructions: { fontSize: 12, color: '#aaaaaa', textAlign: 'center', marginTop: 8, lineHeight: 16 },

  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#000000' },
  sectionCount: { backgroundColor: '#f8fafc', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999, fontSize: 12, fontWeight: '700', color: '#000' },

  quoteTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  quoteAmount: { fontSize: 24, fontWeight: '800', color: '#000000' },
  quoteStatusPill: { backgroundColor: '#f8fafc', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  quoteStatusAccepted: { backgroundColor: '#000000' },
  quoteStatusText: { fontSize: 11, fontWeight: '800', color: '#555555' },
  quoteStatusTextAccepted: { color: '#ffffff' },
  quoteDesc: { fontSize: 14, color: '#333333', marginTop: 4 },
  quoteMeta: { fontSize: 12, color: '#777777', marginTop: 6, fontWeight: '600' },

  // Paid Box
  paidBox: { backgroundColor: '#f9f9f9', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#eee' },
  paidTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  verifiedPill: { backgroundColor: '#000000', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 9999 },
  verifiedPillText: { color: '#ffffff', fontWeight: '800', fontSize: 11 },
  paidAmount: { fontSize: 24, fontWeight: '800', color: '#000000' },
  receiptMeta: { color: '#666666', fontSize: 12, marginTop: 3 },
  paidSandboxNotice: { color: '#555555', fontSize: 12, fontWeight: '600', marginTop: 8 },
  paidActionRow: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  darkSmallPill: { backgroundColor: '#000000', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 9999 },
  darkSmallPillText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  lightSmallPill: { backgroundColor: '#f8fafc', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 9999 },
  lightSmallPillText: { color: '#000000', fontWeight: '700', fontSize: 13 },

  // Unpaid Box
  unpaidBox: { marginTop: 4 },
  unpaidNotice: { color: '#555555', fontSize: 13, marginBottom: 12 },
  breakdownCard: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, marginBottom: 14 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  breakdownLabel: { color: '#666666', fontSize: 13 },
  breakdownValue: { color: '#000000', fontWeight: '700', fontSize: 13 },
  breakdownDiscount: { color: '#16a34a', fontWeight: '700', fontSize: 13 },
  breakdownTotalRow: { borderTopWidth: 1, borderTopColor: '#e0dedd', paddingTop: 8, marginTop: 6 },
  breakdownTotalLabel: { fontWeight: '800', color: '#000000', fontSize: 15 },
  breakdownTotalValue: { fontWeight: '800', color: '#000000', fontSize: 18 },

  // Warranty
  warrantyHeader: { flexDirection: 'row', alignItems: 'center' },
  warrantyShield: { fontSize: 26 },
  warrantyStatusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  warrantyActiveBadge: { backgroundColor: '#000000' },
  warrantyExpiredBadge: { backgroundColor: '#f8fafc' },
  warrantyStatusText: { fontSize: 11, fontWeight: '800' },
  warrantyActiveText: { color: '#ffffff' },
  warrantyExpiredText: { color: '#777777' },
  warrantyBody: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#f1f5f9', paddingTop: 10 },
  warrantyDetailText: { fontSize: 13, color: '#555555', lineHeight: 18 },

  supportPill: {
    backgroundColor: '#f8fafc',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 9999,
    alignItems: 'center',
    marginBottom: 16,
  },
  supportPillText: { color: '#000000', fontWeight: '700', fontSize: 13 },

  // Reviews
  reviewDisplay: { marginTop: 6 },
  reviewStarsRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reviewRatingText: { marginLeft: 8, fontWeight: '800', color: '#000000', fontSize: 14 },
  reviewComment: { color: '#444444', fontSize: 14, fontStyle: 'italic', marginTop: 8 },
  reviewDate: { color: '#888888', fontSize: 12, marginTop: 6 },
  starsRow: { flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 8 },
  star: { fontSize: 28, color: '#e5e5e5' },
  starOn: { fontSize: 28, color: '#000000' },
  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 16,
    padding: 14,
    marginTop: 8,
    minHeight: 70,
    textAlignVertical: 'top',
    color: '#000000',
    fontSize: 14,
  },

  // Modal styles
  
  // Reschedule & Slot Actions
  slotActionRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  rescheduleButton: {
    flex: 1,
    backgroundColor: '#000000',
    paddingVertical: 12,
    borderRadius: 9999,
    alignItems: 'center',
  },
  rescheduleButtonText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  inputLabel: { fontSize: 11, fontWeight: '800', color: '#777777', letterSpacing: 0.8, marginBottom: 6 },
  textInputPill: {
    backgroundColor: '#f8fafc',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#000000',
    fontWeight: '600',
  },
  slotPillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotPill: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  slotPillSelected: { backgroundColor: '#000000' },
  slotPillText: { fontSize: 12, color: '#555555', fontWeight: '700' },
  slotPillTextSelected: { color: '#ffffff' },

  // Safety SOS in Tracker
  sosHeaderPill: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    marginRight: 6,
  },
  sosHeaderPillText: { color: '#ffffff', fontWeight: '800', fontSize: 11 },

  // Safety SOS Modal
  sosModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 22,
    width: '100%',
    maxWidth: 480,
    overflow: 'hidden',
  },
  sosHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  sosShieldIcon: { fontSize: 32 },
  sosModalTitle: { fontSize: 18, fontWeight: '800', color: '#dc2626' },
  sosModalSubtitle: { fontSize: 12, color: '#666666', marginTop: 2 },
  sosCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosCloseBtnText: { fontSize: 14, fontWeight: '800', color: '#000000' },
  sosGpsCard: { backgroundColor: '#fee2e2', borderRadius: 16, padding: 14, marginBottom: 14 },
  sosGpsLabel: { fontSize: 10, fontWeight: '800', color: '#991b1b', letterSpacing: 0.5 },
  sosGpsAddress: { fontSize: 13, color: '#7f1d1d', fontWeight: '700', marginTop: 4 },
  sosGpsCoords: { fontSize: 11, color: '#991b1b', marginTop: 4 },
  sosHelplineHeading: { fontSize: 11, fontWeight: '800', color: '#777777', letterSpacing: 0.8, marginBottom: 8 },
  sosDialerBtnPolice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  sosDialerBtnWomen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  sosDialerBtnOpustia: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 12,
    marginBottom: 12,
    gap: 10,
  },
  sosDialerIcon: { fontSize: 22 },
  sosDialerTitle: { fontSize: 13, fontWeight: '800', color: '#000000' },
  sosDialerSubtitle: { fontSize: 11, color: '#666666', marginTop: 1 },
  sosCallNowText: { fontSize: 12, fontWeight: '800', color: '#dc2626' },
  sosAlertBtn: {
    backgroundColor: '#000000',
    paddingVertical: 13,
    borderRadius: 9999,
    alignItems: 'center',
    marginTop: 4,
  },
  sosAlertBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  sosSuccessNotice: { backgroundColor: '#f8fafc', borderRadius: 14, padding: 12, marginTop: 12 },
  sosSuccessNoticeTitle: { fontSize: 13, fontWeight: '800', color: '#000000' },
  sosSuccessNoticeText: { fontSize: 11, color: '#555555', marginTop: 2 },

  // Promo Coupon UI in Checkout Modal
  couponBox: { backgroundColor: '#f8fafc', borderRadius: 18, padding: 14, marginBottom: 14 },
  couponHeading: { fontSize: 12, fontWeight: '800', color: '#000000', marginBottom: 8 },
  couponInputRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  couponInput: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  couponApplyBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  couponApplyBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
  couponChipsRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  couponChip: { backgroundColor: '#ffffff', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  couponChipText: { fontSize: 11, fontWeight: '700', color: '#000000' },
  couponSuccessText: { color: '#16a34a', fontSize: 12, fontWeight: '700', marginTop: 6 },
  couponErrorText: { color: '#dc2626', fontSize: 12, fontWeight: '700', marginTop: 6 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#ffffff', borderRadius: 28, padding: 24, width: '100%', maxWidth: 440, overflow: 'hidden' },
  modalHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#000000' },
  modalSub: { fontSize: 13, color: '#777777', marginTop: 4, marginBottom: 14 },
  sandboxPill: { backgroundColor: '#f8fafc', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  sandboxPillText: { color: '#000000', fontSize: 10, fontWeight: '800' },
  modalAmountBox: {
    backgroundColor: '#f8fafc',
    padding: 14,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalAmountLabel: { color: '#666666', fontWeight: '700' },
  modalAmountValue: { fontSize: 22, fontWeight: '800', color: '#000000' },
  methodHeading: { fontSize: 13, fontWeight: '800', color: '#000000', marginBottom: 10 },
  methodOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    marginBottom: 8,
    gap: 10,
  },
  methodSelected: { borderColor: '#000000', backgroundColor: '#fafafa' },
  methodIcon: { fontSize: 22 },
  methodName: { fontWeight: '700', color: '#000000', fontSize: 14 },
  methodDesc: { color: '#777777', fontSize: 12, marginTop: 2 },
  radioCircle: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#ccc' },
  radioCircleOn: { borderColor: '#000000', backgroundColor: '#000000' },

  cancelOption: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    marginBottom: 8,
  },
  cancelOptionSelected: { borderColor: '#000000', backgroundColor: '#f8fafc' },
  cancelOptionText: { color: '#555555', fontSize: 13 },
  cancelOptionTextSelected: { color: '#000000', fontWeight: '800', fontSize: 13 },

  modalActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  modalCancelBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 9999, backgroundColor: '#f8fafc' },
  modalCancelBtnText: { color: '#000000', fontWeight: '700' },
  modalConfirmBtn: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 9999, backgroundColor: '#000000' },
  modalConfirmBtnText: { color: '#ffffff', fontWeight: '800' },
  modalDangerBtn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 9999, backgroundColor: '#dc2626' },
  modalDangerBtnText: { color: '#ffffff', fontWeight: '800' },

  // Invoice Modal Card
  invoiceCard: { backgroundColor: '#ffffff', borderRadius: 28, padding: 24, width: '100%', maxWidth: 540, overflow: 'hidden' },
  invoiceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  invoiceBrand: { fontSize: 22, fontWeight: '800', color: '#000000', letterSpacing: 1.5 },
  invoiceSubtitle: { fontSize: 12, color: '#777777', fontWeight: '600', marginTop: 2 },
  invoiceMetaText: { fontSize: 11, color: '#888888', marginTop: 2 },
  taxBadge: { backgroundColor: '#000000', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, alignSelf: 'flex-end', marginBottom: 6 },
  taxBadgeText: { color: '#ffffff', fontWeight: '800', fontSize: 10, letterSpacing: 1 },
  invoiceNumText: { fontSize: 13, fontWeight: '800', color: '#000000', textAlign: 'right' },
  invoiceDateText: { fontSize: 11, color: '#777777', textAlign: 'right', marginTop: 2 },
  invoiceDivider: { height: 1, backgroundColor: '#e5e5e5', marginVertical: 14 },
  invoicePartyRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, backgroundColor: '#f8fafc', padding: 14, borderRadius: 16 },
  partyLabel: { fontSize: 10, fontWeight: '800', color: '#777777', letterSpacing: 0.8, marginBottom: 4 },
  partyName: { fontSize: 13, fontWeight: '800', color: '#000000' },
  partyDetail: { fontSize: 12, color: '#555555', marginTop: 2, lineHeight: 16 },

  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, marginTop: 14 },
  tableHeaderText: { fontSize: 11, fontWeight: '800', color: '#000000' },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', alignItems: 'center' },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: 'center', fontSize: 12, color: '#555555' },
  colAmt: { flex: 1.5, textAlign: 'right', fontSize: 13, fontWeight: '700', color: '#000000' },
  itemDesc: { fontSize: 13, fontWeight: '700', color: '#000000' },
  itemSac: { fontSize: 11, color: '#777777', marginTop: 2 },
  summaryContainer: { marginTop: 12, paddingHorizontal: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontSize: 13, color: '#666666' },
  summaryValue: { fontSize: 13, fontWeight: '600', color: '#000000' },
  summaryTotalRow: { borderTopWidth: 1.5, borderTopColor: '#000000', paddingTop: 8, marginTop: 6 },
  summaryTotalLabel: { fontSize: 15, fontWeight: '800', color: '#000000' },
  summaryTotalValue: { fontSize: 18, fontWeight: '800', color: '#000000' },

  sealBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f9f9f9', borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 16, padding: 12, marginTop: 14 },
  sealIcon: { fontSize: 24 },
  sealTitle: { fontSize: 12, fontWeight: '800', color: '#000000', letterSpacing: 0.5 },
  sealText: { fontSize: 11, color: '#555555', marginTop: 2 },

  certificateBox: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, marginTop: 14 },
  certHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  certBadge: { fontSize: 11, fontWeight: '800', color: '#000000', letterSpacing: 0.5 },
  certWarrantyDays: { backgroundColor: '#000000', color: '#ffffff', fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 9999 },
  certTitle: { fontSize: 14, fontWeight: '800', color: '#000000', marginBottom: 4 },
  certBody: { fontSize: 12, color: '#555555', lineHeight: 17 },

  invoiceModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  printPillBtn: { backgroundColor: '#f8fafc', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 9999 },
  printPillBtnText: { color: '#000000', fontWeight: '700', fontSize: 13 },
  closePillBtn: { backgroundColor: '#000000', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 9999 },
  closePillBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
});
