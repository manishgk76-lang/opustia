import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, SupportTicketPayload } from '../lib/api';

type TabType = 'contact' | 'terms' | 'privacy' | 'refund' | 'grievance';

export default function SupportScreen() {
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<TabType>(
    (params.tab as TabType) || 'contact'
  );

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [category, setCategory] = useState<SupportTicketPayload['category']>('BOOKING_HELP');
  const [bookingId, setBookingId] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [ticketResult, setTicketResult] = useState<{ id: string; notice: string } | null>(null);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (params.tab && ['contact', 'terms', 'privacy', 'refund', 'grievance'].includes(params.tab)) {
      setActiveTab(params.tab as TabType);
    }
  }, [params.tab]);

  const handleSubmitTicket = async () => {
    if (!name.trim()) return setFormError('Please enter your full name');
    if (!email.trim() || !email.includes('@')) return setFormError('Please enter a valid email address');
    if (message.trim().length < 10) return setFormError('Please provide at least 10 characters describing your inquiry');

    setSubmitting(true);
    setFormError('');
    try {
      const res = await api.submitSupportTicket({
        name: name.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        category,
        bookingId: bookingId.trim() || undefined,
        message: message.trim(),
      });
      setTicketResult({
        id: res.ticketId,
        notice: res.acknowledgement,
      });
      setMessage('');
      setBookingId('');
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Unable to submit ticket. Please reach us via phone or email.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Pressable onPress={() => router.back()}>
        <Text style={s.back}>‹ Back</Text>
      </Pressable>

      <View style={s.header}>
        <Text style={s.brandBadge}>OPUSTIA LEGAL & COMPLIANCE</Text>
        <Text style={s.title}>Support & Legal Center</Text>
        <Text style={s.subtitle}>
          Official registered address, 24x7 support desk, statutory consumer protection rights, and privacy policies.
        </Text>
      </View>

      {/* Navigation Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabsScroll}>
        <Pressable
          style={[s.tabPill, activeTab === 'contact' && s.tabPillActive]}
          onPress={() => setActiveTab('contact')}
        >
          <Text style={[s.tabPillText, activeTab === 'contact' && s.tabPillTextActive]}>
            🏢 Contact & Offices
          </Text>
        </Pressable>
        <Pressable
          style={[s.tabPill, activeTab === 'terms' && s.tabPillActive]}
          onPress={() => setActiveTab('terms')}
        >
          <Text style={[s.tabPillText, activeTab === 'terms' && s.tabPillTextActive]}>
            📜 Terms of Service
          </Text>
        </Pressable>
        <Pressable
          style={[s.tabPill, activeTab === 'privacy' && s.tabPillActive]}
          onPress={() => setActiveTab('privacy')}
        >
          <Text style={[s.tabPillText, activeTab === 'privacy' && s.tabPillTextActive]}>
            🛡️ Privacy Policy
          </Text>
        </Pressable>
        <Pressable
          style={[s.tabPill, activeTab === 'refund' && s.tabPillActive]}
          onPress={() => setActiveTab('refund')}
        >
          <Text style={[s.tabPillText, activeTab === 'refund' && s.tabPillTextActive]}>
            🔄 Refunds & Warranty
          </Text>
        </Pressable>
        <Pressable
          style={[s.tabPill, activeTab === 'grievance' && s.tabPillActive]}
          onPress={() => setActiveTab('grievance')}
        >
          <Text style={[s.tabPillText, activeTab === 'grievance' && s.tabPillTextActive]}>
            🏛️ Grievance Officer
          </Text>
        </Pressable>
      </ScrollView>

      {/* TAB 1: CONTACT & REGISTERED OFFICE */}
      {activeTab === 'contact' && (
        <View style={s.sectionCard}>
          <Text style={s.sectionHeading}>Corporate Entity & Headquarters</Text>
          <Text style={s.p}>
            Opustia is owned and operated by <Text style={s.bold}>Opustia Technologies India Private Limited</Text>, an incorporated entity under the Companies Act, 2013.
          </Text>

          {/* Registration Details Box */}
          <View style={s.infoBox}>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Company Legal Name:</Text>
              <Text style={s.infoValue}>Opustia Technologies India Pvt Ltd</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Corporate ID (CIN):</Text>
              <Text style={s.infoValue}>U72900KA2024PTC184920</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>GST Registration (GSTIN):</Text>
              <Text style={s.infoValue}>29AAFCO1234M1Z5</Text>
            </View>
            <View style={s.infoRow}>
              <Text style={s.infoLabel}>Primary Service Classification:</Text>
              <Text style={s.infoValue}>SAC 998719 / 998729 (Maintenance & Repair)</Text>
            </View>
          </View>

          {/* Registered Office Address */}
          <View style={s.addressBox}>
            <View style={s.addressHead}>
              <Text style={s.pinIcon}>📍</Text>
              <View style={{ flex: 1 }}>
                <Text style={s.addressTitle}>Registered & Corporate Headquarters</Text>
                <Text style={s.addressText}>
                  4th Floor, Salarpuria Citadel, 100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka – 560038, India
                </Text>
              </View>
            </View>
            <Pressable
              style={s.mapsBtn}
              onPress={() =>
                Linking.openURL(
                  'https://www.google.com/maps/search/?api=1&query=Salarpuria+Citadel+100+Feet+Road+Indiranagar+Bengaluru'
                )
              }
            >
              <Text style={s.mapsBtnText}>🗺️ View on Google Maps ➔</Text>
            </Pressable>
          </View>

          {/* Helplines Grid */}
          <Text style={[s.sectionHeading, { marginTop: 24 }]}>Customer Support Helplines</Text>
          <View style={s.helplinesGrid}>
            <View style={s.contactCard}>
              <Text style={s.contactCardIcon}>📞</Text>
              <Text style={s.contactCardTitle}>Toll-Free Helpline</Text>
              <Text style={s.contactCardDetail}>1800-889-OPUS (1800-889-6787)</Text>
              <Text style={s.contactCardSub}>Free from all Indian telecom networks</Text>
              <Pressable
                style={s.contactActionBtn}
                onPress={() => Linking.openURL('tel:18008896787')}
              >
                <Text style={s.contactActionBtnText}>Call Toll-Free</Text>
              </Pressable>
            </View>

            <View style={s.contactCard}>
              <Text style={s.contactCardIcon}>💬</Text>
              <Text style={s.contactCardTitle}>WhatsApp Desk</Text>
              <Text style={s.contactCardDetail}>+91 98765 43210</Text>
              <Text style={s.contactCardSub}>Instant live booking & status assistance</Text>
              <Pressable
                style={[s.contactActionBtn, { backgroundColor: '#25D366' }]}
                onPress={() => Linking.openURL('https://wa.me/919876543210')}
              >
                <Text style={s.contactActionBtnText}>WhatsApp Chat</Text>
              </Pressable>
            </View>

            <View style={s.contactCard}>
              <Text style={s.contactCardIcon}>✉️</Text>
              <Text style={s.contactCardTitle}>Support Email</Text>
              <Text style={s.contactCardDetail}>support@opustia.com</Text>
              <Text style={s.contactCardSub}>Typical response in under 2 hours</Text>
              <Pressable
                style={s.contactActionBtn}
                onPress={() => Linking.openURL('mailto:support@opustia.com')}
              >
                <Text style={s.contactActionBtnText}>Send Email</Text>
              </Pressable>
            </View>

            <View style={s.contactCard}>
              <Text style={s.contactCardIcon}>🧾</Text>
              <Text style={s.contactCardTitle}>Billing & Invoices</Text>
              <Text style={s.contactCardDetail}>billing@opustia.com</Text>
              <Text style={s.contactCardSub}>GST tax invoices, refunds & payment help</Text>
              <Pressable
                style={s.contactActionBtn}
                onPress={() => Linking.openURL('mailto:billing@opustia.com')}
              >
                <Text style={s.contactActionBtnText}>Billing Desk</Text>
              </Pressable>
            </View>
          </View>

          {/* Operational Hours */}
          <View style={s.hoursBox}>
            <Text style={s.hoursTitle}>⏰ Support Operational Hours</Text>
            <Text style={s.hoursText}>
              • Customer Support Desk: Monday – Sunday, 7:00 AM – 11:00 PM IST
            </Text>
            <Text style={s.hoursText}>
              • 24x7 Emergency Line: Active for confirmed bookings in progress
            </Text>
            <Text style={s.hoursText}>
              • Operational Cities: Bengaluru (HQ), Mumbai, Delhi NCR, Hyderabad, Chennai, Pune
            </Text>
          </View>

          {/* Submit a Ticket Form */}
          <Text style={[s.sectionHeading, { marginTop: 28 }]}>Submit a Support Inquiry</Text>
          <Text style={s.p}>
            Have an issue with a technician, payment, or service? Leave a note below and our Indiranagar support team will assist you.
          </Text>

          {ticketResult ? (
            <View style={s.successCard}>
              <Text style={s.successTitle}>✓ Inquiry Submitted (Reference #{ticketResult.id})</Text>
              <Text style={s.successText}>{ticketResult.notice}</Text>
              <Pressable
                style={s.newInquiryBtn}
                onPress={() => setTicketResult(null)}
              >
                <Text style={s.newInquiryBtnText}>Submit another query</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.formCard}>
              {formError ? <Text style={s.errorText}>{formError}</Text> : null}

              <Text style={s.fieldLabel}>Your Full Name *</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Aarav Mehta"
                style={s.input}
              />

              <Text style={s.fieldLabel}>Email Address *</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="e.g. aarav@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                style={s.input}
              />

              <Text style={s.fieldLabel}>Phone Number (Optional)</Text>
              <TextInput
                value={phone}
                onChangeText={setPhone}
                placeholder="+91 98765 00000"
                keyboardType="phone-pad"
                style={s.input}
              />

              <Text style={s.fieldLabel}>Inquiry Category</Text>
              <View style={s.categoryChips}>
                {[
                  { id: 'BOOKING_HELP', label: 'Booking Help' },
                  { id: 'PAYMENT_BILLING', label: 'Payment / Invoice' },
                  { id: 'SERVICE_QUALITY', label: 'Service Quality' },
                  { id: 'SAFETY_CONDUCT', label: 'Safety / Conduct' },
                  { id: 'GRIEVANCE', label: 'Statutory Grievance' },
                  { id: 'OTHER', label: 'Other Inquiries' },
                ].map((cat) => (
                  <Pressable
                    key={cat.id}
                    style={[s.chip, category === cat.id && s.chipActive]}
                    onPress={() => setCategory(cat.id as any)}
                  >
                    <Text style={[s.chipText, category === cat.id && s.chipTextActive]}>
                      {cat.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={s.fieldLabel}>Booking ID (Optional)</Text>
              <TextInput
                value={bookingId}
                onChangeText={setBookingId}
                placeholder="e.g. daf60b9f-5b29-40c5..."
                style={s.input}
              />

              <Text style={s.fieldLabel}>Message / Problem Description *</Text>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder="Describe your inquiry or feedback in detail..."
                multiline
                numberOfLines={4}
                style={[s.input, { minHeight: 90, textAlignVertical: 'top' }]}
              />

              <Pressable
                style={s.submitBtn}
                onPress={handleSubmitTicket}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={s.submitBtnText}>Submit Support Request ➔</Text>
                )}
              </Pressable>
            </View>
          )}
        </View>
      )}

      {/* TAB 2: TERMS OF SERVICE & LEGAL RIGHTS */}
      {activeTab === 'terms' && (
        <View style={s.sectionCard}>
          <Text style={s.sectionHeading}>Terms of Service & Customer Rights</Text>
          <Text style={s.versionTag}>Version 2026.1 · Effective from 1 January 2026</Text>

          <Text style={s.p}>
            Welcome to Opustia. These Terms of Service constitute a legally binding electronic agreement under the
            <Text style={s.bold}> Information Technology Act, 2000</Text> and the rules framed thereunder between
            <Text style={s.bold}> Opustia Technologies India Private Limited</Text> and you as a User.
          </Text>

          <Text style={s.subHeading}>1. Customer Legal Rights & Protections</Text>
          <View style={s.bulletBox}>
            <Text style={s.bullet}>
              🛡️ <Text style={s.bold}>Police & KYC Verification Pledge:</Text> Every service professional on Opustia undergoes mandatory identity verification (Aadhaar/PAN KYC) and police background records validation prior to activation.
            </Text>
            <Text style={s.bullet}>
              🛡️ <Text style={s.bold}>Binding Upfront Quotes:</Text> You are never bound to arbitrary or hidden pricing. Technicians provide itemized labor, spare parts, and warranty days in writing via the app. You have the absolute legal right to decline or request clarifications.
            </Text>
            <Text style={s.bullet}>
              🛡️ <Text style={s.bold}>Arrival OTP Security Protocol:</Text> No job can commence without you sharing your 6-digit one-time code upon technician arrival. This prevents ghost billing and guarantees verified technician presence.
            </Text>
            <Text style={s.bullet}>
              🛡️ <Text style={s.bold}>Legal GST Invoices:</Text> Customers receive compliant tax invoices bearing SAC codes (998719 / 998729), Opustia's GSTIN (29AAFCO1234M1Z5), and Razorpay transaction seal.
            </Text>
            <Text style={s.bullet}>
              🛡️ <Text style={s.bold}>30-Day Workmanship Warranty:</Text> All completed jobs are backed by a minimum 30-day warranty guarantee with complimentary inspection and rework.
            </Text>
          </View>

          <Text style={s.subHeading}>2. Marketplace Intermediary Status</Text>
          <Text style={s.p}>
            Opustia operates as an electronic marketplace platform and qualifies as an intermediary under Section 79 of the Information Technology Act, 2000. Contracts for service performance are entered into directly between the Customer and the Independent Professional Partner.
          </Text>

          <Text style={s.subHeading}>3. User Obligations & Conduct</Text>
          <Text style={s.p}>
            You agree to provide safe, unimpeded access to the service premises and treat technicians with dignity. Opustia enforces a strict zero-tolerance policy against physical violence, harassment, discrimination, or solicitation of off-platform cash transactions.
          </Text>

          <Text style={s.subHeading}>4. Dispute Resolution & Governing Law</Text>
          <Text style={s.p}>
            These Terms are governed by the laws of India. Any disputes arising out of or in connection with these Terms shall be subject to the exclusive jurisdiction of the competent civil courts in <Text style={s.bold}>Bengaluru, Karnataka, India</Text>.
          </Text>
        </View>
      )}

      {/* TAB 3: PRIVACY POLICY */}
      {activeTab === 'privacy' && (
        <View style={s.sectionCard}>
          <Text style={s.sectionHeading}>Data Privacy Policy</Text>
          <Text style={s.versionTag}>Compliant with Digital Personal Data Protection (DPDP) Act, 2023</Text>

          <Text style={s.p}>
            Opustia Technologies India Private Limited respects your privacy and is dedicated to safeguarding your personal data in full compliance with the Digital Personal Data Protection Act, 2023 and the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011.
          </Text>

          <Text style={s.subHeading}>1. Personal Data We Collect</Text>
          <View style={s.bulletBox}>
            <Text style={s.bullet}>
              • <Text style={s.bold}>Identity & Contact Details:</Text> Name, phone number, email address, and home service address.
            </Text>
            <Text style={s.bullet}>
              • <Text style={s.bold}>Precise Geographic Location (GPS):</Text> We collect latitude and longitude coordinates upon your consent to match you with nearby service providers and power the live en-route transit tracker. Location tracking is only active during booking creation and transit.
            </Text>
            <Text style={s.bullet}>
              • <Text style={s.bold}>Payment Data:</Text> Payments are processed securely via RBI-authorized, PCI-DSS Level 1 compliant gateway Razorpay. Opustia never collects or stores plain credit/debit card numbers or CVVs.
            </Text>
          </View>

          <Text style={s.subHeading}>2. No Sale of Personal Data</Text>
          <Text style={s.p}>
            We <Text style={s.bold}>never sell, rent, or trade</Text> your personal data to third-party advertisers or data brokers. Your contact and location coordinates are shared strictly with the assigned professional to complete your requested service.
          </Text>

          <Text style={s.subHeading}>3. Security & Encryption Standards</Text>
          <Text style={s.p}>
            All sensitive communications between your device and Opustia servers are secured via 256-bit TLS 1.3 encryption. Data stored in our database is encrypted at rest using AES-256 standard encryption.
          </Text>

          <Text style={s.subHeading}>4. Your Rights Under DPDP Act 2023</Text>
          <Text style={s.p}>
            You hold the statutory right to: (a) Access a summary of personal data held by Opustia; (b) Correct inaccurate or incomplete information; (c) Withdraw consent; and (d) Request complete deletion of your account and data by writing to <Text style={s.bold}>legal@opustia.com</Text>.
          </Text>
        </View>
      )}

      {/* TAB 4: REFUND & WARRANTY POLICY */}
      {activeTab === 'refund' && (
        <View style={s.sectionCard}>
          <Text style={s.sectionHeading}>Cancellation, Refund & Warranty Policy</Text>
          <Text style={s.versionTag}>30-Day Opustia Guarantee & Consumer Protection Rules</Text>

          <Text style={s.subHeading}>1. Cancellation Policy</Text>
          <View style={s.bulletBox}>
            <Text style={s.bullet}>
              • <Text style={s.bold}>100% Free Cancellation:</Text> You can cancel your booking for free at any time prior to the technician starting travel or arriving at your premises.
            </Text>
            <Text style={s.bullet}>
              • <Text style={s.bold}>En-Route Cancellation:</Text> If cancelled after the professional is en route, a nominal dispatch fee (up to ₹99) may apply to compensate the technician's fuel and transit time.
            </Text>
            <Text style={s.bullet}>
              • <Text style={s.bold}>Professional Rejection:</Text> If a technician declines or fails to arrive, 100% of any pre-authorized hold is released immediately.
            </Text>
          </View>

          <Text style={s.subHeading}>2. Refund Processing Timeframes</Text>
          <Text style={s.p}>
            Approved refunds are initiated immediately to the original payment instrument. Under RBI banking protocols, refunds are credited to your bank account or card within:
          </Text>
          <View style={s.infoBox}>
            <Text style={s.infoRowText}>• <Text style={s.bold}>UPI / QR:</Text> Instant to 24 banking hours</Text>
            <Text style={s.infoRowText}>• <Text style={s.bold}>Credit & Debit Cards:</Text> 3 to 5 banking business days</Text>
            <Text style={s.infoRowText}>• <Text style={s.bold}>Net Banking:</Text> 5 to 7 banking business days</Text>
          </View>

          <Text style={s.subHeading}>3. Official 30-Day Service Warranty Guarantee</Text>
          <Text style={s.p}>
            Every completed service on Opustia comes backed with our official <Text style={s.bold}>Opustia Service Protection Certificate</Text>. If you observe any defect in craftsmanship, recurring malfunction, or rework requirement within 30 days of completion:
          </Text>
          <View style={s.bulletBox}>
            <Text style={s.bullet}>
              1. Tap <Text style={s.bold}>Claim Warranty</Text> on your booking detail page or dispute center.
            </Text>
            <Text style={s.bullet}>
              2. Opustia dispatches an authorized professional to inspect and rectify the issue at <Text style={s.bold}>zero additional labor cost</Text>.
            </Text>
            <Text style={s.bullet}>
              3. If the rework cannot be performed satisfactorily, a full refund of labor charges is issued.
            </Text>
          </View>
        </View>
      )}

      {/* TAB 5: GRIEVANCE REDRESSAL OFFICER */}
      {activeTab === 'grievance' && (
        <View style={s.sectionCard}>
          <Text style={s.sectionHeading}>Statutory Grievance Redressal</Text>
          <Text style={s.versionTag}>
            Mandated under Rule 5(9) of Consumer Protection (E-Commerce) Rules, 2020 & Rule 3(2) of IT Rules, 2021
          </Text>

          <Text style={s.p}>
            In compliance with the <Text style={s.bold}>Consumer Protection Act, 2019</Text>, the Consumer Protection (E-Commerce) Rules, 2020, and the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, Opustia has designated a resident Grievance Redressal Officer to handle consumer and legal escalations.
          </Text>

          {/* Grievance Officer Card */}
          <View style={s.officerCard}>
            <Text style={s.officerBadge}>DESIGNATED GRIEVANCE OFFICER</Text>
            <Text style={s.officerName}>Rajeshwar Rao</Text>
            <Text style={s.officerRole}>Head of Trust, Safety & Regulatory Redressal</Text>

            <View style={s.officerDivider} />

            <View style={s.officerRow}>
              <Text style={s.officerLabel}>Email Address:</Text>
              <Pressable onPress={() => Linking.openURL('mailto:grievance-officer@opustia.com')}>
                <Text style={s.officerLink}>grievance-officer@opustia.com</Text>
              </Pressable>
            </View>

            <View style={s.officerRow}>
              <Text style={s.officerLabel}>Direct Phone:</Text>
              <Pressable onPress={() => Linking.openURL('tel:+918045678910')}>
                <Text style={s.officerLink}>+91 80 4567 8910</Text>
              </Pressable>
            </View>

            <View style={s.officerRow}>
              <Text style={s.officerLabel}>Physical Address:</Text>
              <Text style={s.officerValue}>
                Opustia Technologies India Pvt Ltd, 4th Floor, Salarpuria Citadel, 100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru, Karnataka – 560038
              </Text>
            </View>
          </View>

          <Text style={s.subHeading}>Statutory Resolution Timeline & Escalation SLA</Text>
          <View style={s.bulletBox}>
            <Text style={s.bullet}>
              • <Text style={s.bold}>Acknowledgement:</Text> Every grievance is acknowledged with a formal reference number within <Text style={s.bold}>48 hours</Text> of receipt.
            </Text>
            <Text style={s.bullet}>
              • <Text style={s.bold}>Investigation & Resolution:</Text> The Grievance Officer shall investigate and provide a conclusive redressed resolution within <Text style={s.bold}>30 days</Text> from the date of receipt.
            </Text>
          </View>
        </View>
      )}

      {/* Footer Branding */}
      <View style={s.footerContainer}>
        <Text style={s.footerBrand}>OPUSTIA TECHNOLOGIES INDIA PVT LTD</Text>
        <Text style={s.footerMeta}>CIN: U72900KA2024PTC184920 · GSTIN: 29AAFCO1234M1Z5</Text>
        <Text style={s.footerAddress}>Indiranagar 100ft Road, Bengaluru, Karnataka - 560038</Text>
        <Text style={s.footerCopy}>© 2026 Opustia. All statutory consumer rights reserved.</Text>
      </View>
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
  back: { color: '#000000', fontWeight: '800', fontSize: 14, marginTop: 12 },
  header: { marginTop: 16, marginBottom: 14 },
  brandBadge: { fontSize: 11, fontWeight: '900', color: '#000000', letterSpacing: 1.2, textTransform: 'uppercase' },
  title: { fontSize: 28, fontWeight: '800', color: '#000000', letterSpacing: -0.2, marginTop: 4, textTransform: 'uppercase' },
  subtitle: { color: '#666666', marginTop: 4, fontSize: 14, lineHeight: 20 },

  // Tabs
  tabsScroll: { flexDirection: 'row', gap: 10, paddingVertical: 12 },
  tabPill: { paddingVertical: 8, paddingHorizontal: 16, borderRadius: 9999, backgroundColor: '#f8fafc' },
  tabPillActive: { backgroundColor: '#000000' },
  tabPillText: { fontSize: 12, fontWeight: '700', color: '#555555' },
  tabPillTextActive: { color: '#ffffff', fontWeight: '800' },

  // Sections
  sectionCard: { backgroundColor: '#ffffff', borderRadius: 24, overflow: 'hidden', padding: 22, marginTop: 14, borderWidth: 1, borderColor: '#eae7e4' },
  sectionHeading: { fontSize: 20, fontWeight: '800', color: '#000000', marginBottom: 4, textTransform: 'uppercase', letterSpacing: -0.2 },
  versionTag: { fontSize: 11, color: '#666666', fontWeight: '800', marginBottom: 12 },
  subHeading: { fontSize: 15, fontWeight: '800', color: '#000000', marginTop: 18, marginBottom: 8 },
  p: { fontSize: 13, color: '#555555', lineHeight: 22, marginBottom: 10 },
  bold: { fontWeight: '800', color: '#000000' },

  infoBox: { backgroundColor: '#f8fafc', borderRadius: 18, overflow: 'hidden', padding: 16, marginVertical: 12 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4, flexWrap: 'wrap' },
  infoLabel: { fontSize: 12, color: '#666666' },
  infoValue: { fontSize: 12, fontWeight: '800', color: '#000000' },
  infoRowText: { fontSize: 12, color: '#555555', paddingVertical: 3 },

  addressBox: { backgroundColor: '#f8fafc', borderRadius: 20, overflow: 'hidden', padding: 18, marginTop: 14 },
  addressHead: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  pinIcon: { fontSize: 22 },
  addressTitle: { fontSize: 14, fontWeight: '800', color: '#000000' },
  addressText: { fontSize: 12, color: '#555555', marginTop: 4, lineHeight: 18 },
  mapsBtn: { backgroundColor: '#000000', borderRadius: 9999, paddingVertical: 9, alignItems: 'center', marginTop: 14 },
  mapsBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 12 },

  helplinesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  contactCard: { backgroundColor: '#f8fafc', borderRadius: 20, overflow: 'hidden', padding: 16, width: '48%', minWidth: 230, flexGrow: 1 },
  contactCardIcon: { fontSize: 22 },
  contactCardTitle: { fontSize: 13, fontWeight: '800', color: '#000000', marginTop: 6 },
  contactCardDetail: { fontSize: 14, fontWeight: '800', color: '#000000', marginTop: 2 },
  contactCardSub: { fontSize: 11, color: '#666666', marginTop: 2, marginBottom: 12 },
  contactActionBtn: { backgroundColor: '#000000', paddingVertical: 9, borderRadius: 9999, alignItems: 'center' },
  contactActionBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 11 },

  hoursBox: { backgroundColor: '#f8fafc', borderRadius: 18, overflow: 'hidden', padding: 14, marginTop: 16 },
  hoursTitle: { fontSize: 13, fontWeight: '800', color: '#000000', marginBottom: 4 },
  hoursText: { fontSize: 12, color: '#555555', marginTop: 2, lineHeight: 17 },

  bulletBox: { backgroundColor: '#f8fafc', borderRadius: 18, overflow: 'hidden', padding: 16, marginVertical: 12 },
  bullet: { fontSize: 13, color: '#555555', lineHeight: 22, marginBottom: 8 },

  officerCard: { backgroundColor: '#f8fafc', borderRadius: 20, overflow: 'hidden', padding: 20, marginTop: 14 },
  officerBadge: { fontSize: 10, fontWeight: '800', color: '#000000', letterSpacing: 1 },
  officerName: { fontSize: 18, fontWeight: '800', color: '#000000', marginTop: 4 },
  officerRole: { fontSize: 12, color: '#666666', marginTop: 2 },
  officerDivider: { height: 1, backgroundColor: '#e0e0e0', marginVertical: 12 },
  officerRow: { marginBottom: 8 },
  officerLabel: { fontSize: 11, fontWeight: '800', color: '#666666' },
  officerLink: { fontSize: 13, fontWeight: '800', color: '#000000', marginTop: 2, textDecorationLine: 'underline' },
  officerValue: { fontSize: 12, color: '#555555', marginTop: 2, lineHeight: 18 },

  // Form
  formCard: { marginTop: 14, backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#eae7e4', borderRadius: 24, overflow: 'hidden', padding: 18 },
  fieldLabel: { fontSize: 12, fontWeight: '800', color: '#000000', marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { backgroundColor: '#f8fafc', borderRadius: 16, padding: 12, fontSize: 13, color: '#000000' },
  categoryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 9999, backgroundColor: '#f8fafc' },
  chipActive: { backgroundColor: '#000000' },
  chipText: { fontSize: 11, color: '#555555', fontWeight: '700' },
  chipTextActive: { color: '#ffffff', fontWeight: '800' },
  submitBtn: { backgroundColor: '#000000', paddingVertical: 14, borderRadius: 9999, alignItems: 'center', marginTop: 18 },
  submitBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 13 },
  errorText: { color: '#dc2626', fontSize: 12, fontWeight: '700', marginBottom: 8 },
  successCard: { backgroundColor: '#dcfce7', borderRadius: 20, overflow: 'hidden', padding: 16, marginTop: 14 },
  successTitle: { fontSize: 14, fontWeight: '800', color: '#16a34a', marginBottom: 4 },
  successText: { fontSize: 12, color: '#15803d', lineHeight: 18 },
  newInquiryBtn: { alignSelf: 'flex-start', marginTop: 12, backgroundColor: '#000000', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 9999 },
  newInquiryBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 11 },

  // Footer
  footerContainer: { marginTop: 36, alignItems: 'center', paddingVertical: 24, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  footerBrand: { fontSize: 12, fontWeight: '900', color: '#000000', letterSpacing: 1 },
  footerMeta: { fontSize: 11, color: '#666666', marginTop: 4 },
  footerAddress: { fontSize: 11, color: '#666666', marginTop: 2 },
  footerCopy: { fontSize: 10, color: '#888888', marginTop: 6, fontStyle: 'italic' },
});
