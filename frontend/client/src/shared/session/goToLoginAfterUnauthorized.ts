// ログインしたあとの API が 401（ログインが切れた・止められた・退会した）を返したときに呼ぶ。
// 持っているトークンを捨て、ログインの画面へ移す。画面を読み込み直すので、App が持つトークンの状態も消える。
// ログイン・登録・確認・再設定の API の 401 には使わない（パスワードが違うときも 401 なので、画面に誤りの文を出す）。
// あとで（#257）shared/api/client.ts と RequireAuth から呼ぶ形にする（architecture-frontend.md の4章「401 と 403」）
export function goToLoginAfterUnauthorized(): void {
  sessionStorage.removeItem('token')
  window.location.assign('/login')
}
