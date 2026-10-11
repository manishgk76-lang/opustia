import { useEffect, useState } from 'react';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { api, Booking, SessionUser } from '../../lib/api';
import { clearSession, login, readSession } from '../../store/auth';

interface SavedAddress {
  id: string;
  label: string;
  area: string;
  city: string;
  fullAddress: string;
  isDefault: boolean;
}

const DEFAULT_ADDRESSES: SavedAddress[] = [
  {
    id: 'addr-1',
    label: 'Home',
    area: 'Indiranagar',
    city: 'Bengaluru',
    fullAddress: '42, 12th Main Road, HAL 2nd Stage, Indiranagar, Bengaluru - 560038',
    isDefault: true,
  },
  {
    id: 'addr-2',
    label: 'Office / Studio',
    area: 'Koramangala',
    city: 'Bengaluru',
    fullAddress: '88, 80 Feet Road, 4th Block, Koramangala, Bengaluru - 560034',
    isDefault: false,
  },
];

export default function Profile() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [addresses, setAddresses] = useState<SavedAddress[]>(DEFAULT_ADDRESSES);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'addresses' | 'warranties' | 'rewards'>('overview');
  const [copiedCode, setCopiedCode] = useState(false);

  // Add Address Modal state
  const [showAddAddr, setShowAddAddr] = useState(false);
  const [newLabel, setNewLabel] = useState('Other');
  const [newArea, setNewArea] = useState('HSR Layout');
  const [newFullAddr, setNewFullAddr] = useState('');

  const loadData = async () => {
    setLoading(true);
    const session = await readSession();
    if (!session) {
      router.replace('/login');
      return;
    }
    setUser(session.user);
    try {
      const bList = await api.getBookings(session.accessToken);
      setBookings(bList);
    } catch {
      // Offline fallback
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleLogout = async () => {
    await clearSession();
    router.replace('/');
  };

  const handleSwitchRole = async (email: string) => {
    setLoading(true);
    try {
      await login(email, 'demo123');
      await loadData();
    } catch {
      // Handle switch error
    } finally {
      setLoading(false);
    }
  };

  const handleAddAddress = () => {
    if (!newFullAddr.trim()) return;
    const newAddr: SavedAddress = {
      id: `addr-${Date.now()}`,
      label: newLabel,
      area: newArea,
      city: 'Bengaluru',
      fullAddress: newFullAddr.trim(),
      isDefault: false,
    };
    setAddresses((prev) => [...prev, newAddr]);
    setNewFullAddr('');
    setShowAddAddr(false);
  };

  const handleSetDefault = (id: string) => {
    setAddresses((prev) =>
      prev.map((a) => ({
        ...a,
        isDefault: a.id === id,
      }))
    );
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return (name[0] || 'U').toUpperCase();
  };

  const completedBookings = bookings.filter((b) => b.status === 'COMPLETED');

  if (loading) {
    return (
      <View style={s.centerBox}>
        <ActivityIndicator size="large" color="#000000" />
        <Text style={s.centerText}>Loading account details...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={s.page} contentContainerStyle={s.content}>
      {/* Top Navigation */}
      <View style={s.topNav}>
        <Pressable onPress={() => router.push('/')} style={s.backBtn}>
          <Text style={s.backBtnText}>‹ Back to Marketplace</Text>
        </Pressable>
        <Pressable onPress={handleLogout} style={s.logoutBtn}>
          <Text style={s.logoutBtnText}>Sign Out</Text>
        </Pressable>
      </View>

      {/* User Header Card */}
      <View style={s.headerCard}>
        <View style={s.headerLeft}>
          <View style={s.avatarBox}>
            <Text style={s.avatarText}>{user ? getInitials(user.name) : 'U'}</Text>
          </View>
          <View style={s.headerInfo}>
            <View style={s.nameRow}>
              <Text style={s.userName}>{user?.name || 'Customer'}</Text>
              <View style={s.verifiedChip}>
                <Text style={s.verifiedChipText}>✓ Verified</Text>
              </View>
            </View>
            <Text style={s.userEmail}>{user?.email}</Text>
            <View style={s.roleBadgeRow}>
              <View style={s.roleBadge}>
                <Text style={s.roleBadgeText}>{user?.role || 'CUSTOMER'}</Text>
              </View>
              <Text style={s.memberSince}>Member since Jan 2026</Text>
            </View>
          </View>
        </View>

        {user?.role === 'PROFESSIONAL' && (
          <Pressable
            style={s.proConsoleBtn}
            onPress={() => router.push('/professional/dashboard')}
          >
            <Text style={s.proConsoleBtnText}>Go to Pro Jobs Console ➔</Text>
          </Pressable>
        )}
      </View>

      {/* Navigation Tabs */}
      <View style={s.tabsRow}>
        <Pressable
          style={[s.tabPill, activeTab === 'overview' && s.tabPillActive]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[s.tabPillText, activeTab === 'overview' && s.tabPillTextActive]}>
            Overview
          </Text>
        </Pressable>
        <Pressable
          style={[s.tabPill, activeTab === 'addresses' && s.tabPillActive]}
          onPress={() => setActiveTab('addresses')}
        >
          <Text style={[s.tabPillText, activeTab === 'addresses' && s.tabPillTextActive]}>
            Saved Addresses ({addresses.length})
          </Text>
        </Pressable>
        <Pressable
          style={[s.tabPill, activeTab === 'warranties' && s.tabPillActive]}
          onPress={() => setActiveTab('warranties')}
        >
          <Text style={[s.tabPillText, activeTab === 'warranties' && s.tabPillTextActive]}>
            Warranty Vault ({completedBookings.length})
          </Text>
        </Pressable>
        <Pressable
          style={[s.tabPill, activeTab === 'rewards' && s.tabPillActive]}
          onPress={() => setActiveTab('rewards')}
        >
          <Text style={[s.tabPillText, activeTab === 'rewards' && s.tabPillTextActive]}>
            Credits & Rewards
          </Text>
        </Pressable>
      </View>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <View style={s.tabContent}>
          {/* Quick Action Cards Grid */}
          <Text style={s.sectionHeader}>ACCOUNT SHORTCUTS</Text>
          <View style={s.shortcutsGrid}>
            <Pressable style={s.shortcutCard} onPress={() => router.push('/bookings')}>
              <Text style={s.shortcutIcon}>📅</Text>
              <Text style={s.shortcutTitle}>My Bookings</Text>
              <Text style={s.shortcutSub}>Track requests, live transit & receipts</Text>
            </Pressable>

            <Pressable style={s.shortcutCard} onPress={() => router.push('/saved')}>
              <Text style={s.shortcutIcon}>♡</Text>
              <Text style={s.shortcutTitle}>Saved Experts</Text>
              <Text style={s.shortcutSub}>Favorite service professionals</Text>
            </Pressable>

            <Pressable style={s.shortcutCard} onPress={() => router.push('/notifications')}>
              <Text style={s.shortcutIcon}>🔔</Text>
              <Text style={s.shortcutTitle}>Notifications</Text>
              <Text style={s.shortcutSub}>Job updates, quotes & OTP alerts</Text>
            </Pressable>

            <Pressable style={s.shortcutCard} onPress={() => router.push('/support')}>
              <Text style={s.shortcutIcon}>🛡️</Text>
              <Text style={s.shortcutTitle}>Support & Legal</Text>
              <Text style={s.shortcutSub}>24x7 Statutory Helpline & Grievances</Text>
            </Pressable>
          </View>

          {/* Quick Role Switcher (For Demo Testing) */}
          <View style={s.demoSwitchCard}>
            <View style={s.demoHeadRow}>
              <Text style={s.demoTitle}>⚡ Quick Account Switcher</Text>
              <Text style={s.demoBadge}>Demo Environment</Text>
            </View>
            <Text style={s.demoSub}>
              Switch between roles instantly to test professional workflows, customer booking and dispute redressal.
            </Text>
            <View style={s.switchButtonsRow}>
              <Pressable
                style={[
                  s.switchRoleBtn,
                  user?.email === 'customer@opustia.demo' && s.switchRoleBtnActive,
                ]}
                onPress={() => handleSwitchRole('customer@opustia.demo')}
              >
                <Text
                  style={[
                    s.switchRoleText,
                    user?.email === 'customer@opustia.demo' && s.switchRoleTextActive,
                  ]}
                >
                  👤 Customer (Rahul)
                </Text>
              </Pressable>

              <Pressable
                style={[
                  s.switchRoleBtn,
                  user?.email === 'pro@opustia.demo' && s.switchRoleBtnActive,
                ]}
                onPress={() => handleSwitchRole('pro@opustia.demo')}
              >
                <Text
                  style={[
                    s.switchRoleText,
                    user?.email === 'pro@opustia.demo' && s.switchRoleTextActive,
                  ]}
                >
                  💼 Pro Partner (Ravi)
                </Text>
              </Pressable>

              <Pressable
                style={[
                  s.switchRoleBtn,
                  user?.email === 'admin@opustia.demo' && s.switchRoleBtnActive,
                ]}
                onPress={() => handleSwitchRole('admin@opustia.demo')}
              >
                <Text
                  style={[
                    s.switchRoleText,
                    user?.email === 'admin@opustia.demo' && s.switchRoleTextActive,
                  ]}
                >
                  🛡️ Admin (Deepa)
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Tab 2: Saved Addresses */}
      {activeTab === 'addresses' && (
        <View style={s.tabContent}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionHeader}>SAVED SERVICE ADDRESSES</Text>
            <Pressable style={s.addAddrPill} onPress={() => setShowAddAddr(true)}>
              <Text style={s.addAddrPillText}>+ Add Address</Text>
            </Pressable>
          </View>

          <View style={s.addressesList}>
            {addresses.map((addr) => (
              <View key={addr.id} style={s.addressCard}>
                <View style={s.addrTopRow}>
                  <View style={s.addrLabelBox}>
                    <Text style={s.addrPinIcon}>📍</Text>
                    <Text style={s.addrLabelText}>{addr.label}</Text>
                    {addr.isDefault && (
                      <View style={s.defaultBadge}>
                        <Text style={s.defaultBadgeText}>DEFAULT</Text>
                      </View>
                    )}
                  </View>
                  {!addr.isDefault && (
                    <Pressable
                      style={s.setDefaultBtn}
                      onPress={() => handleSetDefault(addr.id)}
                    >
                      <Text style={s.setDefaultText}>Set Default</Text>
                    </Pressable>
                  )}
                </View>

                <Text style={s.addrFullText}>{addr.fullAddress}</Text>
                <Text style={s.addrLocality}>{addr.area}, {addr.city}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Tab 3: Warranty Vault */}
      {activeTab === 'warranties' && (
        <View style={s.tabContent}>
          <Text style={s.sectionHeader}>30-DAY WARRANTY CERTIFICATES</Text>
          <Text style={s.sectionSubtext}>
            All completed doorstep services are backed by the Opustia Quality Pledge. Any defect within 30 days is inspected and reworked free of charge.
          </Text>

          {completedBookings.length === 0 ? (
            <View style={s.emptyVaultCard}>
              <Text style={s.emptyVaultIcon}>🛡️</Text>
              <Text style={s.emptyVaultTitle}>No active warranties yet</Text>
              <Text style={s.emptyVaultSub}>
                When you complete a service and pay the professional, your 30-day statutory warranty certificate and GST tax invoice will appear here.
              </Text>
              <Pressable style={s.findProBtn} onPress={() => router.push('/')}>
                <Text style={s.findProBtnText}>Browse Verified Services ➔</Text>
              </Pressable>
            </View>
          ) : (
            <View style={s.warrantiesList}>
              {completedBookings.map((b) => (
                <View key={b.id} style={s.warrantyCard}>
                  <View style={s.warrantyHeadRow}>
                    <View style={s.warrantyBadge}>
                      <Text style={s.warrantyBadgeText}>🛡️ 30-DAY ACTIVE GUARANTEE</Text>
                    </View>
                    <Text style={s.warrantyBookingId}>#{b.id.slice(0, 8)}</Text>
                  </View>

                  <Text style={s.warrantyServiceTitle}>{b.service}</Text>
                  <Text style={s.warrantyAddressText}>Location: {b.address}</Text>

                  <View style={s.warrantyDetailsRow}>
                    <Text style={s.warrantyDetailItem}>Completed: {b.date}</Text>
                    <Text style={s.warrantyDetailItem}>Free Rework Eligible</Text>
                  </View>

                  <Pressable
                    style={s.viewCertBtn}
                    onPress={() => router.push(`/booking/${b.id}`)}
                  >
                    <Text style={s.viewCertBtnText}>View Full Certificate & Tax Invoice ➔</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Tab 4: Credits & Rewards */}
      {activeTab === 'rewards' && (
        <View style={s.tabContent}>
          <Text style={s.sectionHeader}>OPUSTIA REWARDS & CREDITS</Text>

          <View style={s.rewardsBannerCard}>
            <View style={s.rewardsTopRow}>
              <View>
                <Text style={s.rewardsBalanceLabel}>AVAILABLE WALLET CREDITS</Text>
                <Text style={s.rewardsBalanceValue}>₹500</Text>
              </View>
              <View style={s.rewardsCoinBox}>
                <Text style={s.rewardsCoinText}>✦</Text>
              </View>
            </View>
            <Text style={s.rewardsExpiry}>
              Valid across all verified electrical, plumbing, cleaning & repair services.
            </Text>
          </View>

          {/* Referral Card */}
          <View style={s.referralCard}>
            <Text style={s.referralTitle}>Invite Friends & Earn ₹250 Each</Text>
            <Text style={s.referralSub}>
              Share your personal invite code. When your friend completes their first verified service, both of you receive ₹250 in Opustia credits.
            </Text>
            <View style={s.referralCodeBox}>
              <Text style={s.referralCodeText}>OPUSTIA-BANGALORE-2026</Text>
              <Pressable
                style={s.copyBtn}
                onPress={() => {
                  setCopiedCode(true);
                  setTimeout(() => setCopiedCode(false), 2500);
                }}
              >
                <Text style={s.copyBtnText}>{copiedCode ? '✓ Copied!' : 'Copy Code'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* Add Address Modal */}
      <Modal
        visible={showAddAddr}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAddAddr(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalHeadRow}>
              <Text style={s.modalTitle}>Add New Service Address</Text>
              <Pressable onPress={() => setShowAddAddr(false)} style={s.closeModalBtn}>
                <Text style={s.closeModalText}>✕</Text>
              </Pressable>
            </View>

            <Text style={s.inputLabel}>ADDRESS LABEL</Text>
            <View style={s.labelChipsRow}>
              {['Home', 'Office', 'Parents', 'Rental', 'Other'].map((lbl) => (
                <Pressable
                  key={lbl}
                  style={[s.labelChip, newLabel === lbl && s.labelChipActive]}
                  onPress={() => setNewLabel(lbl)}
                >
                  <Text style={[s.labelChipText, newLabel === lbl && s.labelChipTextActive]}>
                    {lbl}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.inputLabel}>LOCALITY / AREA (BANGALORE)</Text>
            <View style={s.labelChipsRow}>
              {['Indiranagar', 'Koramangala', 'HSR Layout', 'Whitefield', 'Jayanagar'].map((ar) => (
                <Pressable
                  key={ar}
                  style={[s.labelChip, newArea === ar && s.labelChipActive]}
                  onPress={() => setNewArea(ar)}
                >
                  <Text style={[s.labelChipText, newArea === ar && s.labelChipTextActive]}>
                    {ar}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={s.inputLabel}>DOOR NO, STREET & LANDMARK</Text>
            <TextInput
              style={s.addrTextInput}
              placeholder="e.g. #14, 5th Cross, Near Metro Station..."
              placeholderTextColor="#888888"
              value={newFullAddr}
              onChangeText={setNewFullAddr}
              multiline
            />

            <View style={s.modalActionsRow}>
              <Pressable style={s.cancelModalBtn} onPress={() => setShowAddAddr(false)}>
                <Text style={s.cancelModalText}>Cancel</Text>
              </Pressable>
              <Pressable style={s.saveAddrBtn} onPress={handleAddAddress}>
                <Text style={s.saveAddrText}>Save Address</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },
  centerBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 40,
  },
  centerText: {
    marginTop: 14,
    fontSize: 14,
    color: '#666666',
  },

  // Top Nav
  topNav: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  backBtn: {
    paddingVertical: 6,
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
  logoutBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
  },
  logoutBtnText: {
    color: '#dc2626',
    fontSize: 12,
    fontWeight: '800',
  },

  // Header Card
  headerCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 28,
    overflow: 'hidden',
    padding: 24,
    borderWidth: 1,
    borderColor: '#eae7e4',
    marginBottom: 24,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
  },
  avatarBox: {
    width: 64,
    height: 64,
    borderRadius: 9999,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 22,
    fontWeight: '800',
  },
  headerInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  userName: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.2,
  },
  verifiedChip: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  verifiedChipText: {
    color: '#16a34a',
    fontSize: 11,
    fontWeight: '800',
  },
  userEmail: {
    fontSize: 13,
    color: '#666666',
    marginTop: 2,
  },
  roleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 6,
  },
  roleBadge: {
    backgroundColor: '#000000',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  roleBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  memberSince: {
    fontSize: 11,
    color: '#888888',
  },
  proConsoleBtn: {
    marginTop: 16,
    backgroundColor: '#000000',
    paddingVertical: 12,
    borderRadius: 9999,
    alignItems: 'center',
  },
  proConsoleBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },

  // Tabs
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 24,
  },
  tabPill: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 9999,
  },
  tabPillActive: {
    backgroundColor: '#000000',
  },
  tabPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#555555',
  },
  tabPillTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },

  tabContent: {
    gap: 20,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  sectionSubtext: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  addAddrPill: {
    backgroundColor: '#000000',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  addAddrPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },

  // Shortcuts Grid
  shortcutsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  shortcutCard: {
    flex: 1,
    minWidth: 200,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eae7e4',
    borderRadius: 20,
    overflow: 'hidden',
    padding: 18,
  },
  shortcutIcon: {
    fontSize: 24,
    marginBottom: 10,
  },
  shortcutTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 3,
  },
  shortcutSub: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 16,
  },

  // Demo Switch Card
  demoSwitchCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eae7e4',
    padding: 22,
    marginTop: 10,
  },
  demoHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  demoTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
  demoBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#000000',
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0dedd',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  demoSub: {
    fontSize: 12,
    color: '#666666',
    lineHeight: 18,
    marginBottom: 16,
  },
  switchButtonsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  switchRoleBtn: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e0dedd',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 9999,
  },
  switchRoleBtnActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  switchRoleText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#444444',
  },
  switchRoleTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },

  // Addresses List
  addressesList: {
    gap: 12,
  },
  addressCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eae7e4',
    borderRadius: 20,
    overflow: 'hidden',
    padding: 18,
  },
  addrTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  addrLabelBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  addrPinIcon: {
    fontSize: 15,
  },
  addrLabelText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#000000',
  },
  defaultBadge: {
    backgroundColor: '#000000',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  defaultBadgeText: {
    color: '#ffffff',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  setDefaultBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    backgroundColor: '#f8fafc',
  },
  setDefaultText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
  },
  addrFullText: {
    fontSize: 13,
    color: '#333333',
    lineHeight: 19,
    marginBottom: 4,
  },
  addrLocality: {
    fontSize: 11,
    color: '#888888',
  },

  // Warranty Vault
  emptyVaultCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    overflow: 'hidden',
    padding: 32,
    alignItems: 'center',
    textAlign: 'center' as any,
  },
  emptyVaultIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  emptyVaultTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 6,
  },
  emptyVaultSub: {
    fontSize: 13,
    color: '#666666',
    textAlign: 'center',
    maxWidth: 480,
    lineHeight: 20,
    marginBottom: 20,
  },
  findProBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 9999,
  },
  findProBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },
  warrantiesList: {
    gap: 12,
  },
  warrantyCard: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#eae7e4',
    borderRadius: 20,
    overflow: 'hidden',
    padding: 20,
  },
  warrantyHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  warrantyBadge: {
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  warrantyBadgeText: {
    color: '#16a34a',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  warrantyBookingId: {
    fontSize: 11,
    color: '#888888',
  },
  warrantyServiceTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 4,
  },
  warrantyAddressText: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 10,
  },
  warrantyDetailsRow: {
    flexDirection: 'row',
    gap: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingTop: 10,
    marginBottom: 14,
  },
  warrantyDetailItem: {
    fontSize: 11,
    color: '#555555',
    fontWeight: '600',
  },
  viewCertBtn: {
    alignSelf: 'flex-start',
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  viewCertBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },

  // Rewards
  rewardsBannerCard: {
    backgroundColor: '#000000',
    borderRadius: 24,
    overflow: 'hidden',
    padding: 24,
    marginBottom: 16,
  },
  rewardsTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rewardsBalanceLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#aaaaaa',
    letterSpacing: 1,
  },
  rewardsBalanceValue: {
    fontSize: 34,
    fontWeight: '800',
    color: '#ffffff',
    marginTop: 4,
  },
  rewardsCoinBox: {
    width: 44,
    height: 44,
    borderRadius: 9999,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rewardsCoinText: {
    fontSize: 20,
    color: '#000000',
    fontWeight: '900',
  },
  rewardsExpiry: {
    fontSize: 12,
    color: '#cccccc',
    marginTop: 14,
  },

  referralCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#eae7e4',
    padding: 22,
  },
  referralTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 4,
  },
  referralSub: {
    fontSize: 13,
    color: '#666666',
    lineHeight: 19,
    marginBottom: 16,
  },
  referralCodeBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 9999,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#e0dedd',
  },
  referralCodeText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.5,
  },
  copyBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  copyBtnText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    overflow: 'hidden',
    padding: 24,
    width: '100%',
    maxWidth: 480,
  },
  modalHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#000000',
  },
  closeModalBtn: {
    padding: 4,
  },
  closeModalText: {
    fontSize: 16,
    color: '#888888',
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 8,
  },
  labelChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  labelChip: {
    backgroundColor: '#f8fafc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
  },
  labelChipActive: {
    backgroundColor: '#000000',
  },
  labelChipText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555555',
  },
  labelChipTextActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  addrTextInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 14,
    fontSize: 13,
    color: '#000000',
    minHeight: 70,
    outlineStyle: 'none' as any,
  },
  modalActionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  cancelModalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 9999,
    backgroundColor: '#f8fafc',
  },
  cancelModalText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  saveAddrBtn: {
    backgroundColor: '#000000',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 9999,
  },
  saveAddrText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
});
