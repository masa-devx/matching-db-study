// API の失敗の型（architecture-frontend.md の2章）。client.ts が投げ、hook（と、まだ移していないレガシー版の画面）が受けて見分ける。
// 前は shared/api/ApiError.ts にあった（#292 で axios に移したときに、ここへ移した）

// 呼んだ画面の続きの処理（応答を一覧として置くなど）を止めるために投げる失敗の親。
// 画面で受け止めるときは、この型で見分ける（いいねのように、遷移の中で待つ所）。
// ログインが切れた・メンテナンス中・確認していないは、client.ts が画面を移す・帯を出すので、呼んだ所は黙って止まる
export class StoppedRequestError extends Error {}

// ログインが切れた（401・419）。app/ の処理がログインの画面へ移す
export class UnauthorizedError extends StoppedRequestError {
  constructor() {
    super('ログインしてください')
    this.name = 'UnauthorizedError'
  }
}

// メンテナンス中（503。FR-MAINT-006）。app/ の処理が、画面の代わりにメンテナンスの画面を出す
export class MaintenanceError extends StoppedRequestError {
  constructor() {
    super('ただいまメンテナンス中です')
    this.name = 'MaintenanceError'
  }
}

// メールアドレスを確認していない会員が、確認が要る API を呼んだ（403 の email_unverified。FR-AUTH-021）。
// 画面は移さない。確認を促すのは、枠のいちばん上の帯（VerifyBanner。FR-UI-014）
export class EmailUnverifiedError extends StoppedRequestError {
  constructor() {
    super('この機能は使えません')
    this.name = 'EmailUnverifiedError'
  }
}

type ApiErrorFields = {
  status: number
  code: string | null
  serverMessage: string | null
  errors: Record<string, string[]>
}

// 上の3つ以外で、API が 2xx でない応答を返した（400・403・404・409・422・500 など）。
// ログインが要らない API（ログイン・登録など）とログアウトでは、401・419・503 もこれになる（呼んだ画面が文を出すため）
export class ApiError extends Error {
  // 状態コード
  readonly status: number
  // 応答の code（アカウント停止なら 'account_suspended'）。なければ null
  readonly code: string | null
  // 応答の message（文は API の lang/ja/errors.php にある）。なければ null
  readonly serverMessage: string | null
  // 入力の誤り（422 の errors。項目の名前 → 文の配列）。なければ空
  readonly errors: Record<string, string[]>

  constructor({ status, code, serverMessage, errors }: ApiErrorFields) {
    super(serverMessage ?? `API が ${status} を返しました`)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.serverMessage = serverMessage
    this.errors = errors
  }

  // 項目の最初の誤りの文。なければ null
  fieldError(field: string): string | null {
    return this.errors[field]?.[0] ?? null
  }
}

// まだ移していないレガシー版の画面のためだけに使う（画面を移したら、呼ぶ所と一緒に消す）。
// 前の fetch では、2xx でない応答でも例外にならず、状態コードを見ない画面は、そのまま続けていた（ブロック・購入など）。
// axios は 2xx でないと投げるので、ApiError だけを黙って通し、前と同じに続ける。
// ほかの失敗（ログインが切れた・メンテナンス中・確認していない・つながらない）は、前と同じく投げ直して、続きを止める
export const ignoreApiError = (e: unknown): void => {
  if (!(e instanceof ApiError)) throw e
}
