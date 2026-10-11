import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dayjs from 'dayjs';
import clsx from 'clsx';
import { Plus, Minus, Search, ShoppingCart, Pencil, PackagePlus, FileText, Download, Trash2 } from 'lucide-react';
import { get, post, put, openFile } from '../lib/api';
import { useAction, useApi, useDefaultBranchId } from '../lib/hooks';
import { useAuth } from '../store/auth';
import { inr, toPaise, toRupees, fmtDateTime, ymd, PAYMENT_MODES } from '../lib/format';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Pagination, Select, StatCard, Table, Tabs, Toggle } from '../components/ui';

const CATEGORIES = ['supplement', 'beverage', 'snack', 'merchandise', 'accessory', 'other'];

function Pos() {
  const branchId = useDefaultBranchId();
  const [q, setQ] = useState('');
  const [cart, setCart] = useState([]);
  const [memberQ, setMemberQ] = useState('');
  const [member, setMember] = useState(null);
  const [discount, setDiscount] = useState('');
  const [mode, setMode] = useState('upi');
  const [last, setLast] = useState(null);
  const { data: products } = useApi(['shop', 'products', 'pos'], '/shop/products', { active: 'true', search: q });
  const { data: members } = useQuery({ queryKey: ['pos-member', memberQ], queryFn: () => get('/members', { search: memberQ, limit: 5 }), enabled: memberQ.length >= 2 && !member });

  const add = (p) =>
    setCart((c) => {
      const e = c.find((x) => x._id === p._id);
      if (e) return c.map((x) => (x._id === p._id ? { ...x, qty: Math.min(x.qty + 1, p.stock) } : x));
      return p.stock > 0 ? [...c, { ...p, qty: 1 }] : c;
    });
  const setQty = (id, qty) => setCart((c) => c.map((x) => (x._id === id ? { ...x, qty } : x)).filter((x) => x.qty > 0));
  const totals = useMemo(() => {
    const sub = cart.reduce((s, x) => s + x.price * x.qty, 0);
    const tax = cart.reduce((s, x) => s + Math.round((x.price * x.qty * x.taxPercent) / 100), 0);
    const disc = Math.min(toPaise(discount), sub);
    const t = sub ? Math.round(tax * ((sub - disc) / sub)) : 0;
    return { sub, disc, tax: t, total: sub - disc + t };
  }, [cart, discount]);

  const checkout = useAction(
    () => post('/shop/sales', { branchId, memberId: member?._id, items: cart.map((x) => ({ productId: x._id, qty: x.qty })), discount: totals.disc, mode }),
    {
      success: (s) => `Sale ${s.saleNo} done: ${inr(s.total)}`,
      invalidate: ['shop', 'dashboard'],
      onSuccess: (s) => {
        setLast(s);
        setCart([]);
        setMember(null);
        setMemberQ('');
        setDiscount('');
      },
    },
  );

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="relative mb-3">
          <Search className="pointer-events-none absolute top-2.5 left-3 size-4 text-slate-400" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search product or SKU" className="pl-9" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {products?.map((p) => (
            <button
              key={p._id}
              onClick={() => add(p)}
              disabled={p.stock <= 0}
              className={clsx('rounded-xl bg-white p-3 text-left shadow-sm ring-1 ring-slate-200 transition hover:ring-brand-400', p.stock <= 0 && 'cursor-not-allowed opacity-50')}
            >
              <p className="font-medium text-slate-900">{p.name}</p>
              <p className="text-sm font-semibold text-brand-800">{inr(p.price)}</p>
              <p className={clsx('text-xs', p.low ? 'text-rose-600' : 'text-slate-500')}>{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</p>
            </button>
          ))}
          {products && !products.length && <p className="text-sm text-slate-500">No products. Add them in the Products tab.</p>}
        </div>
      </div>
      <Card title={<span className="flex items-center gap-2"><ShoppingCart className="size-4" /> Cart</span>} className="lg:col-span-2">
        {!cart.length ? (
          <p className="py-6 text-center text-sm text-slate-500">Tap products to add them</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {cart.map((x) => (
              <li key={x._id} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate">{x.name}</span>
                <span className="flex items-center gap-1">
                  <button className="rounded p-1 hover:bg-slate-100" onClick={() => setQty(x._id, x.qty - 1)} aria-label="Less">
                    <Minus className="size-3.5" />
                  </button>
                  <span className="w-6 text-center">{x.qty}</span>
                  <button className="rounded p-1 hover:bg-slate-100" onClick={() => setQty(x._id, Math.min(x.qty + 1, x.stock))} aria-label="More">
                    <Plus className="size-3.5" />
                  </button>
                </span>
                <span className="w-20 text-right">{inr(x.price * x.qty)}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 space-y-2">
          {member ? (
            <p className="flex items-center justify-between rounded-lg bg-brand-50 px-3 py-2 text-sm">
              {member.name} (#{member.memberCode})
              <button className="text-slate-500" onClick={() => setMember(null)} aria-label="Remove member">
                <Trash2 className="size-4" />
              </button>
            </p>
          ) : (
            <div>
              <Input value={memberQ} onChange={(e) => setMemberQ(e.target.value)} placeholder="Member (optional): name / phone / code" />
              {members?.items?.length > 0 && (
                <ul className="mt-1 rounded-lg ring-1 ring-slate-200">
                  {members.items.map((m) => (
                    <li key={m._id}>
                      <button className="w-full px-3 py-1.5 text-left text-sm hover:bg-slate-50" onClick={() => setMember(m)}>
                        {m.name} <span className="text-slate-400">#{m.memberCode}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <Input type="number" min="0" placeholder="Discount ₹" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              {PAYMENT_MODES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          </div>
          <dl className="space-y-0.5 text-sm">
            <div className="flex justify-between"><dt className="text-slate-500">Sub total</dt><dd>{inr(totals.sub)}</dd></div>
            {totals.disc > 0 && <div className="flex justify-between"><dt className="text-slate-500">Discount</dt><dd>- {inr(totals.disc)}</dd></div>}
            <div className="flex justify-between"><dt className="text-slate-500">GST</dt><dd>{inr(totals.tax)}</dd></div>
            <div className="flex justify-between text-base font-semibold"><dt>Total</dt><dd>{inr(totals.total, { decimals: true })}</dd></div>
          </dl>
          <Button className="w-full" size="lg" disabled={!cart.length || !branchId} loading={checkout.isPending} onClick={() => checkout.mutate()}>
            Collect {inr(totals.total)}
          </Button>
          {last && (
            <button className="w-full text-center text-sm text-brand-700 hover:underline" onClick={() => openFile(`/shop/sales/${last._id}/receipt.pdf`)}>
              Print receipt {last.saleNo}
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}

function ProductForm({ product, onClose }) {
  const [f, setF] = useState(
    product
      ? { ...product, price: toRupees(product.price), costPrice: toRupees(product.costPrice) }
      : { name: '', sku: '', category: 'supplement', price: '', costPrice: '', taxPercent: 18, lowStockAt: 5, isActive: true },
  );
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const save = useAction((b) => (product ? put(`/shop/products/${product._id}`, b) : post('/shop/products', b)), { success: 'Product saved', invalidate: ['shop'], onSuccess: onClose });
  return (
    <Modal
      open
      onClose={onClose}
      title={product ? 'Edit product' : 'New product'}
      footer={
        <Button
          loading={save.isPending}
          onClick={() =>
            save.mutate({
              name: f.name,
              sku: f.sku || undefined,
              category: f.category,
              price: toPaise(f.price),
              costPrice: toPaise(f.costPrice),
              taxPercent: Number(f.taxPercent),
              lowStockAt: Number(f.lowStockAt),
              isActive: f.isActive,
            })
          }
        >
          Save
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" className="sm:col-span-2">
          <Input value={f.name} onChange={set('name')} />
        </Field>
        <Field label="SKU / barcode">
          <Input value={f.sku || ''} onChange={set('sku')} />
        </Field>
        <Field label="Category">
          <Select value={f.category} onChange={set('category')} className="capitalize">
            {CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
        <Field label="Selling price (₹, before GST)">
          <Input type="number" min="0" value={f.price} onChange={set('price')} />
        </Field>
        <Field label="Cost price (₹)">
          <Input type="number" min="0" value={f.costPrice} onChange={set('costPrice')} />
        </Field>
        <Field label="GST %">
          <Input type="number" min="0" max="50" value={f.taxPercent} onChange={set('taxPercent')} />
        </Field>
        <Field label="Low-stock alert at">
          <Input type="number" min="0" value={f.lowStockAt} onChange={set('lowStockAt')} />
        </Field>
        {product && <Toggle checked={f.isActive} onChange={(v) => setF({ ...f, isActive: v })} label="On sale" />}
      </div>
    </Modal>
  );
}

function StockModal({ product, onClose }) {
  const branchId = useDefaultBranchId();
  const [f, setF] = useState({ type: 'purchase', qty: '', unitCost: toRupees(product.costPrice), note: '' });
  const save = useAction(
    () => post(`/shop/products/${product._id}/stock`, { branchId, type: f.type, qty: Number(f.qty), unitCost: f.type === 'purchase' ? toPaise(f.unitCost) : undefined, note: f.note || undefined }),
    { success: (d) => `Stock updated: ${d.qty} now`, invalidate: ['shop'], onSuccess: onClose },
  );
  return (
    <Modal open onClose={onClose} title={`Stock · ${product.name}`} size="sm" footer={<Button disabled={!Number(f.qty)} loading={save.isPending} onClick={() => save.mutate()}>Save</Button>}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Current stock: {product.stock}</p>
        <Field label="Type">
          <Select value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })}>
            <option value="purchase">Stock in (purchase)</option>
            <option value="adjustment">Adjustment (count correction / damage)</option>
          </Select>
        </Field>
        <Field label="Quantity" hint={f.type === 'adjustment' ? 'Negative to remove, e.g. -2' : undefined}>
          <Input type="number" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} />
        </Field>
        {f.type === 'purchase' && (
          <Field label="Cost per unit (₹)">
            <Input type="number" min="0" value={f.unitCost} onChange={(e) => setF({ ...f, unitCost: e.target.value })} />
          </Field>
        )}
        <Field label="Note">
          <Input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} placeholder="Supplier bill no." />
        </Field>
      </div>
    </Modal>
  );
}

function Products() {
  const can = useAuth((s) => s.can);
  const [modal, setModal] = useState(null);
  const { data } = useApi(['shop', 'products'], '/shop/products');
  return (
    <Card
      padded={false}
      title="Products & stock"
      actions={can('shop.manage') && <Button size="sm" onClick={() => setModal({ type: 'edit' })}><Plus className="size-4" /> Product</Button>}
    >
      <Table
        rows={data}
        empty={<EmptyState title="No products yet" />}
        columns={[
          { key: 'n', label: 'Product', render: (p) => <span><b>{p.name}</b>{p.sku && <span className="ml-1 text-xs text-slate-400">{p.sku}</span>}</span> },
          { key: 'c', label: 'Category', render: (p) => <span className="capitalize">{p.category}</span> },
          { key: 'p', label: 'Price', render: (p) => inr(p.price) },
          { key: 'm', label: 'Margin', render: (p) => (p.price ? `${Math.round(((p.price - p.costPrice) / p.price) * 100)}%` : '—') },
          { key: 's', label: 'Stock', render: (p) => <span className={p.low ? 'font-semibold text-rose-600' : ''}>{p.stock}{p.low && ' · low'}</span> },
          { key: 'st', label: '', render: (p) => !p.isActive && <Badge status="cancelled">Off</Badge> },
          {
            key: 'a',
            label: '',
            render: (p) =>
              can('shop.manage') && (
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => setModal({ type: 'stock', p })}>
                    <PackagePlus className="size-3.5" /> Stock
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setModal({ type: 'edit', p })} aria-label="Edit">
                    <Pencil className="size-4" />
                  </Button>
                </div>
              ),
          },
        ]}
      />
      {modal?.type === 'edit' && <ProductForm product={modal.p} onClose={() => setModal(null)} />}
      {modal?.type === 'stock' && <StockModal product={modal.p} onClose={() => setModal(null)} />}
    </Card>
  );
}

function Sales() {
  const can = useAuth((s) => s.can);
  const branchId = useAuth((s) => s.branchId);
  const [from, setFrom] = useState(ymd(dayjs().startOf('month')));
  const [to, setTo] = useState(ymd());
  const [page, setPage] = useState(1);
  const { data } = useApi(['shop', 'sales'], '/shop/sales', { from, to, page });
  const refund = useAction(({ id, reason }) => post(`/shop/sales/${id}/refund`, { reason }), { success: 'Refunded and stock returned', invalidate: ['shop'] });
  const qs = new URLSearchParams({ from, to, export: 'xlsx', ...(branchId && { branchId }) });
  const s = data?.summary;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input type="date" value={from} onChange={(e) => (setFrom(e.target.value), setPage(1))} className="w-auto" />
        <span className="text-slate-400">to</span>
        <Input type="date" value={to} onChange={(e) => (setTo(e.target.value), setPage(1))} className="w-auto" />
        <Button size="sm" variant="ghost" onClick={() => openFile(`/shop/sales?${qs}`, { download: 'shop-sales.xlsx' })}>
          <Download className="size-4" /> Excel
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Sales" value={s?.count ?? 0} />
        <StatCard label="Revenue (incl. GST)" value={inr(s?.revenue)} tone="green" />
        <StatCard label="GST collected" value={inr(s?.tax)} tone="slate" />
        <StatCard label="Profit" value={inr(s?.profit)} tone="brand" />
      </div>
      {data?.top?.length > 0 && (
        <p className="text-sm text-slate-600">
          Best sellers: {data.top.map((t) => `${t._id} (${t.qty})`).join(', ')}
        </p>
      )}
      <Card padded={false}>
        <Table
          rows={data?.items}
          empty={<EmptyState title="No sales in this period" />}
          columns={[
            { key: 'no', label: 'Sale', render: (r) => r.saleNo },
            { key: 'at', label: 'When', render: (r) => fmtDateTime(r.createdAt) },
            { key: 'c', label: 'Customer', render: (r) => (r.memberId ? `${r.memberId.name} (#${r.memberId.memberCode})` : r.customerName || 'Walk-in') },
            { key: 'i', label: 'Items', className: 'max-w-xs truncate', render: (r) => r.items.map((i) => `${i.name} ×${i.qty}`).join(', ') },
            { key: 't', label: 'Total', render: (r) => <b className={r.status === 'refunded' ? 'line-through' : ''}>{inr(r.total)}</b> },
            { key: 's', label: 'Status', render: (r) => <Badge status={r.status === 'paid' ? 'allow' : 'deny'}>{r.status}</Badge> },
            {
              key: 'a',
              label: '',
              render: (r) => (
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => openFile(`/shop/sales/${r._id}/receipt.pdf`)} aria-label="Receipt">
                    <FileText className="size-4" />
                  </Button>
                  {r.status === 'paid' && can('payments.refund') && (
                    <Button size="sm" variant="ghost" className="text-rose-600" onClick={() => { const reason = window.prompt('Refund reason'); if (reason) refund.mutate({ id: r._id, reason }); }}>
                      Refund
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
        <Pagination page={data?.page} pages={data?.pages} total={data?.total} onChange={setPage} />
      </Card>
    </div>
  );
}

export default function Shop() {
  const [tab, setTab] = useState('pos');
  const can = useAuth((s) => s.can);
  return (
    <div>
      <PageHeader title="Shop" subtitle="Sell supplements, drinks and merchandise. Stock is tracked per branch." />
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'pos', label: 'New sale' },
          { value: 'sales', label: 'Sales' },
          ...(can('shop.manage') ? [{ value: 'products', label: 'Products & stock' }] : []),
        ]}
      />
      {tab === 'pos' && <Pos />}
      {tab === 'sales' && <Sales />}
      {tab === 'products' && <Products />}
    </div>
  );
}
