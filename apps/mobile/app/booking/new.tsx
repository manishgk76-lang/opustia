import { useEffect, useState } from 'react';
import { useLocalSearchParams, router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api } from '../../lib/api';
import { readSession } from '../../store/auth';
import {
  DEFAULT_LOCATION,
  POPULAR_LOCATIONS,
  detectCurrentLocation,
  getSelectedLocation,
} from '../../store/location';

export default function NewBooking() {
  const params = useLocalSearchParams<{
    professionalId?: string;
    professionalName?: string;
    service?: string;
    address?: string;
    problem?: string;
    reorder?: string;
  }>();

  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [service, setService] = useState(params.service || 'General service');
  const [date, setDate] = useState(tomorrowStr);
  const [time, setTime] = useState('10:00');
  const [address, setAddress] = useState(params.address || '');
  const [landmark, setLandmark] = useState('');
  const [lat, setLat] = useState<number | undefined>(DEFAULT_LOCATION.lat);
  const [lng, setLng] = useState<number | undefined>(DEFAULT_LOCATION.lng);
  const [problem, setProblem] = useState(params.problem || '');
  const [busy, setBusy] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!params.address) {
      getSelectedLocation().then((loc) => {
        setAddress(loc.address);
        setLat(loc.lat);
        setLng(loc.lng);
      });
    }
  }, [params.address]);

  const handleGpsDetect = async () => {
    setDetectingGps(true);
    setError('');
    try {
      const loc = await detectCurrentLocation();
      setAddress(loc.address);
      setLat(loc.lat);
      setLng(loc.lng);
    } catch {
      setError('Unable to detect GPS position. Please enter your address manually.');
    } finally {
      setDetectingGps(false);
    }
  };

  const handleSelectPreset = (preset: typeof POPULAR_LOCATIONS[0]) => {
    setAddress(preset.address);
    setLat(preset.lat);
    setLng(preset.lng);
  };

  const submit = async () => {
    const finalAddress = landmark ? `${address.trim()}, Near ${landmark.trim()}` : address.trim();
    if (finalAddress.length < 5) {
      setError('Please provide a complete address (at least 5 characters).');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const session = await readSession();
      if (!session) {
        router.push('/login');
        return;
      }
      await api.createBooking(session.accessToken, {
        professionalId: String(params.professionalId || 'p1'),
        service,
        date,
        time,
        address: finalAddress,
        latitude: lat,
        longitude: lng,
        problem,
        idempotencyKey: `mobile-${Date.now()}`,
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to create booking');
    } finally {
      setBusy(false);
    }
  };

  if (done) {
    return (
      <View style={s.center}>
        <Text style={s.check}>✓</Text>
        <Text style={s.title}>Request sent</Text>
        <Text style={s.copy}>
          Your service request was dispatched to {params.professionalName || 'the professional'}.
          Location and arrival details are shared securely.
        </Text>
        <Pressable style={s.cta} onPress={() => router.replace('/')}>
          <Text style={s.ctaText}>Back to home</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <Pressable onPress={() => router.back()}>
        <Text style={s.back}>‹ Back</Text>
      </Pressable>

      <Text style={s.title}>Book {params.professionalName || 'a professional'}</Text>
      <Text style={s.subtitle}>Share a few details so they can arrive prepared.</Text>

      {params.reorder === 'true' && (
        <View style={s.reorderBanner}>
          <Text style={s.reorderBannerIcon}>↻</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.reorderBannerTitle}>Rebooking Previous Service</Text>
            <Text style={s.reorderBannerSub}>
              Details pre-filled from your previous booking with {params.professionalName || 'the provider'}.
            </Text>
          </View>
        </View>
      )}

      <Text style={s.label}>Service</Text>
      <TextInput value={service} onChangeText={setService} style={s.input} />

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Date</Text>
          <TextInput
            value={date}
            onChangeText={setDate}
            placeholder="YYYY-MM-DD"
            style={s.input}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Time</Text>
          <TextInput
            value={time}
            onChangeText={setTime}
            placeholder="10:00"
            style={s.input}
          />
        </View>
      </View>

      {/* Location Section */}
      <View style={s.locationSectionHead}>
        <Text style={s.label}>Service Location</Text>
        <Pressable
          style={s.gpsDetectBtn}
          onPress={handleGpsDetect}
          disabled={detectingGps}
        >
          {detectingGps ? (
            <ActivityIndicator size="small" color="#167d73" />
          ) : (
            <Text style={s.gpsDetectText}>🎯 Auto-Detect GPS</Text>
          )}
        </Pressable>
      </View>

      {/* Quick location chips */}
      <View style={s.presetChipsRow}>
        <Pressable
          style={[s.chip, address.includes('Indiranagar') && s.chipActive]}
          onPress={() => handleSelectPreset(POPULAR_LOCATIONS[0])}
        >
          <Text style={[s.chipText, address.includes('Indiranagar') && s.chipTextActive]}>
            🏠 Indiranagar
          </Text>
        </Pressable>
        <Pressable
          style={[s.chip, address.includes('Koramangala') && s.chipActive]}
          onPress={() => handleSelectPreset(POPULAR_LOCATIONS[1])}
        >
          <Text style={[s.chipText, address.includes('Koramangala') && s.chipTextActive]}>
            🏢 Koramangala
          </Text>
        </Pressable>
        <Pressable
          style={[s.chip, address.includes('HSR') && s.chipActive]}
          onPress={() => handleSelectPreset(POPULAR_LOCATIONS[2])}
        >
          <Text style={[s.chipText, address.includes('HSR') && s.chipTextActive]}>
            📍 HSR Layout
          </Text>
        </Pressable>
      </View>

      <TextInput
        value={address}
        onChangeText={setAddress}
        placeholder="House/flat, street, area, city"
        style={s.input}
      />

      <Text style={s.label}>Landmark / Directions (Optional)</Text>
      <TextInput
        value={landmark}
        onChangeText={setLandmark}
        placeholder="e.g. Opposite Starbucks, 2nd floor"
        style={s.input}
      />

      {lat != null && lng != null && (
        <View style={s.locationVerifiedCard}>
          <Text style={s.locationPinIcon}>📍</Text>
          <View style={{ flex: 1 }}>
            <Text style={s.locationVerifiedTitle}>Coordinates Attached</Text>
            <Text style={s.locationVerifiedCoords}>
              {lat.toFixed(4)}° N, {lng.toFixed(4)}° E · Shared with provider for turn-by-turn navigation
            </Text>
          </View>
        </View>
      )}

      <Text style={s.label}>Describe the problem</Text>
      <TextInput
        value={problem}
        onChangeText={setProblem}
        placeholder="Explain what needs fixing..."
        multiline
        style={[s.input, s.multiline]}
      />

      {error ? <Text style={s.error}>{error}</Text> : null}

      <Pressable style={s.cta} onPress={submit} disabled={busy}>
        {busy ? (
          <ActivityIndicator color="#17383d" />
        ) : (
          <Text style={s.ctaText}>Request booking</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#ffffff' },
  content: {
    maxWidth: 680,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },
  center: { flex: 1, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center', padding: 30 },
  back: { color: '#000000', fontWeight: '800', fontSize: 14, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', color: '#000000', letterSpacing: -0.2, textTransform: 'uppercase' },
  subtitle: { color: '#666666', marginTop: 4, marginBottom: 20, fontSize: 14 },
  label: { fontWeight: '800', color: '#000000', marginTop: 16, marginBottom: 8, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#eae7e4',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 14,
    color: '#000000',
  },
  multiline: { height: 90, textAlignVertical: 'top' },
  cta: {
    backgroundColor: '#000000',
    paddingVertical: 16,
    borderRadius: 9999,
    alignItems: 'center',
    marginTop: 28,
    width: '100%',
  },
  ctaText: { fontWeight: '800', color: '#ffffff', fontSize: 15 },
  error: { color: '#dc2626', marginTop: 12, fontWeight: '700', fontSize: 13 },
  check: { fontSize: 52, color: '#22c55e' },
  copy: { textAlign: 'center', color: '#666666', lineHeight: 22, marginTop: 10, maxWidth: 340, fontSize: 14 },

  // Location selector styles
  locationSectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, marginBottom: 8 },
  gpsDetectBtn: { backgroundColor: '#000000', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999 },
  gpsDetectText: { color: '#ffffff', fontSize: 11, fontWeight: '800' },
  presetChipsRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  chip: { backgroundColor: '#f8fafc', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 9999 },
  chipActive: { backgroundColor: '#000000' },
  chipText: { fontSize: 12, color: '#555555', fontWeight: '600' },
  chipTextActive: { color: '#ffffff', fontWeight: '800' },
  locationVerifiedCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f8fafc', borderRadius: 18, overflow: 'hidden', padding: 12, marginTop: 10 },
  locationPinIcon: { fontSize: 18 },
  locationVerifiedTitle: { fontSize: 12, fontWeight: '800', color: '#000000' },
  locationVerifiedCoords: { fontSize: 11, color: '#666666', marginTop: 1 },

  // Reorder Banner
  reorderBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f8fafc', borderRadius: 20, overflow: 'hidden', padding: 16, marginBottom: 16 },
  reorderBannerIcon: { fontSize: 22 },
  reorderBannerTitle: { fontSize: 13, fontWeight: '800', color: '#000000' },
  reorderBannerSub: { fontSize: 11, color: '#666666', marginTop: 2, lineHeight: 15 },
});
