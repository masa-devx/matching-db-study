// ログインしたあとの API が 401（ログインが切れた・止められた・退会した）を返したときに呼ぶ。
// ログインした自分の情報（トークンと、前の検索の条件）を捨て、ログインの画面へ移す。
// 画面を読み込み直すので、App が持つトークンの状態も消える。
// ログイン・登録・確認・再設定の API の 401 には使わない（パスワードが違うときも 401 なので、画面に誤りの文を出す）。
// #257 で、消す所は shared/session に残し、ログインの画面へ移すのは app/RequireAuth に分ける。
// shared/api/client.ts は 401 を ApiError で投げるだけにし、ここを呼ばない（architecture-frontend.md の3章・4章の依存の向き）
export function goToLoginAfterUnauthorized(): void {
  // ログアウトと退会（SettingsPage）と同じものを消す。1か所にまとめるのは #257
  sessionStorage.removeItem('token')
  sessionStorage.removeItem('searchConditions')
  window.location.assign('/login')
}
