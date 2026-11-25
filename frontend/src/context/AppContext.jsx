import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { authService, SESSION_KEY } from '../services/api';

const read = (store, key, fallback) => { try { return JSON.parse(store.getItem(key)) ?? fallback; } catch { return fallback; } };
const write = (store, key, value) => { try { value == null ? store.removeItem(key) : store.setItem(key, JSON.stringify(value)); } catch { /* ignore */ } };

// ---------------- Auth (USER_ACCOUNT, role derived from ADMIN) ----------------
const AuthCtx = createContext(null);
export function AuthProvider({ children }) {
  const [session, setSession] = useState(() => read(localStorage, SESSION_KEY, null));
  const save = (s) => { write(localStorage, SESSION_KEY, s); setSession(s); return s; };
  const value = useMemo(() => ({
    user: session?.user || null,
    isAdmin: session?.user?.role === 'Admin',
    login: async (u, p) => save(await authService.login(u, p)),
    register: async (data) => save(await authService.register(data)),
    logout: () => save(null),
  }), [session]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}
export const useAuth = () => useContext(AuthCtx);

// ---------------- Trip (search -> selected flights -> pending bookings -> confirmed) ----------------
const TRIP_KEY = 'frs_trip';
const TripCtx = createContext(null);
export function TripProvider({ children }) {
  const [trip, setTripState] = useState(() => read(sessionStorage, TRIP_KEY, {}));
  const setTrip = useCallback((patch) => setTripState((t) => {
    const next = typeof patch === 'function' ? patch(t) : { ...t, ...patch };
    write(sessionStorage, TRIP_KEY, next);
    return next;
  }), []);
  const resetTrip = useCallback(() => { write(sessionStorage, TRIP_KEY, null); setTripState({}); }, []);
  const value = useMemo(() => ({ trip, setTrip, resetTrip }), [trip, setTrip, resetTrip]);
  return <TripCtx.Provider value={value}>{children}</TripCtx.Provider>;
}
export const useTrip = () => useContext(TripCtx);
