import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { posApi } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  Alert, Badge, Empty, ErrorAlert, Field, Loading, Modal, MoneyInput, PageHeader, ProductThumb, SearchIcon, Stat, TrashIcon,
} from '../components/ui';
import { METHOD_LABELS, isNonZero, rupiah, shortDate, timeOnly } from '../lib/format';
import { TAX_RATE, addMoney, previewTotals, subtractMoney } from '../lib/money';
import { useAction, useApi } from '../lib/useApi';
import { OutletSelect, useOutlets } from '../lib/useOutlets';

/** Layar Kasir: open shift -> sell -> pay -> close shift. */
export default function Cashier() {
  const current = useApi(() => posApi('/shifts/current').then((r) => r.data));
  const [closedResult, setClosedResult] = useState(null);

  if (current.loading && !current.data) return <Loading />;

  return (
    <>
      <PageHeader title="Layar Kasir" />
      <ErrorAlert error={current.error} />
      {closedResult && <ClosedShiftNotice result={closedResult} onDismiss={() => setClosedResult(null)} />}
      {current.data ? (
        <SalesScreen summary={current.data} reloadSummary={current.reload} onClosed={(r) => { setClosedResult(r); current.reload(); }} />
      ) : (
        !current.error && (
          <div className="center-stage">
            <OpenShiftForm onOpened={current.reload} />
          </div>
        )
      )}
    </>
  );
}

function OpenShiftForm({ onOpened }) {
  const { user } = useAuth();
  const { outlets } = useOutlets();
  const [openingCash, setOpeningCash] = useState('');
  const [outletId, setOutletId] = useState('');
  const { busy, error, run } = useAction();

  const submit = (e) => {
    e.preventDefault();
    if (busy) return;
    run(async () => {
      await posApi('/shifts/open', {
        method: 'POST',
        body: { opening_cash: openingCash, outlet_id: user.outlet_id ? undefined : Number(outletId) || undefined },
      });
      onOpened();
    });
  };

  return (
    <form className="card narrow open-shift" onSubmit={submit}>
      <h2>Buka Shift</h2>
      <p className="muted lead">Belum ada shift terbuka. Masukkan modal kas awal untuk mulai berjualan.</p>
      <ErrorAlert error={error} />
      {!user.outlet_id && (
        <Field label="Outlet" hint="Akun Anda tidak terikat outlet, pilih outlet shift ini.">
          <OutletSelect value={outletId} onChange={setOutletId} outlets={outlets} allowAll={false} required />
        </Field>
      )}
      <Field label="Modal kas awal (opening cash)" error={error?.fields?.opening_cash}>
        <MoneyInput value={openingCash} onChange={setOpeningCash} required autoFocus />
      </Field>
      <button className="btn btn-primary btn-block" disabled={busy}>
        {busy ? 'Membuka…' : 'Buka Shift'}
      </button>
    </form>
  );
}

function SalesScreen({ summary, reloadSummary, onClosed }) {
  const shift = summary.shift;
  const [cart, setCart] = useState([]);
  const [discount, setDiscount] = useState('');
  const [paying, setPaying] = useState(null); // server transaction being paid
  const [lastPaid, setLastPaid] = useState(null);
  const [closing, setClosing] = useState(false);
  const trxList = useApi(() => posApi('/transactions', { query: { shift_id: shift.id, per_page: 100 } }).then((r) => r.data), [shift.id]);
  const checkout = useAction();
  const submitting = useRef(false); // guards double clicks before React re-renders the disabled button

  const refresh = () => {
    reloadSummary();
    trxList.reload();
  };

  const addToCart = (product) =>
    setCart((items) => {
      const found = items.find((i) => i.id === product.id);
      return found
        ? items.map((i) => (i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i))
        : [...items, { id: product.id, name: product.name, sku: product.sku, price: product.price, quantity: 1 }];
    });
  const setQty = (id, quantity) =>
    setCart((items) => (quantity < 1 ? items.filter((i) => i.id !== id) : items.map((i) => (i.id === id ? { ...i, quantity } : i))));

  const preview = previewTotals(cart, discount);
  const totalQty = cart.reduce((n, i) => n + i.quantity, 0);

  // Same flow as before: create the (pending) transaction, then pick the payment method in the modal.
  const createTransaction = async () => {
    if (submitting.current || cart.length === 0) return;
    submitting.current = true;
    await checkout.run(async () => {
      const res = await posApi('/transactions', {
        method: 'POST',
        body: { items: cart.map((i) => ({ product_id: i.id, quantity: i.quantity })), discount_amount: discount || 0 },
      });
      rememberItemCount(res.data);
      setCart([]);
      setDiscount('');
      setPaying(res.data);
      trxList.reload();
    });
    submitting.current = false;
  };

  return (
    <>
      <section className="card shift-info" aria-label="Informasi shift">
        <dl className="shift-meta">
          <div>
            <dt>Shift</dt>
            <dd>#{shift.id}</dd>
          </div>
          <div>
            <dt>Outlet</dt>
            <dd>{shift.outlet?.code ?? '-'}</dd>
          </div>
          <div>
            <dt>Tanggal bisnis</dt>
            <dd>{shortDate(shift.business_date)}</dd>
          </div>
          <div>
            <dt>Dibuka</dt>
            <dd>{timeOnly(shift.opened_at)} WIB</dd>
          </div>
          <div>
            <dt>Modal awal</dt>
            <dd>{rupiah(shift.opening_cash)}</dd>
          </div>
          <div>
            <dt>Transaksi</dt>
            <dd>{summary.trx_count}</dd>
          </div>
          <div>
            <dt>Kas seharusnya</dt>
            <dd>{rupiah(summary.expected_cash)}</dd>
          </div>
        </dl>
        <div className="shift-info-actions">
          {summary.unsynced_total > 0 && <Badge kind="sync" value="failed" label={`${summary.unsynced_total} belum synced`} />}
          <button className="btn btn-danger" onClick={() => setClosing(true)} disabled={closing}>
            Tutup Shift
          </button>
        </div>
      </section>

      {lastPaid && <PaidNotice trx={lastPaid} onDismiss={() => setLastPaid(null)} />}

      <div className="cashier-grid">
        <ProductPicker onPick={addToCart} />

        <section className="card cart" aria-labelledby="cart-title">
          <div className="card-title-row">
            <h2 id="cart-title">Keranjang</h2>
            {totalQty > 0 && <span className="muted small">{totalQty} item</span>}
          </div>
          {cart.length === 0 ? (
            <Empty>Pilih produk di sebelah kiri</Empty>
          ) : (
            <ul className="cart-list">
              {cart.map((item) => (
                <li key={item.id} className="cart-item">
                  <ProductThumb name={item.name} />
                  <div className="cart-item-main">
                    <div className="cart-item-head">
                      <div>
                        <div className="cart-item-name">{item.name}</div>
                        <div className="muted small">{item.sku}</div>
                      </div>
                      <button className="icon-btn icon-danger" title="Hapus" aria-label={`Hapus ${item.name}`} onClick={() => setQty(item.id, 0)}>
                        <TrashIcon />
                      </button>
                    </div>
                    <div className="cart-item-foot">
                      <div className="qty">
                        <button className="btn btn-sm" aria-label="Kurangi jumlah" onClick={() => setQty(item.id, item.quantity - 1)}>−</button>
                        <input
                          type="number"
                          min="1"
                          aria-label={`Jumlah ${item.name}`}
                          value={item.quantity}
                          onChange={(e) => setQty(item.id, Math.max(1, parseInt(e.target.value, 10) || 1))}
                        />
                        <button className="btn btn-sm" aria-label="Tambah jumlah" onClick={() => setQty(item.id, item.quantity + 1)}>+</button>
                      </div>
                      <dl className="cart-item-amounts">
                        <div>
                          <dt>Unit Price</dt>
                          <dd>{rupiah(item.price)}</dd>
                        </div>
                        <div>
                          <dt>Subtotal</dt>
                          <dd>{rupiah(Number(item.price) * item.quantity)}</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Field label="Diskon (nominal)">
            <MoneyInput value={discount} onChange={setDiscount} />
          </Field>
          <dl className="totals">
            <dt>Subtotal</dt>
            <dd>{rupiah(preview.subtotal)}</dd>
            <dt>Diskon</dt>
            <dd>− {rupiah(preview.discount)}</dd>
            <dt className="totals-group">Pajak (Tax)</dt>
            <dd />
            <dt className="totals-sub">PPN {Math.round(TAX_RATE * 100)}%</dt>
            <dd>{rupiah(preview.tax)}</dd>
            <dt>Biaya Layanan (Service Fee)</dt>
            <dd>{rupiah(0)}</dd>
            <dt className="grand">Total</dt>
            <dd className="grand">{rupiah(preview.total)}</dd>
          </dl>
          <p className="muted small">Angka final dihitung oleh server saat transaksi dibuat.</p>
          <ErrorAlert error={checkout.error} />
          <button className="btn btn-primary btn-block btn-lg" disabled={cart.length === 0 || checkout.busy} aria-busy={checkout.busy} onClick={createTransaction}>
            {checkout.busy ? 'Memproses…' : `Proses Pembayaran (${rupiah(preview.total)})`}
          </button>
        </section>
      </div>

      <section className="card" aria-labelledby="shift-trx">
        <h2 id="shift-trx">Transaksi shift ini</h2>
        <ShiftSummary summary={summary} rows={trxList.data || []} />
      </section>

      <section className="card" aria-labelledby="shift-history">
        <h2 id="shift-history">Riwayat Transaksi Shift Ini</h2>
        <ErrorAlert error={trxList.error} />
        {trxList.loading && !trxList.data ? <Loading /> : <ShiftTransactions rows={trxList.data || []} onPay={setPaying} />}
      </section>

      {paying && (
        <PaymentModal
          trx={paying}
          onClose={() => {
            setPaying(null);
            refresh();
          }}
          onPaid={(trx) => {
            setPaying(null);
            setLastPaid(trx);
            refresh();
          }}
        />
      )}
      {closing && (
        <CloseShiftModal
          shift={shift}
          summary={summary}
          onClose={() => setClosing(false)}
          onClosed={(result) => {
            setClosing(false);
            onClosed(result);
          }}
        />
      )}
    </>
  );
}

function ProductPicker({ onPick }) {
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setQuery(search), 250);
    return () => clearTimeout(t);
  }, [search]);
  const products = useApi(() => posApi('/products', { query: { search: query, is_active: 1, per_page: 60 } }).then((r) => r.data), [query]);
  const rows = (products.data || []).filter((p) => p.is_active);

  // Barcode scanners type the code and press Enter: add the exact SKU match (or the single result) directly.
  const onKeyDown = async (e) => {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const term = search.trim();
    if (!term) return;
    try {
      const res = await posApi('/products', { query: { search: term, is_active: 1, per_page: 10 } });
      const active = res.data.filter((p) => p.is_active);
      const pick = active.find((p) => p.sku.toLowerCase() === term.toLowerCase()) || (active.length === 1 ? active[0] : null);
      if (pick) {
        onPick(pick);
        setSearch('');
      }
    } catch {
      // the debounced list shows the error state
    }
  };

  return (
    <section className="card products" aria-label="Daftar produk">
      <div className="search-box search-lg">
        <SearchIcon />
        <input
          type="search"
          placeholder="Cari produk / Scan Barcode..."
          aria-label="Cari produk atau scan barcode"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={onKeyDown}
        />
      </div>
      <ErrorAlert error={products.error} />
      {products.loading && !products.data ? (
        <Loading />
      ) : rows.length === 0 ? (
        !products.error && <Empty>Produk tidak ditemukan</Empty>
      ) : (
        <div className="product-grid">
          {rows.map((p) => (
            <button key={p.id} className="product-tile" onClick={() => onPick(p)} aria-label={`Tambah ${p.name} ke keranjang`}>
              <span className="product-name">{p.name}</span>
              <span className="muted small">{p.sku}</span>
              <span className="product-tile-foot">
                <span className="product-price">{rupiah(p.price)}</span>
                <span className="add-btn" aria-hidden="true">+</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function ShiftSummary({ summary, rows }) {
  if (rows.length === 0) return <Empty>Belum ada transaksi</Empty>;
  const byMethod = summary.totals_by_method;
  return (
    <div className="stats small-stats">
      {Object.entries(METHOD_LABELS).map(([m, label]) => (
        <Stat key={m} label={label} value={rupiah(byMethod[m]?.total ?? 0)} hint={`${byMethod[m]?.count ?? 0} transaksi`} />
      ))}
      <Stat label="Pending" value={summary.pending_count} tone={summary.pending_count > 0 ? 'danger' : undefined} hint="Belum dibayar" />
      <Stat label="Void" value={summary.void_count} />
    </div>
  );
}

// Item counts per transaction (the list endpoint has no items; items never change after creation, so cache forever).
const itemCountCache = new Map(); // id -> number | null (loading) | -1 (failed)
function rememberItemCount(trx) {
  if (trx?.items) itemCountCache.set(trx.id, trx.items.reduce((n, i) => n + Number(i.quantity), 0));
}
function useItemCounts(rows) {
  const [, bump] = useState(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const missing = rows.map((r) => r.id).filter((id) => !itemCountCache.has(id)).join(',');
  useEffect(() => {
    if (!missing) return;
    const ids = missing.split(',').map(Number);
    ids.forEach((id) => itemCountCache.set(id, null)); // mark in flight so re-renders don't refetch
    Promise.all(
      ids.map((id) =>
        posApi(`/transactions/${id}`)
          .then((r) => rememberItemCount(r.data))
          .catch(() => itemCountCache.set(id, -1)),
      ),
    ).then(() => mounted.current && bump((n) => n + 1));
  }, [missing]);
  return (id) => itemCountCache.get(id);
}

const STATUS_LABELS = { paid: 'Berhasil', pending: 'Pending', void: 'Void' };

function ShiftTransactions({ rows, onPay }) {
  const itemCount = useItemCounts(rows);
  if (rows.length === 0) return <Empty>Belum ada transaksi</Empty>;
  return (
    <div className="table-scroll">
      <table className="table">
        <thead>
          <tr>
            <th>Waktu</th>
            <th>No. Transaksi</th>
            <th className="num">Items</th>
            <th className="num">Total</th>
            <th>Status</th>
            <th className="actions-col" />
          </tr>
        </thead>
        <tbody>
          {rows.map((t) => {
            const count = itemCount(t.id);
            const unsynced = t.status !== 'pending' && t.finance_sync_status !== 'synced';
            return (
              <tr key={t.id}>
                <td className="nowrap">{timeOnly(t.paid_at || t.created_at)}</td>
                <td>
                  <Link to={`/transaksi/${t.id}`}>{t.trx_number}</Link>
                  {t.payment_method && <div className="muted small">{METHOD_LABELS[t.payment_method]}</div>}
                </td>
                <td className="num">{count === null || count === undefined ? '…' : count < 0 ? '-' : count}</td>
                <td className="num">{rupiah(t.grand_total)}</td>
                <td>
                  <div className="status-stack">
                    <Badge kind="trxShift" value={t.status} label={STATUS_LABELS[t.status] ?? t.status} />
                    {unsynced && <Badge kind="sync" value={t.finance_sync_status} label={`Sync: ${t.finance_sync_status}`} />}
                  </div>
                </td>
                <td className="actions">
                  {t.status === 'pending' && (
                    <button className="btn btn-sm btn-primary" onClick={() => onPay(t)}>
                      Bayar
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Checkout modal: payment method, cash received and change (same API call as before). */
function PaymentModal({ trx, onClose, onPaid }) {
  const [method, setMethod] = useState('cash');
  const [paid, setPaid] = useState('');
  const { busy, error, run } = useAction();
  const submitting = useRef(false);
  const cash = method === 'cash';
  const paidAmount = cash ? paid : trx.grand_total;
  const change = cash && paid !== '' ? subtractMoney(paid, trx.grand_total) : null;

  const submit = async (e) => {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    await run(async () => {
      const res = await posApi(`/transactions/${trx.id}/pay`, { method: 'POST', body: { payment_method: method, paid_amount: paidAmount } });
      onPaid(res.data);
    });
    submitting.current = false;
  };

  return (
    <Modal
      title={`Pembayaran ${trx.trx_number}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose} type="button">
            Nanti
          </button>
          <button className="btn btn-primary" form="pay-form" disabled={busy || (cash && (paid === '' || Number(change) < 0))}>
            {busy ? 'Memproses…' : 'Konfirmasi Bayar'}
          </button>
        </>
      }
    >
      <form id="pay-form" onSubmit={submit}>
        <dl className="totals">
          <dt>Subtotal</dt>
          <dd>{rupiah(trx.subtotal)}</dd>
          <dt>Diskon</dt>
          <dd>− {rupiah(trx.discount_amount)}</dd>
          <dt>PPN</dt>
          <dd>{rupiah(trx.tax_amount)}</dd>
          <dt className="grand">Total</dt>
          <dd className="grand">{rupiah(trx.grand_total)}</dd>
        </dl>
        <div className="field-label">Metode Pembayaran</div>
        <div className="segmented" role="radiogroup" aria-label="Metode pembayaran">
          {Object.entries(METHOD_LABELS).map(([value, label]) => (
            <button type="button" role="radio" aria-checked={method === value} key={value} className={method === value ? 'active' : ''} onClick={() => setMethod(value)}>
              {label}
            </button>
          ))}
        </div>
        {cash ? (
          <>
            <Field label="Uang diterima" error={error?.fields?.paid_amount}>
              <MoneyInput value={paid} onChange={setPaid} required autoFocus />
            </Field>
            <div className={`change ${Number(change) < 0 ? 'negative' : ''}`}>
              Kembalian: <strong>{change === null ? '-' : Number(change) < 0 ? 'Uang kurang' : rupiah(change)}</strong>
            </div>
          </>
        ) : (
          <p className="muted">Nominal {METHOD_LABELS[method]} harus sama dengan total: {rupiah(trx.grand_total)}</p>
        )}
        <ErrorAlert error={error} />
      </form>
    </Modal>
  );
}

function PaidNotice({ trx, onDismiss }) {
  const failed = trx.finance_sync_status !== 'synced';
  return (
    <Alert type={failed ? 'warning' : 'success'}>
      <div className="notice-row">
        <div>
          <strong>{trx.trx_number}</strong> lunas ({METHOD_LABELS[trx.payment_method]}) · Total {rupiah(trx.grand_total)}
          {trx.payment_method === 'cash' && <> · Kembalian <strong>{rupiah(trx.change_amount)}</strong></>}
          {failed && (
            <div className="small">
              Posting ke Finance gagal ({trx.finance_last_error}). Transaksi tetap lunas; kirim ulang dari{' '}
              <Link to={`/transaksi/${trx.id}`}>detail transaksi</Link>.
            </div>
          )}
        </div>
        <button className="icon-btn" onClick={onDismiss} aria-label="Tutup notifikasi">×</button>
      </div>
    </Alert>
  );
}

function CloseShiftModal({ shift, summary, onClose, onClosed }) {
  const [actual, setActual] = useState('');
  const [note, setNote] = useState('');
  const { busy, error, run } = useAction();
  const submitting = useRef(false);

  const byMethod = summary.totals_by_method;
  const cashTotal = byMethod.cash?.total ?? '0';
  const nonCashTotal = addMoney(byMethod.debit?.total ?? '0', byMethod.qris?.total ?? '0');
  const grandTotal = addMoney(cashTotal, nonCashTotal);
  const variance = actual === '' ? null : subtractMoney(actual, summary.expected_cash);
  const varianceTone = variance === null ? 'empty' : Number(variance) < 0 ? 'negative' : Number(variance) > 0 ? 'positive' : 'zero';

  const submit = async (e) => {
    e.preventDefault();
    if (submitting.current || actual === '') return;
    submitting.current = true;
    // On error `run` keeps the modal open and the inputs (incl. the note) untouched.
    await run(async () => {
      const res = await posApi(`/shifts/${shift.id}/close`, { method: 'POST', body: { actual_cash: actual } });
      onClosed({ ...res.data, note: note.trim() });
    });
    submitting.current = false;
  };

  return (
    <Modal
      className="modal-close-shift"
      title="Konfirmasi Tutup Shift"
      subtitle={`Shift #${shift.id} - ${shift.outlet?.name || shift.outlet?.code || '-'}, ${shortDate(shift.business_date)}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn btn-danger-outline" type="button" onClick={onClose}>
            Batal
          </button>
          <button className="btn btn-success" form="close-form" disabled={busy || actual === ''} aria-busy={busy}>
            {busy ? 'Menutup…' : 'Konfirmasi & Tutup Shift'}
          </button>
        </>
      }
    >
      <form id="close-form" onSubmit={submit}>
        {summary.pending_count > 0 && (
          <Alert type="warning">Masih ada {summary.pending_count} transaksi pending — selesaikan pembayaran sebelum menutup shift.</Alert>
        )}
        <table className="table close-table">
          <colgroup>
            <col style={{ width: '60%' }} />
            <col style={{ width: '40%' }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Keterangan</th>
              <th scope="col" className="num">Nominal</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Total Penjualan Tunai</td>
              <td className="num">{rupiah(cashTotal)}</td>
            </tr>
            <tr>
              <td>Total Penjualan Non-Tunai</td>
              <td className="num">{rupiah(nonCashTotal)}</td>
            </tr>
            <tr className="row-total">
              <td>Total Keseluruhan</td>
              <td className="num">{rupiah(grandTotal)}</td>
            </tr>
          </tbody>
        </table>

        <Field
          label="Kas fisik dihitung (actual cash)"
          error={error?.fields?.actual_cash}
          hint={`Kas seharusnya ${rupiah(summary.expected_cash)} (modal awal ${rupiah(shift.opening_cash)} + penjualan tunai)`}
        >
          <MoneyInput value={actual} onChange={setActual} required autoFocus />
        </Field>

        <div className="field">
          <span className="field-label" id="variance-label">Selisih Tunai</span>
          <output className={`variance variance-${varianceTone}`} aria-labelledby="variance-label">
            {variance === null ? '—' : `${Number(variance) > 0 ? '+' : ''}${rupiah(variance)}`}
          </output>
        </div>

        <Field label="Catatan" hint="Catatan ditampilkan pada ringkasan penutupan shift.">
          <textarea rows={3} placeholder="Tulis catatan di sini..." value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} />
        </Field>
        <ErrorAlert error={error} />
      </form>
    </Modal>
  );
}

function ClosedShiftNotice({ result, onDismiss }) {
  const shift = result.shift;
  return (
    <Alert type={result.unsynced_total > 0 || isNonZero(shift.cash_variance) ? 'warning' : 'success'}>
      <div className="notice-row">
        <div>
          <strong>Shift #{shift.id} ditutup.</strong> Kas seharusnya {rupiah(shift.expected_cash)} · Kas fisik {rupiah(shift.actual_cash)} · Selisih{' '}
          <strong>{rupiah(shift.cash_variance)}</strong>
          {result.warning && <div className="small">{result.warning}</div>}
          {result.note && <div className="small">Catatan: {result.note}</div>}
        </div>
        <button className="icon-btn" onClick={onDismiss} aria-label="Tutup notifikasi">×</button>
      </div>
      <div className="stats small-stats">
        <Stat label="Transaksi" value={result.trx_count} />
        <Stat label="Void" value={result.void_count} />
        <Stat label="Belum synced" value={result.unsynced_count} tone={result.unsynced_count ? 'danger' : undefined} />
      </div>
    </Alert>
  );
}
