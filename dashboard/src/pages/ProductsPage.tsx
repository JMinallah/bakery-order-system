import { useState, type FormEvent } from 'react'
import { createProduct, listProducts, updateProduct, type ProductInput } from '../api/products'
import { PhotoField } from '../components/PhotoField'
import { useBakery } from '../context/bakery-context'
import { useToast } from '../context/toast-context'
import { useAsync } from '../hooks/useAsync'
import { formatMoney, MAX_AMOUNT } from '../lib/format'
import { resolveImageUrl } from '../lib/image'
import { PRODUCT_CATEGORIES, type Product, type ProductCategory } from '../types/api'

const CATEGORY_LABELS: Record<ProductCategory, string> = {
  CAKE: 'Cakes',
  CUPCAKE: 'Cupcakes',
  BREAD: 'Bread',
  PASTRY: 'Pastries',
  COOKIE: 'Cookies',
  EXTRA: 'Extras',
}

export function ProductsPage() {
  const { bakery } = useBakery()
  const toast = useToast()
  const { data: products, error, loading, setData, reload } = useAsync(() => listProducts(bakery.id), [bakery.id])
  const [tab, setTab] = useState<ProductCategory | 'ALL'>('ALL')
  const [editing, setEditing] = useState<Product | null>(null)

  const all = products ?? []
  const shown = tab === 'ALL' ? all : all.filter((p) => p.category === tab)
  const categories = PRODUCT_CATEGORIES.filter((c) => all.some((p) => p.category === c))

  const replace = (product: Product) => setData(all.map((p) => (p.id === product.id ? product : p)))

  const setActive = async (product: Product, isActive: boolean) => {
    replace({ ...product, isActive })
    try {
      replace(await updateProduct(bakery.id, product.id, { isActive }))
      toast(isActive ? `${product.name} is back in the app.` : `${product.name} is hidden from the app.`, {
        action: { label: 'Undo', onClick: () => void setActive(product, !isActive) },
      })
    } catch (e) {
      replace(product)
      toast((e as Error).message, { tone: 'error' })
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="stack">
          <h1>Products</h1>
          <p>What customers see on your bakery page. Hidden products stay on past orders.</p>
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Categories">
        <button type="button" role="tab" aria-selected={tab === 'ALL'} onClick={() => setTab('ALL')}>
          All <span className="count">{all.length}</span>
        </button>
        {categories.map((c) => (
          <button key={c} type="button" role="tab" aria-selected={tab === c} onClick={() => setTab(c)}>
            {CATEGORY_LABELS[c]} <span className="count">{all.filter((p) => p.category === c).length}</span>
          </button>
        ))}
      </div>

      <div className="split">
        <div className="split-main">
          {error && <p className="form-error">{error}</p>}
          {loading && !products && <p className="loading">Loading products…</p>}
          {products && shown.length === 0 && (
            <div className="empty">
              <h2>No products yet</h2>
              <p>Add your first product with the form. It shows in the app straight away.</p>
            </div>
          )}
          {shown.length > 0 && (
            <div className="table-wrap">
              <table className="table table-stack" style={{ minWidth: 600 }}>
                <thead>
                  <tr>
                    <th scope="col">Product</th>
                    <th scope="col">Category</th>
                    <th scope="col" className="right">
                      Price
                    </th>
                    <th scope="col">Cake builder</th>
                    <th scope="col">In app</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((p) => (
                    <tr key={p.id} className={p.isActive ? undefined : 'row-muted'}>
                      <td data-label="Product">
                        <div className="row" style={{ gap: 12, flexWrap: 'nowrap' }}>
                          {p.imageUrl ? (
                            <img src={resolveImageUrl(p.imageUrl)} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 10, flexShrink: 0 }} />
                          ) : (
                            <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 10, background: 'var(--sand)', flexShrink: 0 }} />
                          )}
                          <div>
                        <button type="button" className="link-button" onClick={() => setEditing(p)}>
                          {p.name}
                        </button>
                        <div className="sub">{[p.sizeLabel, p.description].filter(Boolean).join(' · ') || 'No description'}</div>
                          </div>
                        </div>
                      </td>
                      <td data-label="Category">{CATEGORY_LABELS[p.category]}</td>
                      <td data-label="Price" className="right nowrap">{formatMoney(p.price, bakery.currency)}</td>
                      <td data-label="Cake builder" className="muted">{p.category !== 'CAKE' ? 'Not available yet' : p.customisable ? 'Can be customised' : 'Sold as it is'}</td>
                      <td data-label="In app">
                        <label className="switch-label">
                          <input type="checkbox" role="switch" className="switch" checked={p.isActive} onChange={(e) => void setActive(p, e.target.checked)} />
                          {p.isActive ? 'Shown' : 'Hidden'}
                          <span className="visually-hidden"> {p.name}</span>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="split-side">
          <ProductForm
            key={editing?.id ?? 'new'}
            product={editing}
            onDone={(saved, created) => {
              setEditing(null)
              reload()
              toast(created ? `${saved.name} added. It now shows in the app.` : `${saved.name} saved.`)
            }}
            onCancel={() => setEditing(null)}
          />
        </div>
      </div>
    </>
  )
}

function ProductForm({ product, onDone, onCancel }: { product: Product | null; onDone: (p: Product, created: boolean) => void; onCancel: () => void }) {
  const { bakery } = useBakery()
  const [form, setForm] = useState({
    name: product?.name ?? '',
    category: product?.category ?? ('CAKE' as ProductCategory),
    price: product ? String(product.price) : '',
    sizeLabel: product?.sizeLabel ?? '',
    serves: product?.serves ? String(product.serves) : '',
    leadTimeDays: String(product?.leadTimeDays ?? 1),
    customisable: product?.customisable ?? true,
    description: product?.description ?? '',
    imageUrl: product?.imageUrl ?? null,
  })
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const price = Number(form.price.replaceAll(',', ''))
    const lead = Number(form.leadTimeDays)
    if (!form.name.trim()) return setError('Give the product a name')
    if (!Number.isInteger(price) || price < 0) return setError('Enter the price as a whole number')
    if (price > MAX_AMOUNT) return setError('That price is too large')
    if (!Number.isInteger(lead) || lead < 0) return setError('Days needed must be a whole number')
    const data: Partial<ProductInput> = {
      name: form.name.trim(),
      category: form.category,
      price,
      sizeLabel: form.sizeLabel.trim() || null,
      serves: form.serves ? Number(form.serves) : null,
      leadTimeDays: lead,
      customisable: form.category === 'CAKE' && form.customisable,
      description: form.description.trim() || null,
      imageUrl: form.imageUrl,
    }
    setSaving(true)
    setError(null)
    try {
      onDone(product ? await updateProduct(bakery.id, product.id, data) : await createProduct(bakery.id, data), !product)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="panel" onSubmit={submit} noValidate>
      <h2>{product ? `Edit ${product.name}` : 'Add a product'}</h2>
      <div className="field">
        <label htmlFor="p-name">Name</label>
        <input id="p-name" className="input" placeholder="For example Lemon drizzle cake" value={form.name} onChange={(e) => set('name', e.target.value)} />
      </div>
      <div className="grid-2">
        <div className="field">
          <label htmlFor="p-category">Category</label>
          <select id="p-category" value={form.category} onChange={(e) => set('category', e.target.value as ProductCategory)}>
            {PRODUCT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="p-price">Price, {bakery.currency}</label>
          <input id="p-price" className="input" inputMode="numeric" placeholder="0" value={form.price} onChange={(e) => set('price', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="p-size">
            Size <span className="optional">· optional</span>
          </label>
          <input id="p-size" className="input" placeholder="For example 1 kg" value={form.sizeLabel} onChange={(e) => set('sizeLabel', e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="p-serves">
            Serves <span className="optional">· optional</span>
          </label>
          <input id="p-serves" className="input" inputMode="numeric" value={form.serves} onChange={(e) => set('serves', e.target.value)} />
        </div>
      </div>
      <div className="field">
        <label htmlFor="p-lead">Days needed to make it</label>
        <input id="p-lead" className="input" inputMode="numeric" value={form.leadTimeDays} onChange={(e) => set('leadTimeDays', e.target.value)} aria-describedby="p-lead-hint" />
        <span id="p-lead-hint" className="hint">
          Customers can't pick a date sooner than this.
        </span>
      </div>
      {form.category === 'CAKE' && (
        <label className="check">
          <input type="checkbox" checked={form.customisable} onChange={(e) => set('customisable', e.target.checked)} />
          <span>
            Customers can change it in the cake builder
            <br />
            <span className="hint">Uses your builder options and prices.</span>
          </span>
        </label>
      )}
      <div className="field">
        <label htmlFor="p-desc">
          Description <span className="optional">· optional</span>
        </label>
        <textarea id="p-desc" rows={2} placeholder="Icing, filling, anything customers should know" value={form.description} onChange={(e) => set('description', e.target.value)} />
      </div>
      <PhotoField label="Photo customers see" value={form.imageUrl} onChange={(url) => set('imageUrl', url)} />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="row">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : product ? 'Save changes' : 'Add product'}
        </button>
        {product && (
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
