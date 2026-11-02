import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  createOption,
  createOptionGroup,
  deleteOption,
  deleteOptionGroup,
  listOptionGroups,
  updateOption,
  updateOptionGroup,
  type OptionInput,
} from '../api/builder'
import { listStock } from '../api/stock'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useBakery } from '../context/bakery-context'
import { useToast } from '../context/toast-context'
import { useAsync } from '../hooks/useAsync'
import { formatMoney, MAX_AMOUNT } from '../lib/format'
import type { BuilderOption, OptionGroup, OptionKind, StockItem } from '../types/api'

const KIND_LABELS: Record<OptionKind, string> = {
  SHAPE: 'Shape',
  TIERS: 'Tiers',
  SIZE: 'Size',
  FLAVOUR: 'Flavour',
  ICING_COLOUR: 'Icing colour',
  DECORATION: 'Decoration',
  OTHER: 'Other',
}

export function BuilderOptionsPage() {
  const { bakery } = useBakery()
  const toast = useToast()
  const groups = useAsync(() => listOptionGroups(bakery.id), [bakery.id])
  const stock = useAsync(() => listStock(bakery.id), [bakery.id])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editing, setEditing] = useState<BuilderOption | null>(null)
  const [deletingGroup, setDeletingGroup] = useState<OptionGroup | null>(null)
  const [deletingOption, setDeletingOption] = useState<BuilderOption | null>(null)

  const list = groups.data ?? []
  const group = list.find((g) => g.id === selectedId) ?? list[0]

  const replaceGroup = (next: OptionGroup) => groups.setData(list.map((g) => (g.id === next.id ? { ...next, options: g.options } : g)))

  const setGroupRule = async (data: Partial<Pick<OptionGroup, 'multiple' | 'required'>>) => {
    if (!group) return
    try {
      replaceGroup(await updateOptionGroup(bakery.id, group.id, data))
      toast(`${group.name} updated.`)
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }

  const setActive = async (option: BuilderOption, isActive: boolean) => {
    try {
      await updateOption(bakery.id, option.id, { isActive })
      groups.reload()
      toast(isActive ? `${option.name} is back in the builder.` : `${option.name} is hidden from the builder.`, {
        action: { label: 'Undo', onClick: () => void setActive(option, !isActive) },
      })
    } catch (e) {
      toast((e as Error).message, { tone: 'error' })
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="stack">
          <h1>Builder options</h1>
          <p>What customers can choose when they design a cake in the app, and what each choice adds to the price.</p>
        </div>
      </div>

      {groups.error && <p className="form-error">{groups.error}</p>}
      {groups.loading && !groups.data && <p className="loading">Loading options…</p>}

      {groups.data && (
        <div className="split">
          <nav aria-label="Option groups" className="stack" style={{ flex: '0 1 230px', minWidth: 190, gap: 2 }}>
            {list.map((g) => {
              const shown = g.options.filter((o) => o.available).length
              const on = g.id === group?.id
              return (
                <button
                  key={g.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setSelectedId(g.id)
                    setEditing(null)
                  }}
                  className="btn"
                  style={{ justifyContent: 'space-between', background: on ? 'var(--sand)' : 'transparent', fontWeight: on ? 700 : 500 }}
                >
                  {g.name}
                  <span className="small muted">
                    {shown}/{g.options.length}
                  </span>
                </button>
              )
            })}
            <AddGroupForm onAdded={(g) => {
              groups.reload()
              setSelectedId(g.id)
              toast(`${g.name} added. Add its options next.`)
            }} />
          </nav>

          {group && (
            <section className="split-main" aria-labelledby="group-h">
              <div className="row-between">
                <h2 id="group-h">{group.name}</h2>
                <div className="row">
                  <span id="pick-label" className="small strong">
                    Customers can pick
                  </span>
                  <div className="segmented" role="radiogroup" aria-labelledby="pick-label">
                    <button type="button" role="radio" aria-checked={!group.multiple} onClick={() => void setGroupRule({ multiple: false })}>
                      Only one
                    </button>
                    <button type="button" role="radio" aria-checked={group.multiple} onClick={() => void setGroupRule({ multiple: true })}>
                      Several
                    </button>
                  </div>
                </div>
              </div>
              <label className="check" style={{ paddingTop: 0 }}>
                <input type="checkbox" checked={group.required} onChange={(e) => void setGroupRule({ required: e.target.checked })} />
                <span>Customers must choose one before they can continue</span>
              </label>

              {group.options.length > 0 && !group.options.some((o) => o.available) && (
                <p className="alert" role="status">
                  <span>
                    <strong>Customers can't see {group.name} right now.</strong> None of its options are switched on and in stock, so the app leaves the
                    group out{group.required ? ' and lets customers continue without it' : ''}. Switch an option on
                    {group.options.some((o) => o.hiddenBecause === 'OUT_OF_STOCK') ? ' or restock it' : ''} to bring it back.
                  </span>
                  {group.options.some((o) => o.hiddenBecause === 'OUT_OF_STOCK') && <Link to="/stock">Go to stock</Link>}
                </p>
              )}

              <p className="alert alert-info">
                <span>
                  Customers only see options that are switched on and in stock. When linked stock runs out, the option hides itself and comes back when you{' '}
                  <Link to="/stock">restock</Link>.
                </span>
              </p>

              {group.options.length === 0 ? (
                <p className="muted">No options in this group yet. Add the first one below.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table table-stack" style={{ minWidth: 600 }}>
                    <thead>
                      <tr>
                        <th scope="col">Option</th>
                        <th scope="col" className="right">
                          Adds
                        </th>
                        <th scope="col">Uses stock</th>
                        <th scope="col">In the builder</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.options.map((o) => (
                        <tr key={o.id} className={o.available ? undefined : 'row-muted'}>
                          <td data-label="Option">
                            <span className="row" style={{ gap: 8 }}>
                              {group.kind === 'ICING_COLOUR' && o.value && (
                                <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: 9, background: o.value, boxShadow: 'inset 0 0 0 1px rgba(43,27,20,0.2)' }} />
                              )}
                              <button type="button" className="link-button" onClick={() => setEditing(o)}>
                                {o.name}
                              </button>
                            </span>
                            {o.serves && <div className="sub">Serves about {o.serves}</div>}
                          </td>
                          <td data-label="Adds" className="right nowrap">{o.price ? formatMoney(o.price, bakery.currency) : <span className="muted">Nothing</span>}</td>
                          <td data-label="Uses stock">
                            {o.stockItem ? (
                              <>
                                <Link to="/stock" style={{ color: 'var(--ink)' }}>
                                  {o.stockItem.name}
                                </Link>
                                {o.stockItem.level !== 'OK' && (
                                  <div className="sub strong" style={{ color: o.stockItem.level === 'OUT' ? 'var(--danger)' : 'var(--warn)' }}>
                                    {o.stockItem.level === 'OUT' ? 'Out of stock' : 'Running low'}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="muted">Not linked</span>
                            )}
                          </td>
                          <td data-label="In the builder">
                            <label className="switch-label">
                              <input
                                type="checkbox"
                                role="switch"
                                className="switch"
                                checked={o.available}
                                disabled={o.hiddenBecause === 'OUT_OF_STOCK'}
                                onChange={(e) => void setActive(o, e.target.checked)}
                              />
                              {o.hiddenBecause === 'OUT_OF_STOCK' ? 'Hidden until restocked' : o.isActive ? 'Shown' : 'Hidden'}
                              <span className="visually-hidden"> {o.name}</span>
                            </label>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <OptionForm
                key={`${group.id}:${editing?.id ?? 'new'}`}
                group={group}
                option={editing}
                stock={stock.data ?? []}
                onDone={(name, created) => {
                  setEditing(null)
                  groups.reload()
                  toast(created ? `${name} added to ${group.name}.` : `${name} saved.`)
                }}
                onCancel={() => setEditing(null)}
                onDelete={() => editing && setDeletingOption(editing)}
              />

              <div style={{ paddingTop: 18, borderTop: '1px solid var(--line)' }}>
                <button type="button" className="btn btn-sm btn-quiet-danger" onClick={() => setDeletingGroup(group)}>
                  Delete the {group.name} group
                </button>
              </div>
            </section>
          )}
        </div>
      )}

      <ConfirmDialog
        open={deletingOption !== null}
        title={`Delete ${deletingOption?.name ?? 'this option'}?`}
        confirmLabel="Delete option"
        tone="danger"
        onClose={() => setDeletingOption(null)}
        onConfirm={async () => {
          if (!deletingOption) return
          await deleteOption(bakery.id, deletingOption.id)
          setEditing(null)
          groups.reload()
          toast(`${deletingOption.name} deleted.`)
        }}
      >
        <p>Customers can't choose it any more. Orders that already have it keep the name and price they were placed with.</p>
        <p className="muted">To take it away for a while instead, switch it off in the table.</p>
      </ConfirmDialog>

      <ConfirmDialog
        open={deletingGroup !== null}
        title={`Delete ${deletingGroup?.name ?? 'this group'}${deletingGroup?.options.length ? ` and its ${deletingGroup.options.length} options` : ''}?`}
        confirmLabel="Delete group"
        tone="danger"
        onClose={() => setDeletingGroup(null)}
        onConfirm={async () => {
          if (!deletingGroup) return
          await deleteOptionGroup(bakery.id, deletingGroup.id)
          setSelectedId(null)
          setEditing(null)
          groups.reload()
          toast(`${deletingGroup.name} deleted.`)
        }}
      >
        <p>It disappears from the cake builder. Orders that already used it keep the choices customers made. You can't undo this.</p>
      </ConfirmDialog>
    </>
  )
}

function OptionForm({
  group,
  option,
  stock,
  onDone,
  onCancel,
  onDelete,
}: {
  group: OptionGroup
  option: BuilderOption | null
  stock: StockItem[]
  onDone: (name: string, created: boolean) => void
  onCancel: () => void
  onDelete: () => void
}) {
  const { bakery } = useBakery()
  const [name, setName] = useState(option?.name ?? '')
  const [price, setPrice] = useState(option ? String(option.price) : '0')
  const [value, setValue] = useState(option?.value ?? (group.kind === 'ICING_COLOUR' ? '#F5B8C9' : group.kind === 'SHAPE' ? 'ROUND' : ''))
  const [serves, setServes] = useState(option?.serves ? String(option.serves) : '')
  const [stockItemId, setStockItemId] = useState(option?.stockItemId ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const singular = group.kind === 'DECORATION' ? 'decoration' : group.name.toLowerCase()

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const amount = Number(price.replaceAll(',', ''))
    if (!name.trim()) return setError('Give the option a name customers will understand')
    if (!Number.isInteger(amount) || amount < 0) return setError('Enter the price as a whole number, or 0')
    if (amount > MAX_AMOUNT) return setError('That price is too large')
    const data: OptionInput = {
      name: name.trim(),
      price: amount,
      value: value.trim() || (group.kind === 'DECORATION' ? name.trim().toLowerCase() : null),
      serves: serves ? Number(serves) : null,
      stockItemId: stockItemId || null,
    }
    setSaving(true)
    setError(null)
    try {
      if (option) await updateOption(bakery.id, option.id, data)
      else await createOption(bakery.id, group.id, data)
      onDone(data.name!, !option)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} className="stack-lg" style={{ paddingTop: 18, borderTop: '1px solid var(--line)' }} noValidate>
      <h3>{option ? `Edit ${option.name}` : `Add a ${singular}`}</h3>
      <div className="row" style={{ alignItems: 'flex-end', gap: 12 }}>
        <div className="field" style={{ flex: '2 1 180px' }}>
          <label htmlFor="o-name">Name customers see</label>
          <input id="o-name" className="input" placeholder={group.kind === 'DECORATION' ? 'For example Chocolate drip' : ''} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field" style={{ flex: '1 1 120px' }}>
          <label htmlFor="o-price">Adds, {bakery.currency}</label>
          <input id="o-price" className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        {group.kind === 'ICING_COLOUR' && (
          <div className="field" style={{ flex: '0 1 120px' }}>
            <label htmlFor="o-colour">Colour</label>
            <input id="o-colour" type="color" className="input" style={{ padding: 4 }} value={value || '#F5B8C9'} onChange={(e) => setValue(e.target.value.toUpperCase())} />
          </div>
        )}
        {group.kind === 'SHAPE' && (
          <div className="field" style={{ flex: '1 1 140px' }}>
            <label htmlFor="o-shape">Drawn as</label>
            <select id="o-shape" value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="ROUND">Round</option>
              <option value="SQUARE">Square</option>
            </select>
          </div>
        )}
        {group.kind === 'TIERS' && (
          <div className="field" style={{ flex: '0 1 120px' }}>
            <label htmlFor="o-tiers">Number of tiers</label>
            <input id="o-tiers" className="input" inputMode="numeric" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
        )}
        {group.kind === 'SIZE' && (
          <div className="field" style={{ flex: '0 1 120px' }}>
            <label htmlFor="o-serves">Serves about</label>
            <input id="o-serves" className="input" inputMode="numeric" value={serves} onChange={(e) => setServes(e.target.value)} />
          </div>
        )}
        <div className="field" style={{ flex: '2 1 180px' }}>
          <label htmlFor="o-stock">
            Uses stock <span className="optional">· optional</span>
          </label>
          <select id="o-stock" value={stockItemId} onChange={(e) => setStockItemId(e.target.value)}>
            <option value="">None</option>
            {stock.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : option ? 'Save option' : 'Add'}
        </button>
        {option && (
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
        )}
        {option && (
          <button type="button" className="btn btn-quiet-danger" onClick={onDelete}>
            Delete option
          </button>
        )}
      </div>
    </form>
  )
}

function AddGroupForm({ onAdded }: { onAdded: (g: OptionGroup) => void }) {
  const { bakery } = useBakery()
  const [open, setOpen] = useState(false)
  const [kind, setKind] = useState<OptionKind>('OTHER')
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  if (!open) {
    return (
      <button type="button" className="btn btn-quiet" style={{ justifyContent: 'flex-start' }} onClick={() => setOpen(true)}>
        Add a group
      </button>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Name the group, for example Fillings')
    try {
      onAdded(await createOptionGroup(bakery.id, { kind, name: name.trim(), multiple: kind === 'DECORATION' }))
      setOpen(false)
      setName('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  return (
    <form onSubmit={submit} className="stack" style={{ paddingTop: 12, marginTop: 8, borderTop: '1px solid var(--line)' }}>
      <div className="field">
        <label htmlFor="g-name">Group name</label>
        <input id="g-name" className="input" placeholder="For example Fillings" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="g-kind">Shown in the preview as</label>
        <select id="g-kind" value={kind} onChange={(e) => setKind(e.target.value as OptionKind)}>
          {(Object.keys(KIND_LABELS) as OptionKind[]).map((k) => (
            <option key={k} value={k}>
              {KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="form-error">{error}</p>}
      <div className="row">
        <button type="submit" className="btn btn-sm btn-primary">
          Add group
        </button>
        <button type="button" className="btn btn-sm btn-outline" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  )
}
