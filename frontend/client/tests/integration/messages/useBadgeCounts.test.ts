import { act, renderHook } from '@testing-library/react'
import { delay, HttpResponse, http } from 'msw'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../src/api/ApiError'
import { configureApiClient } from '../../../src/api/client'
import { messagingApi } from '../../../src/api/messagingApi'
import { useBadgeCounts } from '../../../src/features/messages/hooks/useBadgeCounts'
import type { BadgeCounts } from '../../../src/features/messages/types'
import { SessionProvider, useSession } from '../../../src/shared/session/SessionProvider'
import { BADGE_COUNTS_URL } from '../../support/handlers/messagingApi'
import { accountBody, ME_URL } from '../../support/handlers/profileApi'
import { sentRequests, server } from '../../support/server'

// features/messages/hooks/useBadgeCounts.ts：下のタブの数を、いつ読むか（FR-UI-032・FR-UI-093）。API は MSW で偽物にし、src/api を通す。
// 何回読んだかは偽物が受けた要求（sentRequests）で、止めたかは偽物が受けた要求の signal で数える

// テストで使う値
// 下のタブの数の既定の応答（tests/support/handlers/messagingApi.ts の badgeCountsBody）から計算したタブの数。
// メッセージのタブは、未読の合計と新しいマッチを足す
const tabs = { messagesTab: 4, likesTab: 2 }

const onUnauthorized = vi.fn<(code: string | null) => void>()

const wrapper = ({ children }: { children: ReactNode }) => createElement(SessionProvider, null, children)

// ログインした自分と、下のタブの数を一緒に返す（ログインしているかが決まったのを待つため）
const renderBadgeCounts = (initialPath = '/search') => {
  return renderHook(({ pathname }) => ({ session: useSession().session, tabs: useBadgeCounts(pathname) }), {
    wrapper,
    initialProps: { pathname: initialPath },
  })
}

// 偽物が受けた、下のタブの数の要求
const badgeRequests = (): Request[] => sentRequests('GET', '/api/me/badge-counts')

// 応答を返さず、受けた要求の signal を順に覚える偽物（止めたかを、偽物の側で見る）
const holdBadgeCounts = (): AbortSignal[] => {
  const received: AbortSignal[] = []
  server.use(
    http.get(BADGE_COUNTS_URL, async ({ request }) => {
      received.push(request.signal)
      await delay('infinite')
      return HttpResponse.json({})
    }),
  )
  return received
}

// 条件がそろうまで、本物の時計で待つ（vi.waitFor は、偽の時計のときに時計を進めながら待つので、このファイルでは使わない）。
// 上限は findBy と同じ3秒（tests/support/setup.ts）
const waitWithRealClock = async (check: () => void): Promise<void> => {
  for (let tried = 0; tried < 300; tried++) {
    try {
      check()
      return
    } catch {
      await act(async () => {
        await new Promise<void>((done) => setTimeout(done, 10))
      })
    }
  }
  check()
}

beforeEach(() => {
  // 30秒ごとの読み直しだけを、時計を進めて確かめる（ほかの時計は本物のまま。MSW と axios は本物の時計で動く）
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  onUnauthorized.mockReset()
  configureApiClient({ onUnauthorized, onMaintenance: () => {} })
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * 正常系：要件が通す操作
 */
describe('メールアドレスを確認した会員の画面に、下のタブが出る', () => {
  it('出たときに1回だけ読み、タブに出す数を返す（メッセージのタブは未読と新しいマッチの合計。FR-UI-032・FR-UI-073）', async () => {
    const { result } = renderBadgeCounts()

    await waitWithRealClock(() => expect(result.current.tabs).toEqual(tabs))

    expect(badgeRequests()).toHaveLength(1)
  })

  it('同じ画面にいても、30秒ごとに読み直す（30秒の手前では読まない。FR-UI-093）', async () => {
    const { result } = renderBadgeCounts()
    await waitWithRealClock(() => expect(result.current.tabs).toEqual(tabs))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_999)
    })
    // 30秒の手前で読んでいないかは、ウィンドウに戻って1回読ませ、その要求が届いてから数える（手前で読んでいれば3本になる）
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })
    await waitWithRealClock(() => expect(badgeRequests().length).toBeGreaterThanOrEqual(2))
    expect(badgeRequests()).toHaveLength(2)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })

    await waitWithRealClock(() => expect(badgeRequests()).toHaveLength(3))
  })

  it('ウィンドウに戻ったときに読み直す（FR-UI-093）', async () => {
    const { result } = renderBadgeCounts()
    await waitWithRealClock(() => expect(result.current.tabs).toEqual(tabs))

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    await waitWithRealClock(() => expect(badgeRequests()).toHaveLength(2))
  })

  it('画面から消えたら、30秒ごとの読み直しを止める', async () => {
    const { result, unmount } = renderBadgeCounts()
    await waitWithRealClock(() => expect(result.current.tabs).toEqual(tabs))

    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
      window.dispatchEvent(new Event('focus'))
    })

    // 読んでいないかは、出し直した画面が読んだ1本が届いてから数える（消えたあとも読んでいれば3本以上になる）
    renderBadgeCounts()
    await waitWithRealClock(() => expect(badgeRequests().length).toBeGreaterThanOrEqual(2))
    expect(badgeRequests()).toHaveLength(2)
  })
})

describe('メールアドレスを確認した会員が、下のタブの数を読んだあとに、ログアウトする', () => {
  it('タブに出す数を、どれも 0 に戻す（同じタブで次にログインした会員に、前の会員の数を出さない）', async () => {
    const { result } = renderHook(({ pathname }) => ({ session: useSession(), tabs: useBadgeCounts(pathname) }), {
      wrapper,
      initialProps: { pathname: '/search' },
    })
    await waitWithRealClock(() => expect(result.current.tabs).toEqual(tabs))

    act(() => {
      result.current.session.signOut()
    })

    expect(result.current.tabs).toEqual({ messagesTab: 0, likesTab: 0 })
  })
})

describe('メールアドレスを確認した会員が、下のタブのある画面を移る', () => {
  it('画面を移ったときに読み直す（トークを開いて戻れば、未読が減る）', async () => {
    const { result, rerender } = renderBadgeCounts()
    await waitWithRealClock(() => expect(result.current.tabs).toEqual(tabs))
    server.use(
      http.get(BADGE_COUNTS_URL, () => HttpResponse.json({ unread_messages: 0, new_matches: 1, received_likes: 2 })),
    )

    rerender({ pathname: '/messages' })

    await waitWithRealClock(() => expect(result.current.tabs).toEqual({ messagesTab: 1, likesTab: 2 }))
    expect(badgeRequests()).toHaveLength(2)
  })

  it('次を読み始めたら、前の読み込みに止める合図（AbortSignal）を送る', async () => {
    const received = holdBadgeCounts()
    const { rerender } = renderBadgeCounts()
    // 1回目の要求が偽物に届くまで待つ（届く前に移ると、止めた要求は偽物に届かない）
    await waitWithRealClock(() => expect(received).toHaveLength(1))

    rerender({ pathname: '/messages' })

    await waitWithRealClock(() => expect(received).toHaveLength(2))
    await waitWithRealClock(() => expect(received[0]?.aborted).toBe(true))
    expect(received[1]?.aborted).toBe(false)
  })

  it('止めた前の読み込みの応答が、あとから届いても、新しい数を上書きしない', async () => {
    // 応答が届いたあとで止めた、のときを作るため、この2回だけは、止めても返る偽物にする（通信では、この順番を起こせない）
    const deferred = (): { promise: Promise<BadgeCounts>; resolve: (value: BadgeCounts) => void } => {
      let resolve: (value: BadgeCounts) => void = () => {}
      const promise = new Promise<BadgeCounts>((done) => {
        resolve = done
      })
      return { promise, resolve }
    }
    const older = deferred()
    const newer = deferred()
    const badgeCounts = vi.spyOn(messagingApi, 'badgeCounts')
    badgeCounts.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    const { result, rerender } = renderBadgeCounts()
    await waitWithRealClock(() => expect(badgeCounts).toHaveBeenCalledTimes(1))
    rerender({ pathname: '/messages' })

    await act(async () => {
      newer.resolve({ unreadMessages: 1, newMatches: 0, receivedLikes: 0 })
    })
    await act(async () => {
      older.resolve({ unreadMessages: 9, newMatches: 9, receivedLikes: 9 })
    })

    expect(result.current.tabs).toEqual({ messagesTab: 1, likesTab: 0 })
  })
})

/**
 * 異常系：要件が断る操作
 */
describe('メールアドレスを確認した会員が画面を移り、下のタブの数を読めない（500）', () => {
  it('失敗を記録し、前の数のまま返す（logging.md の4）', async () => {
    const reportErrorSpy = vi.spyOn(globalThis, 'reportError').mockImplementation(() => {})
    const { result, rerender } = renderBadgeCounts()
    await waitWithRealClock(() => expect(result.current.tabs).toEqual(tabs))
    server.use(http.get(BADGE_COUNTS_URL, () => HttpResponse.json({ message: 'Server Error' }, { status: 500 })))

    rerender({ pathname: '/messages' })

    await waitWithRealClock(() => expect(reportErrorSpy).toHaveBeenCalledTimes(1))
    const [failure] = reportErrorSpy.mock.calls[0] ?? []
    expect(failure).toBeInstanceOf(ApiError)
    expect(failure).toMatchObject({ status: 500 })
    expect(badgeRequests()).toHaveLength(2)
    expect(result.current.tabs).toEqual(tabs)
  })
})

// 異常系とした：1回目は画面が止めた（正常）が、2回目はログインが切れて API が断る（401）
describe('メールアドレスを確認した会員が画面を移り、前の読み込みを止め、次の読み込みでログインが切れている（401）', () => {
  it('止めたとき（AbortError）も、ログインが切れたとき（client.ts が画面を移す）も、記録しない', async () => {
    const reportErrorSpy = vi.spyOn(globalThis, 'reportError').mockImplementation(() => {})
    // 1回目は応答を返さず、画面を移ったときに止める。2回目は 401（ログインが切れた）
    const received: AbortSignal[] = []
    server.use(
      http.get(
        BADGE_COUNTS_URL,
        async ({ request }) => {
          received.push(request.signal)
          await delay('infinite')
          return HttpResponse.json({})
        },
        { once: true },
      ),
      http.get(BADGE_COUNTS_URL, () => HttpResponse.json({ message: 'ログインしてください' }, { status: 401 })),
    )
    const { rerender } = renderBadgeCounts()
    // 1回目の要求が偽物に届くまで待つ（届く前に移ると、2回目が「一度だけ返さない」偽物を使ってしまう）
    await waitWithRealClock(() => expect(received).toHaveLength(1))

    rerender({ pathname: '/messages' })

    await waitWithRealClock(() => expect(received[0]?.aborted).toBe(true))
    await waitWithRealClock(() => expect(onUnauthorized).toHaveBeenCalledTimes(1))
    // client.ts が 401 を受けたあと、投げた失敗が hook の catch に届くまで、1回だけ処理を進める
    await act(async () => {
      await new Promise<void>((done) => setTimeout(done, 0))
    })
    expect(badgeRequests()).toHaveLength(2)
    expect(reportErrorSpy).not.toHaveBeenCalled()
  })
})

describe('メールアドレスを確認していない会員の画面に、下のタブが出る', () => {
  it('API が断るので、読まずに数はどれも 0（FR-AUTH-021）', async () => {
    server.use(http.get(ME_URL, () => HttpResponse.json(accountBody({ verified: false }))))
    const { result } = renderBadgeCounts()
    await waitWithRealClock(() => expect(result.current.session.status).toBe('signedIn'))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
      window.dispatchEvent(new Event('focus'))
    })

    // 読んでいないかは、そのあとに送らせた GET /api/me（タブを開き直したときの読み直し）が届いてから数える
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true })
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
    })
    await waitWithRealClock(() => expect(sentRequests('GET', '/api/me')).toHaveLength(2))
    expect(badgeRequests()).toHaveLength(0)
    expect(result.current.tabs).toEqual({ messagesTab: 0, likesTab: 0 })
  })
})
