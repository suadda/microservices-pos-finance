import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { MENU, ROLE_LABELS, can } from '../auth/access';

const initials = (name) =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

export default function Layout() {
  const { user, logout } = useAuth();
  const items = MENU.filter((m) => can(user, m.permission));
  const sections = [...new Set(items.map((m) => m.section))];

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" /> POS + Finance
        </div>
        <nav aria-label="Navigasi utama">
          {sections.map((section) => (
            <div key={section} className="nav-section">
              <div className="nav-title">{section}</div>
              {items
                .filter((m) => m.section === section)
                .map((m) => (
                  <NavLink key={m.to} to={m.to} end={m.end} className="nav-link">
                    {m.label}
                  </NavLink>
                ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-user">
          <span className="user-avatar" aria-hidden="true">
            {initials(user.name)}
          </span>
          <div className="user-name">{user.name}</div>
          <div className="user-meta">
            {ROLE_LABELS[user.role]}
            {user.outlet_id ? ` - Outlet #${user.outlet_id}` : ''}
          </div>
          <button className="btn btn-sm user-logout" onClick={logout}>
            Keluar
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
