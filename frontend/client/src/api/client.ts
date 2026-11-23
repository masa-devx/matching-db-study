// API を呼ぶ axios のインスタンス（axios.create() で作ったもの。architecture-frontend.md の2章・4章）。axios を読めるのは、このファイルだけ。
// 送り先（VITE_API_URL）を読み、セッションの Cookie と CSRF のトークンを付けるのも、ここだけ（Sanctum の SPA 認証。D-027）。
// 画面はトークンを持たない。ログインしているかは、ブラウザが自動で付ける HttpOnly の Cookie で、API が決める。
// 前は shared/api/client.ts が fetch を包んでいた。動きは同じにしてある（#292。D-029）

import axios, { type AxiosResponse, type Method } from 'axios'
import { ApiError, EmailUnverifiedError, MaintenanceError, UnauthorizedError } from './ApiError'

declare module 'axios' {
  // biome-ignore lint/style/useConsistentTypeDefinitions: axios の設定の型に宣言を足すため（quality-frontend.md の S3）
  interface AxiosRequestConfig {
    // どの API か。書かなければ、ログインしたあとの API（401・419・503・確認していない 403 で、続きを止める）。
    // 'withoutLogin'：ログイン・登録・メールアドレスの確認・パスワードの再設定と、起動のときの GET /api/me。
    //   パスワードが違うときも 401 が返るので、ログインの画面へは移さず、ApiError を投げる（画面に誤りの文を出す）
    // 'logout'：ログアウト。401 でも移らない（もうログインしていないのと同じなので、自分でしたログアウトとして扱う）
    // 'withoutLogin'・'logout' でも、503 ならメンテナンスの画面を出す（続きは ApiError で止める）
    // 'withoutLogin' と 'logout' は、client.ts の中では同じ動き（呼ぶ理由を読む人に見せるために分けている）
    access?: 'withoutLogin' | 'logout'
    // 419 のあとに1回送り直したか（このファイルの中だけで使う）
    csrfRetried?: boolean
  }
}

// localhost にそろえる（127.0.0.1 と localhost は別のサイトになり、セッションの Cookie が届かないため。#259）
const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// CSRF のトークンを入れる Cookie（Sanctum が GET /sanctum/csrf-cookie で付ける。JavaScript から読める）
const XSRF_COOKIE = 'XSRF-TOKEN'

// ログインが切れた（401・419）ときと、メンテナンス中（503）のときの処理は、app/ が起動のときに渡す。
// src/api は shared/session も画面の移り方も知らない（依存の向き：app → shared/session → src/api）
type ApiClientSettings = {
  // code は、API が 401 に付けた印（アカウント停止なら 'account_suspended'。CSRF のトークンが合わない 419 なら 'csrf'。ほかは null）
  onUnauthorized: (code: string | null) => void
  // メンテナンス中（503）を受けたとき。画面の代わりにメンテナンスの画面を出す（FR-MAINT-006）
  onMaintenance: () => void
}

let settings: ApiClientSettings = {
  onUnauthorized: () => {},
  onMaintenance: () => {},
}

export const configureApiClient = (next: ApiClientSettings): void => {
  settings = next
}

// API が返した画像のパス（/storage/…）を、画面で使える URL にする
export const apiUrl = (path: string): string => {
  return `${API_URL}${path}`
}

// どの API も、セッションの Cookie を付けて送る（withCredentials）。
// axios の xsrf の設定は、Cookie を読むだけで、ないときに先にもらう動きがない。そのため使わず（withXSRFToken: false）、
// 下の interceptor で、書き込みにだけ付ける。
// 応答の本文は JSON として読み、読めなければ失敗にする（responseType: 'json'・silentJSONParsing: false）。
// 書かないと、axios は JSON として読めない本文を、文字のまま data に入れる（前の res.json() は失敗にしていた）。
// 204 などの空の本文は、読まずに空のまま返す（失敗にならない）
export const client = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  withXSRFToken: false,
  headers: { Accept: 'application/json' },
  responseType: 'json',
  transitional: { silentJSONParsing: false },
})

const isWrite = (method: Method | string | undefined): boolean => {
  const upper = (method ?? 'GET').toUpperCase()
  return upper !== 'GET' && upper !== 'HEAD'
}

const readXsrfCookie = (): string | null => {
  const prefix = `${XSRF_COOKIE}=`
  const found = document.cookie.split('; ').find((cookie) => cookie.startsWith(prefix))
  return found === undefined ? null : decodeURIComponent(found.slice(prefix.length))
}

// GET /sanctum/csrf-cookie で、CSRF のトークンの Cookie を付けてもらう。応答の状態コードは見ない（前の fetch と同じ）
const refreshCsrfCookie = async (): Promise<void> => {
  await axios.get(`${API_URL}/sanctum/csrf-cookie`, {
    headers: { Accept: 'application/json' },
    withCredentials: true,
    validateStatus: () => true,
  })
}

// CSRF のトークン。Cookie になければ GET /sanctum/csrf-cookie で付けてもらい、読み直す
const csrfToken = async (): Promise<string | null> => {
  const saved = readXsrfCookie()
  if (saved !== null) return saved
  await refreshCsrfCookie()
  return readXsrfCookie()
}

// 書き込み（GET・HEAD でないもの）には、CSRF のトークンを X-XSRF-TOKEN で付ける。Cookie がまだなければ、先に1回もらう
client.interceptors.request.use(async (config) => {
  if (isWrite(config.method)) {
    config.headers.set('X-XSRF-TOKEN', (await csrfToken()) ?? '')
  }
  return config
})

// 応答の code を読む。JSON でなければ null（401・403 の理由を見分ける）
const codeOf = (body: unknown): string | null => {
  if (typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string') {
    return body.code
  }
  return null
}

const messageOf = (body: unknown): string | null => {
  if (typeof body === 'object' && body !== null && 'message' in body && typeof body.message === 'string') {
    return body.message
  }
  return null
}

// 422 の errors（項目の名前 → 文の配列）。文でないものは捨てる
const errorsOf = (body: unknown): Record<string, string[]> => {
  if (typeof body !== 'object' || body === null || !('errors' in body)) return {}
  const errors: unknown = body.errors
  if (typeof errors !== 'object' || errors === null) return {}
  const result: Record<string, string[]> = {}
  for (const [field, messages] of Object.entries(errors)) {
    if (Array.isArray(messages)) result[field] = messages.filter((m): m is string => typeof m === 'string')
  }
  return result
}

// メンテナンス中か。見分け方を変えるときは、ここだけを直す（今は 503 を返すのがメンテナンスだけ。code では見分けない）
const isMaintenance = (res: AxiosResponse): boolean => {
  return res.status === 503
}

// 2xx でない応答を、投げる失敗に変える。
// ログインしたあとの API：
//   503 はメンテナンスの画面を出して MaintenanceError。
//   401（ログインが切れた・アカウント停止・退会・強制退会）と 419（CSRF のトークンが合わない。24時間で切れたあとの書き込み）は、
//   ログインの画面へ移して UnauthorizedError。確認していない 403 は EmailUnverifiedError
// ログインが要らない API とログアウト：503 ならメンテナンスの画面を出す。どれも ApiError（呼んだ画面が文を出す）
const toThrown = (res: AxiosResponse, access: 'withoutLogin' | 'logout' | undefined): Error => {
  const body: unknown = res.data
  const code = codeOf(body)
  if (isMaintenance(res)) {
    settings.onMaintenance()
    if (access === undefined) return new MaintenanceError()
  } else if (access === undefined) {
    if (res.status === 401) {
      settings.onUnauthorized(code)
      return new UnauthorizedError()
    }
    if (res.status === 419) {
      settings.onUnauthorized('csrf')
      return new UnauthorizedError()
    }
    if (res.status === 403 && code === 'email_unverified') {
      return new EmailUnverifiedError()
    }
  }
  return new ApiError({ status: res.status, code, serverMessage: messageOf(body), errors: errorsOf(body) })
}

client.interceptors.response.use(undefined, async (error: unknown) => {
  // AbortSignal で止めたときは、前の fetch と同じく、AbortSignal の止めた理由を投げる
  // （abort() は AbortError・AbortSignal.timeout() の時間切れは TimeoutError）。axios は理由を捨てて CanceledError にするので、ここで戻す。
  // 理由は名前で見分ける（テストの jsdom では DOMException が2種類あり、instanceof DOMException では見分けられないため）。
  // ほかの理由なら AbortError にする（hook が「止めたので黙る」と見分ける）
  if (axios.isCancel(error)) {
    const signal = error.config?.signal
    const reason: unknown = signal instanceof AbortSignal ? signal.reason : undefined
    if (reason instanceof Error && (reason.name === 'AbortError' || reason.name === 'TimeoutError')) throw reason
    throw new DOMException('止めました', 'AbortError')
  }
  // つながらない・応答がない：そのまま投げる（呼んだ所が「つながらない」として扱う）
  if (!axios.isAxiosError(error) || error.response === undefined || error.config === undefined) {
    throw error
  }
  const { response, config } = error
  // 2xx なのに、本文を JSON として読めない（送り先の設定違いで、画面の index.html が返るなど）。
  // API の応答ではないので、つながらないときと同じに、そのまま投げる（起動の GET /api/me なら「読み込めませんでした」になる）
  if (response.status >= 200 && response.status < 300) {
    throw error
  }
  // 書き込みが 419 なら、CSRF のトークンが古い（メンテナンスでセッションが消えた・24時間で切れた）。もらい直して、1回だけ送り直す
  // （419 では何も変わっていないので、送り直しても二重にならない。もう一度 419 なら、上の決まりで扱う）
  if (response.status === 419 && isWrite(config.method) && config.csrfRetried !== true) {
    await refreshCsrfCookie()
    return client.request({ ...config, csrfRetried: true })
  }
  throw toThrown(response, config.access)
})
