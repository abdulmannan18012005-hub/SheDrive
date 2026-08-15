import { LocationPoint } from '../types';

export interface SavedPlace {
  id: 'home' | 'work' | string;
  type: 'home' | 'work' | 'favorite' | 'recent';
  label: string;
  address: string;
  latitude: number;
  longitude: number;
  icon: string;
}

export const DEFAULT_SAVED_PLACES: SavedPlace[] = [];

export const RECENT_SEARCHES_MOCK: SavedPlace[] = [];
