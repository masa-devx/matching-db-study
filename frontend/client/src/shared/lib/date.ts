// 日付の計算と表し方（純粋な関数）。年齢の計算は、ここの1か所に書く（architecture-frontend.md の8章）

// 生年月日（'1996-04-01'）から、today の日の年齢を出す。今年の誕生日の前は、年の差から1を引く。
// 日付の文字のまま比べる（Date に直すと、'1996-04-01' は UTC の0時と読まれ、時差によっては日がずれるため）
export const ageFromBirthday = (birthday: string, today: Date = new Date()): number => {
  const month = Number(birthday.slice(5, 7))
  const day = Number(birthday.slice(8, 10))
  const todayMonth = today.getMonth() + 1
  const beforeBirthday = todayMonth < month || (todayMonth === month && today.getDate() < day)
  return today.getFullYear() - Number(birthday.slice(0, 4)) - (beforeBirthday ? 1 : 0)
}

// 月と日だけ（'11/20'）
export const monthDay = (date: Date): string => {
  return date.toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
}
