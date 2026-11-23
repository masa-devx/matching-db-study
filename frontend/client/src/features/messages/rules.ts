import type { BadgeCounts } from './types'

// メッセージのタブのバッジの数。未読の合計に、新しいマッチも1つずつ足す（FR-UI-032・FR-UI-073）
export const messagesTabCount = (counts: BadgeCounts): number => {
  return counts.unreadMessages + counts.newMatches
}
