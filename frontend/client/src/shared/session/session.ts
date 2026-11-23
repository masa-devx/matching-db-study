// ログインした自分の、画面に残すもの。ログインしているかは、HttpOnly の Cookie で API が決めるので、画面はトークンを持たない（D-027）。
// 前の検索の条件は、検索の画面が読み書きする。キーはここの1か所に置き、ログアウトのときに、ここで消す。

// 前の検索の条件（SearchPage が置く）。ログインした人ごとのものなので、ログアウトのときに一緒に消す
export const SEARCH_CONDITIONS_KEY = 'searchConditions'
// 前の JWT を置いていたキー。切り替える前にログインしていた人のブラウザに残るので、消すときに一緒に消す（JWT を消すチケットで外す）
const LEGACY_TOKEN_KEY = 'token'

// ログインしたあとの API が 401 を返して、ログインの画面に移ったときの理由（/login?reason=…。FR-UI-100）
export const SIGNED_OUT_REASON = 'signed-out'
export const ACCOUNT_SUSPENDED_REASON = 'account-suspended'

// ログアウト・退会・ログインが切れた（401）ときに、画面に残したログインした自分の情報を全部消す
export const clearSession = (): void => {
  sessionStorage.removeItem(LEGACY_TOKEN_KEY)
  sessionStorage.removeItem(SEARCH_CONDITIONS_KEY)
}
