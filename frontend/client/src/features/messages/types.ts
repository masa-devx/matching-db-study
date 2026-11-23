// 下のタブのバッジに出す数（画面の形）。API の形（BadgeCountsResponse）は src/api/messagingApi.ts の中だけ
export type BadgeCounts = {
  unreadMessages: number // 相手から届いて、まだ読んでいないメッセージの合計
  newMatches: number // 新しいマッチ（まだ一度も開いていなくて、まだ1通もないルーム）の数
  receivedLikes: number // 届いたいいね（まだ返事をしていないもの）の数
}

// 下のタブに出す数（画面の形）。useBadgeCounts が BadgeCounts から、描く間に計算して返す
export type TabCounts = {
  messagesTab: number // メッセージのタブ：未読の合計と、新しいマッチ
  likesTab: number // いいねのタブ：届いたいいねの人数
}
