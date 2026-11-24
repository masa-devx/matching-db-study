// いいねの機能の画面の型（画面の形）。API の形（ReceivedLikeResponse など）は src/api/matchingApi.ts の中だけ

// 届いたいいねの1件
export type ReceivedLike = {
  userId: string // 相手の public_id
  nickname: string | null // 退会した会員は null
  age: number | null // 生年月日がなければ null
  prefecture: string | null
  image: string | null // 画像のパス（URL にするのは、まだ移していない Avatar）
  likedAt: Date
}

// スキップした相手の1件
export type SkippedMember = {
  // 一覧の行の key。同じ相手が2行来ることがあるので、相手の ID に順番を足して作る
  key: string
  userId: string
  nickname: string | null
  age: number | null
  prefecture: string | null
  image: string | null
  skippedAt: Date
}

// いいねを送った結果。マッチしたら、できたトークルームの ID
export type LikeResult = {
  matched: boolean
  roomId: string | null
}

// マッチの演出に出す1人（自分か相手）
export type MatchPerson = {
  nickname?: string | null
  image?: string | null
}

// マッチの演出に出すもの。自分は、読めなければ null（写真なしで出す）
export type Celebration = {
  me: MatchPerson | null
  partner: MatchPerson
  roomId: string | null
}
