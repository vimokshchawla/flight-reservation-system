import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { CircleAlert, CircleCheck, CircleX, Clock, Inbox, Info, LoaderCircle, RotateCcw, X, Ban, Hourglass, BadgeCheck } from 'lucide-react';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

const VARIANTS = {
  primary: 'bg-ink-900 text-white hover:bg-ink-800 disabled:bg-ink-400',
  brand: 'bg-brand-600 text-white hover:bg-brand-700 disabled:bg-brand-100 disabled:text-brand-500',
  gold: 'bg-gold-500 text-ink-950 hover:bg-gold-600 hover:text-white disabled:opacity-60',
  secondary: 'border border-mist-300 bg-white text-ink-900 hover:border-ink-400 hover:bg-mist-50 disabled:text-ink-400',
  ghost: 'text-ink-700 hover:bg-mist-100 disabled:text-ink-400',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:bg-red-300',
  'danger-ghost': 'text-red-600 hover:bg-red-50',
};
const SIZES = { sm: 'h-9 px-3 text-sm gap-1.5', md: 'h-11 px-5 text-sm gap-2', lg: 'h-13 px-7 text-base gap-2.5', icon: 'h-9 w-9 justify-center' };

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, type = 'button', ...rest }) {
  return (
    <button type={type} disabled={disabled || loading}
      className={cx('inline-flex shrink-0 items-center justify-center rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-100 disabled:cursor-not-allowed', VARIANTS[variant], SIZES[size], className)} {...rest}>
      {loading && <LoaderCircle className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function Field({ label, error, hint, children, className }) {
  return (
    <label className={cx('block', className)}>
      {label && <span className="label">{label}</span>}
      {children}
      {error ? <span className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600"><CircleAlert className="h-3.5 w-3.5" />{error}</span>
        : hint ? <span className="mt-1.5 block text-xs text-ink-500">{hint}</span> : null}
    </label>
  );
}
export const Input = ({ error, className, ...p }) => <input className={cx('control', error && 'control-error', className)} aria-invalid={!!error} {...p} />;
export const Select = ({ error, className, children, ...p }) => <select className={cx('control appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-9', error && 'control-error', className)} style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2352688a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")" }} {...p}>{children}</select>;

export const Spinner = ({ className = 'h-5 w-5' }) => <LoaderCircle className={cx('animate-spin text-brand-500', className)} />;
export function PageLoader({ label = 'Loading…' }) {
  return <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-ink-500"><Spinner className="h-7 w-7" />{label}</div>;
}

export function EmptyState({ icon: Icon = Inbox, title, text, action, className }) {
  return (
    <div className={cx('flex flex-col items-center px-6 py-14 text-center', className)}>
      <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-mist-100 text-ink-500"><Icon className="h-6 w-6" /></div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {text && <p className="mt-1.5 max-w-md text-sm text-ink-500">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const ALERT = {
  error: ['border-red-200 bg-red-50 text-red-800', CircleX],
  success: ['border-emerald-200 bg-emerald-50 text-emerald-800', CircleCheck],
  info: ['border-brand-100 bg-brand-50 text-brand-700', Info],
  warning: ['border-amber-200 bg-amber-50 text-amber-800', CircleAlert],
};
export function Alert({ tone = 'info', title, children, onRetry, className }) {
  const [cls, Icon] = ALERT[tone];
  return (
    <div role="alert" className={cx('flex gap-3 rounded-xl border px-4 py-3 text-sm', cls, className)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0 flex-1">{title && <p className="font-semibold">{title}</p>}{children && <div className={title ? 'mt-0.5' : ''}>{children}</div>}</div>
      {onRetry && <button onClick={onRetry} className="inline-flex items-center gap-1 self-start font-semibold underline-offset-2 hover:underline"><RotateCcw className="h-3.5 w-3.5" />Retry</button>}
    </div>
  );
}

const STATUS = {
  Confirmed: ['bg-emerald-50 text-emerald-700 ring-emerald-600/20', BadgeCheck],
  Paid: ['bg-emerald-50 text-emerald-700 ring-emerald-600/20', CircleCheck],
  Pending: ['bg-amber-50 text-amber-800 ring-amber-600/25', Hourglass],
  Cancelled: ['bg-mist-100 text-ink-700 ring-ink-500/20', Ban],
  Failed: ['bg-red-50 text-red-700 ring-red-600/20', CircleX],
  Refunded: ['bg-brand-50 text-brand-700 ring-brand-500/20', RotateCcw],
  Departed: ['bg-mist-100 text-ink-500 ring-ink-400/20', Clock],
  Upcoming: ['bg-brand-50 text-brand-700 ring-brand-500/20', Clock],
};
export function StatusBadge({ status, prefix }) {
  const [cls, Icon] = STATUS[status] || STATUS.Cancelled;
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset', cls)}><Icon className="h-3.5 w-3.5" />{prefix && <span className="font-medium opacity-75">{prefix}</span>}{status}</span>;
}

// Airline monogram used as the logo placeholder (fixed colour per airline id)
const MARKS = ['#9b1c2c', '#1f3f99', '#e26b2c', '#c0182d', '#8a6d2a', '#14386b', '#2e6b5a'];
export function AirlineMark({ name = '', id = 0, size = 'md' }) {
  const s = size === 'sm' ? 'h-8 w-8 text-[11px]' : 'h-11 w-11 text-sm';
  const letters = name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  return <span className={cx('grid shrink-0 place-items-center rounded-xl font-bold tracking-wide text-white', s)} style={{ background: MARKS[id % MARKS.length] }} aria-hidden>{letters}</span>;
}

export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return;
    const k = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink-950/45 p-0 sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div role="dialog" aria-modal="true" className={cx('flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl', width)}>
        <div className="flex items-center justify-between border-b border-mist-200 px-6 py-4">
          <h3 className="text-lg font-semibold">{title}</h3>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close"><X className="h-4 w-4" /></Button>
        </div>
        <div className="overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-mist-200 px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

const ToastCtx = createContext(() => {});
export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, tone = 'success') => {
    const id = Math.random();
    setItems((x) => [...x, { id, message, tone }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="no-print pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
        {items.map((t) => <Alert key={t.id} tone={t.tone} className="pointer-events-auto bg-white shadow-lg">{t.message}</Alert>)}
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);

export function Stepper({ step }) {
  const steps = ['Flights', 'Passengers', 'Payment', 'Ticket'];
  return (
    <ol className="flex items-center gap-2 text-xs font-semibold sm:gap-3 sm:text-sm">
      {steps.map((s, i) => (
        <li key={s} className="flex items-center gap-2 sm:gap-3">
          <span className={cx('flex items-center gap-2', i <= step ? 'text-ink-900' : 'text-ink-400')}>
            <span className={cx('grid h-6 w-6 place-items-center rounded-full text-[11px]', i < step ? 'bg-emerald-600 text-white' : i === step ? 'bg-ink-900 text-white' : 'bg-mist-200 text-ink-500')}>
              {i < step ? <CircleCheck className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className={cx(i !== step && 'hidden sm:inline')}>{s}</span>
          </span>
          {i < steps.length - 1 && <span className="h-px w-5 bg-mist-300 sm:w-10" />}
        </li>
      ))}
    </ol>
  );
}
