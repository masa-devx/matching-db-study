import { useEffect, useEffectEvent, useState } from 'react'
import { ApiError, StoppedRequestError } from '../../../api/ApiError'
import { matchingApi } from '../../../api/matchingApi'
import { profileApi } from '../../../api/profileApi'
import { recountBadges } from '../../messages'
import type { Celebration, LikeResult, ReceivedLike, SkippedMember } from '../types'

// 送った結果。'stopped' は、ログインが切れた・メンテナンス中などで、client.ts が画面を移す・帯を出したとき（呼んだ画面は何も出さない）
export type MatchOutcome = 'matched' | 'needsPlan' | 'failed' | 'stopped'
export type SendOutcome = 'done' | 'failed' | 'stopped'

// 2つの一覧。読み込み中と失敗のときは、どちらも空
type Lists = {
  status: 'loading' | 'error' | 'success'
  likes: ReceivedLike[]
  skips: SkippedMember[]
}

type ReceivedLikes = Lists & {
  busyUserId: string | null // 送っている間の相手。その相手のボタンを押せなくする
  upsellOpen: boolean // 有料会員への誘導のモーダルを出しているか
  celebration: Celebration | null // マッチの演出に出すもの
  reload: () => void
  match: (like: ReceivedLike) => Promise<MatchOutcome>
  skip: (like: ReceivedLike) => Promise<SendOutcome>
  restore: (skipped: SkippedMember) => Promise<SendOutcome>
  closeUpsell: () => void
  closeCelebration: () => void
}

const LOADING: Lists = { status: 'loading', likes: [], skips: [] }

// API が返した失敗（ApiError）でも、client.ts が扱う失敗（StoppedRequestError）でもないもの（つながらない・時間切れ）は、
// サーバーのログに残らないので記録する（logging.md の4）
const reportUnexpected = (e: unknown): void => {
  if (!(e instanceof ApiError) && !(e instanceof StoppedRequestError)) reportError(e)
}

// 送れなかったときの結果。ログインが切れた・メンテナンス中・確認していないは、client.ts が画面を移す・帯を出すので、黙る
const failureOf = (e: unknown): 'failed' | 'stopped' => {
  reportUnexpected(e)
  return e instanceof StoppedRequestError ? 'stopped' : 'failed'
}

// 届いたいいねの画面の手順と状態（FR-LIKE-010〜013）。届いたいいねとスキップした相手を読み、
// 「マッチする」（いいねを送り返す）・「スキップ」・「元に戻す」を送る。
// 成功したら、下のタブの数を読み直す（FR-UI-064）。スキップ・元に戻すのあとは、2つの一覧も読み直す
export const useReceivedLikes = (): ReceivedLikes => {
  const [lists, setLists] = useState<Lists>(LOADING)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [upsellOpen, setUpsellOpen] = useState<boolean>(false)
  const [celebration, setCelebration] = useState<Celebration | null>(null)

  // 2つの一覧を読む（2本）。どちらかが読めなければ、失敗にして「もう一度」を出す（FR-UI-013）。
  // 読み直している間は、前の一覧を出したまま。isStale が true を返したら、届いた応答を捨てる（quality-frontend.md の R4）
  const load = async (isStale: () => boolean): Promise<void> => {
    try {
      const [likes, skips] = await Promise.all([matchingApi.receivedLikes(), matchingApi.skips()])
      if (!isStale()) setLists({ status: 'success', likes, skips })
    } catch (e) {
      if (isStale() || failureOf(e) === 'stopped') return
      setLists({ status: 'error', likes: [], skips: [] })
    }
  }

  // 開いたとき。画面から消えたら、あとから届いた応答を捨てる
  const loadOnOpen = useEffectEvent(load)
  useEffect(() => {
    let stale = false
    loadOnOpen(() => stale)
    return () => {
      stale = true
    }
  }, [])

  // 失敗のあとの「もう一度」。読み込み中（スケルトン）に戻してから読む
  const reload = (): void => {
    setLists(LOADING)
    load(() => false)
  }

  // マッチする：いいねを送り返す（POST /api/me/likes）。相手からのいいねがあるので、マッチになる
  const match = async (like: ReceivedLike): Promise<MatchOutcome> => {
    setBusyUserId(like.userId)
    let result: LikeResult
    try {
      result = await matchingApi.like(like.userId)
    } catch (e) {
      setBusyUserId(null)
      // 送り返すいいねは、1日10回の数に入れない（FR-LIKE-011）。それでも 403 が返ったら、誘導のモーダルを出す
      if (e instanceof ApiError && e.status === 403) {
        setUpsellOpen(true)
        return 'needsPlan'
      }
      return failureOf(e)
    }
    setBusyUserId(null)
    // 届いたいいねが1つ減り、新しいマッチが1つ増える（FR-UI-067）
    recountBadges()
    // 演出に出す自分の写真。読めなければ、写真なしで演出を出す（FR-UI-028）
    const me = await profileApi.myMatchPerson().catch((e: unknown) => {
      reportUnexpected(e)
      return null
    })
    setCelebration({ me, partner: like, roomId: result.roomId })
    setLists((before) => ({ ...before, likes: before.likes.filter((x) => x.userId !== like.userId) }))
    return 'matched'
  }

  // スキップ：この相手を、届いたいいねと検索に出さないようにする
  const skip = async (like: ReceivedLike): Promise<SendOutcome> => {
    setBusyUserId(like.userId)
    try {
      await matchingApi.skip(like.userId)
    } catch (e) {
      setBusyUserId(null)
      return failureOf(e)
    }
    setBusyUserId(null)
    load(() => false)
    recountBadges()
    return 'done'
  }

  // スキップを元に戻す：また、届いたいいねと検索に出るようになる
  const restore = async (skipped: SkippedMember): Promise<SendOutcome> => {
    setBusyUserId(skipped.userId)
    try {
      await matchingApi.restoreSkip(skipped.userId)
    } catch (e) {
      setBusyUserId(null)
      return failureOf(e)
    }
    setBusyUserId(null)
    load(() => false)
    recountBadges()
    return 'done'
  }

  return {
    ...lists,
    busyUserId,
    upsellOpen,
    celebration,
    reload,
    match,
    skip,
    restore,
    closeUpsell: () => setUpsellOpen(false),
    closeCelebration: () => setCelebration(null),
  }
}
