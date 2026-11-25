import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Armchair, ArrowRight, ShieldCheck, Ticket } from 'lucide-react';
import FlightSearchForm, { defaultDate } from '../components/FlightSearchForm';
import { flightService } from '../services/api';
import { inr } from '../utils/format';

const IMG = (id, w = 900) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=75`;
const HERO = IMG('photo-1436491865332-7a61a109cc05', 2000);
const CITY_IMG = {
  Mumbai: 'photo-1570168007204-dfb528c6958f', Goa: 'photo-1512343879784-a960bf40e7f2', Delhi: 'photo-1587474260584-136574528ed5',
  Dubai: 'photo-1512453979798-5ea266f8880c', Singapore: 'photo-1525625293386-3f8f99389edd', London: 'photo-1513635269975-59663e0ac1ad',
  Bengaluru: 'photo-1596176530529-78163a4f7af2', Chennai: 'photo-1582510003544-4d00b7f74220',
};

function Photo({ src, alt, className }) {
  const [ok, setOk] = useState(true);
  return ok && src ? <img src={src} alt={alt} loading="lazy" onError={() => setOk(false)} className={className} /> : null;
}

export default function Home() {
  const [routes, setRoutes] = useState(null);
  useEffect(() => { flightService.popular().then(setRoutes).catch(() => setRoutes([])); }, []);

  // One card per destination city, cheapest route first
  const destinations = useMemo(() => {
    const seen = new Map();
    for (const r of routes || []) {
      const cur = seen.get(r.dest_city);
      if (!cur || r.min_fare < cur.min_fare) seen.set(r.dest_city, r);
    }
    return [...seen.values()].sort((a, b) => b.flights - a.flights).slice(0, 6);
  }, [routes]);

  return (
    <>
      <section className="relative overflow-hidden bg-ink-900">
        <Photo src={HERO} alt="" className="absolute inset-0 h-full w-full object-cover opacity-45" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink-950/70 via-ink-900/40 to-ink-900/85" />
        <div className="container-x relative pb-44 pt-20 sm:pt-28">
          <p className="eyebrow text-gold-100/90">Flight Reservation System</p>
          <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold leading-[1.08] text-white sm:text-6xl">Book the seat you want, on the flight you need.</h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">Live availability on 11,000+ flights across India and beyond. Pick your seat, pay securely and get your e-ticket in minutes.</p>
        </div>
      </section>

      <section className="container-x relative z-10 -mt-32">
        <FlightSearchForm />
      </section>

      <section className="container-x mt-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Popular this month</p>
            <h2 className="mt-2 font-display text-3xl font-semibold">Where travellers are heading</h2>
          </div>
          <p className="max-w-sm text-sm text-ink-500">Lowest economy fares from the live schedule, before taxes.</p>
        </div>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {routes === null && Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-2xl bg-mist-200" />)}
          {routes && destinations.length === 0 && <p className="text-sm text-ink-500">No upcoming routes found. Is the backend connected?</p>}
          {destinations.map((d) => (
            <Link key={d.dest_city} to={`/flights?${new URLSearchParams({ from: d.src_code, to: d.dest_code, date: defaultDate(), pax: 1, cabin: 'Economy', trip: 'oneway' })}`}
              className="group relative flex h-64 flex-col justify-end overflow-hidden rounded-2xl bg-gradient-to-br from-ink-700 to-ink-950 p-5 text-white">
              <Photo src={CITY_IMG[d.dest_city] && IMG(CITY_IMG[d.dest_city])} alt={d.dest_city} className="absolute inset-0 h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink-950/85 via-ink-950/20 to-transparent" />
              <div className="relative flex items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/70">{d.src_city} → {d.dest_code}</p>
                  <h3 className="mt-1 font-display text-2xl font-semibold text-white">{d.dest_city}</h3>
                  <p className="text-sm text-white/75">{d.dest_country} · {d.flights} flights</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-white/70">from</p>
                  <p className="text-xl font-bold">{inr(d.min_fare)}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="container-x mt-24">
        <div className="grid overflow-hidden rounded-3xl bg-ink-900 text-white lg:grid-cols-[1fr_1.4fr]">
          <div className="p-8 sm:p-12">
            <p className="eyebrow text-gold-100/90">Why book with us</p>
            <h2 className="mt-3 font-display text-3xl font-semibold text-white">Every seat accounted for.</h2>
            <p className="mt-4 text-white/70">Seat availability is calculated from real bookings in the database, so two people can never hold the same seat.</p>
            <Link to="/my-bookings" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-gold-100 hover:text-white">Manage a booking <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="grid border-t border-white/10 sm:grid-cols-3 sm:border-l sm:border-t-0 lg:border-t-0">
            {[
              [Armchair, 'Choose your seat', 'Interactive seat maps for Economy and Business, updated with every booking.'],
              [ShieldCheck, 'Safe, simulated checkout', 'Seats are held while you pay. Bookings confirm only after payment succeeds.'],
              [Ticket, 'Instant e-ticket', 'Print or download your ticket with PNR, seat and payment status.'],
            ].map(([Icon, t, d]) => (
              <div key={t} className="border-white/10 p-8 sm:border-l sm:first:border-l-0">
                <Icon className="h-6 w-6 text-gold-500" />
                <h3 className="mt-5 font-semibold text-white">{t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/65">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
