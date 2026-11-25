import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider, TripProvider } from './context/AppContext';
import { Button, EmptyState, ToastProvider } from './components/ui';
import SiteLayout from './layouts/SiteLayout';
import AdminLayout from './layouts/AdminLayout';
import Home from './pages/Home';
import SearchResults from './pages/SearchResults';
import Booking from './pages/Booking';
import Payment from './pages/Payment';
import Confirmation from './pages/Confirmation';
import MyBookings from './pages/MyBookings';
import Login from './pages/Login';
import Dashboard from './pages/admin/Dashboard';
import { AirportsAdmin, BookingsAdmin, FleetAdmin, FlightsAdmin, PassengersAdmin, PaymentsAdmin } from './pages/admin/AdminPages';

const NotFound = () => <div className="container-x py-20"><EmptyState title="Page not found" text="The page you are looking for does not exist." action={<Link to="/"><Button>Back to home</Button></Link>} /></div>;

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <TripProvider>
          <ToastProvider>
            <Routes>
              <Route element={<SiteLayout />}>
                <Route index element={<Home />} />
                <Route path="flights" element={<SearchResults />} />
                <Route path="booking" element={<Booking />} />
                <Route path="payment" element={<Payment />} />
                <Route path="confirmation" element={<Confirmation />} />
                <Route path="my-bookings" element={<MyBookings />} />
                <Route path="login" element={<Login />} />
                <Route path="*" element={<NotFound />} />
              </Route>
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="flights" element={<FlightsAdmin />} />
                <Route path="airports" element={<AirportsAdmin />} />
                <Route path="fleet" element={<FleetAdmin />} />
                <Route path="passengers" element={<PassengersAdmin />} />
                <Route path="bookings" element={<BookingsAdmin />} />
                <Route path="payments" element={<PaymentsAdmin />} />
              </Route>
            </Routes>
          </ToastProvider>
        </TripProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
