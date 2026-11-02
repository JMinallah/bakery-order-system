import { api, send } from './client'

export type BakeryApplicationInput = {
  bakeryName: string
  contactName: string
  email: string
  phone: string
  city: string
  notes?: string
}

export type BakeryApplicationReceipt = {
  id: string
  status: 'PENDING'
  createdAt: string
}

export type BakeryApplicationStatus = BakeryApplicationReceipt['status'] | 'CONTACTED' | 'APPROVED' | 'DECLINED'

export type BakeryApplication = {
  id: string
  bakeryName: string
  contactName: string
  email: string
  phone: string
  city: string
  notes: string | null
  status: BakeryApplicationStatus
  createdAt: string
  updatedAt: string
  bakery: { id: string; name: string; slug: string; isPublished: boolean; isActive: boolean } | null
  // Set once the bakery exists: whether the applicant has become its owner yet.
  owner: OwnerStatus | null
}

export type OwnerStatus = 'LINKED' | 'INVITED' | 'NONE'

export interface OnboardResult {
  bakery: { id: string; name: string; slug: string }
  owner: OwnerStatus
  // CREATED: a Firebase account was made, so send the set-a-password email.
  // EXISTING: they already have an account. UNAVAILABLE: Firebase isn't set up.
  account: 'CREATED' | 'EXISTING' | 'UNAVAILABLE'
}

export const submitBakeryApplication = (data: BakeryApplicationInput) =>
  send<BakeryApplicationReceipt>('POST', '/bakery-applications', data)

export const listBakeryApplications = () => api<BakeryApplication[]>('/bakery-applications')

export const updateBakeryApplicationStatus = (id: string, status: Exclude<BakeryApplicationStatus, 'APPROVED'>) =>
  send<BakeryApplication>('PATCH', `/bakery-applications/${id}`, { status })

export const onboardBakeryApplication = (id: string) => send<OnboardResult>('POST', `/bakery-applications/${id}/onboard`)
