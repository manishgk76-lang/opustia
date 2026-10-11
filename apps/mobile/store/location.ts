import { Platform } from 'react-native';
import { UserLocation } from '../lib/api';

const LOCATION_KEY = 'opustia.selected-location';
const isWeb = Platform.OS === 'web';

export const POPULAR_LOCATIONS: UserLocation[] = [
  {
    address: '100ft Road, Indiranagar',
    area: 'Indiranagar',
    city: 'Bengaluru',
    lat: 12.9719,
    lng: 77.6412,
  },
  {
    address: '80ft Road, 4th Block, Koramangala',
    area: 'Koramangala',
    city: 'Bengaluru',
    lat: 12.9352,
    lng: 77.6245,
  },
  {
    address: 'Sector 2, HSR Layout',
    area: 'HSR Layout',
    city: 'Bengaluru',
    lat: 12.9121,
    lng: 77.6446,
  },
  {
    address: 'ITPL Main Road, Whitefield',
    area: 'Whitefield',
    city: 'Bengaluru',
    lat: 12.9698,
    lng: 77.7499,
  },
  {
    address: '4th Block, Jayanagar',
    area: 'Jayanagar',
    city: 'Bengaluru',
    lat: 12.9308,
    lng: 77.5838,
  },
  {
    address: 'Linking Road, Bandra West',
    area: 'Bandra West',
    city: 'Mumbai',
    lat: 19.0596,
    lng: 72.8295,
  },
  {
    address: 'Connaught Place, Central Delhi',
    area: 'Connaught Place',
    city: 'New Delhi',
    lat: 28.6315,
    lng: 77.2167,
  },
];

export const DEFAULT_LOCATION: UserLocation = POPULAR_LOCATIONS[0];

export async function getSelectedLocation(): Promise<UserLocation> {
  try {
    const raw = isWeb ? globalThis.localStorage?.getItem(LOCATION_KEY) : null;
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT_LOCATION;
}

export async function setSelectedLocation(loc: UserLocation): Promise<void> {
  try {
    if (isWeb) globalThis.localStorage?.setItem(LOCATION_KEY, JSON.stringify(loc));
  } catch {}
}

export async function detectCurrentLocation(): Promise<UserLocation> {
  return new Promise((resolve, reject) => {
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const { latitude, longitude } = pos.coords;
          resolve({
            address: `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`,
            area: 'Current Location',
            city: 'Bengaluru',
            lat: latitude,
            lng: longitude,
          });
        },
        (err) => {
          reject(err);
        },
        { timeout: 8000, enableHighAccuracy: true }
      );
    } else {
      resolve(DEFAULT_LOCATION);
    }
  });
}
