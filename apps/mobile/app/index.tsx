import { useEffect, useMemo, useState } from 'react';
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
import { api, Category, Professional, RateCardCategory, SessionUser, UserLocation } from '../lib/api';
import { readSession, restoreValidatedSession } from '../store/auth';
import {
  DEFAULT_LOCATION,
  POPULAR_LOCATIONS,
  detectCurrentLocation,
  getSelectedLocation,
  setSelectedLocation,
} from '../store/location';
import { router } from 'expo-router';

function getInitials(name: string): string {
  if (!name) return 'OP';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function Home() {
  const [q, setQ] = useState('');
  const [cats, setCats] = useState<Category[]>([]);
  const [pros, setPros] = useState<Professional[]>([]);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [saved, setSaved] = useState<string[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Location state
  const [location, setLocation] = useState<UserLocation>(DEFAULT_LOCATION);
  const [showLocModal, setShowLocModal] = useState(false);
  const [detectingGps, setDetectingGps] = useState(false);
  const [customLocInput, setCustomLocInput] = useState('');
  // Rate Cards & Sorting State
  const [rateCards, setRateCards] = useState<RateCardCategory[]>([]);
  const [showRateModal, setShowRateModal] = useState(false);
  const [activeRateCat, setActiveRateCat] = useState('plumbing');
  const [proSortBy, setProSortBy] = useState<'all' | 'top_rated' | 'nearest' | 'budget' | 'verified'>('all');


  const load = async (search = '', targetLoc?: UserLocation) => {
    setLoading(true);
    setError('');
    const activeLoc = targetLoc || location;
    try {
      const [c, p] = await Promise.all([
        api.getCategories(),
        api.getProfessionals(search, activeLoc.lat, activeLoc.lng),
      ]);
      setCats(c);
      setPros(p.items);
      api.getRateCards().then((rc) => Array.isArray(rc) && setRateCards(rc)).catch(() => {});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getSelectedLocation().then((loc) => {
      setLocation(loc);
      load(q, loc);
    });

    restoreValidatedSession().then(async (session) => {
      setUser(session?.user || null);
      if (session?.accessToken) {
        api.getUnreadNotificationsCount(session.accessToken)
          .then((res) => setUnreadCount(res.count))
          .catch(() => {});
      }
      if (session?.user.role === 'CUSTOMER') {
        try {
          const favorites = await api.getFavorites(session.accessToken);
          setSaved(favorites.map((p) => p.id));
        } catch {}
      }
    });
  }, []);

  const handleSelectLocation = async (loc: UserLocation) => {
    await setSelectedLocation(loc);
    setLocation(loc);
    setShowLocModal(false);
    load(q, loc);
  };

  
  const sortedPros = useMemo(() => {
    let list = [...pros];
    if (proSortBy === 'top_rated') {
      return list.filter((p) => p.rating >= 4.8).sort((a, b) => b.rating - a.rating);
    }
    if (proSortBy === 'nearest') {
      return [...list].sort((a, b) => (a.distanceKm ?? 99) - (b.distanceKm ?? 99));
    }
    if (proSortBy === 'budget') {
      return [...list].sort((a, b) => (a.priceFrom ?? 999) - (b.priceFrom ?? 999));
    }
    if (proSortBy === 'verified') {
      return list.filter((p) => p.verified);
    }
    return list;
  }, [pros, proSortBy]);

  const handleGpsDetect = async () => {
    setDetectingGps(true);
    try {
      const detected = await detectCurrentLocation();
      await handleSelectLocation(detected);
    } catch {
      setError('Could not retrieve GPS location. Please choose from the list.');
    } finally {
      setDetectingGps(false);
    }
  };

  const handleApplyCustomLoc = async () => {
    const trimmed = customLocInput.trim();
    if (!trimmed) return;
    const customLoc: UserLocation = {
      address: trimmed,
      area: trimmed.split(',')[0].trim(),
      city: 'Bengaluru',
      lat: 12.9716,
      lng: 77.5946,
    };
    setCustomLocInput('');
    await handleSelectLocation(customLoc);
  };

  const toggleSave = async (p: Professional) => {
    const session = await readSession();
    if (!session) {
      router.push('/login');
      return;
    }
    if (session.user.role !== 'CUSTOMER') {
      setError('Only customer accounts can save professionals.');
      return;
    }
    try {
      if (saved.includes(p.id)) {
        await api.removeFavorite(session.accessToken, p.id);
        setSaved((current) => current.filter((id) => id !== p.id));
      } else {
        await api.addFavorite(session.accessToken, p.id);
        setSaved((current) => [...current, p.id]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update saved professionals');
    }
  };

  return (
    <ScrollView style={s.page} contentContainerStyle={s.scrollContainer}>
      {/* 1. Top Announcement Bar */}
      <View style={s.announcementBar}>
        <Text style={s.announcementText}>
          ✦ Verified home experts with instant upfront quotes, arrival OTP security, and 30-day warranty.
        </Text>
      </View>

      {/* 2. Top Navigation Bar */}
      <View style={s.navWrapper}>
        <View style={s.navInner}>
          {/* Logo & Location Pill */}
          <View style={s.brandGroup}>
            <Pressable
              onPress={() => {
                setQ('');
                load('');
              }}
              style={s.logoPressable}
            >
              <View style={s.logoBadge}>
                <Text style={s.logoBadgeIcon}>✦</Text>
              </View>
              <Text style={s.logoText}>OPUSTIA</Text>
            </Pressable>

            <Pressable
              style={s.locationPill}
              onPress={() => setShowLocModal(true)}
            >
              <Text style={s.locationPin}>📍</Text>
              <Text style={s.locationArea} numberOfLines={1}>
                {location.area}
              </Text>
              <Text style={s.locationCity}>, {location.city}</Text>
              <Text style={s.locationChevron}>▾</Text>
            </Pressable>
          </View>

          {/* Right Action Items */}
          <View style={s.navActionRow}>
            <Pressable
              onPress={() => router.push('/professional/dashboard')}
              style={s.navProBtn}
            >
              <Text style={s.navProBtnText}>Pro Console ➔</Text>
            </Pressable>

            {user?.role === 'CUSTOMER' && (
              <Pressable
                onPress={() => router.push('/bookings')}
                style={s.navPillBtn}
              >
                <Text style={s.navPillBtnText}>📅 Bookings</Text>
              </Pressable>
            )}

            {user?.role === 'CUSTOMER' && (
              <Pressable
                onPress={() => router.push('/saved')}
                style={s.navIconBtn}
              >
                <Text style={s.navIconEmoji}>♡</Text>
                {saved.length > 0 && (
                  <View style={s.navBadge}>
                    <Text style={s.navBadgeText}>{saved.length}</Text>
                  </View>
                )}
              </Pressable>
            )}

            {user && (
              <Pressable
                onPress={() => router.push('/notifications')}
                style={s.navIconBtn}
              >
                <Text style={s.navIconEmoji}>🔔</Text>
                {unreadCount > 0 && (
                  <View style={s.navBadge}>
                    <Text style={s.navBadgeText}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </Text>
                  </View>
                )}
              </Pressable>
            )}

            <Pressable
              onPress={() => router.push('/support')}
              style={s.navSupportPill}
            >
              <Text style={s.navSupportText}>🛡️ Support</Text>
            </Pressable>

            <Pressable
              onPress={() => router.push(user ? '/profile' : '/login')}
              style={s.navUserPill}
            >
              <Text style={s.navUserPillText}>
                {user ? `👤 ${user.name.split(' ')[0]}` : 'Sign In'}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>

      {/* Main Content Body */}
      <View style={s.mainBody}>
        {/* 3. Hero Section (Clean High-Contrast Aesthetic) */}
        <View style={s.heroCard}>
          <View style={s.heroPillBadge}>
            <Text style={s.heroPillText}>✦ INDIA'S VERIFIED HOME SERVICES MARKETPLACE</Text>
          </View>

          <Text style={s.heroHeadline}>
            What service do you need today?
          </Text>

          <Text style={s.heroSubtitle}>
            {user
              ? `Welcome back, ${user.name.split(' ')[0]}! Book certified home experts with guaranteed upfront quotes.`
              : 'Book police-verified professionals with instant upfront quotes, arrival OTP security, and 30-day warranty.'}
          </Text>

          {/* Search Input Bar */}
          <View style={s.searchBarBox}>
            <Text style={s.searchIcon}>🔍</Text>
            <TextInput
              value={q}
              onChangeText={setQ}
              onSubmitEditing={() => load(q)}
              placeholder="Search plumbers, electricians, AC repair, cleaners..."
              placeholderTextColor="#888888"
              style={s.searchInput}
            />
            {q.length > 0 ? (
              <Pressable
                onPress={() => {
                  setQ('');
                  load('');
                }}
                style={s.searchClearBtn}
              >
                <Text style={s.searchClearText}>✕</Text>
              </Pressable>
            ) : (
              <Pressable style={s.searchActionBtn} onPress={() => load(q)}>
                <Text style={s.searchActionBtnText}>Search</Text>
              </Pressable>
            )}
          </View>

          {/* Quick Popular Tags */}
          <View style={s.popularTagsRow}>
            <Text style={s.popularLabel}>Popular:</Text>
            {['Plumbing', 'Electrical', 'AC Service', 'Cleaning', 'Carpentry'].map((tag) => (
              <Pressable
                key={tag}
                style={s.tagPill}
                onPress={() => {
                  setQ(tag);
                  load(tag);
                }}
              >
                <Text style={s.tagPillText}>{tag}</Text>
              </Pressable>
            ))}
          </View>

          
          {/* Rate Card Transparency Banner Button */}
          <Pressable style={s.rateCardBannerBtn} onPress={() => setShowRateModal(true)}>
            <View style={s.rateCardBannerLeft}>
              <Text style={s.rateCardBannerIcon}>🏷️</Text>
              <View>
                <Text style={s.rateCardBannerTitle}>Standard Benchmark Rate Cards</Text>
                <Text style={s.rateCardBannerSub}>100% price transparency, zero hidden charges & 30-day warranty</Text>
              </View>
            </View>
            <View style={s.rateCardBannerPill}>
              <Text style={s.rateCardBannerPillText}>View Rates ➔</Text>
            </View>
          </Pressable>

          {/* Stats Counters Row */}
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statNumber}>500+</Text>
              <Text style={s.statLabel}>Verified Pros</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statNumber}>25,000+</Text>
              <Text style={s.statLabel}>Completed Jobs</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statNumber}>4.9 ★</Text>
              <Text style={s.statLabel}>Average Rating</Text>
            </View>
          </View>
        </View>

        {/* 4. Browse Categories Section */}
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>BROWSE CATEGORIES</Text>
          <Text style={s.sectionSubtitle}>
            Select a service to find nearby certified professionals
          </Text>
        </View>

        <View style={s.catsGrid}>
          {cats.map((c) => {
            const isSelected = q.toLowerCase() === c.name.toLowerCase();
            return (
              <Pressable
                key={c.id}
                style={[s.catCard, isSelected && s.catCardActive]}
                onPress={() => {
                  const nextQ = isSelected ? '' : c.name;
                  setQ(nextQ);
                  load(nextQ);
                }}
              >
                <View style={[s.catIconBox, isSelected && s.catIconBoxActive]}>
                  <Text style={s.catEmoji}>{c.icon}</Text>
                </View>
                <Text style={[s.catName, isSelected && s.catNameActive]} numberOfLines={1}>
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* 5. The Opustia Quality Pledge */}
        <View style={s.trustBanner}>
          <View style={s.trustHeaderRow}>
            <View style={s.trustBadgePill}>
              <Text style={s.trustBadgeText}>🛡️ THE OPUSTIA QUALITY PLEDGE</Text>
            </View>
            <View style={s.ratingBadgePill}>
              <Text style={s.pledgeRatingText}>★ 4.9/5 Average Pro Rating</Text>
            </View>
          </View>

          <View style={s.trustFeaturesGrid}>
            <View style={s.trustFeatureItem}>
              <View style={s.trustIconBox}>
                <Text style={s.trustFeatureIcon}>👮</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.trustFeatureTitle}>Police & KYC Verified</Text>
                <Text style={s.trustFeatureSub}>Background checked and skill certified</Text>
              </View>
            </View>

            <View style={s.trustFeatureItem}>
              <View style={s.trustIconBox}>
                <Text style={s.trustFeatureIcon}>🏷️</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.trustFeatureTitle}>Binding Upfront Quotes</Text>
                <Text style={s.trustFeatureSub}>Fixed labour quotes with no surprise surges</Text>
              </View>
            </View>

            <View style={s.trustFeatureItem}>
              <View style={s.trustIconBox}>
                <Text style={s.trustFeatureIcon}>🔑</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.trustFeatureTitle}>Arrival OTP Security</Text>
                <Text style={s.trustFeatureSub}>Share arrival code only at your doorstep</Text>
              </View>
            </View>

            <View style={s.trustFeatureItem}>
              <View style={s.trustIconBox}>
                <Text style={s.trustFeatureIcon}>🔄</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.trustFeatureTitle}>30-Day Free Warranty</Text>
                <Text style={s.trustFeatureSub}>Free inspection and rework on every service</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 6. Nearby Professionals Section */}
        <View style={s.prosHeaderRow}>
          <View>
            <Text style={s.sectionTitle}>NEARBY PROFESSIONALS</Text>
            <Text style={s.sectionSubtitle}>
              Verified service partners available near {location.area}
            </Text>
          </View>
          <Pressable
            style={s.activeLocChip}
            onPress={() => setShowLocModal(true)}
          >
            <Text style={s.activeLocChipText}>📍 Near {location.area} ▾</Text>
          </Pressable>
        </View>

        
        {/* Marketplace Sorting & Proximity Filter Bar */}
        <View style={s.sortBarContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.sortBarScroll}>
            <Pressable
              style={[s.sortPill, proSortBy === 'all' && s.sortPillActive]}
              onPress={() => setProSortBy('all')}
            >
              <Text style={[s.sortPillText, proSortBy === 'all' && s.sortPillTextActive]}>
                All Pros ({pros.length})
              </Text>
            </Pressable>
            <Pressable
              style={[s.sortPill, proSortBy === 'top_rated' && s.sortPillActive]}
              onPress={() => setProSortBy('top_rated')}
            >
              <Text style={[s.sortPillText, proSortBy === 'top_rated' && s.sortPillTextActive]}>
                ★ Top Rated (4.8+)
              </Text>
            </Pressable>
            <Pressable
              style={[s.sortPill, proSortBy === 'nearest' && s.sortPillActive]}
              onPress={() => setProSortBy('nearest')}
            >
              <Text style={[s.sortPillText, proSortBy === 'nearest' && s.sortPillTextActive]}>
                📍 Nearest Proximity
              </Text>
            </Pressable>
            <Pressable
              style={[s.sortPill, proSortBy === 'budget' && s.sortPillActive]}
              onPress={() => setProSortBy('budget')}
            >
              <Text style={[s.sortPillText, proSortBy === 'budget' && s.sortPillTextActive]}>
                ₹ Budget Friendly
              </Text>
            </Pressable>
            <Pressable
              style={[s.sortPill, proSortBy === 'verified' && s.sortPillActive]}
              onPress={() => setProSortBy('verified')}
            >
              <Text style={[s.sortPillText, proSortBy === 'verified' && s.sortPillTextActive]}>
                ✓ KYC Verified Only
              </Text>
            </Pressable>
          </ScrollView>
        </View>

        {loading ? (
          <View style={s.loadingBox}>
            <ActivityIndicator color="#000000" size="large" />
            <Text style={s.loadingText}>Finding nearby certified providers...</Text>
          </View>
        ) : error ? (
          <View style={s.errorBox}>
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : sortedPros.length === 0 ? (
          <View style={s.emptyBox}>
            <Text style={s.emptyIcon}>🔍</Text>
            <Text style={s.emptyTitle}>No professionals found in this area</Text>
            <Text style={s.emptySubtitle}>
              Try searching for a different service or changing your locality above.
            </Text>
          </View>
        ) : (
          <View style={s.prosGrid}>
            {sortedPros.map((p) => {
              const isSaved = saved.includes(p.id);
              return (
                <View key={p.id} style={s.proCard}>
                  <Pressable
                    style={s.proCardContent}
                    onPress={() => router.push(`/professional/${p.id}`)}
                  >
                    {/* Pro Avatar */}
                    <View style={s.proAvatarBox}>
                      <Text style={s.proAvatarText}>{getInitials(p.businessName)}</Text>
                      {p.verified && (
                        <View style={s.verifiedCheckBadge}>
                          <Text style={s.verifiedCheckText}>✓</Text>
                        </View>
                      )}
                    </View>

                    {/* Pro Info */}
                    <View style={s.proInfo}>
                      <Text style={s.proName} numberOfLines={1}>
                        {p.businessName}
                      </Text>

                      <View style={s.proBadgesRow}>
                        <View style={s.categoryPill}>
                          <Text style={s.categoryPillText}>
                            {p.category.replace('-', ' ')}
                          </Text>
                        </View>
                        <View style={s.distanceBadge}>
                          <Text style={s.distanceBadgeText}>📍 {p.distanceKm} km</Text>
                        </View>
                        <View style={s.ratingBadge}>
                          <Text style={s.ratingBadgeText}>★ {p.rating}</Text>
                        </View>
                      </View>

                      {p.serviceArea ? (
                        <Text style={s.serviceAreaText} numberOfLines={1}>
                          Servicing: {p.serviceArea}
                        </Text>
                      ) : null}

                      <Text style={s.proStartingText}>
                        Binding upfront quote on request · Arrival OTP security
                      </Text>
                    </View>
                  </Pressable>

                  {/* Pro Actions Row */}
                  <View style={s.proActionsRow}>
                    <Pressable
                      style={[s.saveBtn, isSaved && s.saveBtnActive]}
                      onPress={() => toggleSave(p)}
                    >
                      <Text style={[s.saveBtnIcon, isSaved && s.saveBtnIconActive]}>
                        {isSaved ? '♥' : '♡'}
                      </Text>
                    </Pressable>
                    <Pressable
                      style={s.bookBtn}
                      onPress={() =>
                        router.push({
                          pathname: '/booking/new',
                          params: { professionalId: p.id, professionalName: p.businessName },
                        })
                      }
                    >
                      <Text style={s.bookBtnText}>Book Now ➔</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* 7. Corporate Legal & Support Footer (Uber-Style Minimalist Architecture) */}
        <View style={s.uberFooter}>
          {/* Top Brand & Help Bar */}
          <View style={s.uberFooterTop}>
            <View style={s.uberFooterBrandBlock}>
              <View style={s.uberFooterLogoRow}>
                <View style={s.uberLogoSquare}>
                  <Text style={s.uberLogoSquareText}>✦</Text>
                </View>
                <Text style={s.uberFooterLogo}>OPUSTIA</Text>
              </View>
              <Text style={s.uberFooterTagline}>
                Doorstep home services by police-verified professionals · Transparent upfront quotes · 30-day warranty
              </Text>
            </View>

            <Pressable
              style={s.uberHelpCenterBtn}
              onPress={() => router.push('/support?tab=contact')}
            >
              <Text style={s.uberHelpCenterBtnText}>Visit Help Center ➔</Text>
            </Pressable>
          </View>

          {/* Platform Directory Navigation Bar */}
          <View style={s.uberNavBar}>
            <View style={s.uberNavHeaderRow}>
              <View style={s.uberNavBadge}>
                <Text style={s.uberNavBadgeText}>✦ PLATFORM DIRECTORY</Text>
              </View>
              <Text style={s.uberNavSub}>Direct 1-tap navigation across Opustia verified services</Text>
            </View>

            <View style={s.uberNavPillsRow}>
              <Pressable
                style={[s.uberNavPill, s.uberNavPillActive]}
                onPress={() => router.push('/')}
              >
                <Text style={s.uberNavPillIcon}>🏠</Text>
                <Text style={[s.uberNavPillText, s.uberNavPillTextActive]}>Marketplace Home</Text>
              </Pressable>

              <Pressable
                style={s.uberNavPill}
                onPress={() => setShowRateModal(true)}
              >
                <Text style={s.uberNavPillIcon}>🏷️</Text>
                <Text style={s.uberNavPillText}>Benchmark Rates</Text>
              </Pressable>

              <Pressable
                style={s.uberNavPill}
                onPress={() => router.push('/bookings')}
              >
                <Text style={s.uberNavPillIcon}>📅</Text>
                <Text style={s.uberNavPillText}>My Bookings</Text>
              </Pressable>

              <Pressable
                style={s.uberNavPill}
                onPress={() => router.push('/professional/dashboard')}
              >
                <Text style={s.uberNavPillIcon}>💼</Text>
                <Text style={s.uberNavPillText}>Partner Pro Console</Text>
              </Pressable>

              <Pressable
                style={s.uberNavPill}
                onPress={() => router.push('/notifications')}
              >
                <Text style={s.uberNavPillIcon}>🔔</Text>
                <Text style={s.uberNavPillText}>Alerts & Updates</Text>
              </Pressable>

              <Pressable
                style={s.uberNavPill}
                onPress={() => router.push('/disputes')}
              >
                <Text style={s.uberNavPillIcon}>⚖️</Text>
                <Text style={s.uberNavPillText}>Resolution Center</Text>
              </Pressable>

              <Pressable
                style={s.uberNavPill}
                onPress={() => router.push('/support')}
              >
                <Text style={s.uberNavPillIcon}>🎧</Text>
                <Text style={s.uberNavPillText}>24x7 Help Desk</Text>
              </Pressable>
            </View>
          </View>

          {/* Multi-Column Uber Directory */}
          <View style={s.uberColumnsRow}>
            {/* Column 1: Company */}
            <View style={s.uberCol}>
              <Text style={s.uberColHeader}>COMPANY</Text>
              <Pressable onPress={() => router.push('/support')} style={s.uberLinkItem}>
                <Text style={s.uberLinkText}>About Opustia</Text>
              </Pressable>
              <Pressable onPress={() => setShowRateModal(true)} style={s.uberLinkItem}>
                <Text style={s.uberLinkText}>Standard Rate Cards</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/support?tab=trust')} style={s.uberLinkItem}>
                <Text style={s.uberLinkText}>Police & KYC Verification</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/support?tab=refund')} style={s.uberLinkItem}>
                <Text style={s.uberLinkText}>30-Day Free Warranty</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/support')} style={s.uberLinkItem}>
                <Text style={s.uberLinkText}>Newsroom & Blog</Text>
              </Pressable>
            </View>

            {/* Column 2: Popular Services */}
            <View style={s.uberCol}>
              <Text style={s.uberColHeader}>SERVICES</Text>
              <Pressable onPress={() => { setQ('Plumbing'); load('Plumbing'); }} style={s.uberLinkItem}>
                <Text style={s.uberLinkText}>Plumbing & Sanitary</Text>
              </Pressable>
              <Pressable onPress={() => { setQ('Electrical'); load('Electrical'); }} style={s.uberLinkItem}>
                <Text style={s.uberLinkText}>Electrical & Wiring</Text>
              </Pressable>
              <Pressable onPress={() => { setQ('AC Repair'); load('AC Repair'); }} style={s.uberLinkItem}>
                <Text style={s.uberLinkText}>AC Service & Foam Jet</Text>
              </Pressable>
              <Pressable onPress={() => { setQ('Cleaning'); load('Cleaning'); }} style={s.uberLinkItem}>
                <Text style={s.uberLinkText}>Deep Home Cleaning</Text>
              </Pressable>
              <Pressable onPress={() => { setQ('Carpentry'); load('Carpentry'); }} style={s.uberLinkItem}>
                <Text style={s.uberLinkText}>Carpentry & Locks</Text>
              </Pressable>
            </View>

            {/* Column 3: Partner With Us */}
            <View style={s.uberCol}>
              <Text style={s.uberColHeader}>PARTNER WITH US</Text>
              <Pressable onPress={() => router.push('/professional/dashboard')} style={s.uberLinkItem}>
                <Text style={s.uberLinkText}>Professional Console ➔</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/support?tab=terms')} style={s.uberLinkItem}>
                <Text style={s.uberLinkText}>Direct Escrow Settlements</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/support?tab=trust')} style={s.uberLinkItem}>
                <Text style={s.uberLinkText}>Partner Code of Conduct</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/support')} style={s.uberLinkItem}>
                <Text style={s.uberLinkText}>Partner Safety Shield</Text>
              </Pressable>
              <Pressable onPress={() => router.push('/support?tab=contact')} style={s.uberLinkItem}>
                <Text style={s.uberLinkText}>Partner Priority Desk</Text>
              </Pressable>
            </View>

            {/* Column 4: Registered Office & Grievance */}
            <View style={s.uberCol}>
              <Text style={s.uberColHeader}>REGISTERED OFFICE</Text>
              <Text style={s.uberLegalName}>OPUSTIA TECHNOLOGIES INDIA PVT LTD</Text>
              <Text style={s.uberAddress}>
                4th Floor, Salarpuria Citadel, 100ft Road, HAL 2nd Stage, Indiranagar, Bengaluru – 560038
              </Text>
              <Text style={s.uberGrievance}>
                Grievance Officer: Rajeshwar Rao · grievance-officer@opustia.com
              </Text>
              <View style={s.uberRegRow}>
                <Text style={s.uberRegBadge}>CIN: U72900KA2024PTC184920</Text>
                <Text style={s.uberRegBadge}>GSTIN: 29AAFCO1234M1Z5</Text>
              </View>
            </View>
          </View>

          {/* Uber-Style Location, Language & Trust Utility Row */}
          <View style={s.uberUtilityRow}>
            <View style={s.uberUtilityLeft}>
              <Pressable style={s.uberUtilityPill} onPress={() => setShowLocModal(true)}>
                <Text style={s.uberUtilityPillText}>📍 Bengaluru, KA</Text>
              </Pressable>
              <View style={s.uberUtilityPill}>
                <Text style={s.uberUtilityPillText}>🌐 English (IN)</Text>
              </View>
              <Pressable
                style={s.uberUtilityPill}
                onPress={() => router.push('/support?tab=contact')}
              >
                <Text style={s.uberUtilityPillText}>🎧 Toll-Free: 1800-889-OPUS</Text>
              </Pressable>
            </View>

            <View style={s.uberTrustRow}>
              <Text style={s.uberTrustBadge}>🔒 256-Bit SSL</Text>
              <Text style={s.uberTrustBadge}>👮 Police Verified</Text>
              <Text style={s.uberTrustBadge}>🛡️ 30-Day Warranty</Text>
              <Text style={s.uberTrustBadge}>⚡ RBI Escrow</Text>
            </View>
          </View>

          {/* Policy Pills Row */}
          <View style={s.uberPolicyRow}>
            <Pressable onPress={() => router.push('/support?tab=terms')} style={s.uberPolicyPill}>
              <Text style={s.uberPolicyText}>📜 Terms of Service</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/support?tab=privacy')} style={s.uberPolicyPill}>
              <Text style={s.uberPolicyText}>🛡️ Data Privacy (DPDP Act 2023)</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/support?tab=refund')} style={s.uberPolicyPill}>
              <Text style={s.uberPolicyText}>🔄 Cancellation & Refunds</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/support?tab=grievance')} style={s.uberPolicyPill}>
              <Text style={s.uberPolicyText}>🏛️ Grievance Escalation Matrix</Text>
            </Pressable>
            <Pressable onPress={() => router.push('/support?tab=contact')} style={s.uberPolicyPill}>
              <Text style={s.uberPolicyText}>🏢 Corporate Office</Text>
            </Pressable>
          </View>

          {/* Bottom Copyright Bar */}
          <View style={s.uberBottomBar}>
            <Text style={s.uberCopyright}>
              © 2026 Opustia Technologies India Pvt Ltd. Intermediary under Section 79 of IT Act 2000 & Consumer Protection (E-Commerce) Rules 2020. All rights reserved.
            </Text>
          </View>
        </View>
      </View>

      {/* 8. Location Selection Modal */}
      <Modal
        visible={showLocModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLocModal(false)}
      >
        <View style={s.modalOverlay}>
          <View style={s.modalContent}>
            <View style={s.modalHead}>
              <View>
                <Text style={s.modalTitle}>Choose Service Location</Text>
                <Text style={s.modalSub}>
                  Find verified professionals and calculate travel times.
                </Text>
              </View>
              <Pressable onPress={() => setShowLocModal(false)} style={s.modalClose}>
                <Text style={s.modalCloseText}>✕</Text>
              </Pressable>
            </View>

            {/* GPS Auto-detect Button */}
            <Pressable
              style={s.gpsButton}
              onPress={handleGpsDetect}
              disabled={detectingGps}
            >
              {detectingGps ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <>
                  <View style={s.gpsIconCircle}>
                    <Text style={s.gpsIcon}>🎯</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.gpsTitle}>Use Current GPS Location</Text>
                    <Text style={s.gpsSub}>Auto-detect using device GPS coordinates</Text>
                  </View>
                </>
              )}
            </Pressable>

            {/* Custom Locality Input */}
            <View style={s.customLocBox}>
              <TextInput
                value={customLocInput}
                onChangeText={setCustomLocInput}
                placeholder="Enter locality, street or landmark..."
                placeholderTextColor="#888888"
                style={s.customLocInput}
              />
              <Pressable style={s.customLocBtn} onPress={handleApplyCustomLoc}>
                <Text style={s.customLocBtnText}>Set</Text>
              </Pressable>
            </View>

            <Text style={s.popularLocTitle}>Popular Localities in Bengaluru</Text>
            <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
              {POPULAR_LOCATIONS.map((loc) => {
                const isCurrent = location.area === loc.area;
                return (
                  <Pressable
                    key={loc.area}
                    style={[s.locItem, isCurrent && s.locItemActive]}
                    onPress={() => handleSelectLocation(loc)}
                  >
                    <Text style={s.locItemPin}>{isCurrent ? '✓' : '📍'}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.locItemArea, isCurrent && s.locItemAreaActive]}>
                        {loc.area}
                      </Text>
                      <Text style={s.locItemDetail}>{loc.city} · {loc.address}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
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
  scrollContainer: {
    paddingBottom: 0,
  },

  // Announcement Bar
  announcementBar: {
    backgroundColor: '#000000',
    paddingVertical: 9,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  announcementText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Top Nav Header
  navWrapper: {
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    paddingHorizontal: 24,
    paddingVertical: 14,
  },
  navInner: {
    maxWidth: 1140,
    width: '100%',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    flexWrap: 'wrap',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  logoPressable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    cursor: 'pointer' as any,
  },
  logoBadge: {
    backgroundColor: '#000000',
    width: 30,
    height: 30,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadgeIcon: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '900',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.2,
    textTransform: 'uppercase',
  },
  locationPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    gap: 4,
  },
  locationPin: {
    fontSize: 13,
  },
  locationArea: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    maxWidth: 110,
  },
  locationCity: {
    fontSize: 12,
    color: '#666666',
  },
  locationChevron: {
    fontSize: 11,
    color: '#666666',
    marginLeft: 2,
  },

  // Nav Actions
  navActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  navProBtn: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  navProBtnText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#000000',
  },
  navPillBtn: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  navPillBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  navIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  navIconEmoji: {
    fontSize: 16,
  },
  navBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#000000',
    borderRadius: 9999,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  navBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  navSupportPill: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  navSupportText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  navUserPill: {
    backgroundColor: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  navUserPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },

  // Main Body
  mainBody: {
    maxWidth: 1140,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 24,
  },

  // Hero Card
  heroCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 36,
    paddingVertical: 40,
    alignItems: 'center',
    textAlign: 'center' as any,
    marginBottom: 40,
  },
  heroPillBadge: {
    backgroundColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
    marginBottom: 14,
  },
  heroPillText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  heroHeadline: {
    fontSize: 38,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.2,
    textAlign: 'center',
    marginBottom: 10,
  },
  heroSubtitle: {
    fontSize: 14,
    color: '#555555',
    textAlign: 'center',
    maxWidth: 620,
    lineHeight: 22,
    marginBottom: 24,
  },

  // Search Bar Box
  searchBarBox: {
    width: '100%',
    maxWidth: 640,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 9999,
    overflow: 'hidden',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: '#cbd5e1',
    gap: 10,
  },
  searchIcon: {
    fontSize: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    padding: 0,
    outlineStyle: 'none' as any,
  },
  searchClearBtn: {
    padding: 4,
  },
  searchClearText: {
    fontSize: 13,
    color: '#888888',
    fontWeight: '800',
  },
  searchActionBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  searchActionBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },

  // Popular Tags
  popularTagsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 18,
  },
  popularLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#666666',
  },
  tagPill: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tagPillText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },

  // Stats Counters
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 28,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#e4e4e4',
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '800',
    color: '#000000',
  },
  statLabel: {
    fontSize: 11,
    color: '#666666',
    fontWeight: '600',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: '#cccccc',
  },

  // Section Header
  sectionHeader: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#000000',
    letterSpacing: -0.2,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    fontSize: 13,
    color: '#666666',
    marginTop: 3,
  },

  // Categories Grid
  catsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 36,
  },
  catCard: {
    flex: 1,
    minWidth: 130,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 20,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 10,
    cursor: 'pointer' as any,
  },
  catCardActive: {
    backgroundColor: '#000000',
    borderColor: '#000000',
  },
  catIconBox: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catIconBoxActive: {
    backgroundColor: '#222222',
  },
  catEmoji: {
    fontSize: 22,
  },
  catName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
  },
  catNameActive: {
    color: '#ffffff',
  },

  // Trust Banner
  trustBanner: {
    backgroundColor: '#f8fafc',
    borderRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 28,
    marginBottom: 40,
  },
  trustHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  trustBadgePill: {
    backgroundColor: '#000000',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  trustBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  ratingBadgePill: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 9999,
  },
  pledgeRatingText: {
    color: '#000000',
    fontSize: 11,
    fontWeight: '800',
  },
  trustFeaturesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  trustFeatureItem: {
    flex: 1,
    minWidth: 230,
    backgroundColor: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  trustIconBox: {
    width: 40,
    height: 40,
    borderRadius: 9999,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  trustFeatureIcon: {
    fontSize: 20,
  },
  trustFeatureTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
  },
  trustFeatureSub: {
    fontSize: 11,
    color: '#666666',
    marginTop: 2,
  },

  // Nearby Pros
  prosHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    flexWrap: 'wrap',
    gap: 12,
  },
  activeLocChip: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 9999,
  },
  activeLocChipText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
  },
  prosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
    marginBottom: 40,
  },
  proCard: {
    flex: 1,
    minWidth: 320,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 24,
    overflow: 'hidden',
    padding: 20,
    justifyContent: 'space-between',
  },
  proCardContent: {
    flexDirection: 'row',
    gap: 14,
  },
  proAvatarBox: {
    width: 54,
    height: 54,
    borderRadius: 9999,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  proAvatarText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
  },
  verifiedCheckBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9999,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  verifiedCheckText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '900',
  },
  proInfo: {
    flex: 1,
  },
  proName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 6,
  },
  proBadgesRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  categoryPill: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  categoryPillText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
    textTransform: 'capitalize',
  },
  distanceBadge: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  distanceBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#555555',
  },
  ratingBadge: {
    backgroundColor: '#FFF8E7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
  },
  ratingBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#D97706',
  },
  serviceAreaText: {
    fontSize: 11,
    color: '#666666',
    marginBottom: 4,
  },
  proStartingText: {
    fontSize: 11,
    color: '#888888',
  },
  proActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  saveBtn: {
    width: 38,
    height: 38,
    borderRadius: 9999,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveBtnActive: {
    backgroundColor: '#fee2e2',
  },
  saveBtnIcon: {
    fontSize: 17,
    color: '#000000',
  },
  saveBtnIconActive: {
    color: '#ef4444',
  },
  bookBtn: {
    flex: 1,
    backgroundColor: '#000000',
    paddingVertical: 11,
    borderRadius: 9999,
    alignItems: 'center',
  },
  bookBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '800',
  },

  // Uber-Style Clean Minimalist Footer
  uberFooter: {
    backgroundColor: '#000000',
    borderRadius: 24,
    padding: 36,
    marginBottom: 40,
    borderWidth: 1,
    borderColor: '#1e293b',
  },
  uberFooterTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 20,
    marginBottom: 28,
  },
  uberFooterBrandBlock: {
    maxWidth: 540,
  },
  uberFooterLogoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  uberLogoSquare: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uberLogoSquareText: {
    color: '#000000',
    fontSize: 14,
    fontWeight: '900',
  },
  uberFooterLogo: {
    fontSize: 22,
    fontWeight: '900',
    color: '#ffffff',
    letterSpacing: -0.5,
  },
  uberFooterTagline: {
    fontSize: 13,
    color: '#94a3b8',
    lineHeight: 20,
  },
  uberHelpCenterBtn: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  uberHelpCenterBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },

  // Directory Nav Bar
  uberNavBar: {
    backgroundColor: '#0f172a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1e293b',
    padding: 18,
    marginBottom: 32,
  },
  uberNavHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  uberNavBadge: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
  },
  uberNavBadgeText: {
    color: '#000000',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  uberNavSub: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  uberNavPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  uberNavPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 9999,
  },
  uberNavPillActive: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff',
  },
  uberNavPillIcon: {
    fontSize: 13,
  },
  uberNavPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#e2e8f0',
  },
  uberNavPillTextActive: {
    color: '#000000',
  },

  // Columns Grid
  uberColumnsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 28,
    justifyContent: 'space-between',
    marginBottom: 32,
    paddingBottom: 28,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  uberCol: {
    flex: 1,
    minWidth: 180,
  },
  uberColHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  uberLinkItem: {
    marginBottom: 10,
  },
  uberLinkText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  uberLegalName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 4,
  },
  uberAddress: {
    fontSize: 12,
    color: '#94a3b8',
    lineHeight: 18,
    marginBottom: 8,
  },
  uberGrievance: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
    marginBottom: 10,
  },
  uberRegRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  uberRegBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94a3b8',
    backgroundColor: '#1e293b',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },

  // Utility Row
  uberUtilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 14,
    marginBottom: 20,
  },
  uberUtilityLeft: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  uberUtilityPill: {
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 9999,
  },
  uberUtilityPillText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  uberTrustRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  uberTrustBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#cbd5e1',
    backgroundColor: '#1e293b',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 9999,
  },

  // Policy Pills
  uberPolicyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  uberPolicyPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  uberPolicyText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },

  // Bottom Copyright
  uberBottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
  },
  uberCopyright: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 18,
    maxWidth: 820,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  
  // Rate Card Banner Button
  rateCardBannerBtn: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#e5e5e5',
    gap: 12,
  },
  rateCardBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  rateCardBannerIcon: { fontSize: 28 },
  rateCardBannerTitle: { fontSize: 15, fontWeight: '800', color: '#000000' },
  rateCardBannerSub: { fontSize: 12, color: '#666666', marginTop: 2 },
  rateCardBannerPill: {
    backgroundColor: '#000000',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  rateCardBannerPillText: { color: '#ffffff', fontWeight: '700', fontSize: 12 },

  // Sort Filter Bar
  sortBarContainer: { marginTop: 12, marginBottom: 14 },
  sortBarScroll: { flexDirection: 'row', gap: 8, paddingVertical: 4 },
  sortPill: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
  },
  sortPillActive: { backgroundColor: '#000000' },
  sortPillText: { fontSize: 12, fontWeight: '700', color: '#444444' },
  sortPillTextActive: { color: '#ffffff' },

  // Rate Modal
  rateModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    width: '100%',
    maxWidth: 620,
    maxHeight: '88%',
    padding: 22,
    overflow: 'hidden',
  },
  rateModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 14,
  },
  rateBadge: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 9999,
    alignSelf: 'flex-start',
    marginBottom: 6,
  },
  rateBadgeText: { fontSize: 10, fontWeight: '800', color: '#000000', letterSpacing: 0.5 },
  rateModalTitle: { fontSize: 20, fontWeight: '800', color: '#000000', letterSpacing: -0.2 },
  rateModalSubtitle: { fontSize: 12, color: '#666666', marginTop: 3 },
  rateModalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 9999,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rateModalCloseText: { fontSize: 14, fontWeight: '800', color: '#000000' },
  rateCategoryScroll: { marginBottom: 14, maxHeight: 44 },
  rateCatTab: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 9999,
    marginRight: 8,
    gap: 6,
  },
  rateCatTabActive: { backgroundColor: '#000000' },
  rateCatIcon: { fontSize: 14 },
  rateCatTabText: { fontSize: 12, fontWeight: '700', color: '#444444' },
  rateCatTabTextActive: { color: '#ffffff' },
  rateItemsScroll: { maxHeight: 450 },
  rateCatDesc: { fontSize: 13, color: '#666666', marginBottom: 12, fontStyle: 'italic' },
  rateItemCard: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
  },
  rateItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 },
  rateItemName: { fontSize: 15, fontWeight: '800', color: '#000000' },
  rateItemDuration: { fontSize: 12, color: '#666666', marginTop: 4 },
  ratePriceBox: { alignItems: 'flex-end' },
  ratePriceValue: { fontSize: 20, fontWeight: '800', color: '#000000' },
  ratePriceSub: { fontSize: 10, color: '#777777', fontWeight: '600' },
  rateItemInclusions: { fontSize: 12, color: '#555555', marginTop: 8, lineHeight: 17 },
  rateItemBookBtn: {
    backgroundColor: '#000000',
    paddingVertical: 10,
    borderRadius: 9999,
    alignItems: 'center',
    marginTop: 12,
  },
  rateItemBookBtnText: { color: '#ffffff', fontWeight: '700', fontSize: 13 },

  modalContent: {
    width: '100%',
    maxWidth: 480,
    backgroundColor: '#ffffff',
    borderRadius: 28,
    overflow: 'hidden',
    padding: 24,
  },
  modalHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#000000',
  },
  modalSub: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  modalClose: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 16,
    color: '#888888',
  },
  gpsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    padding: 14,
    borderRadius: 20,
    overflow: 'hidden',
    gap: 12,
    marginBottom: 14,
  },
  gpsIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gpsIcon: {
    fontSize: 16,
  },
  gpsTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
  },
  gpsSub: {
    fontSize: 11,
    color: '#666666',
  },
  customLocBox: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  customLocInput: {
    flex: 1,
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
    borderRadius: 9999,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13,
    color: '#000000',
    outlineStyle: 'none' as any,
  },
  customLocBtn: {
    backgroundColor: '#000000',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 9999,
    justifyContent: 'center',
  },
  customLocBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  popularLocTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#000000',
    marginBottom: 10,
  },
  locItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    gap: 10,
  },
  locItemActive: {
    backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0',
  },
  locItemPin: {
    fontSize: 14,
  },
  locItemArea: {
    fontSize: 13,
    fontWeight: '700',
    color: '#000000',
  },
  locItemAreaActive: {
    color: '#000000',
  },
  locItemDetail: {
    fontSize: 11,
    color: '#888888',
  },

  // State Boxes
  loadingBox: {
    padding: 40,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: '#666666',
  },
  errorBox: {
    padding: 16,
    backgroundColor: '#fee2e2',
    borderRadius: 18,
    overflow: 'hidden',
    marginBottom: 16,
  },
  errorText: {
    color: '#dc2626',
    fontSize: 13,
  },
  emptyBox: {
    padding: 48,
    alignItems: 'center',
    gap: 8,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#000000',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#666666',
  },
});
