import { describe, expect, it } from 'vitest'
import { messagesTabCount } from './rules'

// features/messages/rules.ts：メッセージのタブのバッジの数（FR-UI-032・FR-UI-073）

describe('メッセージのタブのバッジの数', () => {
  it('未読の合計に、新しいマッチを足す（届いたいいねは足さない）', () => {
    expect(messagesTabCount({ unreadMessages: 3, newMatches: 2, receivedLikes: 5 })).toBe(5)
  })

  it('未読も新しいマッチもなければ 0', () => {
    expect(messagesTabCount({ unreadMessages: 0, newMatches: 0, receivedLikes: 5 })).toBe(0)
  })
})
