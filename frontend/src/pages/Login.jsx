import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Alert, ErrorAlert, Field } from '../components/ui';
import { useAction } from '../lib/useApi';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useAction();

  if (user) return <Navigate to="/" replace />;

  const submit = (e) => {
    e.preventDefault();
    run(async () => {
      await login(email, password);
      navigate(location.state?.from || '/', { replace: true });
    });
  };

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="brand login-brand">
          <span className="brand-mark" aria-hidden="true" /> POS + Finance
        </div>
        <p className="muted">Masuk untuk melanjutkan</p>
        {location.state?.expired && <Alert type="warning">Sesi Anda berakhir, silakan login kembali.</Alert>}
        <ErrorAlert error={error} />
        <Field label="Email">
          <input
            type="email"
            name="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </Field>
        <Field label="Password">
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </Field>
        <button className="btn btn-primary btn-block" disabled={busy}>
          {busy ? 'Memproses…' : 'Masuk'}
        </button>
      </form>
    </div>
  );
}
