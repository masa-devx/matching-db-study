// ログインした自分（今はトークンだけ）を置く所。sessionStorage を読み書きするのは、このファイルだけにする。
// セッション（Cookie）に切り替えたら（#259）、トークンを置かなくなり、ここが小さくなる

const TOKEN_KEY = 'token'
// 前の検索の条件（SearchPage が置く）。ログインした人ごとのものなので、ログアウトのときに一緒に消す
const SEARCH_CONDITIONS_KEY = 'searchConditions'

export function readToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY)
}

export function saveToken(token: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
}

// ログインが切れたこと（401）を、ログインの画面に伝える印（/login?reason=signed-out）
export const SIGNED_OUT_REASON = 'signed-out'

// ログアウト・退会・ログインが切れた（401）ときに、ログインした自分の情報を全部消す
export function clearSession(): void {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(SEARCH_CONDITIONS_KEY)
}
