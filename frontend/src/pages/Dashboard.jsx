import { Link } from 'react-router-dom';
import { financeApi, posApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { can } from '../auth/access';
import { Badge, Empty, ErrorAlert, Loading, PageHeader, Stat } from '../components/ui';
import { METHOD_LABELS, rupiah, shortDate, todayJakarta } from '../lib/format';
import { useApi } from '../lib/useApi';
import { useOutlets } from '../lib/useOutlets';

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <>
      <PageHeader title={`Halo, ${user.name}`} subtitle={`Tanggal bisnis ${shortDate(todayJakarta())} (Asia/Jakarta)`} />
      {can(user, 'posDashboard') && <PosDashboard />}
      {can(user, 'finance') && <FinanceDashboard />}
    </>
  );
}

function SectionHead({ title, subtitle, children }) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p className="muted small">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

/** Horizontal share bar with a visible percentage (the number, not the bar, carries the meaning). */
function Share({ part, total }) {
  const pct = Number(total) > 0 ? Math.round((Number(part) / Number(total)) * 100) : 0;
  return (
    <div className="share">
      <div className="share-track" aria-hidden="true">
        <div className="share-fill" style={{ width: `${pct}%` }} />
      </div>
      <span className="share-pct">{pct}%</span>
    </div>
  );
}

function PosDashboard() {
  const { data, error, loading } = useApi(() => posApi('/dashboard').then((r) => r.data));
  const methods = data ? Object.entries(data.by_method) : [];

  return (
    <section className="card" aria-labelledby="pos-today">
      <SectionHead title={<span id="pos-today">Penjualan POS hari ini</span>} subtitle="Sesuai outlet yang dapat Anda akses">
        <Link className="btn btn-sm" to="/transaksi">
          Lihat transaksi
        </Link>
      </SectionHead>
      <ErrorAlert error={error} />
      {loading && !data ? (
        <Loading />
      ) : (
        data && (
          <>
            <div className="stats">
              <Stat label="Total penjualan (bersih)" value={rupiah(data.total_sales)} tone="primary" />
              <Stat label="Jumlah transaksi" value={data.trx_count} />
              <Stat label="Transaksi void" value={data.void_count} />
              <Stat
                label="Belum synced ke Finance"
                value={
                  data.unsynced_count > 0 ? <Link to="/transaksi?finance_sync_status=failed">{data.unsynced_count}</Link> : 0
                }
                tone={data.unsynced_count > 0 ? 'danger' : 'success'}
                hint={data.unsynced_count > 0 ? 'Perlu dicek, klik untuk detail' : 'Semua tersinkron'}
              />
            </div>
            {methods.length === 0 ? (
              <Empty>Belum ada transaksi hari ini</Empty>
            ) : (
              <div className="table-scroll">
                <table className="table compact">
                  <thead>
                    <tr>
                      <th>Metode bayar</th>
                      <th className="num">Transaksi</th>
                      <th className="num">Total</th>
                      <th>Porsi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {methods.map(([method, row]) => (
                      <tr key={method}>
                        <td>{METHOD_LABELS[method] ?? method}</td>
                        <td className="num">{row.count}</td>
                        <td className="num">{rupiah(row.total)}</td>
                        <td>
                          <Share part={row.total} total={data.total_sales} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )
      )}
    </section>
  );
}

function FinanceDashboard() {
  const { outlets } = useOutlets();
  const days = Array.from({ length: 7 }, (_, i) => todayJakarta(i - 6));
  const today = days[6];
  const recon = useApi(() =>
    financeApi('/reconciliations', { query: { date_from: days[0], date_to: days[6], per_page: 100 } }).then((r) => r.data),
  );
  const sales = useApi(() => financeApi('/reports/daily-sales', { query: { business_date: today } }).then((r) => r.data));

  const cell = (outletId, date) => recon.data?.find((r) => r.outlet_id === outletId && r.business_date === date);
  const mismatches = recon.data?.filter((r) => r.status === 'mismatch').length ?? 0;

  return (
    <>
      <section className="card" aria-labelledby="fin-today">
        <SectionHead title={<span id="fin-today">Ledger Finance hari ini</span>} subtitle="Semua outlet, dari jurnal yang sudah diposting" />
        <ErrorAlert error={sales.error} />
        {sales.loading && !sales.data ? (
          <Loading />
        ) : (
          sales.data && (
            <div className="stats">
              <Stat label="Total bersih" value={rupiah(sales.data.total)} tone="primary" />
              <Stat label="Jumlah transaksi" value={sales.data.trx_count} />
              {Object.entries(sales.data.totals).map(([m, v]) => (
                <Stat key={m} label={METHOD_LABELS[m] ?? m} value={rupiah(v)} hint={<Share part={v} total={sales.data.total} />} />
              ))}
            </div>
          )
        )}
      </section>

      <section className="card" aria-labelledby="fin-recon">
        <SectionHead title={<span id="fin-recon">Status rekonsiliasi 7 hari terakhir</span>} subtitle="Klik status untuk melihat detail">
          {mismatches > 0 ? (
            <Badge kind="recon" value="mismatch" label={`${mismatches} mismatch`} />
          ) : (
            recon.data && <Badge kind="recon" value="matched" label="Tidak ada mismatch" />
          )}
        </SectionHead>
        <ErrorAlert error={recon.error} />
        {recon.loading && !recon.data ? (
          <Loading />
        ) : (
          <div className="table-scroll">
            <table className="table compact recon-grid">
              <thead>
                <tr>
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
                      <strong>{o.code}</strong> <span className="muted small">{o.name}</span>
                    </th>
                    {days.map((d) => {
                      const r = cell(o.id, d);
                      return (
                        <td key={d}>
                          {r ? (
                            <Link to={`/rekonsiliasi/${r.id}`} aria-label={`${o.code} ${shortDate(d)}: ${r.status}`}>
                              <Badge kind="recon" value={r.status} />
                            </Link>
                          ) : (
                            <span className="muted small">belum</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
