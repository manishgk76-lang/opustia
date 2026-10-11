import { ActivityIndicator, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import { api, Booking, Invoice } from '../lib/api';
import { readSession } from '../store/auth';

const CANCELLATION_OPTIONS = [
  'Change of plans',
  'Booked by mistake',
  'Found another service provider',
  'Schedule conflict',
  'Pricing or quote too high',
  'Other',
];

export default function Bookings() {
  const [items, setItems] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [activeTab, setActiveTab] = useState<'ALL' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('Change of plans');
  const [customReason, setCustomReason] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const [showInvoiceModal, setShowInvoiceModal] = useState(false);
  const [invoiceData, setInvoiceData] = useState<Invoice | null>(null);
  const [loadingInvoice, setLoadingInvoice] = useState(false);

  const load = async () => {
    const session = await readSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    try {
      setItems(await api.getBookings(session.accessToken));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load bookings');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const openCancelModal = (id: string) => {
    setCancelTargetId(id);
    setCancelReason('Change of plans');
    setCustomReason('');
  };

  const confirmCancel = async () => {
    if (!cancelTargetId) return;
    const session = await readSession();
    if (!session) return;
    setCancelling(true);
    try {
      const finalReason = cancelReason === 'Other' ? (customReason.trim() || 'Other reason') : cancelReason;
      await api.updateBookingStatus(session.accessToken, cancelTargetId, 'CANCELLED', finalReason);
      setCancelTargetId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to cancel booking');
    } finally {
      setCancelling(false);
    }
  };

  const openInvoice = async (bookingId: string) => {
    setShowInvoiceModal(true);
    setLoadingInvoice(true);
    const session = await readSession();
    if (session) {
      try {
        const inv = await api.getBookingInvoice(session.accessToken, bookingId);
        setInvoiceData(inv);
      } catch {}
    }
    setLoadingInvoice(false);
  };

  const activeCount = items.filter((b) =>
    ['REQUESTED', 'ACCEPTED', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED'].includes(b.status)
  ).length;
  const completedCount = items.filter((b) => b.status === 'COMPLETED').length;
  const cancelledCount = items.filter((b) => b.status === 'CANCELLED').length;

  const filteredItems = items.filter((b) => {
    if (activeTab === 'ACTIVE' && !['REQUESTED', 'ACCEPTED', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED'].includes(b.status)) {
      return false;
    }
    if (activeTab === 'COMPLETED' && b.status !== 'COMPLETED') {
      return false;
    }
    if (activeTab === 'CANCELLED' && b.status !== 'CANCELLED') {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchService = b.service.toLowerCase().includes(q);
      const matchAddress = b.address.toLowerCase().includes(q);
      const matchStatus = b.status.toLowerCase().includes(q);
      if (!matchService && !matchAddress && !matchStatus) return false;
    }

    return true;
  });

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Pressable onPress={() => router.back()}><Text style={s.back}>‹ Back</Text></Pressable>
      <View style={s.heading}>
        <Text style={s.title}>My bookings</Text>
        <Pressable onPress={() => router.push('/disputes')}><Text style={s.cases}>Support cases</Text></Pressable>
      </View>
      <Text style={s.subtitle}>Track requests, quotes, live transit and invoices.</Text>

      {/* Search Input */}
      <View style={s.searchContainer}>
        <Text style={s.searchIcon}>🔍</Text>
        <TextInput
          style={s.searchInput}
          placeholder="Search by service or address..."
          placeholderTextColor="#8aa0a4"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <Text style={s.searchClear}>✕</Text>
          </Pressable>
        )}
      </View>

      {/* Filter Tabs */}
      <View style={s.tabsRow}>
        <Pressable
          style={[s.tabPill, activeTab === 'ALL' && s.tabPillActive]}
          onPress={() => setActiveTab('ALL')}
        >
          <Text style={[s.tabPillText, activeTab === 'ALL' && s.tabPillTextActive]}>
            All ({items.length})
          </Text>
        </Pressable>
        <Pressable
          style={[s.tabPill, activeTab === 'ACTIVE' && s.tabPillActive]}
          onPress={() => setActiveTab('ACTIVE')}
        >
          <Text style={[s.tabPillText, activeTab === 'ACTIVE' && s.tabPillTextActive]}>
            Active ({activeCount})
          </Text>
        </Pressable>
        <Pressable
          style={[s.tabPill, activeTab === 'COMPLETED' && s.tabPillActive]}
          onPress={() => setActiveTab('COMPLETED')}
        >
          <Text style={[s.tabPillText, activeTab === 'COMPLETED' && s.tabPillTextActive]}>
            Completed ({completedCount})
          </Text>
        </Pressable>
        <Pressable
          style={[s.tabPill, activeTab === 'CANCELLED' && s.tabPillActive]}
          onPress={() => setActiveTab('CANCELLED')}
        >
          <Text style={[s.tabPillText, activeTab === 'CANCELLED' && s.tabPillTextActive]}>
            Cancelled ({cancelledCount})
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <ActivityIndicator color="#187d73" style={{ marginTop: 28 }} />
      ) : error ? (
        <Text style={s.error}>{error}</Text>
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No bookings yet</Text>
          <Text style={s.muted}>When you book a professional, it will appear here.</Text>
          <Pressable style={s.cta} onPress={() => router.replace('/')}><Text style={s.ctaText}>Find a professional</Text></Pressable>
        </View>
      ) : filteredItems.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyTitle}>No matching bookings</Text>
          <Text style={s.muted}>No bookings match your current filter or search query.</Text>
          <Pressable style={[s.cta, { backgroundColor: '#167d73' }]} onPress={() => { setActiveTab('ALL'); setSearchQuery(''); }}>
            <Text style={[s.ctaText, { color: '#fff' }]}>Clear filters</Text>
          </Pressable>
        </View>
      ) : (
        filteredItems.map((b) => {
          const isPaid = b.payment?.status === 'SUCCESS';
          return (
            <View key={b.id} style={s.card}>
              <Pressable onPress={() => router.push(`/booking/${b.id}`)}>
                <View style={s.row}>
                  <Text style={s.service}>{b.service}</Text>
                  <View style={[
                    s.statusBadge,
                    b.status === 'CANCELLED' && s.statusCancelled,
                    isPaid && s.statusPaid,
                    ['ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED'].includes(b.status) && s.statusEnRoute
                  ]}>
                    <Text style={[
                      s.statusText,
                      b.status === 'CANCELLED' && s.statusTextCancelled,
                      isPaid && s.statusTextPaid,
                      ['ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED'].includes(b.status) && s.statusTextEnRoute
                    ]}>
                      {isPaid ? 'PAID & COMPLETED' : b.status.replaceAll('_', ' ')}
                    </Text>
                  </View>
                </View>
                <Text style={s.muted}>📅 {b.date} · ⏰ {b.time}</Text>
                <Text style={s.muted}>📍 {b.address}</Text>

                {b.status === 'CANCELLED' && (
                  <View style={s.cancelInfoBox}>
                    <Text style={s.cancelInfoText}>Cancelled: {b.cancellationReason || 'No reason specified'}</Text>
                    {b.cancelledBy ? <Text style={s.cancelActorText}>By {b.cancelledBy.toLowerCase()}</Text> : null}
                  </View>
                )}
              </Pressable>

              {/* Action Buttons Row */}
              <View style={s.actionRow}>
                {b.status !== 'CANCELLED' && (
                  <Pressable
                    style={s.chatBtn}
                    onPress={() => router.push(`/chat/${b.id}`)}
                  >
                    <Text style={s.chatBtnText}>💬 Chat</Text>
                  </Pressable>
                )}

                {['REQUESTED', 'ACCEPTED', 'CONFIRMED', 'ON_THE_WAY', 'ARRIVED', 'SERVICE_STARTED'].includes(b.status) && (
                  <Pressable
                    style={s.trackBtn}
                    onPress={() => router.push(`/booking/${b.id}`)}
                  >
                    <Text style={s.trackBtnText}>
                      {b.status === 'ON_THE_WAY' ? '🚗 Live Tracker' : '📍 Details'}
                    </Text>
                  </Pressable>
                )}

                {b.status === 'COMPLETED' && !isPaid && (
                  <Pressable
                    style={s.payBtn}
                    onPress={() => router.push(`/booking/${b.id}`)}
                  >
                    <Text style={s.payBtnText}>💳 Pay Now</Text>
                  </Pressable>
                )}

                {b.status === 'COMPLETED' && isPaid && (
                  <Pressable
                    style={s.invoiceBtn}
                    onPress={() => openInvoice(b.id)}
                  >
                    <Text style={s.invoiceBtnText}>🧾 Tax Invoice</Text>
                  </Pressable>
                )}

                {(b.status === 'COMPLETED' || b.status === 'CANCELLED') && (
                  <Pressable
                    style={s.reorderBtn}
                    onPress={() =>
                      router.push(
                        `/booking/new?reorder=true&professionalId=${b.professionalId || ''}&service=${encodeURIComponent(
                          b.service
                        )}&address=${encodeURIComponent(b.address)}&problem=${encodeURIComponent(b.problem || '')}`
                      )
                    }
                  >
                    <Text style={s.reorderBtnText}>↻ Book Again</Text>
                  </Pressable>
                )}

                {['REQUESTED', 'ACCEPTED', 'CONFIRMED'].includes(b.status) && (
                  <Pressable onPress={() => openCancelModal(b.id)} style={s.cancelBtnWrapper}>
                    <Text style={s.cancelText}>✕ Cancel</Text>
                  </Pressable>
                )}
              </View>

              {['CONFIRMED', 'ON_THE_WAY', 'SERVICE_STARTED', 'COMPLETED'].includes(b.status) && (
                <Pressable onPress={() => router.push(`/dispute/${b.id}`)}>
                  <Text style={s.support}>Need booking support?</Text>
                </Pressable>
              )}
            </View>
          );
        })
      )}

      {/* Invoice & Warranty Certificate Modal */}
      <Modal visible={showInvoiceModal} transparent animationType="fade" onRequestClose={() => setShowInvoiceModal(false)}>
        <View style={s.modalOverlay}>
          <ScrollView contentContainerStyle={{ paddingVertical: 20, alignItems: 'center' }} style={{ width: '100%' }}>
            <View style={s.invoiceModalCard}>
              {loadingInvoice ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <ActivityIndicator color="#187d73" size="large" />
                  <Text style={{ marginTop: 12, color: '#556b6f', fontWeight: '600' }}>Generating official GST invoice...</Text>
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

                  {/* Bill To & Provider */}
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
                        style={s.printBtn}
                        onPress={() => {
                          if (typeof window !== 'undefined') window.print();
                        }}
                      >
                        <Text style={s.printBtnText}>🖨️ Print / Save PDF</Text>
                      </Pressable>
                    )}
                    <Pressable style={s.closeInvoiceBtn} onPress={() => setShowInvoiceModal(false)}>
                      <Text style={s.closeInvoiceBtnText}>Close</Text>
                    </Pressable>
                  </View>
                </View>
              ) : (
                <View style={{ padding: 24, alignItems: 'center' }}>
                  <Text style={{ color: '#b91c1c', fontWeight: '600' }}>Unable to load invoice at this time.</Text>
                  <Pressable style={[s.closeInvoiceBtn, { marginTop: 14 }]} onPress={() => setShowInvoiceModal(false)}>
                    <Text style={s.closeInvoiceBtnText}>Close</Text>
                  </Pressable>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Cancellation Modal */}
      <Modal visible={Boolean(cancelTargetId)} transparent animationType="fade" onRequestClose={() => setCancelTargetId(null)}>
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <Text style={s.modalTitle}>Cancel booking?</Text>
            <Text style={s.modalSubtitle}>Please choose a reason for cancelling this booking.</Text>

            {CANCELLATION_OPTIONS.map((opt) => (
              <Pressable
                key={opt}
                style={[s.radioOption, cancelReason === opt && s.radioSelected]}
                onPress={() => setCancelReason(opt)}
              >
                <Text style={cancelReason === opt ? s.radioTextSelected : s.radioText}>{opt}</Text>
              </Pressable>
            ))}

            {cancelReason === 'Other' && (
              <TextInput
                value={customReason}
                onChangeText={setCustomReason}
                placeholder="Describe your reason"
                style={s.input}
              />
            )}

            <View style={s.modalActions}>
              <Pressable style={s.modalBtnCancel} onPress={() => setCancelTargetId(null)}>
                <Text style={s.modalBtnCancelText}>Keep booking</Text>
              </Pressable>
              <Pressable style={s.modalBtnConfirm} onPress={confirmCancel} disabled={cancelling}>
                <Text style={s.modalBtnConfirmText}>{cancelling ? 'Cancelling...' : 'Confirm'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#ffffff' },
  content: {
    maxWidth: 1080,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },
  back: { color: '#000000', fontWeight: '800', fontSize: 14, marginBottom: 16 },
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  title: { fontSize: 28, fontWeight: '900', color: '#000000', letterSpacing: -0.5, textTransform: 'uppercase' },
  cases: { color: '#000000', fontWeight: '800', fontSize: 13 },
  subtitle: { color: '#666666', marginTop: 4, fontSize: 14 },

  // Search & Filter
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 18,
  },
  searchIcon: { fontSize: 15, marginRight: 8, color: '#888888' },
  searchInput: { flex: 1, fontSize: 14, color: '#000000', outlineStyle: 'none' } as any,
  searchClear: { color: '#888888', fontSize: 13, fontWeight: '800', paddingHorizontal: 6 },

  tabsRow: { flexDirection: 'row', gap: 10, marginTop: 16, flexWrap: 'wrap' },
  tabPill: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 9999, backgroundColor: '#f8fafc' },
  tabPillActive: { backgroundColor: '#000000' },
  tabPillText: { fontSize: 13, fontWeight: '600', color: '#555555' },
  tabPillTextActive: { color: '#ffffff', fontWeight: '800' },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    padding: 20,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#eae7e4',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  service: { fontSize: 18, fontWeight: '800', color: '#000000', flex: 1 },
  statusBadge: { backgroundColor: '#f8fafc', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  statusText: { fontSize: 11, color: '#000000', fontWeight: '800' },
  statusCancelled: { backgroundColor: '#fee2e2' },
  statusTextCancelled: { color: '#dc2626' },
  statusPaid: { backgroundColor: '#dcfce7' },
  statusTextPaid: { color: '#16a34a' },
  statusEnRoute: { backgroundColor: '#f8fafc' },
  statusTextEnRoute: { color: '#000000' },

  cancelInfoBox: { backgroundColor: '#fee2e2', borderRadius: 16, padding: 12, marginTop: 10 },
  cancelInfoText: { color: '#991b1b', fontSize: 12, fontWeight: '700' },
  cancelActorText: { color: '#dc2626', fontSize: 11, fontStyle: 'italic', marginTop: 2 },
  muted: { color: '#666666', marginTop: 4, fontSize: 13 },
  support: { color: '#000000', fontWeight: '800', marginTop: 14, fontSize: 12 },

  // Card Quick Actions
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16, alignItems: 'center' },
  chatBtn: { backgroundColor: '#f8fafc', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 9999 },
  chatBtnText: { color: '#000000', fontWeight: '800', fontSize: 12 },
  trackBtn: { backgroundColor: '#f8fafc', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 9999 },
  trackBtnText: { color: '#000000', fontWeight: '800', fontSize: 12 },
  payBtn: { backgroundColor: '#000000', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 9999 },
  payBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  invoiceBtn: { backgroundColor: '#000000', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 9999 },
  invoiceBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  reorderBtn: { backgroundColor: '#000000', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 9999 },
  reorderBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
  cancelBtnWrapper: { paddingVertical: 8, paddingHorizontal: 10 },
  cancelText: { color: '#dc2626', fontWeight: '700', fontSize: 12 },

  empty: { marginTop: 30, backgroundColor: '#ffffff', padding: 30, borderRadius: 24, overflow: 'hidden', alignItems: 'center', borderWidth: 1, borderColor: '#eae7e4' },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#000000' },
  cta: { backgroundColor: '#000000', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 9999, marginTop: 16, alignItems: 'center' },
  ctaText: { fontWeight: '800', color: '#ffffff', fontSize: 13 },
  error: { color: '#dc2626', marginTop: 20, fontWeight: '600' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalContent: { backgroundColor: '#ffffff', borderRadius: 28, overflow: 'hidden', padding: 24, width: '100%', maxWidth: 420 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#000000', marginBottom: 4 },
  modalSubtitle: { fontSize: 13, color: '#666666', marginBottom: 14 },
  radioOption: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: '#e8e8e8', marginBottom: 8 },
  radioSelected: { borderColor: '#ef4444', backgroundColor: '#fee2e2' },
  radioText: { color: '#000000', fontSize: 13 },
  radioTextSelected: { color: '#dc2626', fontWeight: '800', fontSize: 13 },
  input: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 12, marginTop: 8, fontSize: 13 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  modalBtnCancel: { paddingVertical: 10, paddingHorizontal: 18, borderRadius: 9999, backgroundColor: '#f8fafc' },
  modalBtnCancelText: { color: '#000000', fontWeight: '700', fontSize: 13 },
  modalBtnConfirm: { paddingVertical: 10, paddingHorizontal: 20, borderRadius: 9999, backgroundColor: '#dc2626' },
  modalBtnConfirmText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },

  // Invoice Modal
  invoiceModalCard: { backgroundColor: '#ffffff', borderRadius: 28, overflow: 'hidden', padding: 24, width: '100%', maxWidth: 520, borderWidth: 1, borderColor: '#eae7e4' },
  invoiceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  invoiceBrand: { fontSize: 22, fontWeight: '800', color: '#000000', letterSpacing: -0.2 },
  invoiceSubtitle: { fontSize: 11, color: '#666666', fontWeight: '600', marginTop: 2 },
  invoiceMetaText: { fontSize: 11, color: '#888888', marginTop: 1 },
  taxBadge: { backgroundColor: '#000000', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999, alignSelf: 'flex-end', marginBottom: 4 },
  taxBadgeText: { color: '#ffffff', fontWeight: '900', fontSize: 10, letterSpacing: 1 },
  invoiceNumText: { fontSize: 13, fontWeight: '800', color: '#000000', textAlign: 'right' },
  invoiceDateText: { fontSize: 11, color: '#666666', textAlign: 'right', marginTop: 2 },
  invoiceDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 14 },
  invoicePartyRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, backgroundColor: '#f8fafc', padding: 14, borderRadius: 14 },
  partyLabel: { fontSize: 10, fontWeight: '800', color: '#666666', letterSpacing: 0.8, marginBottom: 4 },
  partyName: { fontSize: 13, fontWeight: '800', color: '#000000' },
  partyDetail: { fontSize: 11, color: '#555555', marginTop: 2, lineHeight: 15 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#f8fafc', paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, marginTop: 14 },
  tableHeaderText: { fontSize: 11, fontWeight: '800', color: '#000000' },
  tableRow: { flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0', alignItems: 'center' },
  colDesc: { flex: 3 },
  colQty: { flex: 1, textAlign: 'center', fontSize: 12, color: '#666666' },
  colAmt: { flex: 1.5, textAlign: 'right', fontSize: 13, fontWeight: '800', color: '#000000' },
  itemDesc: { fontSize: 13, fontWeight: '700', color: '#000000' },
  itemSac: { fontSize: 10, color: '#888888', marginTop: 2 },
  summaryContainer: { marginTop: 12, paddingHorizontal: 8 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontSize: 12, color: '#666666' },
  summaryValue: { fontSize: 12, fontWeight: '600', color: '#000000' },
  summaryTotalRow: { borderTopWidth: 1.5, borderTopColor: '#000000', paddingTop: 8, marginTop: 6 },
  summaryTotalLabel: { fontSize: 14, fontWeight: '900', color: '#000000' },
  summaryTotalValue: { fontSize: 18, fontWeight: '900', color: '#000000' },
  sealBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#dcfce7', borderRadius: 14, padding: 12, marginTop: 14 },
  sealIcon: { fontSize: 22 },
  sealTitle: { fontSize: 11, fontWeight: '900', color: '#16a34a', letterSpacing: 0.5 },
  sealText: { fontSize: 11, color: '#15803d', marginTop: 1 },
  certificateBox: { backgroundColor: '#f8fafc', borderRadius: 14, padding: 14, marginTop: 14 },
  certHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  certBadge: { fontSize: 10, fontWeight: '900', color: '#000000', letterSpacing: 0.5 },
  certWarrantyDays: { backgroundColor: '#000000', color: '#ffffff', fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  certTitle: { fontSize: 13, fontWeight: '800', color: '#000000', marginBottom: 4 },
  certBody: { fontSize: 11, color: '#555555', lineHeight: 16 },
  invoiceModalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  printBtn: { backgroundColor: '#f8fafc', paddingVertical: 10, paddingHorizontal: 16, borderRadius: 9999 },
  printBtnText: { color: '#000000', fontWeight: '800', fontSize: 12 },
  closeInvoiceBtn: { backgroundColor: '#000000', paddingVertical: 10, paddingHorizontal: 20, borderRadius: 9999 },
  closeInvoiceBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },
});
