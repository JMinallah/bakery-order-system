import type { AddMemberResult, BakerySettings, BlockedDate, CalendarDay, Invite, Me, Member, MemberRole } from '../types/api'
import { api, query, send } from './client'

export const getMe = () => api<Me>('/users/me')

export const getSettings = (bakeryId: string) => api<BakerySettings>(`/bakeries/${bakeryId}/settings`)

export type SettingsUpdate = Partial<
  Omit<BakerySettings, 'id' | 'slug' | 'country' | 'currency' | 'timezone' | 'isPublished' | 'isActive' | 'publishProblems'>
>

export const updateSettings = (bakeryId: string, data: SettingsUpdate) =>
  send<BakerySettings>('PATCH', `/bakeries/${bakeryId}`, data)

export const getAvailability = (bakeryId: string, from: string, days: number) =>
  api<CalendarDay[]>(`/bakeries/${bakeryId}/availability${query({ from, days })}`)

export const listBlockedDates = (bakeryId: string) => api<BlockedDate[]>(`/bakeries/${bakeryId}/blocked-dates`)

export const blockDate = (bakeryId: string, date: string, reason?: string) =>
  send<BlockedDate>('POST', `/bakeries/${bakeryId}/blocked-dates`, { date, reason: reason || undefined })

export const unblockDate = (bakeryId: string, blockedDateId: string) =>
  send<null>('DELETE', `/bakeries/${bakeryId}/blocked-dates/${blockedDateId}`)

export const listMembers = (bakeryId: string) => api<Member[]>(`/bakeries/${bakeryId}/members`)

// Publishing refuses with the list of what's missing while publishProblems isn't empty.
export const setPublished = (bakeryId: string, published: boolean) =>
  send<BakerySettings>('POST', `/bakeries/${bakeryId}/${published ? 'publish' : 'unpublish'}`)

export const addMember = (bakeryId: string, email: string, role: MemberRole) =>
  send<AddMemberResult>('POST', `/bakeries/${bakeryId}/members`, { email, role })

export const changeMemberRole = (bakeryId: string, memberId: string, role: MemberRole) =>
  send<Member>('PATCH', `/bakeries/${bakeryId}/members/${memberId}`, { role })

export const listInvites = (bakeryId: string) => api<Invite[]>(`/bakeries/${bakeryId}/invites`)

export const cancelInvite = (bakeryId: string, inviteId: string) =>
  send<null>('DELETE', `/bakeries/${bakeryId}/invites/${inviteId}`)

export const removeMember = (bakeryId: string, memberId: string) =>
  send<null>('DELETE', `/bakeries/${bakeryId}/members/${memberId}`)
