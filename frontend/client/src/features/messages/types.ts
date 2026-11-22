// 下のタブのバッジに出す数（画面の形）。API の形（BadgeCountsResponse）は api.ts の中だけ
export type BadgeCounts = {
  unreadMessages: number // 相手から届いて、まだ読んでいないメッセージの合計
  newMatches: number // 新しいマッチ（まだ一度も開いていなくて、まだ1通もないルーム）の数
  receivedLikes: number // 届いたいいね（まだ返事をしていないもの）の数
}
