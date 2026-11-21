// API を呼ぶのは、この3つの関数だけにする（architecture-frontend.md の4章）。
// 送り先（VITE_API_URL）を読み、セッションの Cookie と CSRF のトークンを付けるのも、ここだけ（Sanctum の SPA 認証。D-027）。
// 画面はトークンを持たない。ログインしているかは、ブラウザが自動で付ける HttpOnly の Cookie で、API が決める。
// 失敗の扱い（422 の文を出すなど）は、まだ呼ぶ画面ごとに持つ。ApiError に変えるのは、画面を機能のフォルダに移すとき

import { EmailUnverifiedError, MaintenanceError, UnauthorizedError } from './ApiError'

// 失敗のクラスは ApiError.ts に置く。レガシー版の画面が client から読んでいるので、ここからも出す
export { EmailUnverifiedError, MaintenanceError, StoppedRequestError, UnauthorizedError } from './ApiError'

// localhost にそろえる（127.0.0.1 と localhost は別のサイトになり、セッションの Cookie が届かないため。#259）
const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// CSRF のトークンを入れる Cookie（Sanctum が GET /sanctum/csrf-cookie で付ける。JavaScript から読める）
const XSRF_COOKIE = 'XSRF-TOKEN'

// ログインが切れた（401・419）ときと、メンテナンス中（503）のときの処理は、app/ が起動のときに渡す。
// shared/api は shared/session も画面の移り方も知らない（依存の向き：app → shared/session → shared/api）
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

export function configureApiClient(next: ApiClientSettings): void {
  settings = next
}

// API が返した画像のパス（/storage/…）を、画面で使える URL にする
export function apiUrl(path: string): string {
  return `${API_URL}${path}`
}

// ログインしたあとの API。
// 401（ログインが切れた・アカウント停止・退会・強制退会）と 419（CSRF のトークンが合わない。24時間で切れたあとの書き込み）なら、
// ログインの画面へ移し、続きを止める
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await send(path, init)
  if (isMaintenance(res)) {
    settings.onMaintenance()
    throw new MaintenanceError()
  }
  if (res.status === 401) {
    settings.onUnauthorized(await codeOf(res))
    throw new UnauthorizedError()
  }
  if (res.status === 419) {
    settings.onUnauthorized('csrf')
    throw new UnauthorizedError()
  }
  if (res.status === 403 && (await codeOf(res)) === 'email_unverified') {
    throw new EmailUnverifiedError()
  }
  return res
}

// ログアウトの API。401 でも移らない（もうログインしていないのと同じなので、自分でしたログアウトとして扱う）。
// 503 なら、メンテナンスの画面を出すが、投げない（待たずに呼ぶ画面があるため）
export async function apiFetchForLogout(path: string, init: RequestInit = {}): Promise<Response> {
  return noticeMaintenance(await send(path, init))
}

// ログイン・登録・メールアドレスの確認・パスワードの再設定と、起動のときの GET /api/me。
// パスワードが違うときも 401 が返るので、ログインの画面へは移さず、応答をそのまま返す（画面に誤りの文を出す）。
// 503 なら、メンテナンスの画面を出すが、投げない（待たずに呼ぶ画面があるため）
export async function apiFetchWithoutLogin(path: string, init: RequestInit = {}): Promise<Response> {
  return noticeMaintenance(await send(path, init))
}

// どの API も、セッションの Cookie を付けて送る（credentials: 'include'）。
// 書き込み（GET・HEAD でないもの）には、CSRF のトークンを X-XSRF-TOKEN で付ける。Cookie がまだなければ、先に1回もらう
async function send(path: string, init: RequestInit): Promise<Response> {
  const headers = new Headers(init.headers)
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }
  if (isWrite(init)) {
    const token = (await csrfToken()) ?? ''
    headers.set('X-XSRF-TOKEN', token)
  }
  return fetch(`${API_URL}${path}`, { ...init, headers, credentials: 'include' })
}

function isWrite(init: RequestInit): boolean {
  const method = (init.method ?? 'GET').toUpperCase()
  return method !== 'GET' && method !== 'HEAD'
}

// CSRF のトークン。Cookie になければ GET /sanctum/csrf-cookie で付けてもらい、読み直す
async function csrfToken(): Promise<string | null> {
  const saved = readXsrfCookie()
  if (saved !== null) return saved
  await fetch(`${API_URL}/sanctum/csrf-cookie`, { headers: { Accept: 'application/json' }, credentials: 'include' })
  return readXsrfCookie()
}

function readXsrfCookie(): string | null {
  const prefix = `${XSRF_COOKIE}=`
  const found = document.cookie.split('; ').find((cookie) => cookie.startsWith(prefix))
  return found === undefined ? null : decodeURIComponent(found.slice(prefix.length))
}

// メンテナンス中か。見分け方を変えるときは、ここだけを直す（今は 503 を返すのがメンテナンスだけ。code では見分けない）
function isMaintenance(res: Response): boolean {
  return res.status === 503
}

// 503（メンテナンス中）なら、メンテナンスの処理を呼ぶ。応答はそのまま返す
function noticeMaintenance(res: Response): Response {
  if (isMaintenance(res)) {
    settings.onMaintenance()
  }
  return res
}

// 401・403 の応答の code を読む。JSON でなければ null
async function codeOf(res: Response): Promise<string | null> {
  try {
    const body: unknown = await res.clone().json()
    if (typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string') {
      return body.code
    }
  } catch {
    // JSON でない応答。理由は分からないので null
  }
  return null
}
