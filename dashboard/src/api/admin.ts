import type { AddMemberResult } from '../types/api'
import { api, send } from './client'

export type AdminOverview = {
  totalBakeries: number
  activeBakeries: number
  suspendedBakeries: number
  pendingApplications: number
  totalUsers: number
  totalOrders: number
}

export type PlatformBakery = {
  id: string
  slug: string
  name: string
  city: string
  phone: string | null
  address: string | null
  isActive: boolean
  isPublished: boolean
  createdAt: string
  openOrders: number
  owners: number
  _count: {
    members: number
    products: number
    orders: number
    invites: number
  }
}

export type PlatformUser = {
  id: string
  email: string | null
  name: string | null
  phone: string | null
  role: 'ADMIN' | 'CUSTOMER'
  createdAt: string
  _count: {
    memberships: number
    orders: number
  }
}

export const getAdminOverview = () => api<AdminOverview>('/admin/overview')

export const listPlatformBakeries = () => api<PlatformBakery[]>('/admin/bakeries')

export const updateBakeryStatus = (bakeryId: string, isActive: boolean) =>
  send<PlatformBakery>('PATCH', `/admin/bakeries/${bakeryId}/status`, { isActive })

export const listPlatformUsers = () => api<PlatformUser[]>('/admin/users')

export const updateUserRole = (userId: string, role: 'ADMIN' | 'CUSTOMER') =>
  send<PlatformUser>('PATCH', `/admin/users/${userId}/role`, { role })

export const assignBakeryOwner = (bakeryId: string, email: string) =>
  send<AddMemberResult>('POST', `/admin/bakeries/${bakeryId}/owner`, { email })
