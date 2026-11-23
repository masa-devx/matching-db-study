import { client } from './client'

// Members（docs/backend.md の2章）：会員の検索・保存した検索条件・通報・お知らせ

// GET /api/users の1件（docs/api/04-search.md）
type SearchedMemberResponse = {
  id: number
  public_id: string
  created_at: string
  last_login_at: string | null
  is_paid: boolean
  profile: {
    nickname: string | null
    gender: string | null
    birthday: string | null
    prefecture: string | null
    image: string | null
  } | null
}

// 保存した検索条件（docs/api/04b-saved-searches.md）。条件は、検索の条件の画面が送ったまま
type SearchConditionResponse = {
  id: number
  public_id: string
  user_id: number
  name: string
  conditions: Record<string, unknown>
  created_at: string
  updated_at: string
}

// 保存した検索条件を直すとき（名前だけ・条件だけ）
type SearchConditionUpdate = { name: string } | { conditions: Record<string, unknown> }

// 通報（POST /api/me/reports。docs/api/m7-reports.md）
type ReportInput = {
  user_id: string
  message_id?: number
  reason: string
  detail: string | null
  block: boolean
}

// 運営からのお知らせ（GET /api/me/notices）
type NoticeResponse = {
  id: string
  kind: string
  title: string
  body: string
  read_at: string | null
  created_at: string
}

export const membersApi = {
  // API の形のまま（レガシー版の画面が読む。移すときに画面の形にする）
  // 会員を探す。条件は検索の画面が作ったクエリのまま
  search: async (query: URLSearchParams): Promise<SearchedMemberResponse[]> => {
    const { data } = await client.get<SearchedMemberResponse[]>(`/api/users?${query}`)
    return data
  },

  // API の形のまま（レガシー版の画面が読む。移すときに画面の形にする）
  searchConditions: async (): Promise<SearchConditionResponse[]> => {
    const { data } = await client.get<SearchConditionResponse[]>('/api/me/search-conditions')
    return data
  },

  createSearchCondition: async (name: string, conditions: Record<string, unknown>): Promise<void> => {
    await client.post('/api/me/search-conditions', { name, conditions })
  },

  updateSearchCondition: async (publicId: string, update: SearchConditionUpdate): Promise<void> => {
    await client.put(`/api/me/search-conditions/${publicId}`, update)
  },

  deleteSearchCondition: async (publicId: string): Promise<void> => {
    await client.delete(`/api/me/search-conditions/${publicId}`)
  },

  report: async (input: ReportInput): Promise<void> => {
    await client.post('/api/me/reports', input)
  },

  // API の形のまま（レガシー版の画面が読む。移すときに画面の形にする）
  notices: async (): Promise<NoticeResponse[]> => {
    const { data } = await client.get<NoticeResponse[]>('/api/me/notices')
    return data
  },

  readNotice: async (noticeId: string): Promise<void> => {
    await client.post(`/api/me/notices/${noticeId}/read`)
  },
}
