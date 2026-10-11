import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { api, Professional, Review } from '../../lib/api';

export default function ProfessionalProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pro, setPro] = useState<Professional | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    const fetchPro = async () => {
      setLoading(true);
      setError('');
      try {
        const [proData, reviewsData] = await Promise.all([
          api.getProfessional(String(id)),
          api.getProfessionalReviews(String(id)).catch(() => []),
        ]);
        setPro(proData);
        setReviews(reviewsData);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to load professional profile');
      } finally {
        setLoading(false);
      }
    };
    fetchPro();
  }, [id]);

  if (loading) {
    return (
      <View style={[s.page, s.center]}>
        <ActivityIndicator size="large" color="#000000" />
      </View>
    );
  }

  if (error || !pro) {
    return (
      <View style={[s.page, s.center, { padding: 20 }]}>
        <Text style={s.error}>{error || 'Professional not found'}</Text>
        <Pressable style={s.backBtn} onPress={() => router.back()}>
          <Text style={s.backBtnText}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={s.page} contentContainerStyle={{ padding: 22, paddingBottom: 80 }}>
      <Pressable onPress={() => router.back()}>
        <Text style={s.back}>‹ Back</Text>
      </Pressable>

      <View style={s.headerCard}>
        <View style={s.avatarBox}>
          <Text style={s.avatarText}>{pro.name.slice(0, 1)}</Text>
        </View>
        <View style={s.headerInfo}>
          <View style={s.nameRow}>
            <Text style={s.businessName}>{pro.businessName}</Text>
            {pro.verified && (
              <View style={s.verifiedBadge}>
                <Text style={s.verifiedText}>✓ Verified</Text>
              </View>
            )}
          </View>
          <Text style={s.proName}>Operated by {pro.name}</Text>
          <Text style={s.categoryTag}>{pro.category.replace('-', ' ')}</Text>
        </View>
      </View>

      {/* Metrics Row */}
      <View style={s.metricsRow}>
        <View style={s.metricCard}>
          <Text style={s.metricVal}>★ {pro.rating.toFixed(1)}</Text>
          <Text style={s.metricSub}>{pro.reviews} reviews</Text>
        </View>
        <View style={s.metricCard}>
          <Text style={s.metricVal}>{pro.completedJobs}</Text>
          <Text style={s.metricSub}>Jobs done</Text>
        </View>
        <View style={s.metricCard}>
          <Text style={s.metricVal}>{pro.onTime}%</Text>
          <Text style={s.metricSub}>On-time</Text>
        </View>
      </View>

      {/* About */}
      <View style={s.sectionCard}>
        <Text style={s.sectionTitle}>About</Text>
        <Text style={s.description}>
          {pro.description ||
            `Certified and vetted professional specialized in ${pro.category.replace('-', ' ')}. Transparent quotes and service warranty on every booking.`}
        </Text>
        <View style={s.priceBox}>
          <Text style={s.priceLabel}>Pricing starts from</Text>
          <Text style={s.priceValue}>₹{pro.priceFrom} / visit</Text>
        </View>
      </View>

      {/* Customer Reviews Section */}
      <View style={s.sectionCard}>
        <View style={s.reviewHeadRow}>
          <Text style={s.sectionTitle}>Customer Reviews ({reviews.length})</Text>
        </View>

        {reviews.length === 0 ? (
          <Text style={s.muted}>No customer reviews yet. Be the first to book and rate!</Text>
        ) : (
          reviews.map((r) => (
            <View key={r.id} style={s.reviewItem}>
              <View style={s.reviewTop}>
                <Text style={s.reviewerName}>{r.customerName || 'Customer'}</Text>
                <Text style={s.reviewStars}>
                  {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                </Text>
              </View>
              {r.comment ? <Text style={s.reviewComment}>"{r.comment}"</Text> : null}
              <Text style={s.reviewDate}>{new Date(r.createdAt).toLocaleDateString('en-IN')}</Text>
            </View>
          ))
        )}
      </View>

      {/* Bottom Floating Book Button */}
      <View style={s.bottomCtaBox}>
        <Pressable
          style={s.bookBtn}
          onPress={() =>
            router.push({
              pathname: '/booking/new',
              params: { professionalId: pro.id, professionalName: pro.businessName },
            })
          }
        >
          <Text style={s.bookBtnText}>Book Appointment with {pro.businessName}</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#ffffff' },
  center: { justifyContent: 'center', alignItems: 'center' },
  back: { color: '#000000', fontWeight: '800', marginTop: 16, fontSize: 14 },
  headerCard: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    padding: 22,
    borderRadius: 28,
    overflow: 'hidden',
    marginTop: 16,
    alignItems: 'center',
    gap: 16,
  },
  avatarBox: {
    width: 68,
    height: 68,
    borderRadius: 9999,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#ffffff', fontSize: 28, fontWeight: '800' },
  headerInfo: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  businessName: { fontSize: 22, fontWeight: '800', color: '#000000', letterSpacing: -0.2 },
  verifiedBadge: { backgroundColor: '#dcfce7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 9999 },
  verifiedText: { color: '#16a34a', fontSize: 11, fontWeight: '800' },
  proName: { color: '#666666', fontSize: 13, marginTop: 3 },
  categoryTag: { color: '#000000', fontSize: 12, fontWeight: '800', textTransform: 'capitalize', marginTop: 4 },

  metricsRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
  metricCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eae7e4',
    alignItems: 'center',
  },
  metricVal: { fontSize: 20, fontWeight: '800', color: '#000000' },
  metricSub: { fontSize: 11, color: '#666666', marginTop: 4, fontWeight: '600' },

  sectionCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    overflow: 'hidden',
    padding: 22,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#eae7e4',
  },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#000000', textTransform: 'uppercase', marginBottom: 10, letterSpacing: -0.2 },
  description: { color: '#555555', fontSize: 14, lineHeight: 22 },
  priceBox: {
    marginTop: 16,
    backgroundColor: '#f8fafc',
    padding: 16,
    borderRadius: 20,
    overflow: 'hidden',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  priceLabel: { color: '#000000', fontSize: 13, fontWeight: '700' },
  priceValue: { color: '#000000', fontSize: 18, fontWeight: '800' },

  reviewHeadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  reviewItem: { borderTopWidth: 1, borderTopColor: '#f0f0f0', paddingTop: 14, marginTop: 14 },
  reviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reviewerName: { fontWeight: '800', color: '#000000', fontSize: 14 },
  reviewStars: { color: '#FFC633', fontSize: 15 },
  reviewComment: { color: '#555555', fontSize: 13, lineHeight: 20, marginTop: 6 },
  reviewDate: { color: '#888888', fontSize: 11, marginTop: 6 },

  muted: { color: '#888888', fontSize: 14 },
  error: { color: '#ef4444', fontSize: 16, fontWeight: '700' },
  backBtn: { marginTop: 16, backgroundColor: '#000000', paddingHorizontal: 22, paddingVertical: 12, borderRadius: 9999 },
  backBtnText: { color: '#ffffff', fontWeight: '700' },

  bottomCtaBox: { marginTop: 24 },
  bookBtn: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 9999,
    alignItems: 'center',
  },
  bookBtnText: { color: '#ffffff', fontSize: 15, fontWeight: '800' },
});
