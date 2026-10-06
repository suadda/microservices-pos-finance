import { useEffect, useRef, useState } from 'react';
import { posApi } from '../api/client';
import {
  Badge, EditIcon, Empty, ErrorAlert, Field, Loading, Modal, MoneyInput, PageHeader, PageNav, ProductThumb, SearchIcon, Switch,
} from '../components/ui';
import { rupiah } from '../lib/format';
import { CATEGORY_OPTIONS, categoryOf } from '../lib/productCategory';
import { useAction, useApi } from '../lib/useApi';

const PER_PAGE = 10;

/** All products matching the server-side filters (category is derived client-side, so it needs the full set). */
async function fetchAllProducts(query) {
  const rows = [];
  for (let page = 1; ; page += 1) {
    const res = await posApi('/products', { query: { ...query, page, per_page: 100 } });
    rows.push(...res.data);
    if (page >= res.meta.last_page) return rows;
  }
}

/** Product list page: { data, meta } — server-paginated, or paginated locally when a category is selected. */
function loadPage({ search, status, category, page }) {
  const query = { search, is_active: status };
  if (!category) return posApi('/products', { query: { ...query, page, per_page: PER_PAGE } });
  return fetchAllProducts(query).then((all) => {
    const rows = all.filter((p) => categoryOf(p.sku) === category);
    const last = Math.max(1, Math.ceil(rows.length / PER_PAGE));
    const current = Math.min(page, last);
    return {
      data: rows.slice((current - 1) * PER_PAGE, current * PER_PAGE),
      meta: { page: current, per_page: PER_PAGE, total: rows.length, last_page: last },
    };
  });
}

export default function Products() {
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ search: '', status: '', category: '', page: 1 });
  const list = useApi(() => loadPage(filters), [JSON.stringify(filters)]);
  const summary = useApi(() =>
    Promise.all(['', '1', '0'].map((a) => posApi('/products', { query: { is_active: a, per_page: 1 } }).then((r) => r.meta.total))).then(
      ([total, active, inactive]) => ({ total, active, inactive }),
    ),
  );
  const [editing, setEditing] = useState(null); // {} = new, product = edit

  // Optimistic toggle state: id -> displayed is_active, plus in-flight ids (prevents double toggles).
  const [overrides, setOverrides] = useState({});
  const [busyIds, setBusyIds] = useState({});
  const inFlight = useRef(new Set());
  const [toggleError, setToggleError] = useState(null);

  const set = (k, v) => setFilters((f) => ({ ...f, [k]: v, page: k === 'page' ? v : 1 }));

  // Debounced search; resets to page 1 like the other filters.
  useEffect(() => {
    const t = setTimeout(() => setFilters((f) => (f.search === search.trim() ? f : { ...f, search: search.trim(), page: 1 })), 300);
    return () => clearTimeout(t);
  }, [search]);

  // Fresh server data replaces settled optimistic values (keep only rows still being saved).
  useEffect(() => {
    setOverrides((o) => Object.fromEntries(Object.entries(o).filter(([id]) => inFlight.current.has(Number(id)))));
  }, [list.data]);

  const isActive = (p) => overrides[p.id] ?? p.is_active;

  const toggle = async (p, next) => {
    if (inFlight.current.has(p.id)) return;
    inFlight.current.add(p.id);
    setBusyIds((b) => ({ ...b, [p.id]: true }));
    setOverrides((o) => ({ ...o, [p.id]: next }));
    setToggleError(null);
    try {
      if (next) await posApi(`/products/${p.id}`, { method: 'PUT', body: { is_active: true } });
      else await posApi(`/products/${p.id}`, { method: 'DELETE' });
      inFlight.current.delete(p.id);
      summary.reload();
      list.reload();
    } catch (e) {
      inFlight.current.delete(p.id);
      setOverrides((o) => {
        const rest = { ...o };
        delete rest[p.id];
        return rest;
      });
      setToggleError(e);
    } finally {
      setBusyIds((b) => {
        const rest = { ...b };
        delete rest[p.id];
        return rest;
      });
    }
  };

  const rows = list.data?.data ?? [];
  const s = summary.data;

  return (
    <>
      <PageHeader
        title="Manajemen Produk"
        actions={
          <button className="btn btn-primary" onClick={() => setEditing({})}>
            + Tambah Produk
          </button>
        }
      />

      <section className="card summary-bar" aria-label="Ringkasan produk">
        <ErrorAlert error={summary.error} />
        <div className="summary-item">
          <span className="summary-label">Total Produk</span>
          <strong className="summary-value">{s ? s.total : '…'}</strong>
        </div>
        <div className="summary-item">
          <span className="summary-label">Produk Aktif</span>
          <strong className="summary-value text-success">{s ? s.active : '…'}</strong>
        </div>
        <div className="summary-item">
          <span className="summary-label">Produk Non-Aktif</span>
          <strong className="summary-value muted">{s ? s.inactive : '…'}</strong>
        </div>
      </section>

      <section className="card">
        <div className="filters-row">
          <div className="search-box">
            <SearchIcon />
            <input type="search" placeholder="Search" aria-label="Cari SKU atau nama produk" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select aria-label="Filter kategori" value={filters.category} onChange={(e) => set('category', e.target.value)}>
            <option value="">Semua Kategori</option>
            {CATEGORY_OPTIONS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select aria-label="Filter status" value={filters.status} onChange={(e) => set('status', e.target.value)}>
            <option value="">Semua Status</option>
            <option value="1">Aktif</option>
            <option value="0">Non-Aktif</option>
          </select>
        </div>

        <ErrorAlert error={list.error || toggleError} />
        {list.loading && !list.data ? (
          <Loading />
        ) : rows.length === 0 ? (
          <Empty>{list.error ? 'Data produk gagal dimuat' : 'Tidak ada produk yang cocok dengan filter'}</Empty>
        ) : (
          <div className="table-scroll">
            <table className="table product-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Nama Produk</th>
                  <th>Kategori</th>
                  <th className="num">Harga</th>
                  <th>Status</th>
                  <th className="actions-col">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => {
                  const active = isActive(p);
                  return (
                    <tr key={p.id}>
                      <td className="nowrap">
                        <code>{p.sku}</code>
                      </td>
                      <td>
                        <div className="product-cell">
                          <ProductThumb name={p.name} src={p.image_url} />
                          <span>{p.name}</span>
                        </div>
                      </td>
                      <td className="nowrap">{categoryOf(p.sku)}</td>
                      <td className="num">{rupiah(p.price)}</td>
                      <td>
                        <Badge kind="active" value={active} label={active ? 'Aktif' : 'Non-Aktif'} />
                      </td>
                      <td className="actions">
                        <div className="product-actions">
                          <button className="btn btn-sm" onClick={() => setEditing(p)}>
                            <EditIcon /> Edit
                          </button>
                          <Switch
                            checked={active}
                            disabled={Boolean(busyIds[p.id])}
                            onChange={(next) => toggle(p, next)}
                            label={`${active ? 'Nonaktifkan' : 'Aktifkan'} ${p.name}`}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <PageNav meta={list.data?.meta} onPage={(p) => set('page', p)} unit="produk" />
      </section>

      {editing && (
        <ProductForm
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            list.reload();
            summary.reload();
          }}
        />
      )}
    </>
  );
}

function ProductForm({ product, onClose, onSaved }) {
  const isNew = !product.id;
  const [form, setForm] = useState({ sku: product.sku || '', name: product.name || '', price: product.price || '', is_active: product.is_active ?? true });
  const { busy, error, run } = useAction();
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = (e) => {
    e.preventDefault();
    if (busy) return;
    run(async () => {
      await posApi(isNew ? '/products' : `/products/${product.id}`, { method: isNew ? 'POST' : 'PUT', body: form });
      onSaved();
    });
  };

  return (
    <Modal
      title={isNew ? 'Tambah Produk' : `Edit ${product.name}`}
      onClose={onClose}
      footer={
        <>
          <button className="btn" type="button" onClick={onClose}>Batal</button>
          <button className="btn btn-primary" form="product-form" disabled={busy}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
        </>
      }
    >
      <form id="product-form" onSubmit={submit}>
        <Field label="SKU" error={error?.fields?.sku} hint={form.sku ? `Kategori: ${categoryOf(form.sku)} (ditentukan dari prefix SKU)` : undefined}>
          <input value={form.sku} onChange={set('sku')} required maxLength={50} />
        </Field>
        <Field label="Nama produk" error={error?.fields?.name}>
          <input value={form.name} onChange={set('name')} required maxLength={200} />
        </Field>
        <Field label="Harga jual" error={error?.fields?.price}>
          <MoneyInput value={form.price} onChange={(v) => setForm((f) => ({ ...f, price: v }))} required />
        </Field>
        <label className="checkbox">
          <input type="checkbox" checked={form.is_active} onChange={set('is_active')} /> Aktif (dapat dijual)
        </label>
        <ErrorAlert error={error} />
      </form>
    </Modal>
  );
}
