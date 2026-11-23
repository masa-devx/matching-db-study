import { act, renderHook } from '@testing-library/react'
import { delay, HttpResponse, http } from 'msw'
import { createElement, type ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest'
import { ApiError, UnauthorizedError } from '../../../src/api/ApiError'
import { messagingApi } from '../../../src/api/messagingApi'
import { useBadgeCounts } from '../../../src/features/messages/hooks/useBadgeCounts'
import type { BadgeCounts } from '../../../src/features/messages/types'
import { SessionProvider, useSession } from '../../../src/shared/session/SessionProvider'
import { BADGE_COUNTS_URL } from '../../support/handlers/messagingApi'
import { accountBody, ME_URL } from '../../support/handlers/profileApi'
import { sentRequests, server } from '../../support/server'

// features/messages/hooks/useBadgeCounts.ts：下のタブの数を、いつ読むか（FR-UI-032・FR-UI-093）。API は MSW で偽物にし、src/api を通す。
// 何回読んだか・どの止める合図を渡したかは、messagingApi.badgeCounts を包んで数える（中身はそのまま動かす）

// テストで使う値
// 下のタブの数の既定の応答（tests/support/handlers/messagingApi.ts の badgeCountsBody）から計算したタブの数。
// メッセージのタブは、未読の合計と新しいマッチを足す
const tabs = { messagesTab: 4, likesTab: 2 }

const wrapper = ({ children }: { children: ReactNode }) => createElement(SessionProvider, null, children)

// ログインした自分と、下のタブの数を一緒に返す（ログインしているかが決まったのを待つため）
const renderBadgeCounts = (initialPath = '/search') => {
  return renderHook(({ pathname }) => ({ session: useSession().session, tabs: useBadgeCounts(pathname) }), {
    wrapper,
    initialProps: { pathname: initialPath },
  })
}

// 条件がそろうまで、本物の時計で待つ（vi.waitFor は、偽の時計のときに時計を進めながら待つので、30秒の境目を数えるテストでは使わない）
const waitWithRealClock = async (check: () => void): Promise<void> => {
  for (let tried = 0; tried < 100; tried++) {
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

let badgeCounts: MockInstance<typeof messagingApi.badgeCounts>

beforeEach(() => {
  // 30秒ごとの読み直しだけを、時計を進めて確かめる（ほかの時計は本物のまま。MSW と axios は本物の時計で動く）
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] })
  badgeCounts = vi.spyOn(messagingApi, 'badgeCounts')
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

    await vi.waitFor(() => expect(result.current.tabs).toEqual(tabs))
    expect(badgeCounts).toHaveBeenCalledTimes(1)
    expect(sentRequests('GET', '/api/me/badge-counts')).toHaveLength(1)
  })

  it('同じ画面にいても、30秒ごとに読み直す（30秒の手前では読まない。FR-UI-093）', async () => {
    const { result } = renderBadgeCounts()
    await waitWithRealClock(() => expect(result.current.tabs).toEqual(tabs))

    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_999)
    })
    expect(badgeCounts).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(badgeCounts).toHaveBeenCalledTimes(2)
    await waitWithRealClock(() => expect(sentRequests('GET', '/api/me/badge-counts')).toHaveLength(2))
  })

  it('ウィンドウに戻ったときに読み直す（FR-UI-093）', async () => {
    const { result } = renderBadgeCounts()
    await vi.waitFor(() => expect(result.current.tabs).toEqual(tabs))

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(badgeCounts).toHaveBeenCalledTimes(2)
  })

  it('画面から消えたら、30秒ごとの読み直しを止める', async () => {
    const { result, unmount } = renderBadgeCounts()
    await vi.waitFor(() => expect(result.current.tabs).toEqual(tabs))

    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
      window.dispatchEvent(new Event('focus'))
    })

    expect(badgeCounts).toHaveBeenCalledTimes(1)
  })
})

describe('メールアドレスを確認した会員が、下のタブのある画面を移る', () => {
  it('画面を移ったときに読み直す（トークを開いて戻れば、未読が減る）', async () => {
    const { result, rerender } = renderBadgeCounts()
    await vi.waitFor(() => expect(result.current.tabs).toEqual(tabs))
    server.use(
      http.get(BADGE_COUNTS_URL, () => HttpResponse.json({ unread_messages: 0, new_matches: 1, received_likes: 2 })),
    )

    rerender({ pathname: '/messages' })

    await vi.waitFor(() => expect(result.current.tabs).toEqual({ messagesTab: 1, likesTab: 2 }))
    expect(badgeCounts).toHaveBeenCalledTimes(2)
  })

  it('次を読み始めたら、前の読み込みに止める合図（AbortSignal）を送る', async () => {
    server.use(
      http.get(BADGE_COUNTS_URL, async () => {
        await delay('infinite')
        return HttpResponse.json({})
      }),
    )
    const { result, rerender } = renderBadgeCounts()
    await vi.waitFor(() => expect(result.current.session.status).toBe('signedIn'))
    await vi.waitFor(() => expect(badgeCounts).toHaveBeenCalledTimes(1))

    rerender({ pathname: '/messages' })

    expect(badgeCounts).toHaveBeenCalledTimes(2)
    const firstSignal = badgeCounts.mock.calls[0]?.[0]
    const secondSignal = badgeCounts.mock.calls[1]?.[0]
    expect(firstSignal?.aborted).toBe(true)
    expect(secondSignal?.aborted).toBe(false)
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
    badgeCounts.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    const { result, rerender } = renderBadgeCounts()
    await vi.waitFor(() => expect(badgeCounts).toHaveBeenCalledTimes(1))
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
    await vi.waitFor(() => expect(result.current.tabs).toEqual(tabs))
    server.use(http.get(BADGE_COUNTS_URL, () => HttpResponse.json({ message: 'Server Error' }, { status: 500 })))

    rerender({ pathname: '/messages' })

    await vi.waitFor(() => expect(reportErrorSpy).toHaveBeenCalledTimes(1))
    const [failure] = reportErrorSpy.mock.calls[0] ?? []
    expect(failure).toBeInstanceOf(ApiError)
    expect(failure).toMatchObject({ status: 500 })
    expect(badgeCounts).toHaveBeenCalledTimes(2)
    expect(result.current.tabs).toEqual(tabs)
  })
})

// 異常系とした：1回目は画面が止めた（正常）が、2回目はログインが切れて API が断る（401）
describe('メールアドレスを確認した会員が画面を移り、前の読み込みを止め、次の読み込みでログインが切れている（401）', () => {
  it('止めたとき（AbortError）も、ログインが切れたとき（client.ts が画面を移す）も、記録しない', async () => {
    const reportErrorSpy = vi.spyOn(globalThis, 'reportError').mockImplementation(() => {})
    // 1回目は応答を返さず、画面を移ったときに止める。2回目は 401（ログインが切れた）
    server.use(
      http.get(
        BADGE_COUNTS_URL,
        async () => {
          await delay('infinite')
          return HttpResponse.json({})
        },
        { once: true },
      ),
      http.get(BADGE_COUNTS_URL, () => HttpResponse.json({ message: 'ログインしてください' }, { status: 401 })),
    )
    const { rerender } = renderBadgeCounts()
    await vi.waitFor(() => expect(badgeCounts).toHaveBeenCalledTimes(1))

    rerender({ pathname: '/messages' })

    expect(badgeCounts).toHaveBeenCalledTimes(2)
    await expect(badgeCounts.mock.results[0]?.value).rejects.toMatchObject({ name: 'AbortError' })
    await expect(badgeCounts.mock.results[1]?.value).rejects.toThrow(UnauthorizedError)
    await act(async () => {}) // hook の catch まで進める
    expect(reportErrorSpy).not.toHaveBeenCalled()
  })
})

describe('メールアドレスを確認していない会員の画面に、下のタブが出る', () => {
  it('API が断るので、読まずに数はどれも 0（FR-AUTH-021）', async () => {
    server.use(http.get(ME_URL, () => HttpResponse.json(accountBody({ verified: false }))))

    const { result } = renderBadgeCounts()
    await vi.waitFor(() => expect(result.current.session.status).toBe('signedIn'))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
      window.dispatchEvent(new Event('focus'))
    })

    expect(badgeCounts).not.toHaveBeenCalled()
    expect(sentRequests('GET', '/api/me/badge-counts')).toHaveLength(0)
    expect(result.current.tabs).toEqual({ messagesTab: 0, likesTab: 0 })
  })
})
