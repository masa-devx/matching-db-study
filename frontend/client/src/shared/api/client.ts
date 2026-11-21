// API を呼ぶのは、この2つの関数だけにする（architecture-frontend.md の4章）。
// 送り先（VITE_API_URL）を読み、トークンを Authorization に付けるのも、ここだけ。
// 失敗の扱い（422 の文を出すなど）は、まだ呼ぶ画面ごとに持つ。ApiError に変えるのは、画面を機能のフォルダに移すとき

// localhost にそろえる（127.0.0.1 と localhost は別のサイトになり、セッションの Cookie が届かないため。#259）
const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

// トークンの読み方と、ログインが切れた（401）ときの処理は、app/ が起動のときに渡す。
// shared/api は shared/session も画面の移り方も知らない（依存の向き：app → shared/session → shared/api）
type ApiClientSettings = {
  readToken: () => string | null
  onUnauthorized: () => void
}

let settings: ApiClientSettings = {
  readToken: () => null,
  onUnauthorized: () => {},
}

export function configureApiClient(next: ApiClientSettings): void {
  settings = next
}

// ログインが切れたときに投げる。呼んだ画面の続きの処理（応答を一覧として置くなど）を止めるため
export class UnauthorizedError extends Error {
  constructor() {
    super('ログインしてください')
    this.name = 'UnauthorizedError'
  }
}

function headersWithAccept(init: RequestInit): Headers {
  const headers = new Headers(init.headers)
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json')
  }
  return headers
}

// API が返した画像のパス（/storage/…）を、画面で使える URL にする
export function apiUrl(path: string): string {
  return `${API_URL}${path}`
}

// ログインしたあとの API。トークンを付ける。
// 401（ログインが切れた・アカウント停止・退会・強制退会）なら、ログインの画面へ移し、続きを止める
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = headersWithAccept(init)
  const token = settings.readToken()
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  const res = await fetch(`${API_URL}${path}`, { ...init, headers })
  if (res.status === 401) {
    settings.onUnauthorized()
    throw new UnauthorizedError()
  }
  return res
}

// ログイン・登録・メールアドレスの確認・パスワードの再設定の API。トークンは付けない。
// パスワードが違うときも 401 が返るので、ログインの画面へは移さず、応答をそのまま返す（画面に誤りの文を出す）
export function apiFetchWithoutLogin(path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${API_URL}${path}`, { ...init, headers: headersWithAccept(init) })
}
