import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { api, Booking, ChatMessage } from '../../lib/api';
import { readSession } from '../../store/auth';

const QUICK_CHIPS = [
  'I am at the location',
  'Please call when nearby',
  'Running a few minutes late',
  'Can you clarify the problem?',
];

export default function BookingChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  const listRef = useRef<FlatList>(null);

  const loadData = async () => {
    const session = await readSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    try {
      const [bookings, msgs] = await Promise.all([
        api.getBookings(session.accessToken),
        api.getBookingMessages(session.accessToken, String(id)),
      ]);
      const current = bookings.find((b) => b.id === id) || null;
      setBooking(current);
      setMessages(msgs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load conversation');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      readSession().then((session) => {
        if (session && id) {
          api.getBookingMessages(session.accessToken, String(id)).then(setMessages).catch(() => {});
        }
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [id]);

  const sendMessage = async (msgText: string) => {
    const trimmed = msgText.trim();
    if (!trimmed || sending) return;
    const session = await readSession();
    if (!session) return;
    setSending(true);
    try {
      const sent = await api.sendBookingMessage(session.accessToken, String(id), trimmed);
      setMessages((prev) => [...prev, sent]);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={s.page}
      keyboardVerticalOffset={20}
    >
      {/* Header */}
      <View style={s.header}>
        <Pressable onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backText}>‹ Back</Text>
        </Pressable>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>{booking ? booking.service : 'Service Chat'}</Text>
          <Text style={s.headerSub}>
            {booking ? `${booking.date} · ${booking.status.replaceAll('_', ' ')}` : 'Live Messages'}
          </Text>
        </View>
        <View style={{ width: 45 }} />
      </View>

      {error ? (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>{error}</Text>
        </View>
      ) : null}

      {/* Messages Feed */}
      {loading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color="#000000" />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Text style={s.emptyIcon}>💬</Text>
              <Text style={s.emptyTitle}>Direct Service Messages</Text>
              <Text style={s.emptyText}>
                Communicate directly with the service partner to coordinate timing, arrival directions, or task scope.
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const isMe = item.isMe;
            return (
              <View style={[s.bubbleRow, isMe ? s.bubbleRowMe : s.bubbleRowOther]}>
                {!isMe && (
                  <View style={s.senderInfo}>
                    <Text style={s.senderName}>{item.senderName}</Text>
                    <View style={s.roleBadge}>
                      <Text style={s.roleBadgeText}>{item.senderRole.toLowerCase()}</Text>
                    </View>
                  </View>
                )}
                <View style={[s.bubble, isMe ? s.bubbleMe : s.bubbleOther]}>
                  <Text style={[s.bubbleText, isMe ? s.bubbleTextMe : s.bubbleTextOther]}>
                    {item.text}
                  </Text>
                  <Text style={[s.timeText, isMe ? s.timeTextMe : s.timeTextOther]}>
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Quick Chips */}
      <View style={s.chipsRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={QUICK_CHIPS}
          keyExtractor={(item) => item}
          renderItem={({ item }) => (
            <Pressable style={s.chip} onPress={() => sendMessage(item)}>
              <Text style={s.chipText}>{item}</Text>
            </Pressable>
          )}
        />
      </View>

      {/* Input Row */}
      <View style={s.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type a message…"
          placeholderTextColor="#888888"
          style={s.input}
          multiline
          maxLength={1000}
        />
        <Pressable
          style={[s.sendBtn, (!text.trim() || sending) && s.sendBtnDisabled]}
          onPress={() => sendMessage(text)}
          disabled={!text.trim() || sending}
        >
          <Text style={s.sendBtnText}>{sending ? '…' : 'Send'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#ffffff' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 45,
    paddingBottom: 14,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e5e5',
  },
  backBtn: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  backText: { color: '#000000', fontWeight: '700', fontSize: 13 },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#000000' },
  headerSub: { fontSize: 12, color: '#777777', marginTop: 2 },
  errorBanner: { backgroundColor: '#fee2e2', padding: 10, margin: 12, borderRadius: 12 },
  errorText: { color: '#dc2626', fontSize: 13, textAlign: 'center', fontWeight: '600' },

  listContent: { padding: 16, paddingBottom: 24, maxWidth: 780, width: '100%', alignSelf: 'center' },
  emptyState: { alignItems: 'center', marginTop: 60, paddingHorizontal: 30 },
  emptyIcon: { fontSize: 44, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#000000' },
  emptyText: { color: '#777777', fontSize: 13, textAlign: 'center', marginTop: 6, lineHeight: 18 },

  bubbleRow: { marginBottom: 14, maxWidth: '80%' },
  bubbleRowMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleRowOther: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  senderInfo: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4, marginLeft: 6 },
  senderName: { fontSize: 12, fontWeight: '700', color: '#000000' },
  roleBadge: { backgroundColor: '#f8fafc', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 },
  roleBadgeText: { fontSize: 10, color: '#555555', fontWeight: '700' },

  bubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  bubbleMe: { backgroundColor: '#000000', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#f8fafc', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 20 },
  bubbleTextMe: { color: '#ffffff' },
  bubbleTextOther: { color: '#000000' },
  timeText: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  timeTextMe: { color: '#aaaaaa' },
  timeTextOther: { color: '#888888' },

  chipsRow: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  chip: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
    marginRight: 8,
  },
  chipText: { fontSize: 12, color: '#000000', fontWeight: '600' },

  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderTopColor: '#e5e5e5',
    gap: 10,
    maxWidth: 780,
    width: '100%',
    alignSelf: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 9999,
    paddingHorizontal: 18,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000000',
    minHeight: 42,
  },
  sendBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#cccccc' },
  sendBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },
});
