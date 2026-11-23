import { client } from './client'

// Billing（docs/backend.md の2章）：プラン・購入（docs/api/07-paid-members.md）

type PlanResponse = {
  id: number
  name: string
  months: number
  price: number
  created_at: string
  updated_at: string
}

type PurchaseResponse = {
  name: string
  months: number
  price: number
  bought_at: string
}

export const billingApi = {
  // API の形のまま（レガシー版の画面が読む。移すときに画面の形にする）
  // プランの一覧。男性でなければ 403
  plans: async (): Promise<PlanResponse[]> => {
    const { data } = await client.get<PlanResponse[]>('/api/plans')
    return data
  },

  // API の形のまま（レガシー版の画面が読む。移すときに画面の形にする）
  purchases: async (): Promise<PurchaseResponse[]> => {
    const { data } = await client.get<PurchaseResponse[]>('/api/me/purchases')
    return data
  },

  purchase: async (planId: number): Promise<void> => {
    await client.post('/api/me/purchases', { plan_id: planId })
  },
}
