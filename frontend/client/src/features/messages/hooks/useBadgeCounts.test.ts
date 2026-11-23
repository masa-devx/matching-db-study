import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UnauthorizedError } from '../../../api/ApiError'
import { messagingApi } from '../../../api/messagingApi'
import type { SessionState } from '../../../shared/session/SessionProvider'
import type { BadgeCounts } from '../types'
import { useBadgeCounts } from './useBadgeCounts'

// features/messages/hooks/useBadgeCounts.ts：下のタブの数を、いつ読むか（FR-UI-032・FR-UI-093）。
// API を呼ぶ所（src/api/messagingApi.ts の badgeCounts）は偽物にする

vi.mock('../../../api/messagingApi', () => ({ messagingApi: { badgeCounts: vi.fn() } }))

let session: SessionState
vi.mock('../../../shared/session/SessionProvider', () => ({
  useSession: () => ({ session }),
}))

const fetchMock = vi.mocked(messagingApi.badgeCounts)
const counts: BadgeCounts = { unreadMessages: 3, newMatches: 1, receivedLikes: 2 }
// counts から計算したタブの数（メッセージのタブは、未読の合計と新しいマッチを足す）
const tabs = { messagesTab: 4, likesTab: 2 }

const signedIn = (emailVerified: boolean): SessionState => {
  return { status: 'signedIn', account: { userId: 'u1', email: 'a@example.test', emailVerified } }
}

// あとから好きな時に返す応答（tsconfig の lib が Promise.withResolvers を持たないので、手で作る）
const deferred = (): { promise: Promise<BadgeCounts>; resolve: (value: BadgeCounts) => void } => {
  let resolve: (value: BadgeCounts) => void = () => {}
  const promise = new Promise<BadgeCounts>((done) => {
    resolve = done
  })
  return { promise, resolve }
}

// 読み込みの片付け（then の中の setState）まで進める
const settle = async (): Promise<void> => {
  await act(async () => {})
}

beforeEach(() => {
  vi.useFakeTimers()
  fetchMock.mockReset()
  fetchMock.mockResolvedValue(counts)
  session = signedIn(true)
})

afterEach(() => {
  vi.useRealTimers()
})

describe('メールアドレスを確認した会員の画面に、下のタブが出る', () => {
  it('出たときに1回だけ読み、タブに出す数を返す（メッセージのタブは未読と新しいマッチの合計。FR-UI-032・FR-UI-073）', async () => {
    const { result } = renderHook(() => useBadgeCounts('/search'))
    await settle()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual(tabs)
  })

  it('同じ画面にいても、30秒ごとに読み直す（30秒の手前では読まない。FR-UI-093）', async () => {
    renderHook(() => useBadgeCounts('/search'))
    await settle()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_999)
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('ウィンドウに戻ったときに読み直す（FR-UI-093）', async () => {
    renderHook(() => useBadgeCounts('/search'))
    await settle()

    await act(async () => {
      window.dispatchEvent(new Event('focus'))
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('画面を移ったときに読み直す（トークを開いて戻れば、未読が減る）', async () => {
    const { rerender } = renderHook(({ pathname }) => useBadgeCounts(pathname), {
      initialProps: { pathname: '/search' },
    })
    await settle()

    rerender({ pathname: '/messages' })
    await settle()

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('次を読み始めたら、前の読み込みに止める合図（AbortSignal）を送る', async () => {
    fetchMock.mockImplementation(() => new Promise<BadgeCounts>(() => {}))
    const { rerender } = renderHook(({ pathname }) => useBadgeCounts(pathname), {
      initialProps: { pathname: '/search' },
    })
    await settle()

    rerender({ pathname: '/messages' })
    await settle()

    const firstSignal = fetchMock.mock.calls[0]?.[0]
    const secondSignal = fetchMock.mock.calls[1]?.[0]
    expect(firstSignal?.aborted).toBe(true)
    expect(secondSignal?.aborted).toBe(false)
  })

  it('止めた前の読み込みの応答が、あとから届いても、新しい数を上書きしない', async () => {
    const older = deferred()
    const newer = deferred()
    fetchMock.mockReturnValueOnce(older.promise).mockReturnValueOnce(newer.promise)
    const { result, rerender } = renderHook(({ pathname }) => useBadgeCounts(pathname), {
      initialProps: { pathname: '/search' },
    })
    await settle()
    rerender({ pathname: '/messages' })
    await settle()

    newer.resolve({ unreadMessages: 1, newMatches: 0, receivedLikes: 0 })
    await settle()
    older.resolve({ unreadMessages: 9, newMatches: 9, receivedLikes: 9 })
    await settle()

    expect(result.current).toEqual({ messagesTab: 1, likesTab: 0 })
  })

  it('画面から消えたら、30秒ごとの読み直しを止める', async () => {
    const { unmount } = renderHook(() => useBadgeCounts('/search'))
    await settle()

    unmount()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
      window.dispatchEvent(new Event('focus'))
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('読めなかった（500）ときは、失敗を記録し、前の数のまま返す（logging.md の4）', async () => {
    const reportErrorSpy = vi.spyOn(globalThis, 'reportError').mockImplementation(() => {})
    const { result, rerender } = renderHook(({ pathname }) => useBadgeCounts(pathname), {
      initialProps: { pathname: '/search' },
    })
    await settle()
    const failure = new Error('下のタブの数を読めませんでした（500）')
    fetchMock.mockRejectedValue(failure)

    rerender({ pathname: '/messages' })
    await settle()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(reportErrorSpy).toHaveBeenCalledWith(failure)
    expect(result.current).toEqual(tabs)
  })

  it('止めたとき（AbortError）と、ログインが切れたとき（client.ts が画面を移す）は、記録しない', async () => {
    const reportErrorSpy = vi.spyOn(globalThis, 'reportError').mockImplementation(() => {})
    fetchMock
      .mockRejectedValueOnce(new DOMException('止めた', 'AbortError'))
      .mockRejectedValueOnce(new UnauthorizedError())
    const { rerender } = renderHook(({ pathname }) => useBadgeCounts(pathname), {
      initialProps: { pathname: '/search' },
    })
    await settle()

    rerender({ pathname: '/messages' })
    await settle()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(reportErrorSpy).not.toHaveBeenCalled()
  })
})

describe('メールアドレスを確認していない会員の画面に、下のタブが出る', () => {
  it('API が断るので、読まずに数はどれも 0（FR-AUTH-021）', async () => {
    session = signedIn(false)

    const { result } = renderHook(() => useBadgeCounts('/search'))
    await settle()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000)
      window.dispatchEvent(new Event('focus'))
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.current).toEqual({ messagesTab: 0, likesTab: 0 })
  })
})
