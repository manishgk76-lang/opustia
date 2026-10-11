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
import { Dispute, getDisputes } from '../lib/api';
import { readSession } from '../store/auth';

export default function MySupportCases() {
  const [items, setItems] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    readSession().then(async (session) => {
      if (!session) {
        router.replace('/login');
        return;
      }
      try {
        setItems(await getDisputes(session.accessToken));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Unable to load support cases');
      } finally {
        setLoading(false);
      }
    });
  }, []);

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Pressable onPress={() => router.back()} style={s.backBtn}>
        <Text style={s.backText}>‹ Back</Text>
      </Pressable>

      <Text style={s.title}>Support & Dispute Cases</Text>
      <Text style={s.subtitle}>
        Track statutory investigations, warranty rework claims, and resolution history.
      </Text>

      {loading ? (
        <View style={s.loadingBox}>
          <ActivityIndicator color="#000000" size="large" />
        </View>
      ) : error ? (
        <View style={s.errorBox}>
          <Text style={s.error}>{error}</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>🛡️</Text>
          <Text style={s.emptyTitle}>No active cases</Text>
          <Text style={s.emptySubtitle}>
            When you raise a complaint or warranty claim for a service, it will appear here with live updates.
          </Text>
        </View>
      ) : (
        items.map((item) => (
          <View key={item.id} style={s.card}>
            <View style={s.row}>
              <Text style={s.service}>{item.service}</Text>
              <View
                style={[
                  s.statusPill,
                  item.status === 'RESOLVED' && s.statusPillResolved,
                ]}
              >
                <Text
                  style={[
                    s.statusText,
                    item.status === 'RESOLVED' && s.statusTextResolved,
                  ]}
                >
                  {item.status.replaceAll('_', ' ')}
                </Text>
              </View>
            </View>

            <View style={s.reasonPill}>
              <Text style={s.reasonText}>
                ⚠️ Reason: {item.reason.replaceAll('_', ' ')}
              </Text>
            </View>

            <Text style={s.description}>{item.description}</Text>
            <Text style={s.date}>
              Raised on {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>

            {item.status === 'RESOLVED' && (
              <View style={s.resolvedBox}>
                <Text style={s.resolvedText}>
                  ✓ Case investigated and resolved by Opustia Grievance Redressal.
                </Text>
              </View>
            )}
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
  title: { fontSize: 26, fontWeight: '800', color: '#000000', letterSpacing: -0.2 },
  subtitle: { color: '#666666', marginTop: 4, marginBottom: 18, fontSize: 13, lineHeight: 18 },

  loadingBox: { paddingVertical: 40, alignItems: 'center' },
  errorBox: {
    backgroundColor: '#fee2e2',
    padding: 14,
    borderRadius: 16,
    marginBottom: 16,
  },
  error: { color: '#dc2626', fontWeight: '700', fontSize: 13 },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 20,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  service: { fontSize: 17, fontWeight: '800', color: '#000000', flex: 1 },

  statusPill: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  statusPillResolved: { backgroundColor: '#000000' },
  statusText: { color: '#555555', fontSize: 11, fontWeight: '800' },
  statusTextResolved: { color: '#ffffff' },

  reasonPill: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
    alignSelf: 'flex-start',
    marginTop: 10,
  },
  reasonText: { color: '#000000', fontWeight: '700', fontSize: 12 },

  description: { color: '#444444', marginTop: 10, lineHeight: 18, fontSize: 13 },
  date: { color: '#888888', fontSize: 11, marginTop: 10 },

  resolvedBox: {
    marginTop: 12,
    backgroundColor: '#f8fafc',
    padding: 12,
    borderRadius: 16,
  },
  resolvedText: { color: '#000000', fontWeight: '700', fontSize: 12 },

  empty: {
    marginTop: 20,
    backgroundColor: '#ffffff',
    padding: 36,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e5e5e5',
  },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { fontWeight: '800', fontSize: 17, color: '#000000' },
  emptySubtitle: { color: '#777777', fontSize: 13, marginTop: 4, textAlign: 'center', lineHeight: 18 },
});
