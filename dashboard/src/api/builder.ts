import type { BuilderOption, OptionGroup, OptionKind } from '../types/api'
import { api, send } from './client'

export const listOptionGroups = (bakeryId: string) => api<OptionGroup[]>(`/bakeries/${bakeryId}/option-groups`)

export const createOptionGroup = (bakeryId: string, data: { kind: OptionKind; name: string; multiple?: boolean; required?: boolean }) =>
  send<OptionGroup>('POST', `/bakeries/${bakeryId}/option-groups`, data)

export const updateOptionGroup = (bakeryId: string, groupId: string, data: Partial<Pick<OptionGroup, 'name' | 'multiple' | 'required'>>) =>
  send<OptionGroup>('PATCH', `/bakeries/${bakeryId}/option-groups/${groupId}`, data)

export type OptionInput = Partial<Pick<BuilderOption, 'name' | 'price' | 'value' | 'serves' | 'isActive' | 'stockItemId'>>

export const createOption = (bakeryId: string, groupId: string, data: OptionInput) =>
  send<BuilderOption>('POST', `/bakeries/${bakeryId}/option-groups/${groupId}/options`, data)

export const updateOption = (bakeryId: string, optionId: string, data: OptionInput) =>
  send<BuilderOption>('PATCH', `/bakeries/${bakeryId}/options/${optionId}`, data)

export const deleteOptionGroup = (bakeryId: string, groupId: string) =>
  send<null>('DELETE', `/bakeries/${bakeryId}/option-groups/${groupId}`)

export const deleteOption = (bakeryId: string, optionId: string) => send<null>('DELETE', `/bakeries/${bakeryId}/options/${optionId}`)
