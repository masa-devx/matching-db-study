// 日付の計算と表し方（純粋な関数）。年齢の計算は、ここの1か所に書く（architecture-frontend.md の8章）

// 生年月日（'1996-04-01'）から年齢を出す。
// 分かっている不具合：今の年から生まれた年を引くだけなので、今年の誕生日の前は1歳多い（まだ移していない画面と同じ計算）
export const ageFromBirthday = (birthday: string): number => {
  return new Date().getFullYear() - Number(birthday.slice(0, 4))
}

// 月と日だけ（'11/20'）
export const monthDay = (date: Date): string => {
  return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}
