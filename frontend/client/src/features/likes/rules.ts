// いいねの機能の見せ方の決まり（純粋な関数）

// ニックネーム。ない（退会した会員）ときは「退会した会員」
export const displayName = (nickname: string | null): string => {
  return nickname ?? '退会した会員'
}

// 年齢の表し方（'30歳'）。分からないときは出さない
export const ageLabel = (age: number | null): string => {
  return age === null ? '' : `${age}歳`
}
