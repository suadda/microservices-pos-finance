// Small shared UI building blocks.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

const BADGE_COLORS = {
  trx: { pending: 'gray', paid: 'green', void: 'dark' },
  sync: { synced: 'green', pending: 'yellow', failed: 'red', none: 'gray' },
  recon: { pending: 'gray', matched: 'green', mismatch: 'red', resolved: 'blue' },
  shift: { open: 'green', closed: 'gray' },
  entry: { sale: 'green', reversal: 'red' },
  active: { true: 'green', false: 'gray' },
  trxShift: { paid: 'green', pending: 'yellow', void: 'red' },
};

// ---- Inline icons (no icon dependency) ----
const svgProps = {
  width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false,
};
export const SearchIcon = () => (
  <svg {...svgProps}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
);
export const EditIcon = () => (
  <svg {...svgProps}><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
);
export const TrashIcon = () => (
  <svg {...svgProps}><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /></svg>
);

/** Product image with a stable initials placeholder (never renders a broken image). */
export function ProductThumb({ name, src, size = 'md' }) {
  const [failed, setFailed] = useState(false);
  const initials = String(name || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  return (
    <span className={`thumb thumb-${size}`} aria-hidden="true">
      {src && !failed ? <img src={src} alt="" onError={() => setFailed(true)} /> : initials}
    </span>
  );
}

/** Accessible on/off switch. */
export function Switch({ checked, onChange, disabled, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      className={`switch ${checked ? 'on' : ''}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="switch-knob" />
    </button>
  );
}

/** Numbered pagination: first / prev / pages / next / last, total on the right. */
export function PageNav({ meta, onPage, unit = 'data' }) {
  if (!meta) return null;
  const { page, last_page: last, total } = meta;
  const from = Math.max(1, Math.min(page - 2, last - 4));
  const pages = Array.from({ length: Math.min(5, last) }, (_, i) => from + i);
  return (
    <div className="page-nav">
      {last > 1 ? (
        <nav className="page-nav-buttons" aria-label="Halaman">
          <button className="page-btn" disabled={page <= 1} onClick={() => onPage(1)} aria-label="Halaman pertama">«</button>
          <button className="page-btn" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Halaman sebelumnya">‹</button>
          {pages.map((p) => (
            <button key={p} className={`page-btn ${p === page ? 'active' : ''}`} aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)}>
              {p}
            </button>
          ))}
          <button className="page-btn" disabled={page >= last} onClick={() => onPage(page + 1)} aria-label="Halaman berikutnya">›</button>
          <button className="page-btn" disabled={page >= last} onClick={() => onPage(last)} aria-label="Halaman terakhir">»</button>
        </nav>
      ) : (
        <span />
      )}
      <span className="page-nav-total">Total {total} {unit}</span>
    </div>
  );
}

export function Badge({ kind, value, label }) {
  const color = BADGE_COLORS[kind]?.[String(value)] || 'gray';
  return <span className={`badge badge-${color}`}>{label ?? String(value ?? '-')}</span>;
}

/** Renders ApiError messages: business message for 409/422 (+ field errors), generic for 5xx/network. */
export function ErrorAlert({ error }) {
  if (!error) return null;
  const fields = Object.values(error.fields || {});
  return (
    <div className="alert alert-error" role="alert">
      <strong>{error.message || 'Terjadi kesalahan'}</strong>
      {fields.length > 0 && (
        <ul>
          {fields.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Alert({ type = 'info', children }) {
  return <div className={`alert alert-${type}`}>{children}</div>;
}

export function Pagination({ meta, onPage }) {
  if (!meta || meta.last_page <= 1) return meta ? <div className="pagination muted">{meta.total} data</div> : null;
  return (
    <div className="pagination">
      <button className="btn btn-sm" disabled={meta.page <= 1} onClick={() => onPage(meta.page - 1)}>
        ‹ Sebelumnya
      </button>
      <span>
        Halaman {meta.page} / {meta.last_page} · {meta.total} data
      </span>
      <button className="btn btn-sm" disabled={meta.page >= meta.last_page} onClick={() => onPage(meta.page + 1)}>
        Berikutnya ›
      </button>
    </div>
  );
}

export function Modal({ title, subtitle, onClose, children, footer, className = '' }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div className={`modal ${className}`} role="dialog" aria-modal="true" aria-label={typeof title === 'string' ? title : undefined} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-titles">
            <h3>{title}</h3>
            {subtitle && <p className="modal-subtitle">{subtitle}</p>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Tutup">
            ×
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

export function Field({ label, error, children, hint }) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
      {error && <span className="field-error">{error}</span>}
    </label>
  );
}

// ---- MoneyInput: shows "1.500.000,50" while typing, emits a plain decimal string ("1500000.50") ----

const groupThousands = (digits) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Raw user text -> { text: display string, value: canonical decimal string for the API }. */
function parseMoney(raw) {
  const cleaned = String(raw ?? '').replace(/[^\d,]/g, '');
  const comma = cleaned.indexOf(',');
  let int = comma < 0 ? cleaned : cleaned.slice(0, comma);
  const dec = comma < 0 ? null : cleaned.slice(comma + 1).replace(/,/g, '').slice(0, 2);
  int = int.replace(/^0+(?=\d)/, '');
  if (int === '' && dec !== null) int = '0';
  const text = groupThousands(int) + (dec !== null ? `,${dec}` : '');
  const value = int === '' ? '' : int + (dec ? `.${dec}` : '');
  return { text, value };
}

/** Canonical/API value ("15000.00") -> display text ("15.000"). */
function formatMoney(value) {
  if (value === null || value === undefined || value === '') return '';
  const [int, dec = ''] = String(value).split('.');
  const trimmed = dec.replace(/0+$/, '');
  return parseMoney(trimmed ? `${int},${trimmed}` : int).text;
}

/**
 * Currency input with thousand separators (id-ID: "." thousands, "," decimals).
 * `value` / `onChange` use plain decimal strings, so API payloads and math helpers are unchanged.
 */
export function MoneyInput({ value, onChange, ...rest }) {
  const [text, setText] = useState(() => formatMoney(value));
  const [, rerender] = useState(0);
  const inputRef = useRef(null);
  const pendingCaret = useRef(null);

  // Keep in sync when the parent changes the value externally (e.g. form reset, prefill).
  useEffect(() => {
    if (parseMoney(text).value !== parseMoney(formatMoney(value)).value) setText(formatMoney(value));
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore the caret after every reformat so editing in the middle doesn't jump to the end.
  // Runs on each render (not only when `text` changes) because rejected keystrokes leave `text` as is.
  useLayoutEffect(() => {
    if (pendingCaret.current === null || !inputRef.current) return;
    const el = inputRef.current;
    let seen = 0;
    let pos = 0;
    while (pos < text.length && seen < pendingCaret.current) {
      if (/[\d,]/.test(text[pos])) seen += 1;
      pos += 1;
    }
    el.setSelectionRange(pos, pos);
    pendingCaret.current = null;
  });

  const apply = (raw, caret) => {
    pendingCaret.current = raw.slice(0, caret).replace(/[^\d,]/g, '').length;
    const next = parseMoney(raw);
    setText(next.text);
    onChange(next.value);
    rerender((n) => n + 1);
  };

  const handleChange = (e) => apply(e.target.value, e.target.selectionStart ?? e.target.value.length);

  // "1500000.50" pasted from a spreadsheet/JS: a dot followed by 1-2 digits is a decimal point (grouping dots
  // always have 3 digits), so convert it instead of silently dropping it (which would turn it into 150000050).
  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').trim().replace(/^Rp\s*/i, '');
    if (!/^\d+\.\d{1,2}$/.test(pasted)) return;
    e.preventDefault();
    const el = e.target;
    const insert = pasted.replace('.', ',');
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    apply(el.value.slice(0, start) + insert + el.value.slice(end), start + insert.length);
  };

  return (
    <div className="money-input">
      <span className="money-prefix" aria-hidden="true">Rp</span>
      <input ref={inputRef} type="text" inputMode="decimal" autoComplete="off" placeholder="0" {...rest} value={text} onChange={handleChange} onPaste={handlePaste} />
    </div>
  );
}

/** Uniform Edit + Aktifkan/Nonaktifkan buttons for table rows (fixed columns so every row lines up). */
export function RowActions({ onEdit, active, onToggle, busy, canToggle = true }) {
  return (
    <div className="row-actions">
      <button className="btn btn-sm" onClick={onEdit}>Edit</button>
      {canToggle ? (
        <button className={`btn btn-sm ${active ? 'btn-danger-outline' : 'btn-success-outline'}`} disabled={busy} onClick={onToggle}>
          {active ? 'Nonaktifkan' : 'Aktifkan'}
        </button>
      ) : (
        <span aria-hidden="true" />
      )}
    </div>
  );
}

export function Loading({ text = 'Memuat…' }) {
  return <div className="loading">{text}</div>;
}

export function Empty({ children = 'Tidak ada data' }) {
  return <div className="empty">{children}</div>;
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, tone, hint }) {
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </div>
  );
}
