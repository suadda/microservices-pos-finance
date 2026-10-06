import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Alert, ErrorAlert } from '../components/ui';
import { useAction } from '../lib/useApi';
import './Login.css';

const icon = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
};

const MailIcon = () => (
  <svg {...icon} className="lg-icon">
    <rect x="3" y="5" width="18" height="14" rx="2.5" />
    <path d="m4 7 8 6 8-6" />
  </svg>
);

const LockIcon = () => (
  <svg {...icon} className="lg-icon">
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.5" />
    <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
  </svg>
);

const EyeIcon = ({ off }) => (
  <svg {...icon}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
    {off && <path d="m4 4 16 16" />}
  </svg>
);

function Brand() {
  return (
    <div className="lg-brand">
      <span className="lg-logo" aria-hidden="true">
        A
      </span>
      <div>
        <strong>Anyartech</strong>
        <small>POS + Finance System</small>
      </div>
    </div>
  );
}

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [capsOn, setCapsOn] = useState(false);
  const { busy, error, run } = useAction();

  if (user) return <Navigate to="/" replace />;

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      await login(form.email, form.password);
      navigate(location.state?.from || '/', { replace: true });
    });
  };

  const checkCaps = (e) => setCapsOn(e.getModifierState?.('CapsLock') ?? false);

  return (
    <div className="lg-page">
      <main className="lg-main">
        <form className="lg-card" onSubmit={submit} noValidate={false}>
          <Brand />

          <header className="lg-head">
            <h1>Masuk ke akun Anda</h1>
            <p>Gunakan email dan password yang terdaftar.</p>
          </header>

          {location.state?.expired && (
            <Alert type="warning">Sesi Anda berakhir, silakan login kembali.</Alert>
          )}
          <ErrorAlert error={error} />

          <div className="lg-field">
            <label htmlFor="login-email">Email</label>
            <div className="lg-control">
              <MailIcon />
              <input
                id="login-email"
                type="email"
                name="email"
                placeholder="nama@perusahaan.com"
                autoComplete="username"
                required
                autoFocus
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>

          <div className="lg-field">
            <label htmlFor="login-password">Password</label>
            <div className="lg-control">
              <LockIcon />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder="Masukkan password"
                autoComplete="current-password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                onKeyUp={checkCaps}
                onKeyDown={checkCaps}
                onBlur={() => setCapsOn(false)}
              />
              <button
                type="button"
                className="lg-toggle"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                aria-pressed={showPassword}
              >
                <EyeIcon off={showPassword} />
              </button>
            </div>
            {capsOn && (
              <p className="lg-hint" role="status">
                Caps Lock sedang aktif.
              </p>
            )}
          </div>

          <button className="lg-submit" type="submit" disabled={busy} aria-busy={busy}>
            {busy ? (
              <>
                <span className="lg-spin" aria-hidden="true" />
                Memproses…
              </>
            ) : (
              'Masuk'
            )}
          </button>

          <p className="lg-foot">© {new Date().getFullYear()} Anyartech</p>
        </form>
      </main>
    </div>
  );
}