import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { api } from '../../lib/api';
import { readSession } from '../../store/auth';

const reasons = [
  'NO_SHOW',
  'PRICING',
  'POOR_SERVICE',
  'WRONG_SERVICE',
  'PROPERTY_DAMAGE',
  'PAYMENT',
  'OTHER',
];

export default function Dispute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [reason, setReason] = useState('POOR_SERVICE');
  const [description, setDescription] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const session = await readSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.createDispute(session.accessToken, String(id), reason, description);
      setMessage('Your case has been logged and assigned to Opustia Grievance Redressal.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create dispute');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Pressable onPress={() => router.back()} style={s.backBtn}>
        <Text style={s.backText}>‹ Back</Text>
      </Pressable>

      <Text style={s.title}>Raise a Concern / Dispute</Text>
      <Text style={s.subtitle}>
        Provide details about the issue. Our statutory grievance team will review and contact both parties.
      </Text>

      {message ? (
        <View style={s.successBox}>
          <Text style={s.successText}>✓ {message}</Text>
          <Pressable style={s.viewCasesBtn} onPress={() => router.push('/disputes')}>
            <Text style={s.viewCasesBtnText}>View My Support Cases ➔</Text>
          </Pressable>
        </View>
      ) : (
        <View style={s.card}>
          <Text style={s.label}>PRIMARY REASON</Text>
          <View style={s.reasons}>
            {reasons.map((item) => {
              const active = reason === item;
              return (
                <Pressable
                  key={item}
                  style={[s.reasonPill, active && s.reasonPillActive]}
                  onPress={() => setReason(item)}
                >
                  <Text style={[s.reasonText, active && s.reasonTextActive]}>
                    {item.replaceAll('_', ' ')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={s.label}>DETAILED DESCRIPTION</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Please describe the issue or rework request in detail..."
            placeholderTextColor="#888888"
            multiline
            style={s.input}
          />

          {error ? <Text style={s.error}>{error}</Text> : null}

          <Pressable
            style={[s.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={submit}
            disabled={submitting}
          >
            <Text style={s.submitBtnText}>
              {submitting ? 'Submitting…' : 'Submit Case to Grievance Redressal'}
            </Text>
          </Pressable>
        </View>
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
  subtitle: { color: '#666666', marginTop: 4, marginBottom: 20, fontSize: 13, lineHeight: 18 },

  card: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    padding: 20,
    overflow: 'hidden',
  },
  label: { fontSize: 11, fontWeight: '800', color: '#777777', letterSpacing: 0.8, marginBottom: 10, marginTop: 8 },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  reasonPill: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  reasonPillActive: { backgroundColor: '#000000' },
  reasonText: { fontSize: 12, color: '#333333', fontWeight: '600' },
  reasonTextActive: { color: '#ffffff', fontWeight: '700' },

  input: {
    backgroundColor: '#f9f9f9',
    borderWidth: 1,
    borderColor: '#e5e5e5',
    borderRadius: 16,
    padding: 14,
    minHeight: 120,
    textAlignVertical: 'top',
    fontSize: 14,
    color: '#000000',
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: '#000000',
    paddingVertical: 14,
    borderRadius: 9999,
    alignItems: 'center',
  },
  submitBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 14 },

  error: { color: '#dc2626', fontSize: 13, fontWeight: '700', marginBottom: 12 },
  successBox: {
    backgroundColor: '#000000',
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
  },
  successText: { color: '#ffffff', fontWeight: '700', fontSize: 14, textAlign: 'center', lineHeight: 20 },
  viewCasesBtn: {
    backgroundColor: '#ffffff',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 9999,
    marginTop: 16,
  },
  viewCasesBtnText: { color: '#000000', fontWeight: '700', fontSize: 13 },
});
