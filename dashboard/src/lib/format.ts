// The API refuses amounts above this, matching MAX_AMOUNT in backend/src/lib/validation.ts.
export const MAX_AMOUNT = 1_000_000_000

// "UGX 165,000". Amounts are whole units of the bakery's currency.
export const formatMoney = (amount: number | null | undefined, currency: string) =>
  amount == null ? 'Not set' : `${currency} ${amount.toLocaleString('en-US')}`

// "DEPOSIT_PAID" -> "Deposit paid"
export const humanize = (value: string) => value.charAt(0) + value.slice(1).toLowerCase().replaceAll('_', ' ')

const dateFormats = new Map<string, Intl.DateTimeFormat>()
function cached(key: string, make: () => Intl.DateTimeFormat) {
  let format = dateFormats.get(key)
  if (!format) {
    format = make()
    dateFormats.set(key, format)
  }
  return format
}

// "Sat 7 Nov", shown in the bakery's timezone so staff see the same day as customers.
export const formatDay = (iso: string, timeZone: string) =>
  cached(`day:${timeZone}`, () => new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short' })).format(new Date(iso))

// "2:00 pm"
export const formatTime = (iso: string, timeZone: string) =>
  cached(`time:${timeZone}`, () => new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', minute: '2-digit' }))
    .format(new Date(iso))
    .toLowerCase()

// "Wed 14 Oct, 10:05 am"
export const formatDateTime = (iso: string, timeZone: string) => `${formatDay(iso, timeZone)}, ${formatTime(iso, timeZone)}`

// "YYYY-MM-DD" for the instant in the given timezone.
export const dayKey = (date: Date, timeZone: string) =>
  cached(`key:${timeZone}`, () => new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })).format(date)

const keyToUtc = (key: string) => new Date(`${key}T00:00:00Z`)

export function addDays(key: string, days: number) {
  const date = keyToUtc(key)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export const daysBetween = (from: string, to: string) => Math.round((keyToUtc(to).getTime() - keyToUtc(from).getTime()) / 86_400_000)

// 1 is Monday, 7 is Sunday.
export function isoWeekday(key: string) {
  const day = keyToUtc(key).getUTCDay()
  return day === 0 ? 7 : day
}

export const mondayOf = (key: string) => addDays(key, 1 - isoWeekday(key))

// "Sat 7 Nov" for a YYYY-MM-DD key.
export const formatDayKey = (key: string) => formatDay(`${key}T12:00:00Z`, 'UTC')

// "Today", "Tomorrow", "In 3 days", "2 days late", or empty when it's a while away.
export function dueHint(iso: string, timeZone: string, now = new Date()) {
  const days = daysBetween(dayKey(now, timeZone), dayKey(new Date(iso), timeZone))
  if (days < 0) return days === -1 ? '1 day late' : `${-days} days late`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days <= 6) return `In ${days} days`
  return ''
}

export const orderRef = (order: { number: number }) => `BK${order.number}`
