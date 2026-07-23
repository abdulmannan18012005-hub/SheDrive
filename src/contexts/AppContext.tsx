import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import {
  UserProfile,
  UserRole,
  RideRequest,
  DriverLocation,
  Coordinates,
  LocationPoint,
} from '../types';

// ─── State Shape ───────────────────────────────────────────
interface AppState {
  // Authentication
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;

  // Role
  role: UserRole;

  // Passenger state
  pickup: LocationPoint | null;
  dropoff: LocationPoint | null;
  currentLocation: Coordinates | null;
  fareBid: number;
  activeRide: RideRequest | null;

  // Driver state
  isOnline: boolean;
  nearbyDrivers: DriverLocation[];

  // Theme
  isDarkMode: boolean;
}

// ─── Initial State ─────────────────────────────────────────
const initialState: AppState = {
  user: null,
  isAuthenticated: false,
  isLoading: true,
  role: 'passenger',
  pickup: null,
  dropoff: null,
  currentLocation: null,
  fareBid: 0,
  activeRide: null,
  isOnline: false,
  nearbyDrivers: [],
  isDarkMode: false,
};

// ─── Actions ───────────────────────────────────────────────
type AppAction =
  | { type: 'SET_USER'; payload: UserProfile | null }
  | { type: 'SET_AUTHENTICATED'; payload: boolean }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ROLE'; payload: UserRole }
  | { type: 'SET_PICKUP'; payload: LocationPoint | null }
  | { type: 'SET_DROPOFF'; payload: LocationPoint | null }
  | { type: 'SET_CURRENT_LOCATION'; payload: Coordinates | null }
  | { type: 'SET_FARE_BID'; payload: number }
  | { type: 'SET_ACTIVE_RIDE'; payload: RideRequest | null }
  | { type: 'SET_ONLINE'; payload: boolean }
  | { type: 'SET_NEARBY_DRIVERS'; payload: DriverLocation[] }
  | { type: 'SET_DARK_MODE'; payload: boolean }
  | { type: 'RESET_RIDE' }
  | { type: 'LOGOUT' };

// ─── Reducer ───────────────────────────────────────────────
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER':
      return { ...state, user: action.payload };
    case 'SET_AUTHENTICATED':
      return { ...state, isAuthenticated: action.payload };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_ROLE':
      return { ...state, role: action.payload };
    case 'SET_PICKUP':
      return { ...state, pickup: action.payload };
    case 'SET_DROPOFF':
      return { ...state, dropoff: action.payload };
    case 'SET_CURRENT_LOCATION':
      return { ...state, currentLocation: action.payload };
    case 'SET_FARE_BID':
      return { ...state, fareBid: action.payload };
    case 'SET_ACTIVE_RIDE':
      return { ...state, activeRide: action.payload };
    case 'SET_ONLINE':
      return { ...state, isOnline: action.payload };
    case 'SET_NEARBY_DRIVERS':
      return { ...state, nearbyDrivers: action.payload };
    case 'SET_DARK_MODE':
      return { ...state, isDarkMode: action.payload };
    case 'RESET_RIDE':
      return {
        ...state,
        pickup: null,
        dropoff: null,
        fareBid: 0,
        activeRide: null,
      };
    case 'LOGOUT':
      return {
        ...initialState,
        isLoading: false,
        isDarkMode: state.isDarkMode,
      };
    default:
      return state;
  }
}

// ─── Context ───────────────────────────────────────────────
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ─── Provider ──────────────────────────────────────────────
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps): React.JSX.Element {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

// ─── Hook ──────────────────────────────────────────────────
export function useApp(): AppContextType {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}

export default AppContext;
