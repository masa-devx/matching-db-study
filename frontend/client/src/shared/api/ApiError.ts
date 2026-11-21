// API の失敗のクラス。画面（機能の hook・container）は、shared/api の中でこのファイルだけを読んでよい（architecture-frontend.md の3章）。
// 失敗の扱いを ApiError（状態コード・code・文）にするときも、ここに置く

// 呼んだ画面の続きの処理（応答を一覧として置くなど）を止めるために投げる失敗の親。
// 画面で受け止めるときは、この型で見分ける（いいねのように、遷移の中で待つ所）。
// 失敗の扱いを ApiError にするとき、ここは「status と code を持つ ApiError」に置き換える
export class StoppedRequestError extends Error {}

// ログインが切れた（401）。app/ の処理がログインの画面へ移す
export class UnauthorizedError extends StoppedRequestError {
  constructor() {
    super('ログインしてください')
    this.name = 'UnauthorizedError'
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
