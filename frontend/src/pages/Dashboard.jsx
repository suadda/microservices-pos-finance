import { useState } from 'react';
import { Link } from 'react-router-dom';
import { financeApi, posApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { can } from '../auth/access';
import { Empty, ErrorAlert, Loading, PageHeader } from '../components/ui';
import { METHOD_LABELS, rupiah, shortDate, todayJakarta } from '../lib/format';
import { useApi } from '../lib/useApi';
import { useOutlets } from '../lib/useOutlets';

const METHODS = ['cash', 'debit', 'qris'];

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title={user.name} subtitle={`Tanggal bisnis ${shortDate(todayJakarta())} (Asia/Jakarta)`} />
      {can(user, 'posDashboard') && <PosDashboard />}
      {can(user, 'finance') && <FinanceDashboard />}
    </>
  );
}

// ---------- helpers ----------

/** Whole-number percentage of part/total, 0 when total is 0/invalid (never NaN). */
function pctOf(part, total) {
  const p = Number(part);
  const t = Number(total);
  if (!Number.isFinite(p) || !Number.isFinite(t) || t <= 0) return 0;
  return Math.round((p / t) * 100);
}
const clamp = (n) => Math.max(0, Math.min(100, n));

/** 7 consecutive business dates ending `endOffset` days from today. */
const windowDays = (endOffset = 0) => Array.from({ length: 7 }, (_, i) => todayJakarta(endOffset + i - 6));

const dayLabel = (date) =>
  new Date(`${date}T00:00:00+07:00`).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short', day: '2-digit', month: 'short' });

const compact = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
const compactRupiah = (v) => (Number(v) === 0 ? '0' : `Rp ${compact.format(Number(v))}`);

function SectionHead({ id, title, subtitle, children }) {
  return (
    <div className="section-head">
      <div>
        <h2 id={id}>{title}</h2>
        {subtitle && <p className="muted small">{subtitle}</p>}
      </div>
      {children && <div className="section-head-aside">{children}</div>}
    </div>
  );
}

function Progress({ value, tone = 'green', label }) {
  return (
    <div className={`progress progress-${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamp(value)} aria-label={label}>
      <div className="progress-fill" style={{ width: `${clamp(value)}%` }} />
    </div>
  );
}

/** "▲ 12%" vs the previous day; hidden when there is nothing to compare against. */
function Delta({ current, previous }) {
  const prev = Number(previous);
  if (!Number.isFinite(prev) || prev <= 0) return null;
  const pct = Math.round(((Number(current) - prev) / prev) * 100);
  const tone = pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat';
  return (
    <span className={`delta delta-${tone}`} title="Dibanding kemarin">
      {pct > 0 ? '▲' : pct < 0 ? '▼' : '•'} {Math.abs(pct)}%
    </span>
  );
}

function KpiCard({ label, value, badge, hint, progress, tone }) {
  return (
    <div className={`kpi ${tone ? `kpi-${tone}` : ''}`}>
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        {badge}
      </div>
      <span className="kpi-value">{value}</span>
      {progress && <Progress value={progress.value} label={progress.label} />}
      {hint && <span className="kpi-hint">{hint}</span>}
    </div>
  );
}

/** Payment-method mix: stacked bar + one card per method (nominal, % share, progress). */
function MethodBreakdown({ items, total, title = 'Jumlah transaksi', subtitle = 'Per metode pembayaran' }) {
  const shares = items.map((i) => ({ ...i, pct: clamp(pctOf(i.total, total)) }));
  const summary = shares.map((s) => `${s.label} ${s.pct}%`).join(', ');
  return (
    <div className="method-panel">
      <div className="method-panel-head">
        <h3>{title}</h3>
        <span className="muted small">{subtitle}</span>
      </div>
      <div className="stack-bar" role="img" aria-label={`Porsi metode bayar: ${summary}`}>
        {shares.map((s) => s.pct > 0 && <span key={s.key} className={`stack-seg m-${s.key}`} style={{ width: `${s.pct}%` }} />)}
      </div>
      <div className="method-cards">
        {shares.map((s) => (
          <div key={s.key} className={`method-card m-${s.key}`}>
            <div className="method-card-top">
              <span className="method-name">
                <span className="method-dot" aria-hidden="true" /> {s.label}
              </span>
              <span className="method-pct">{s.pct}%</span>
            </div>
            <div className="method-amount">{rupiah(s.total)}</div>
            {s.count !== undefined && <div className="muted small">{s.count} transaksi</div>}
            <Progress value={s.pct} tone={s.key} label={`Porsi ${s.label}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- POS (kasir / supervisor / superadmin) ----------

function PosDashboard() {
  const today = todayJakarta();
  const yesterday = todayJakarta(-1);
  const { data, error, loading } = useApi(() =>
    Promise.all([
      posApi('/dashboard', { query: { business_date: today } }).then((r) => r.data),
      posApi('/dashboard', { query: { business_date: yesterday } }).then((r) => r.data),
    ]),
  );
  const [d, prev] = data || [];
  const items = d ? METHODS.map((m) => ({ key: m, label: METHOD_LABELS[m], total: d.by_method[m]?.total ?? 0, count: d.by_method[m]?.count ?? 0 })) : [];

  return (
    <section className="card" aria-labelledby="pos-today">
      <SectionHead id="pos-today" title="Penjualan POS hari ini" subtitle="Sesuai outlet yang dapat Anda akses">
        <Link className="btn btn-sm" to="/transaksi">
          Lihat transaksi
        </Link>
      </SectionHead>
      <ErrorAlert error={error} />
      {loading && !data ? (
        <Loading />
      ) : (
        d && (
          <div className="ledger-split">
            <div className="kpi-col">
              <KpiCard label="Total penjualan (bersih)" value={rupiah(d.total_sales)} tone="primary" badge={<Delta current={d.total_sales} previous={prev?.total_sales} />} />
              <KpiCard label="Jumlah transaksi" value={d.trx_count} badge={<Delta current={d.trx_count} previous={prev?.trx_count} />} hint={`Void: ${d.void_count}`} />
              <KpiCard
                label="Belum synced ke Finance"
                tone={d.unsynced_count > 0 ? 'danger' : 'success'}
                value={d.unsynced_count > 0 ? <Link to="/transaksi?finance_sync_status=failed">{d.unsynced_count}</Link> : 0}
                hint={d.unsynced_count > 0 ? 'Perlu dicek, klik untuk detail' : 'Semua tersinkron'}
              />
            </div>
            {d.trx_count === 0 && Number(d.total_sales) === 0 ? (
              <div className="method-panel">
                <Empty>Belum ada transaksi hari ini</Empty>
              </div>
            ) : (
              <MethodBreakdown items={items} total={d.total_sales} />
            )}
          </div>
        )
      )}
    </section>
  );
}

// ---------- Finance (staff / manager / superadmin) ----------

function FinanceDashboard() {
  const days = windowDays(0);
  const sales = useApi(() => Promise.all(days.map((d) => financeApi('/reports/daily-sales', { query: { business_date: d } }).then((r) => r.data))));
  const t = sales.data?.[6];
  const y = sales.data?.[5];
  const maxTotal = sales.data ? Math.max(0, ...sales.data.map((r) => Number(r.total))) : 0;
  const totalPct = clamp(pctOf(t?.total, maxTotal));
  const items = t ? METHODS.map((m) => ({ key: m, label: METHOD_LABELS[m], total: t.totals[m] ?? 0 })) : [];

  return (
    <>
      <section className="card" aria-labelledby="fin-today">
        <SectionHead id="fin-today" title="Ledger Finance hari ini" subtitle="Semua outlet, dari jurnal yang sudah diposting" />
        <ErrorAlert error={sales.error} />
        {sales.loading && !sales.data ? (
          <Loading />
        ) : (
          t && (
            <div className="ledger-split">
              <div className="kpi-col">
                <KpiCard
                  label="Total bersih"
                  value={rupiah(t.total)}
                  tone="primary"
                  badge={<Delta current={t.total} previous={y?.total} />}
                  progress={{ value: totalPct, label: 'Dibanding penjualan tertinggi 7 hari' }}
                  hint={`${totalPct}% dari penjualan tertinggi 7 hari terakhir`}
                />
                <KpiCard label="Jumlah transaksi" value={t.trx_count} badge={<Delta current={t.trx_count} previous={y?.trx_count} />} hint={`Kemarin: ${y?.trx_count ?? 0} transaksi`} />
              </div>
              <MethodBreakdown items={items} total={t.total} />
            </div>
          )
        )}
      </section>

      <section className="card" aria-labelledby="fin-trend">
        <SectionHead id="fin-trend" title="Tren Penjualan 7 Hari Terakhir" subtitle="Penjualan bersih per metode bayar dari ledger Finance" />
        {sales.loading && !sales.data ? <Loading /> : sales.data && <SalesTrendChart days={days} rows={sales.data} />}
      </section>

      <ReconciliationGrid />
    </>
  );
}

const SERIES = [
  { key: 'net', label: 'Total Sales (Net)', get: (r) => r.total },
  { key: 'cash', label: 'Cash', get: (r) => r.totals.cash },
  { key: 'debit', label: 'Debit', get: (r) => r.totals.debit },
  { key: 'qris', label: 'QRIS', get: (r) => r.totals.qris },
];

/** "Nice" axis maximum (1/2/2.5/5 x 10^n) so tick labels are round numbers. */
function niceMax(value) {
  if (value <= 0) return 1;
  const exp = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 2.5, 5, 10].find((s) => s * exp >= value);
  return step * exp;
}

/** Dependency-free grouped bar chart (the project has no chart library). */
function SalesTrendChart({ days, rows }) {
  const [active, setActive] = useState(null);
  const values = rows.map((r) => SERIES.map((s) => Math.max(0, Number(s.get(r)) || 0)));
  const max = Math.max(0, ...values.flat());
  if (max === 0) return <Empty>Belum ada penjualan dalam 7 hari terakhir</Empty>;

  const top = niceMax(max);
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => top * f);
  const today = todayJakarta();

  return (
    <div className="chart">
      <div className="chart-scroll">
        <div className="chart-body">
          <div className="chart-y" aria-hidden="true">
            {ticks.map((v) => (
              <span key={v} style={{ bottom: `${(v / top) * 100}%` }}>
                {compactRupiah(v)}
              </span>
            ))}
          </div>
          <div className="chart-main">
            <div className="chart-plot">
              {ticks.map((v) => (
                <span key={v} className="chart-grid" style={{ bottom: `${(v / top) * 100}%` }} aria-hidden="true" />
              ))}
              {days.map((d, i) => (
                <div
                  key={d}
                  className={`chart-group ${active === i ? 'active' : ''}`}
                  tabIndex={0}
                  aria-label={`${dayLabel(d)}: ${SERIES.map((s, k) => `${s.label} ${rupiah(values[i][k])}`).join(', ')}`}
                  onMouseEnter={() => setActive(i)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(i)}
                  onBlur={() => setActive(null)}
                >
                  <div className="chart-bars">
                    {SERIES.map((s, k) => (
                      <span key={s.key} className={`chart-bar s-${s.key}`} style={{ height: `${(values[i][k] / top) * 100}%` }} />
                    ))}
                  </div>
                  {active === i && (
                    <div className={`chart-tooltip ${i >= 5 ? 'left' : ''}`} role="tooltip">
                      <strong>{dayLabel(d)}</strong>
                      {SERIES.map((s, k) => (
                        <div key={s.key} className="chart-tooltip-row">
                          <span className={`legend-dot s-${s.key}`} />
                          <span>{s.label}</span>
                          <span className="num">{rupiah(values[i][k])}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="chart-x" aria-hidden="true">
              {days.map((d) => (
                <span key={d} className={d === today ? 'today' : undefined}>
                  {d === today ? 'Hari ini' : dayLabel(d)}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
      <ul className="chart-legend">
        {SERIES.map((s) => (
          <li key={s.key}>
            <span className={`legend-dot s-${s.key}`} aria-hidden="true" /> {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

const RECON_LABELS = { matched: 'Terisi', pending: 'Pending', mismatch: 'Mismatch', resolved: 'Resolved' };

function ReconChip({ status }) {
  return <span className={`recon-chip recon-${status}`}>{RECON_LABELS[status] ?? status}</span>;
}

function ReconciliationGrid() {
  const { outlets } = useOutlets();
  const [endOffset, setEndOffset] = useState(0); // 0 = window ends today, -7 = previous week, ...
  const days = windowDays(endOffset);
  const today = todayJakarta();
  const recon = useApi(
    () => financeApi('/reconciliations', { query: { date_from: days[0], date_to: days[6], per_page: 100 } }).then((r) => r.data),
    [endOffset],
  );

  const cell = (outletId, date) => recon.data?.find((r) => r.outlet_id === outletId && r.business_date === date);
  const mismatches = recon.data?.filter((r) => r.status === 'mismatch').length ?? 0;

  return (
    <section className="card" aria-labelledby="fin-recon">
      <SectionHead id="fin-recon" title="Status rekonsiliasi 7 hari terakhir" subtitle="Klik status outlet melihat detail">
        <div className="period-nav">
          <button className="btn btn-sm" onClick={() => setEndOffset((o) => o - 7)} aria-label="Periode sebelumnya">
            ‹
          </button>
          <span className="period-date">{shortDate(days[0])}</span>
          <span className="muted small">to</span>
          <span className="period-date">{shortDate(days[6])}</span>
          <button className="btn btn-sm" disabled={endOffset >= 0} onClick={() => setEndOffset((o) => Math.min(0, o + 7))} aria-label="Periode berikutnya">
            ›
          </button>
          {recon.data &&
            (mismatches > 0 ? (
              <span className="recon-chip recon-mismatch">{mismatches} mismatch</span>
            ) : (
              <span className="recon-chip recon-matched">Tidak ada mismatch</span>
            ))}
        </div>
      </SectionHead>
      <ErrorAlert error={recon.error} />
      {recon.loading && !recon.data ? (
        <Loading />
      ) : outlets.length === 0 ? (
        <Empty>Belum ada outlet</Empty>
      ) : (
        <div className="table-scroll">
          <table className="table compact recon-grid">
            <thead>
              <tr>
                <th scope="col">Kode</th>
                <th scope="col">Outlet</th>
                {days.map((d) => (
                  <th key={d} scope="col" className={d === today ? 'today' : undefined}>
                    {d === today ? 'Hari ini' : shortDate(d)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {outlets.map((o) => (
                <tr key={o.id}>
                  <th scope="row" className="row-head">
                    <strong>{o.code}</strong>
                  </th>
                  <td className="outlet-name">{o.name}</td>
                  {days.map((d) => {
                    const r = cell(o.id, d);
                    return (
                      <td key={d}>
                        {r ? (
                          <Link to={`/rekonsiliasi/${r.id}`} aria-label={`${o.code} ${shortDate(d)}: ${RECON_LABELS[r.status] ?? r.status}`}>
                            <ReconChip status={r.status} />
                          </Link>
                        ) : (
                          <span className="recon-chip recon-none">Belum</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="grand">
                <th scope="row" className="row-head" colSpan={2}>
                  Total terisi
                </th>
                {days.map((d) => {
                  const rows = recon.data?.filter((r) => r.business_date === d) ?? [];
                  const bad = rows.filter((r) => r.status === 'mismatch').length;
                  return (
                    <td key={d}>
                      <div>
                        {rows.length}/{outlets.length}
                      </div>
                      {bad > 0 && <div className="small text-danger">{bad} mismatch</div>}
                    </td>
                  );
                })}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
