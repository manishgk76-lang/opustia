import { useState } from 'react';
import { Link, router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { login, register } from '../store/auth';

export default function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('pro@opustia.demo');
  const [password, setPassword] = useState('demo123');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      const user =
        mode === 'login'
          ? await login(email, password)
          : await register(name, email, password);
      if (user.role === 'PROFESSIONAL') {
        router.replace('/professional/dashboard');
      } else {
        router.replace('/');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to continue');
    } finally {
      setBusy(false);
    }
  };

  const fillCustomer = () => {
    setEmail('customer@opustia.demo');
    setPassword('demo123');
  };

  const fillPro = () => {
    setEmail('pro@opustia.demo');
    setPassword('demo123');
  };

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      <View style={s.card}>
        {/* Brand Header */}
        <View style={s.logoRow}>
          <View style={s.logoBadge}>
            <Text style={s.logoBadgeIcon}>✦</Text>
          </View>
          <Text style={s.logoText}>opustia</Text>
        </View>

        <Text style={s.title}>{mode === 'login' ? 'Welcome back' : 'Create an account'}</Text>
        <Text style={s.subtitle}>
          {mode === 'login'
            ? 'Sign in to access your dashboard, bookings and services.'
            : 'Join Opustia for verified experts and upfront pricing.'}
        </Text>

        {/* Quick Demo Switcher */}
        {mode === 'login' && (
          <View style={s.quickRolesBox}>
            <Text style={s.quickRolesLabel}>⚡ Quick Demo Sign-In:</Text>
            <View style={s.quickRow}>
              <Pressable
                style={[s.quickBtn, email === 'pro@opustia.demo' && s.quickBtnActive]}
                onPress={fillPro}
              >
                <Text
                  style={[
                    s.quickBtnText,
                    email === 'pro@opustia.demo' && s.quickBtnTextActive,
                  ]}
                >
                  💼 Pro (Ravi)
                </Text>
              </Pressable>
              <Pressable
                style={[s.quickBtn, email === 'customer@opustia.demo' && s.quickBtnActive]}
                onPress={fillCustomer}
              >
                <Text
                  style={[
                    s.quickBtnText,
                    email === 'customer@opustia.demo' && s.quickBtnTextActive,
                  ]}
                >
                  👤 Customer (Rahul)
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Form Inputs */}
        {mode === 'register' && (
          <View style={s.inputGroup}>
            <Text style={s.inputLabel}>Full Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Ramesh Kumar"
              placeholderTextColor="#94a3b8"
              style={s.input}
            />
          </View>
        )}

        <View style={s.inputGroup}>
          <Text style={s.inputLabel}>Email Address</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor="#94a3b8"
            style={s.input}
          />
        </View>

        <View style={s.inputGroup}>
          <Text style={s.inputLabel}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor="#94a3b8"
            style={s.input}
          />
        </View>

        {error ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>⚠️ {error}</Text>
          </View>
        ) : null}

        {/* Primary CTA */}
        <Pressable style={s.ctaBtn} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={s.ctaBtnText}>
              {mode === 'login' ? 'Sign In to Opustia' : 'Create Free Account'}
            </Text>
          )}
        </Pressable>

        {/* Toggle Mode */}
        <Pressable
          onPress={() => setMode(mode === 'login' ? 'register' : 'login')}
          style={s.switchBtn}
        >
          <Text style={s.switchBtnText}>
            {mode === 'login'
              ? 'New to Opustia? Create an account ➔'
              : 'Already have an account? Sign in ➔'}
          </Text>
        </Pressable>

        {/* Skip Link */}
        <Link href="/" style={s.skipLink}>
          Continue browsing without signing in
        </Link>

        {/* Trust Footer */}
        <View style={s.trustFooter}>
          <Text style={s.trustFooterText}>🔒 256-bit Bank-grade Encryption · DPDP Act 2023 Compliant</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: '#ffffff' },
  content: {
    padding: 20,
    justifyContent: 'center',
    minHeight: '100%',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    overflow: 'hidden',
    padding: 28,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#eae7e4',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  logoBadge: {
    backgroundColor: '#000000',
    width: 32,
    height: 32,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeIcon: { color: '#ffffff', fontSize: 16, fontWeight: '900' },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.2,
    textTransform: 'uppercase',
  },

  title: { fontSize: 26, fontWeight: '800', color: '#000000', letterSpacing: -0.2, textTransform: 'uppercase' },
  subtitle: { color: '#666666', marginTop: 4, marginBottom: 22, fontSize: 13, lineHeight: 18 },

  quickRolesBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 20,
    overflow: 'hidden',
    padding: 14,
    marginBottom: 20,
  },
  quickRolesLabel: { fontSize: 11, fontWeight: '800', color: '#000000', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 9999,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    alignItems: 'center',
  },
  quickBtnActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  quickBtnText: { fontSize: 12, fontWeight: '700', color: '#555555' },
  quickBtnTextActive: { color: '#ffffff', fontWeight: '800' },

  inputGroup: { marginBottom: 14 },
  inputLabel: { fontSize: 12, fontWeight: '800', color: '#000000', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    color: '#000000',
  },

  errorBox: {
    backgroundColor: '#fee2e2',
    padding: 12,
    borderRadius: 16,
    marginBottom: 14,
  },
  errorText: { color: '#dc2626', fontSize: 12, fontWeight: '700' },

  ctaBtn: {
    backgroundColor: '#000000',
    paddingVertical: 15,
    borderRadius: 9999,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaBtnText: { color: '#ffffff', fontWeight: '800', fontSize: 15 },

  switchBtn: { marginTop: 18, alignItems: 'center' },
  switchBtnText: { color: '#000000', fontWeight: '700', fontSize: 13 },

  skipLink: {
    textAlign: 'center',
    color: '#888888',
    marginTop: 18,
    fontSize: 12,
    textDecorationLine: 'underline',
  },

  trustFooter: {
    marginTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 14,
    alignItems: 'center',
  },
  trustFooterText: { fontSize: 11, color: '#888888', textAlign: 'center', fontWeight: '600' },
});
