import { apiFetchWithoutLogin } from '../shared/api/client'
import { readToken } from '../shared/session/session'

// 起動のときに1回呼ぶ。トークンがない人も、メンテナンス中なら、開いたときにメンテナンスの画面を出す（FR-MAINT-006）。
// トークンがあれば、SessionProvider の GET /api/me で分かるので、何もしない。
// 呼ぶのは GET /api/me（トークンなし）。ふだんは 401 が返るだけで、メンテナンス中は 503 が返り、client.ts が見分ける。
// GET /api/health と GET /up は使わない（/up はメンテナンス中も止まらず、/api/health は消す予定のため）
export async function checkMaintenanceWithoutLogin(): Promise<void> {
  if (readToken()) return
  try {
    await apiFetchWithoutLogin('/api/me')
  } catch {
    // つながらないときは、いつもの画面のまま。ログイン・登録を送ったときに、その画面が失敗の文を出す
  }
}
