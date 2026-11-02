import { describe, expect, it } from 'vitest'
import { addDays, dayKey, dueHint, formatDay, formatMoney, formatTime, mondayOf } from './format'
import { canRecordPayment, needsAttention, nextAction, orderTitle, quoteExpiresAt, stepsFor, waitingFor } from './order-flow'

const TZ = 'Africa/Kampala'

describe('format', () => {
  it('writes money the way the designs do', () => {
    expect(formatMoney(165000, 'UGX')).toBe('UGX 165,000')
    expect(formatMoney(null, 'UGX')).toBe('Not set')
  })

  it("shows times in the bakery's timezone", () => {
    // 11:00 UTC is 2:00 pm in Kampala.
    expect(formatDay('2026-11-07T11:00:00Z', TZ)).toBe('Sat 7 Nov')
    expect(formatTime('2026-11-07T11:00:00Z', TZ)).toBe('2:00 pm')
    expect(dayKey(new Date('2026-11-06T21:30:00Z'), TZ)).toBe('2026-11-07')
  })

  it('finds the Monday of a week and moves across months', () => {
    expect(mondayOf('2026-11-01')).toBe('2026-10-26') // a Sunday
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02')
  })

  it('says how soon an order is due', () => {
    const now = new Date('2026-10-16T09:00:00+03:00')
    expect(dueHint('2026-10-16T15:00:00+03:00', TZ, now)).toBe('Today')
    expect(dueHint('2026-10-17T10:00:00+03:00', TZ, now)).toBe('Tomorrow')
    expect(dueHint('2026-10-19T10:00:00+03:00', TZ, now)).toBe('In 3 days')
    expect(dueHint('2026-10-14T10:00:00+03:00', TZ, now)).toBe('2 days late')
    expect(dueHint('2026-11-07T10:00:00+03:00', TZ, now)).toBe('')
  })
})

describe('order flow', () => {
  it('skips the quote step for ready made orders', () => {
    expect(stepsFor('STANDARD')).not.toContain('QUOTED')
    expect(stepsFor('CUSTOM')).toContain('QUOTED')
  })

  it('offers the right next button', () => {
    expect(nextAction({ status: 'SUBMITTED', type: 'STANDARD', fulfilment: 'PICKUP' })?.status).toBe('CONFIRMED')
    expect(nextAction({ status: 'SUBMITTED', type: 'CUSTOM', fulfilment: 'PICKUP' })).toBeNull()
    expect(nextAction({ status: 'QUOTED', type: 'CUSTOM', fulfilment: 'PICKUP' })).toBeNull()
    expect(nextAction({ status: 'READY', type: 'CUSTOM', fulfilment: 'PICKUP' })?.label).toBe('Mark as collected')
    expect(nextAction({ status: 'READY', type: 'CUSTOM', fulfilment: 'DELIVERY' })?.label).toBe('Mark as delivered')
    expect(nextAction({ status: 'COMPLETED', type: 'CUSTOM', fulfilment: 'DELIVERY' })).toBeNull()
  })

  it('says who the order is waiting for', () => {
    expect(waitingFor({ status: 'SUBMITTED', type: 'CUSTOM' })).toBe('Needs a quote')
    expect(waitingFor({ status: 'QUOTED', type: 'CUSTOM' })).toBe('Waiting for the customer')
    expect(waitingFor({ status: 'PREPARING', type: 'CUSTOM' })).toBe('')
  })

  it('takes deposits from the moment a quote is sent', () => {
    expect(canRecordPayment('SUBMITTED')).toBe(false)
    expect(canRecordPayment('QUOTED')).toBe(true)
    expect(canRecordPayment('CONFIRMED')).toBe(true)
    expect(canRecordPayment('CANCELLED')).toBe(false)
  })

  it('works out when an unanswered quote expires', () => {
    expect(quoteExpiresAt('2026-11-01T10:00:00Z', 7).toISOString()).toBe('2026-11-08T10:00:00.000Z')
  })

  it('flags orders due soon that nobody touched', () => {
    const now = new Date('2026-10-16T09:00:00Z').getTime()
    const base = { status: 'SUBMITTED' as const, dueDate: '2026-10-17T09:00:00Z', updatedAt: '2026-10-14T09:00:00Z' }
    expect(needsAttention(base, now)).toBe(true)
    expect(needsAttention({ ...base, updatedAt: '2026-10-16T08:00:00Z' }, now)).toBe(false)
    expect(needsAttention({ ...base, status: 'READY' }, now)).toBe(false)
  })

  it('names orders', () => {
    const product = (name: string) => ({ id: name, quantity: 1, unitPrice: 0, product: { id: name, name } })
    expect(orderTitle({ occasion: 'Birthday', items: [], type: 'CUSTOM' })).toBe('Birthday cake')
    expect(orderTitle({ occasion: null, items: [product('Red velvet cake')], type: 'STANDARD' })).toBe('Red velvet cake')
    expect(orderTitle({ occasion: null, items: [], type: 'BULK' })).toBe('Bulk order')
  })
})
