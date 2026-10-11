import { useEffect, useMemo, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, Booking, EarningsData, SessionUser } from '../../lib/api';
import { login, readSession } from '../../store/auth';

const PRO_CANCELLATION_OPTIONS = [
  'Schedule conflict / fully booked',
  'Outside service area',
  'Cannot handle requested problem',
  'Emergency / unavailable',
  'Other',
];

export default function ProfessionalDashboard() {
  const [items, setItems] = useState<Booking[]>([]);
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState('');
  const [quoteFor, setQuoteFor] = useState<string | null>(null);
  const [otpFor, setOtpFor] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [labour, setLabour] = useState('499');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');

  // Clean filter tab
  const [activeTab, setActiveTab] = useState<'all' | 'action_needed' | 'completed' | 'cancelled'>('all');

  const [declineTargetId, setDeclineTargetId] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState('Schedule conflict / fully booked');
  const [customDeclineReason, setCustomDeclineReason] = useState('');
  const [isOnline, setIsOnline] = useState(true);
  const [submittingDecline, setSubmittingDecline] = useState(false);

  const load = async () => {
    const session = await readSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    setCurrentUser(session.user);
    if (session.user.role !== 'PROFESSIONAL') {
      setError(
        'Signed in as ' + session.user.name + ' (' + session.user.role + '). Switch to Pro account to manage jobs.'
      );
      setBusy(false);
      return;
    }
    setError('');
    try {
      const [bookings, earn] = await Promise.all([
        api.getBookings(session.accessToken),
        api.getProfessionalEarnings(session.accessToken).catch(() => null),
      ]);
      setItems(bookings);
      setEarnings(earn);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load requests');
    } finally {
      setBusy(false);
    }
  };

  const switchToPro = async () => {
    setBusy(true);
    setError('');
    try {
      const user = await login('pro@opustia.demo', 'demo123');
      setCurrentUser(user);
      const session = await readSession();
      if (session) {
        const [bookings, earn] = await Promise.all([
          api.getBookings(session.accessToken),
          api.getProfessionalEarnings(session.accessToken).catch(() => null),
        ]);
        setItems(bookings);
        setEarnings(earn);
        setMessage('Switched to Professional account (Ravi Kumar)!');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to switch to professional account');
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const act = async (id: string, status: string, reason?: string) => {
    const session = await readSession();
    if (!session) return;
    try {
      await api.updateBookingStatus(session.accessToken, id, status, reason);
      setMessage('Booking marked ' + status.replaceAll('_', ' ').toLowerCase() + '.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update booking');
    }
  };

  const openDeclineModal = (id: string) => {
    setDeclineTargetId(id);
    setDeclineReason('Schedule conflict / fully booked');
    setCustomDeclineReason('');
  };

  const confirmDecline = async () => {
    if (!declineTargetId) return;
    setSubmittingDecline(true);
    try {
      const finalReason =
        declineReason === 'Other'
          ? customDeclineReason.trim() || 'Other reason'
          : declineReason;
      await act(declineTargetId, 'CANCELLED', finalReason);
      setDeclineTargetId(null);
    } finally {
      setSubmittingDecline(false);
    }
  };

  const sendQuote = async (id: string) => {
    const session = await readSession();
    if (!session) return;
    try {
      await api.createQuote(session.accessToken, {
        bookingId: id,
        labour: Number(labour),
        parts: 0,
        additional: 0,
        description,
      });
      setMessage('Quote sent to customer.');
      setQuoteFor(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to send quote');
    }
  };

  const verifyOtp = async (id: string) => {
    const session = await readSession();
    if (!session) return;
    try {
      await api.verifyArrivalOtp(session.accessToken, id, otp.trim());
      setMessage('Arrival OTP verified. Service started.');
      setOtpFor(null);
      setOtp('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Invalid OTP code');
    }
  };

  const actionNeededCount = useMemo(() => {
    return items.filter((b) =>
      ['REQUESTED', 'ACCEPTED', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED'].includes(
        b.status
      )
    ).length;
  }, [items]);

  const completedCount = useMemo(() => {
    return items.filter((b) => b.status === 'COMPLETED').length;
  }, [items]);

  const cancelledCount = useMemo(() => {
    return items.filter((b) => ['CANCELLED', 'DISPUTED'].includes(b.status)).length;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (activeTab === 'action_needed') {
      return items.filter((b) =>
        ['REQUESTED', 'ACCEPTED', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED'].includes(
          b.status
        )
      );
    }
    if (activeTab === 'completed') {
      return items.filter((b) => b.status === 'COMPLETED');
    }
    if (activeTab === 'cancelled') {
      return items.filter((b) => ['CANCELLED', 'DISPUTED'].includes(b.status));
    }
    return items;
  }, [items, activeTab]);

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      {/* Top Header Bar */}
      <View style={s.topNav}>
        <Pressable onPress={() => router.push('/')} style={s.navBackBtn}>
          <Text style={s.navBackText}>‹ Back to Marketplace</Text>
        </Pressable>

        <View style={s.navBrand}>
          <View style={s.brandIconBox}>
            <Text style={s.brandIcon}>✦</Text>
          </View>
          <Text style={s.brandTitle}>OPUSTIA / PRO</Text>
        </View>

        <View style={s.topNavRight}>
          {/* Uber-Driver Online / Offline Dispatch Toggle */}
          <Pressable
            style={[s.onlineTogglePill, isOnline ? s.onlineActive : s.onlineInactive]}
            onPress={() => setIsOnline(!isOnline)}
          >
            <View style={[s.onlineDot, isOnline ? s.onlineDotActive : s.onlineDotInactive]} />
            <Text style={[s.onlineToggleText, isOnline ? s.onlineTextActive : s.onlineTextInactive]}>
              {isOnline ? 'ONLINE · Accepting Dispatches' : 'OFFLINE · Paused'}
            </Text>
          </Pressable>

          {currentUser ? (
            <View style={s.userPill}>
              <View style={s.userDot} />
              <Text style={s.userName}>{currentUser.name}</Text>
            </View>
          ) : null}
        </View>
      </View>

      {/* Main Hero Header */}
      <View style={s.hero}>
        <View style={s.heroTitleRow}>
          <Text style={s.heroTitle}>Your requests</Text>
          <View style={[s.statusPillBadge, isOnline ? s.statusPillGreen : s.statusPillGray]}>
            <Text style={[s.statusPillText, isOnline ? s.statusTextGreen : s.statusTextGray]}>
              {isOnline ? '🟢 Live Dispatch Active' : '⚪ Dispatch Paused'}
            </Text>
          </View>
        </View>
        <Text style={s.heroSubtitle}>
          {isOnline
            ? 'You are active. New doorstep customer requests will appear in real time below.'
            : 'You are currently offline. Switch to ONLINE above when you are ready to receive jobs.'}
        </Text>
      </View>

      {message ? (
        <View style={s.messageBanner}>
          <Text style={s.messageBannerText}>✓ {message}</Text>
        </View>
      ) : null}

      {error ? (
        <View style={s.errorBanner}>
          <Text style={s.errorBannerText}>⚠️ {error}</Text>
        </View>
      ) : null}

      {/* Clean Stats Strip (Apple-style airy counter) */}
      {currentUser?.role === 'PROFESSIONAL' && earnings && (
        <View style={s.statsCard}>
          <View style={s.statCol}>
            <Text style={s.statNum}>
              ₹{earnings.totalEarnings.toLocaleString('en-IN')}
            </Text>
            <Text style={s.statText}>Earnings</Text>
          </View>

          <View style={s.statDivider} />

          <View style={s.statCol}>
            <Text style={s.statNum}>{earnings.completedJobs}</Text>
            <Text style={s.statText}>Completed</Text>
          </View>

          <View style={s.statDivider} />

          <View style={s.statCol}>
            <Text style={s.statNum}>
              {earnings.rating > 0 ? earnings.rating.toFixed(1) : '5.0'} ★
            </Text>
            <Text style={s.statText}>Rating</Text>
          </View>

          <View style={s.statDivider} />

          <View style={s.statCol}>
            <Text style={s.statNum}>{earnings.onTime}%</Text>
            <Text style={s.statText}>On-Time</Text>
          </View>
        </View>
      )}

      {/* Clean Filter Pill Row */}
      <View style={s.tabsRow}>
        <Pressable
          style={[s.tabPill, activeTab === 'all' && s.tabPillActive]}
          onPress={() => setActiveTab('all')}
        >
          <Text style={[s.tabPillText, activeTab === 'all' && s.tabPillTextActive]}>
            All ({items.length})
          </Text>
        </Pressable>

        <Pressable
          style={[s.tabPill, activeTab === 'action_needed' && s.tabPillActive]}
          onPress={() => setActiveTab('action_needed')}
        >
          <Text style={[s.tabPillText, activeTab === 'action_needed' && s.tabPillTextActive]}>
            Active ({actionNeededCount})
          </Text>
        </Pressable>

        <Pressable
          style={[s.tabPill, activeTab === 'completed' && s.tabPillActive]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[s.tabPillText, activeTab === 'completed' && s.tabPillTextActive]}>
            Completed ({completedCount})
          </Text>
        </Pressable>

        <Pressable
          style={[s.tabPill, activeTab === 'cancelled' && s.tabPillActive]}
          onPress={() => setActiveTab('cancelled')}
        >
          <Text style={[s.tabPillText, activeTab === 'cancelled' && s.tabPillTextActive]}>
            Cancelled ({cancelledCount})
          </Text>
        </Pressable>
      </View>

      {busy ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color="#0f172a" size="large" />
          <Text style={s.loadingText}>Loading requests...</Text>
        </View>
      ) : currentUser?.role !== 'PROFESSIONAL' ? (
        <View style={s.card}>
          <Text style={s.cardTitle}>Signed in as Customer</Text>
          <Text style={s.metaText}>
            You are currently signed in as {currentUser?.name}. Switch to Ravi Kumar to manage partner dispatches.
          </Text>
          <Pressable style={s.blackPillBtn} onPress={switchToPro}>
            <Text style={s.blackPillBtnText}>Switch to Pro Account ➔</Text>
          </Pressable>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={s.emptyCard}>
          <Text style={s.emptyIcon}>📋</Text>
          <Text style={s.emptyTitle}>No bookings</Text>
          <Text style={s.emptySub}>
            {activeTab === 'action_needed'
              ? 'No active requests requiring attention.'
              : 'Requests will appear here.'}
          </Text>
        </View>
      ) : (
        filteredItems.map((b) => (
          <View key={b.id} style={s.card}>
            {/* Header: Service Name & Status Pill */}
            <View style={s.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{b.service}</Text>
                <Text style={s.metaText}>
                  📅 {b.date} · ⏰ {b.time} · 📍 {b.address}
                </Text>
              </View>

              <View
                style={[
                  s.statusBadge,
                  b.status === 'COMPLETED' && s.statusBadgeDone,
                  b.status === 'CANCELLED' && s.statusBadgeCancelled,
                  ['ON_THE_WAY', 'SERVICE_STARTED'].includes(b.status) && s.statusBadgeActive,
                ]}
              >
                <Text
                  style={[
                    s.statusBadgeText,
                    b.status === 'COMPLETED' && s.statusBadgeTextDone,
                    b.status === 'CANCELLED' && s.statusBadgeTextCancelled,
                    ['ON_THE_WAY', 'SERVICE_STARTED'].includes(b.status) && s.statusBadgeTextActive,
                  ]}
                >
                  {b.status.replaceAll('_', ' ')}
                </Text>
              </View>
            </View>

            {/* Problem note if present */}
            {b.problem ? (
              <View style={s.issueQuoteBox}>
                <Text style={s.issueQuoteText}>"{b.problem}"</Text>
              </View>
            ) : null}

            {/* Cancelled reason */}
            {b.status === 'CANCELLED' && (
              <View style={s.cancelledNote}>
                <Text style={s.cancelledNoteText}>
                  Cancelled: {b.cancellationReason || 'No reason provided'}
                </Text>
              </View>
            )}

            {/* Action Buttons Row */}
            <View style={s.actionsRow}>
              {b.status === 'REQUESTED' && (
                <>
                  <Pressable style={s.blackBtn} onPress={() => act(b.id, 'ACCEPTED')}>
                    <Text style={s.blackBtnText}>Accept Request</Text>
                  </Pressable>
                  <Pressable style={s.greyBtn} onPress={() => openDeclineModal(b.id)}>
                    <Text style={s.greyBtnText}>Decline</Text>
                  </Pressable>
                </>
              )}

              {b.status === 'ACCEPTED' && (
                <>
                  <Pressable
                    style={s.blackBtn}
                    onPress={() => setQuoteFor(quoteFor === b.id ? null : b.id)}
                  >
                    <Text style={s.blackBtnText}>
                      {quoteFor === b.id ? 'Close Quote' : 'Submit Quote'}
                    </Text>
                  </Pressable>
                  <Pressable style={s.greyBtn} onPress={() => openDeclineModal(b.id)}>
                    <Text style={s.greyBtnText}>Cancel</Text>
                  </Pressable>
                </>
              )}

              {b.status === 'CONFIRMED' && (
                <>
                  <Pressable style={s.blackBtn} onPress={() => act(b.id, 'ON_THE_WAY')}>
                    <Text style={s.blackBtnText}>Start Travel 🚗</Text>
                  </Pressable>
                  <Pressable style={s.greyBtn} onPress={() => openDeclineModal(b.id)}>
                    <Text style={s.greyBtnText}>Cancel</Text>
                  </Pressable>
                </>
              )}

              {b.status === 'ON_THE_WAY' && (
                <Pressable
                  style={s.blackBtn}
                  onPress={() => setOtpFor(otpFor === b.id ? null : b.id)}
                >
                  <Text style={s.blackBtnText}>
                    {otpFor === b.id ? 'Close OTP' : 'Verify Arrival OTP 🔑'}
                  </Text>
                </Pressable>
              )}

              {b.status === 'SERVICE_STARTED' && (
                <Pressable style={s.emeraldBtn} onPress={() => act(b.id, 'COMPLETED')}>
                  <Text style={s.emeraldBtnText}>Complete Work ✓</Text>
                </Pressable>
              )}

              {b.status === 'COMPLETED' && (
                <View style={s.settledRow}>
                  <Text style={s.settledText}>
                    {b.payment?.status === 'SUCCESS'
                      ? '₹' + b.payment.amount.toLocaleString('en-IN') + ' Settled ✓'
                      : 'Completed ✓'}
                  </Text>
                </View>
              )}

              {/* Utility shortcuts: Maps & Chat */}
              <Pressable
                style={s.iconPill}
                onPress={() =>
                  Linking.openURL(
                    'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(b.address)
                  )
                }
              >
                <Text style={s.iconPillText}>📍 Maps</Text>
              </Pressable>

              {b.status !== 'CANCELLED' && (
                <Pressable
                  style={s.iconPill}
                  onPress={() => router.push('/chat/' + b.id)}
                >
                  <Text style={s.iconPillText}>💬 Chat</Text>
                </Pressable>
              )}
            </View>

            {/* Inline Quote Drawer */}
            {quoteFor === b.id ? (
              <View style={s.drawerBox}>
                <Text style={s.drawerTitle}>Upfront Quote Builder</Text>
                <TextInput
                  value={labour}
                  onChangeText={setLabour}
                  keyboardType="numeric"
                  placeholder="Labour charge in ₹ (e.g. 499)"
                  placeholderTextColor="#94a3b8"
                  style={s.drawerInput}
                />
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Scope & replacement parts description"
                  placeholderTextColor="#94a3b8"
                  style={s.drawerInput}
                />
                <Pressable style={s.blackBtn} onPress={() => sendQuote(b.id)}>
                  <Text style={s.blackBtnText}>Send Quote to Customer ➔</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Inline OTP Drawer */}
            {otpFor === b.id ? (
              <View style={s.drawerBox}>
                <Text style={s.drawerTitle}>Customer 6-Digit Doorstep OTP</Text>
                <TextInput
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="numeric"
                  placeholder="• • • • • •"
                  placeholderTextColor="#cbd5e1"
                  maxLength={6}
                  style={s.otpField}
                />
                <Pressable style={s.blackBtn} onPress={() => verifyOtp(b.id)}>
                  <Text style={s.blackBtnText}>Verify & Start Job ➔</Text>
                </Pressable>
              </View>
            ) : null}

            {/* Customer Review display if completed */}
            {b.review ? (
              <View style={s.reviewBox}>
                <Text style={s.reviewScore}>
                  {'★'.repeat(b.review.rating)}{'☆'.repeat(5 - b.review.rating)} ({b.review.rating}/5)
                </Text>
                {b.review.comment ? (
                  <Text style={s.reviewComment}>"{b.review.comment}"</Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ))
      )}

      {/* ✦ Pro Console Footer & Navigation Bar (Uber-Style Minimalist Architecture) */}
      <View style={s.uberProFooter}>
        <View style={s.uberProFooterTop}>
          <View style={s.uberProFooterBrand}>
            <View style={s.uberProSquare}>
              <Text style={s.uberProSquareText}>✦</Text>
            </View>
            <View>
              <Text style={s.uberProTitle}>OPUSTIA PARTNER NETWORK</Text>
              <Text style={s.uberProSub}>
                Verified professional technician platform · Direct RBI escrow bank payouts
              </Text>
            </View>
          </View>
          <View style={s.uberProHelpBlock}>
            <Text style={s.uberProHelpTitle}>Partner Priority Desk: 1800-889-PROS</Text>
            <Text style={s.uberProHelpSub}>Direct Email: partner-support@opustia.com</Text>
          </View>
        </View>

        {/* Partner Navigation Bar */}
        <View style={s.uberProNavBar}>
          <Text style={s.uberProNavTag}>PARTNER QUICK NAVIGATION</Text>
          <View style={s.uberProNavRow}>
            <Pressable style={s.uberProNavPill} onPress={() => router.push('/')}>
              <Text style={s.uberProNavPillText}>🏠 Marketplace Home</Text>
            </Pressable>
            <Pressable style={[s.uberProNavPill, s.uberProNavPillActive]} onPress={() => {}}>
              <Text style={[s.uberProNavPillText, s.uberProNavPillTextActive]}>
                💼 Pro Partner Console
              </Text>
            </Pressable>
            <Pressable style={s.uberProNavPill} onPress={() => router.push('/bookings')}>
              <Text style={s.uberProNavPillText}>📅 Customer Bookings</Text>
            </Pressable>
            <Pressable style={s.uberProNavPill} onPress={() => router.push('/notifications')}>
              <Text style={s.uberProNavPillText}>🔔 Partner Alerts</Text>
            </Pressable>
            <Pressable style={s.uberProNavPill} onPress={() => router.push('/disputes')}>
              <Text style={s.uberProNavPillText}>⚖️ Resolution Desk</Text>
            </Pressable>
            <Pressable style={s.uberProNavPill} onPress={() => router.push('/support')}>
              <Text style={s.uberProNavPillText}>🎧 Partner Support</Text>
            </Pressable>
          </View>
        </View>

        {/* Partner Policy Pills */}
        <View style={s.uberProPolicyRow}>
          <Pressable style={s.uberProPolicyPill} onPress={() => router.push('/support?tab=terms')}>
            <Text style={s.uberProPolicyText}>📜 Partner Code of Conduct</Text>
          </Pressable>
          <Pressable style={s.uberProPolicyPill} onPress={() => router.push('/support?tab=refund')}>
            <Text style={s.uberProPolicyText}>💸 Instant Escrow Settlement Terms</Text>
          </Pressable>
          <Pressable style={s.uberProPolicyPill} onPress={() => router.push('/support?tab=privacy')}>
            <Text style={s.uberProPolicyText}>🛡️ DPDP Partner Privacy</Text>
          </Pressable>
          <Pressable style={s.uberProPolicyPill} onPress={() => router.push('/support?tab=grievance')}>
            <Text style={s.uberProPolicyText}>🏛️ Grievance Redressal</Text>
          </Pressable>
        </View>

        <View style={s.uberProBottom}>
          <Text style={s.uberProCopy}>
            © 2026 Opustia Technologies India Pvt Ltd · CIN: U72900KA2024PTC184920 · All partner payouts secured under RBI escrow guidelines.
          </Text>
        </View>
      </View>

      {/* Decline / Cancel Modal */}
      <Modal
        visible={Boolean(declineTargetId)}
        transparent
        animationType="fade"
        onRequestClose={() => setDeclineTargetId(null)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Decline Request</Text>
            <Text style={s.modalSub}>Select a reason for declining this request:</Text>

            {PRO_CANCELLATION_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                style={[s.radioOption, declineReason === opt && s.radioSelected]}
                onPress={() => setDeclineReason(opt)}
              >
                <Text
                  style={declineReason === opt ? s.radioTextSelected : s.radioText}
                >
                  {opt}
                </Text>
              </Pressable>
            ))}

            {declineReason === 'Other' && (
              <TextInput
                value={customDeclineReason}
                onChangeText={setCustomDeclineReason}
                placeholder="Reason..."
                placeholderTextColor="#94a3b8"
                style={s.drawerInput}
              />
            )}

            <View style={s.modalActions}>
              <Pressable
                style={s.greyBtn}
                onPress={() => setDeclineTargetId(null)}
              >
                <Text style={s.greyBtnText}>Back</Text>
              </Pressable>
              <Pressable
                style={s.redBtn}
                onPress={confirmDecline}
                disabled={submittingDecline}
              >
                <Text style={s.redBtnText}>
                  {submittingDecline ? 'Submitting...' : 'Confirm'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#ffffff', // Clean Modern Minimalist pure white canvas
  },
  content: {
    maxWidth: 920,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 80,
  },

  // Top Nav Bar
  topNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 32,
    flexWrap: 'wrap',
    gap: 12,
  },
  navBackBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9999,
  },
  navBackText: {
    color: '#0f172a',
    fontWeight: '700',
    fontSize: 13,
  },
  navBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  brandIconBox: {
    backgroundColor: '#0f172a',
    width: 28,
    height: 28,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandIcon: { color: '#ffffff', fontSize: 13, fontWeight: '900' },
  brandTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: 0.6,
  },
  userPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    gap: 8,
  },
  userDot: {
    width: 8,
    height: 8,
    borderRadius: 9999,
    backgroundColor: '#10b981',
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
  },

  // Hero Section
  hero: {
    marginBottom: 28,
  },
  heroTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.8,
  },
  heroSubtitle: {
    fontSize: 15,
    color: '#64748b',
    marginTop: 6,
    lineHeight: 22,
  },

  messageBanner: {
    backgroundColor: '#0f172a',
    padding: 14,
    borderRadius: 16,
    marginBottom: 20,
  },
  messageBannerText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },

  errorBanner: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 14,
    borderRadius: 16,
    marginBottom: 20,
  },
  errorBannerText: { color: '#dc2626', fontSize: 13, fontWeight: '700' },

  // Stats Card (Apple-style pure white card with hairline slate border)
  statsCard: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 24,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    marginBottom: 28,
  },
  statCol: {
    alignItems: 'center',
    flex: 1,
  },
  statNum: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  statText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 34,
    backgroundColor: '#f1f5f9',
  },

  // Tabs Row
  tabsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 22,
  },
  tabPill: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9999,
  },
  tabPillActive: {
    backgroundColor: '#0f172a',
    borderColor: '#0f172a',
  },
  tabPillText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
  },
  tabPillTextActive: {
    color: '#ffffff',
  },

  loadingBox: { paddingVertical: 50, alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#64748b', fontWeight: '600' },

  emptyCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 20,
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a' },
  emptySub: { fontSize: 13, color: '#64748b', marginTop: 4 },

  // Minimal White Booking Card
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
    marginBottom: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 14,
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.3,
  },
  metaText: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 6,
    lineHeight: 20,
  },

  statusBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  statusBadgeDone: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  statusBadgeCancelled: { backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca' },
  statusBadgeActive: { backgroundColor: '#f0fdf4', borderWidth: 1, borderColor: '#bbf7d0' },
  statusBadgeText: { fontSize: 11, fontWeight: '800', color: '#334155' },
  statusBadgeTextDone: { color: '#0f172a' },
  statusBadgeTextCancelled: { color: '#dc2626' },
  statusBadgeTextActive: { color: '#15803d' },

  issueQuoteBox: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#f1f5f9',
    padding: 14,
    borderRadius: 14,
    marginTop: 14,
  },
  issueQuoteText: {
    fontSize: 13,
    color: '#334155',
    fontStyle: 'italic',
    lineHeight: 20,
  },

  cancelledNote: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
    padding: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  cancelledNoteText: { color: '#dc2626', fontSize: 12, fontWeight: '600' },

  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },

  blackBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  blackBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },

  emeraldBtn: {
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  emeraldBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },

  greyBtn: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  greyBtnText: { color: '#0f172a', fontWeight: '700', fontSize: 13 },

  redBtn: {
    backgroundColor: '#dc2626',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  redBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },

  iconPill: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  iconPillText: { color: '#0f172a', fontWeight: '700', fontSize: 12 },

  settledRow: {
    paddingVertical: 6,
  },
  settledText: {
    color: '#059669',
    fontWeight: '800',
    fontSize: 13,
  },

  blackPillBtn: {
    backgroundColor: '#0f172a',
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 9999,
    alignSelf: 'flex-start',
    marginTop: 14,
  },
  blackPillBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },

  // Drawer forms
  drawerBox: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  drawerTitle: { fontSize: 14, fontWeight: '800', color: '#0f172a', marginBottom: 10 },
  drawerInput: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 10,
  },
  otpField: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    padding: 14,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 6,
    color: '#0f172a',
    marginBottom: 12,
  },

  reviewBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  reviewScore: { fontSize: 13, fontWeight: '800', color: '#f59e0b' },
  reviewComment: { fontSize: 13, color: '#475569', fontStyle: 'italic', marginTop: 4 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 24,
    width: '100%',
    maxWidth: 420,
  },
  modalTitle: { fontSize: 19, fontWeight: '800', color: '#0f172a' },
  modalSub: { fontSize: 13, color: '#64748b', marginTop: 4, marginBottom: 16 },
  radioOption: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 8,
  },
  radioSelected: { backgroundColor: '#0f172a', borderColor: '#0f172a' },
  radioText: { color: '#334155', fontSize: 13, fontWeight: '600' },
  radioTextSelected: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },

  // Uber Driver Online Toggle & Hero
  topNavRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  onlineTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    borderWidth: 1.5,
  },
  onlineActive: {
    backgroundColor: '#f0fdf4',
    borderColor: '#15803d',
  },
  onlineInactive: {
    backgroundColor: '#f8fafc',
    borderColor: '#94a3b8',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 9999,
  },
  onlineDotActive: {
    backgroundColor: '#15803d',
  },
  onlineDotInactive: {
    backgroundColor: '#94a3b8',
  },
  onlineToggleText: {
    fontSize: 12,
    fontWeight: '800',
  },
  onlineTextActive: {
    color: '#15803d',
  },
  onlineTextInactive: {
    color: '#64748b',
  },
  heroTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 6,
  },
  statusPillBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 9999,
    borderWidth: 1,
  },
  statusPillGreen: {
    backgroundColor: '#f0fdf4',
    borderColor: '#bbf7d0',
  },
  statusPillGray: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '800',
  },
  statusTextGreen: {
    color: '#15803d',
  },
  statusTextGray: {
    color: '#64748b',
  },

  // Uber-Style Pro Footer
  uberProFooter: {
    marginTop: 48,
    backgroundColor: '#000000',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  uberProFooterTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 24,
  },
  uberProFooterBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  uberProSquare: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uberProSquareText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
  },
  uberProTitle: {
    fontSize: 13,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  uberProSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  uberProHelpBlock: {
    alignItems: 'flex-start',
  },
  uberProHelpTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  uberProHelpSub: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  uberProNavBar: {
    backgroundColor: '#0f172a',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 16,
    marginBottom: 20,
  },
  uberProNavTag: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: '#ffffff',
    marginBottom: 10,
  },
  uberProNavRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  uberProNavPill: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 9999,
  },
  uberProNavPillActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  uberProNavPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  uberProNavPillTextActive: {
    color: '#000000',
  },
  uberProPolicyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  uberProPolicyPill: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 9999,
  },
  uberProPolicyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#cbd5e1',
  },
  uberProBottom: {
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
    paddingTop: 16,
  },
  uberProCopy: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
  },
});
