import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api, Professional } from '../lib/api';
import { readSession } from '../store/auth';

export default function Saved() {
  const [items, setItems] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    const session = await readSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    try {
      setItems(await api.getFavorites(session.accessToken));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load saved professionals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const remove = async (pro: Professional) => {
    const session = await readSession();
    if (!session) return;
    try {
      await api.removeFavorite(session.accessToken, pro.id);
      setItems((current) => current.filter((item) => item.id !== pro.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to remove saved professional');
    }
  };

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Pressable onPress={() => router.back()}>
        <Text style={s.back}>‹ Back</Text>
      </Pressable>
      <Text style={s.title}>Saved Professionals</Text>
      <Text style={s.subtitle}>
        Your favorite verified service providers, ready whenever you need them.
      </Text>

      {loading ? (
        <ActivityIndicator color="#0f766e" style={{ marginTop: 20 }} />
      ) : error ? (
        <Text style={s.error}>{error}</Text>
      ) : items.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyIcon}>♡</Text>
          <Text style={s.emptyTitle}>No saved professionals yet</Text>
          <Text style={s.emptySub}>
            Tap the heart icon beside any professional on the home screen to add them to your favorites.
          </Text>
        </View>
      ) : (
        items.map((pro) => (
          <View key={pro.id} style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{pro.businessName}</Text>
              <Text style={s.muted}>
                {pro.category.replace('-', ' ')} · ★ {pro.rating} · From ₹{pro.priceFrom}
              </Text>
            </View>
            <View style={s.actions}>
              <Pressable onPress={() => remove(pro)} style={s.heartBtn}>
                <Text style={s.remove}>♥</Text>
              </Pressable>
              <Pressable
                style={s.book}
                onPress={() =>
                  router.push({
                    pathname: '/booking/new',
                    params: {
                      professionalId: pro.id,
                      professionalName: pro.businessName,
                    },
                  })
                }
              >
                <Text style={s.bookText}>Book Now</Text>
              </Pressable>
            </View>
          </View>
        ))
      )}
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
    paddingTop: 20,
    paddingBottom: 60,
  },
  back: { color: '#000000', fontWeight: '800', fontSize: 14, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#000000', letterSpacing: -0.2, textTransform: 'uppercase' },
  subtitle: { color: '#666666', marginTop: 4, marginBottom: 20, fontSize: 14 },
  card: {
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 24,
    overflow: 'hidden',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    borderWidth: 1,
    borderColor: '#eae7e4',
  },
  name: { fontWeight: '900', color: '#000000', fontSize: 16 },
  muted: { color: '#666666', marginTop: 4, fontSize: 13 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heartBtn: { padding: 4 },
  remove: { color: '#ef4444', fontSize: 22 },
  book: { backgroundColor: '#000000', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 9999 },
  bookText: { fontWeight: '800', color: '#ffffff', fontSize: 12 },
  emptyBox: {
    backgroundColor: '#ffffff',
    padding: 36,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    marginTop: 10,
  },
  emptyIcon: { fontSize: 36, color: '#888888', marginBottom: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#000000', textTransform: 'uppercase' },
  emptySub: { fontSize: 13, color: '#666666', marginTop: 6, textAlign: 'center', lineHeight: 20 },
  error: { color: '#dc2626', fontWeight: '700' },
});
