import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createStockItem, deleteStockItem, listStock, updateStockItem } from '../api/stock'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { StockBadge } from '../components/StatusBadge'
import { useBakery } from '../context/bakery-context'
import { useToast } from '../context/toast-context'
import { useAsync } from '../hooks/useAsync'
import type { StockItem } from '../types/api'

type Filter = 'ALL' | 'LOW' | 'OUT' | 'UNLINKED'

const FILTERS: { id: Filter; label: string; test: (s: StockItem) => boolean }[] = [
  { id: 'ALL', label: 'All', test: () => true },
  { id: 'LOW', label: 'Running low', test: (s) => s.level === 'LOW' },
  { id: 'OUT', label: 'Out of stock', test: (s) => s.level === 'OUT' },
  { id: 'UNLINKED', label: 'Not linked', test: (s) => s.options.length === 0 },
]

const amount = (n: number | null, unit: string) => (n == null ? 'Not set' : `${Number(n.toFixed(2))} ${unit}`)

export function StockPage() {
  const { bakery, refreshCounts } = useBakery()
  const toast = useToast()
  const { data, error, loading, setData, reload } = useAsync(() => listStock(bakery.id), [bakery.id])
  const [filter, setFilter] = useState<Filter>('ALL')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<StockItem | null>(null)

  const items = data ?? []
  const shown = items.filter(FILTERS.find((f) => f.id === filter)!.test)

  const saved = (item: StockItem, message: string) => {
    setData(items.map((s) => (s.id === item.id ? item : s)))
    refreshCounts()
    toast(message)
  }

  return (
    <>
      <div className="page-header">
        <div className="stack">
          <h1>Stock</h1>
          <p>Private to your bakery. Customers never see this page.</p>
        </div>
        {!adding && (
          <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
            Add stock item
          </button>
        )}
      </div>

      {adding && (
        <AddStockForm
          onCancel={() => setAdding(false)}
          onAdded={(item) => {
            setAdding(false)
            reload()
            toast(`${item.name} added.`)
          }}
        />
      )}

      <div className="tabs" role="tablist" aria-label="Filter stock">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label} <span className="count">{items.filter(f.test).length}</span>
          </button>
        ))}
      </div>

      {error && <p className="form-error">{error}</p>}
      {loading && !data && <p className="loading">Loading stock…</p>}
      {data && shown.length === 0 && (
        <div className="empty">
          <h2>{filter === 'ALL' ? 'No stock items yet' : 'Nothing here'}</h2>
          <p>{filter === 'ALL' ? 'Add the ingredients and supplies you want to keep an eye on.' : 'Everything in this list looks fine.'}</p>
        </div>
      )}
      {shown.length > 0 && (
        <div className="table-wrap">
          <table className="table table-stack-wide" style={{ minWidth: 820 }}>
            <thead>
              <tr>
                <th scope="col">Item</th>
                <th scope="col" className="right">
                  In stock
                </th>
                <th scope="col" className="right">
                  Warn me at
                </th>
                <th scope="col">Status</th>
                <th scope="col">Linked to builder</th>
                <th scope="col">
                  <span className="visually-hidden">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((item) => (
                <StockRow key={item.id} item={item} onSaved={saved} onDelete={() => setDeleting(item)} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="row" style={{ alignItems: 'flex-start', gap: 24 }}>
        <p className="small" style={{ flex: '1 1 320px', color: 'var(--ink-2)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--ink)' }}>How linking works.</strong> Link an item to a builder option in <Link to="/builder">Builder options</Link>. When the item
          reaches zero, that option disappears from the app until you update the count.
        </p>
        <p className="small" style={{ flex: '1 1 320px', color: 'var(--ink-2)', lineHeight: 1.5 }}>
          <strong style={{ color: 'var(--ink)' }}>Items with no link</strong>, like cake boards and boxes, are only for your own records.
        </p>
      </div>

      <ConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'this item'}?`}
        confirmLabel="Delete item"
        tone="danger"
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          await deleteStockItem(bakery.id, deleting.id)
          setData(items.filter((s) => s.id !== deleting.id))
          refreshCounts()
          toast(`${deleting.name} deleted.`)
        }}
      >
        <p>
          {deleting?.options.length
            ? `${deleting.options.map((o) => o.name).join(', ')} will stay in the builder, but will no longer hide when you run out.`
            : 'It isn’t linked to any builder option.'}
        </p>
      </ConfirmDialog>
    </>
  )
}

function StockRow({ item, onSaved, onDelete }: { item: StockItem; onSaved: (item: StockItem, message: string) => void; onDelete: () => void }) {
  const { bakery } = useBakery()
  const [editing, setEditing] = useState(false)
  const [quantity, setQuantity] = useState(String(item.quantity))
  const [error, setError] = useState<string | null>(null)

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const value = Number(quantity)
    if (!Number.isFinite(value) || value < 0) return setError('Enter 0 or more')
    try {
      const updated = await updateStockItem(bakery.id, item.id, { quantity: value })
      setEditing(false)
      setError(null)
      const back = item.level === 'OUT' && updated.level !== 'OUT' && updated.options.length > 0
      onSaved(updated, back ? `${item.name} restocked. ${updated.options.map((o) => o.name).join(', ')} is back in the builder.` : `${item.name} updated.`)
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <tr>
      <td data-label="Item" className="strong">{item.name}</td>
      <td data-label="In stock" className="right nowrap" style={{ color: item.level === 'OUT' ? 'var(--danger)' : undefined, fontWeight: 600 }}>
        {editing ? (
          <form onSubmit={save} className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
            <label htmlFor={`qty-${item.id}`} className="visually-hidden">
              New count for {item.name}, in {item.unit}
            </label>
            <input id={`qty-${item.id}`} className="input" style={{ width: 90, minHeight: 38 }} inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} autoFocus />
            <span className="muted">{item.unit}</span>
            <button type="submit" className="btn btn-sm btn-primary">
              Save
            </button>
            <button type="button" className="btn btn-sm btn-outline" onClick={() => setEditing(false)}>
              Cancel
            </button>
            {error && <span className="form-error">{error}</span>}
          </form>
        ) : (
          amount(item.quantity, item.unit)
        )}
      </td>
      <td data-label="Warn me at" className="right nowrap muted">{amount(item.lowAt, item.unit)}</td>
      <td data-label="Status">
        <StockBadge level={item.level} />
      </td>
      <td data-label="Linked to builder" style={{ color: 'var(--ink-2)' }}>{item.options.length ? item.options.map((o) => o.name).join(', ') : <span className="muted">Not linked</span>}</td>
      <td data-label="" className="right nowrap">
        {!editing && (
          <div className="row" style={{ justifyContent: 'flex-end', gap: 4 }}>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => {
                setQuantity(String(item.quantity))
                setEditing(true)
              }}
            >
              Update count
            </button>
            <button type="button" className="btn btn-sm btn-quiet-danger" onClick={onDelete} aria-label={`Delete ${item.name}`}>
              Delete
            </button>
          </div>
        )}
      </td>
    </tr>
  )
}

function AddStockForm({ onAdded, onCancel }: { onAdded: (item: StockItem) => void; onCancel: () => void }) {
  const { bakery } = useBakery()
  const [form, setForm] = useState({ name: '', unit: '', quantity: '', lowAt: '' })
  const [error, setError] = useState<string | null>(null)
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!form.name.trim() || !form.unit.trim()) return setError('Add a name and a unit, for example "Fresh roses" in "stems"')
    try {
      onAdded(
        await createStockItem(bakery.id, {
          name: form.name.trim(),
          unit: form.unit.trim(),
          quantity: form.quantity ? Number(form.quantity) : 0,
          lowAt: form.lowAt ? Number(form.lowAt) : null,
        }),
      )
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>Add a stock item</h2>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="s-name">Item</label>
          <input id="s-name" className="input" placeholder="For example Fresh roses" value={form.name} onChange={(e) => set('name', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="s-unit">Counted in</label>
          <input id="s-unit" className="input" placeholder="kg, stems, packs" value={form.unit} onChange={(e) => set('unit', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="s-qty">In stock now</label>
          <input id="s-qty" className="input" inputMode="decimal" placeholder="0" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="s-low">
            Warn me at <span className="optional">· optional</span>
          </label>
          <input id="s-low" className="input" inputMode="decimal" value={form.lowAt} onChange={(e) => set('lowAt', e.target.value)} />
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button type="submit" className="btn btn-primary">
          Add item
        </button>
        <button type="button" className="btn btn-outline" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}
