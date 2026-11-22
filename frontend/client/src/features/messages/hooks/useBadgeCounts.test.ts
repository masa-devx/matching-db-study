import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionState } from '../../../shared/session/SessionProvider'
import { fetchBadgeCounts } from '../api'
import type { BadgeCounts } from '../types'
import { useBadgeCounts } from './useBadgeCounts'

// features/messages/hooks/useBadgeCounts.ts：下のタブの数を、いつ読むか（FR-UI-032・FR-UI-093）。
// API を呼ぶ所（api.ts の fetchBadgeCounts）は偽物にする

vi.mock('../api', () => ({ fetchBadgeCounts: vi.fn() }))

let session: SessionState
vi.mock('../../../shared/session/SessionProvider', () => ({
  useSession: () => ({ session }),
}))

const fetchMock = vi.mocked(fetchBadgeCounts)
const counts: BadgeCounts = { unreadMessages: 3, newMatches: 1, receivedLikes: 2 }

function signedIn(emailVerified: boolean): SessionState {
  return { status: 'signedIn', account: { userId: 'u1', email: 'a@example.test', emailVerified } }
}

// 読み込みの片付け（then の中の setState）まで進める
async function settle(): Promise<void> {
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
  it('出たときに1回だけ読み、その数を返す（FR-UI-032）', async () => {
    const { result } = renderHook(() => useBadgeCounts('/search'))
    await settle()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(result.current).toEqual(counts)
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

  it('次を読み始めたら、前の読み込みを止める（古い応答で、新しい数を上書きしない）', async () => {
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

  it('読めなかったときは、前の数のまま返す', async () => {
    const { result, rerender } = renderHook(({ pathname }) => useBadgeCounts(pathname), {
      initialProps: { pathname: '/search' },
    })
    await settle()
    fetchMock.mockRejectedValue(new Error('下のタブの数を読めませんでした（500）'))

    rerender({ pathname: '/messages' })
    await settle()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.current).toEqual(counts)
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
    expect(result.current).toEqual({ unreadMessages: 0, newMatches: 0, receivedLikes: 0 })
  })
})
