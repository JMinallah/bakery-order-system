// Mirrors docs/api.md. Update both together.

export type MemberRole = 'OWNER' | 'STAFF'
export type ProductCategory = 'CAKE' | 'CUPCAKE' | 'BREAD' | 'PASTRY' | 'COOKIE' | 'EXTRA'
export type OptionKind = 'SHAPE' | 'TIERS' | 'SIZE' | 'FLAVOUR' | 'ICING_COLOUR' | 'DECORATION' | 'OTHER'
export type OrderType = 'STANDARD' | 'CUSTOM' | 'BULK'
export type OrderStatus = 'SUBMITTED' | 'QUOTED' | 'CONFIRMED' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED'
export type Fulfilment = 'PICKUP' | 'DELIVERY'
export type PaymentStatus = 'UNPAID' | 'DEPOSIT_PAID' | 'PAID'
export type PaymentMethod = 'CASH' | 'MOBILE_MONEY'
export type DayStatus = 'OPEN' | 'FULL' | 'CLOSED' | 'BLOCKED' | 'TOO_SOON'
export type StockLevel = 'OK' | 'LOW' | 'OUT'

export const ORDER_STATUSES: OrderStatus[] = ['SUBMITTED', 'QUOTED', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED', 'CANCELLED']
export const PRODUCT_CATEGORIES: ProductCategory[] = ['CAKE', 'CUPCAKE', 'BREAD', 'PASTRY', 'COOKIE', 'EXTRA']

export interface Me {
  id: string
  email: string | null
  emailVerified: boolean
  name: string | null
  phone: string | null
  role: 'CUSTOMER' | 'ADMIN'
  bakeries: { id: string; slug: string; name: string; memberRole: MemberRole }[]
}

// GET /bakeries/:id/settings
export interface BakerySettings {
  id: string
  slug: string
  name: string
  about: string | null
  phone: string | null
  address: string | null
  city: string
  country: string
  currency: string
  timezone: string
  imageUrl: string | null
  deliveryAreas: string[]
  deliveryFee: number
  pickupAvailable: boolean
  acceptsCash: boolean
  acceptsMobileMoney: boolean
  mobileMoneyNumber: string | null
  customCakesPerDay: number
  customNoticeDays: number
  closedWeekdays: number[]
  handoverTimes: string[]
  occasions: string[]
  quoteExpiryDays: number
  // Hidden from customers until the owner publishes it.
  isPublished: boolean
  // False while a platform admin has suspended the bakery.
  isActive: boolean
  // What still stops the bakery being published. Empty when it's ready.
  publishProblems: string[]
}

export interface Member {
  id: string
  role: MemberRole
  createdAt: string
  user: { id: string; name: string | null; email: string | null }
}

// Someone asked to join who hasn't signed in with that email verified yet.
export interface Invite {
  id: string
  email: string
  role: MemberRole
  createdAt: string
}

// POST /bakeries/:id/members
export type AddMemberResult = { status: 'ADDED'; member: Member } | { status: 'INVITED'; invite: Invite }

export interface BlockedDate {
  id: string
  date: string
  reason: string | null
}

export interface CalendarDay {
  date: string
  status: DayStatus
  booked: number
  limit: number
}

export interface Product {
  id: string
  bakeryId: string
  name: string
  description: string | null
  category: ProductCategory
  price: number
  imageUrl: string | null
  sizeLabel: string | null
  serves: number | null
  leadTimeDays: number
  customisable: boolean
  isActive: boolean
}

export interface StockItem {
  id: string
  name: string
  unit: string
  quantity: number
  lowAt: number | null
  level: StockLevel
  options: { id: string; name: string; isActive: boolean }[]
}

export interface BuilderOption {
  id: string
  groupId: string
  name: string
  price: number
  value: string | null
  serves: number | null
  imageUrl: string | null
  isActive: boolean
  position: number
  stockItemId: string | null
  available: boolean
  hiddenBecause: 'SWITCHED_OFF' | 'OUT_OF_STOCK' | null
  stockItem: { id: string; name: string; quantity: number; lowAt: number | null; unit: string; level: StockLevel } | null
}

export interface OptionGroup {
  id: string
  category: ProductCategory
  kind: OptionKind
  name: string
  multiple: boolean
  required: boolean
  position: number
  options: BuilderOption[]
}

export interface Quotation {
  id: string
  amount: number
  note: string | null
  acceptedAt: string | null
  createdAt: string
}

export interface Payment {
  id: string
  amount: number
  method: PaymentMethod
  note: string | null
  createdAt: string
  recordedBy: { id: string; name: string | null }
}

export interface OrderComment {
  id: string
  body: string
  fromBakery: boolean
  createdAt: string
  author: { id: string; name: string | null }
}

export interface OrderSelection {
  id: string
  optionId: string | null
  groupName: string
  optionName: string
  value: string | null
  price: number
}

export interface Customer {
  id: string
  name: string | null
  phone: string | null
  email: string | null
}

// The fields every order response has (lists and detail).
export interface OrderBase {
  id: string
  number: number
  bakeryId: string
  type: OrderType
  status: OrderStatus
  currency: string
  occasion: string | null
  flavour: string | null
  icing: string | null
  size: string | null
  colours: string | null
  theme: string | null
  inscription: string | null
  notes: string | null
  budget: number | null
  estimate: number | null
  total: number | null
  designImageUrl: string | null
  dueDate: string
  fulfilment: Fulfilment
  deliveryArea: string | null
  deliveryAddress: string | null
  deliveryFee: number
  paymentStatus: PaymentStatus
  amountPaid: number
  cancelledBy: 'CUSTOMER' | 'BAKERY' | 'SYSTEM' | null
  cancelReason: string | null
  createdAt: string
  updatedAt: string
  customer: Customer
  items: { id: string; quantity: number; unitPrice: number; product: { id: string; name: string } }[]
}

// GET /bakeries/:id/orders
export interface OrderSummary extends OrderBase {
  quotations: Quotation[]
}

// GET /orders/:id
export interface Order extends OrderBase {
  selections: OrderSelection[]
  images: { id: string; url: string }[]
  quotations: Quotation[]
  payments: Payment[]
  comments: OrderComment[]
}

export interface OrdersSummary {
  counts: Partial<Record<OrderStatus, number>>
  needsAttention: number
}
