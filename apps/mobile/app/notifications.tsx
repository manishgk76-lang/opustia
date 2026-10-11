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
import { api, Notification } from '../lib/api';
import { readSession } from '../store/auth';

export default function Notifications() {
  const [items, setItems] = useState<Notification[]>([]);
  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadNotifications = async () => {
    const session = await readSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    setToken(session.accessToken);
    try {
      const data = await api.getNotifications(session.accessToken);
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load notifications');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const handleNotificationPress = async (item: Notification) => {
    if (!item.read && token) {
      // Optimistic update
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n))
      );
      try {
        await api.markNotificationRead(token, item.id);
      } catch {
        // Silently tolerate if already marked
      }
    }

    if (item.bookingId) {
      router.push(`/booking/${item.bookingId}`);
    }
  };

  const markAllAsRead = async () => {
    if (!token) return;
    const unread = items.filter((n) => !n.read);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    await Promise.all(
      unread.map((n) => api.markNotificationRead(token, n.id).catch(() => {}))
    );
  };

  const unreadCount = items.filter((n) => !n.read).length;

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Pressable onPress={() => router.back()} style={s.backBtn}>
        <Text style={s.backText}>‹ Back</Text>
      </Pressable>

      <View style={s.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Notifications</Text>
          <Text style={s.subtitle}>Real-time updates on quotes, dispatch, and payments.</Text>
        </View>
        {unreadCount > 0 && (
          <Pressable style={s.markAllBtn} onPress={markAllAsRead}>
            <Text style={s.markAllText}>Mark all read</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color="#000000" size="large" />
        </View>
      ) : error ? (
        <View style={s.errorBox}>
          <Text style={s.error}>{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={s.emptyBox}>
          <Text style={s.emptyIcon}>🔔</Text>
          <Text style={s.emptyTitle}>All caught up</Text>
          <Text style={s.emptySub}>You have no pending notifications right now.</Text>
        </View>
      ) : (
        items.map((item) => (
          <Pressable
            key={item.id}
            style={[s.card, !item.read && s.cardUnread]}
            onPress={() => handleNotificationPress(item)}
          >
            <View style={[s.dot, !item.read && s.dotUnread]} />
            <View style={{ flex: 1 }}>
              <Text style={[s.cardTitle, !item.read && s.cardTitleUnread]}>
                {item.title}
              </Text>
              <Text style={s.time}>
                {new Date(item.createdAt).toLocaleString('en-IN')}
              </Text>
            </View>
            <Text style={s.chevron}>›</Text>
          </Pressable>
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
    paddingTop: 18,
    paddingBottom: 60,
  },
  backBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    marginBottom: 16,
  },
  backText: { color: '#000000', fontWeight: '700', fontSize: 13 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  title: { fontSize: 26, fontWeight: '800', color: '#000000', letterSpacing: -0.2 },
  subtitle: { color: '#666666', marginTop: 4, fontSize: 13 },
  markAllBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    alignSelf: 'flex-start',
  },
  markAllText: { color: '#ffffff', fontSize: 11, fontWeight: '700' },

  loadingBox: { paddingVertical: 40, alignItems: 'center' },
  errorBox: {
    backgroundColor: '#fee2e2',
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  error: { color: '#dc2626', fontWeight: '700', fontSize: 13 },

  emptyBox: { alignItems: 'center', paddingVertical: 50 },
  emptyIcon: { fontSize: 40, marginBottom: 10 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#000000' },
  emptySub: { fontSize: 13, color: '#777777', marginTop: 4 },

  card: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 20,
    padding: 16,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    overflow: 'hidden',
  },
  cardUnread: {
    backgroundColor: '#f8fafc',
    borderColor: '#000000',
  },
  dot: { width: 8, height: 8, borderRadius: 9999, backgroundColor: '#cccccc' },
  dotUnread: { backgroundColor: '#000000' },
  cardTitle: { fontWeight: '600', color: '#555555', fontSize: 14 },
  cardTitleUnread: { fontWeight: '800', color: '#000000' },
  time: { fontSize: 11, color: '#888888', marginTop: 4 },
  chevron: { fontSize: 22, color: '#000000', fontWeight: '700' },
});
