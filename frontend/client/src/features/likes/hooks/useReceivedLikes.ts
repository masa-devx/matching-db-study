import { useEffect, useEffectEvent, useState } from 'react'
import { ApiError } from '../../../api/ApiError'
import { matchingApi } from '../../../api/matchingApi'
import { profileApi } from '../../../api/profileApi'
import type { Celebration, LikeResult, ReceivedLike, SkippedMember } from '../types'

// 「マッチする」の結果。失敗のトーストを出すかは、呼んだ画面が決める
export type MatchOutcome = 'matched' | 'needsPlan' | 'failed'

type ReceivedLikes = {
  likes: ReceivedLike[] | null // 読み込み中は null
  skips: SkippedMember[]
  busyUserId: string | null // 送っている間の相手。その相手のボタンを押せなくする
  upsellOpen: boolean // 有料会員への誘導のモーダルを出しているか
  celebration: Celebration | null // マッチの演出に出すもの
  match: (like: ReceivedLike) => Promise<MatchOutcome>
  skip: (like: ReceivedLike) => Promise<boolean>
  restore: (skipped: SkippedMember) => Promise<boolean>
  closeUpsell: () => void
  closeCelebration: () => void
}

// 届いたいいねの画面の手順と状態（FR-LIKE-010〜013）。届いたいいねとスキップした相手を読み、
// 「マッチする」（いいねを送り返す）・「スキップ」・「元に戻す」を送る。スキップ・元に戻すが成功したら、2つの一覧を読み直す。
// 分かっている不具合：ApiError でない失敗（つながらない・ログインが切れた）は、移す前の画面と同じく投げ直すだけで、ボタンが押せないまま残る
export const useReceivedLikes = (): ReceivedLikes => {
  const [likes, setLikes] = useState<ReceivedLike[] | null>(null)
  const [skips, setSkips] = useState<SkippedMember[]>([])
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [upsellOpen, setUpsellOpen] = useState<boolean>(false)
  const [celebration, setCelebration] = useState<Celebration | null>(null)

  // 2つの一覧を読む（2本）。isStale が true を返したら、届いた応答を捨てる（quality-frontend.md の R4）。
  // 分かっている不具合：読めなかったときを考えない（失敗を受けず、読み込み中のまま。移す前の画面と同じ）
  const load = (isStale: () => boolean): void => {
    matchingApi.receivedLikes().then((next) => {
      if (!isStale()) setLikes(next)
    })
    matchingApi.skips().then((next) => {
      if (!isStale()) setSkips(next)
    })
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

  // マッチする：いいねを送り返す（POST /api/me/likes）。相手からのいいねがあるので、マッチになる
  const match = async (like: ReceivedLike): Promise<MatchOutcome> => {
    setBusyUserId(like.userId)
    let result: LikeResult
    try {
      result = await matchingApi.like(like.userId)
    } catch (e) {
      if (!(e instanceof ApiError)) throw e
      setBusyUserId(null)
      // 送り返すいいねは、1日10回の数に入れない（FR-LIKE-011）。それでも 403 が返ったら、誘導のモーダルを出す
      if (e.status === 403) {
        setUpsellOpen(true)
        return 'needsPlan'
      }
      return 'failed'
    }
    setBusyUserId(null)
    // 演出に出す自分の写真。ApiError なら写真なしで演出を出す（ほかの失敗は投げ直す）
    const me = await profileApi.myMatchPerson().catch((e: unknown) => {
      if (!(e instanceof ApiError)) throw e
      return null
    })
    setCelebration({ me, partner: like, roomId: result.roomId })
    setLikes((before) => (before ?? []).filter((x) => x.userId !== like.userId))
    return 'matched'
  }

  // スキップ：この相手を、届いたいいねと検索に出さないようにする
  const skip = async (like: ReceivedLike): Promise<boolean> => {
    setBusyUserId(like.userId)
    try {
      await matchingApi.skip(like.userId)
    } catch (e) {
      if (!(e instanceof ApiError)) throw e
      setBusyUserId(null)
      return false
    }
    setBusyUserId(null)
    load(() => false)
    return true
  }

  // スキップを元に戻す：また、届いたいいねと検索に出るようになる
  const restore = async (skipped: SkippedMember): Promise<boolean> => {
    setBusyUserId(skipped.userId)
    try {
      await matchingApi.restoreSkip(skipped.userId)
    } catch (e) {
      if (!(e instanceof ApiError)) throw e
      setBusyUserId(null)
      return false
    }
    setBusyUserId(null)
    load(() => false)
    return true
  }

  return {
    likes,
    skips,
    busyUserId,
    upsellOpen,
    celebration,
    match,
    skip,
    restore,
    closeUpsell: () => setUpsellOpen(false),
    closeCelebration: () => setCelebration(null),
  }
}
