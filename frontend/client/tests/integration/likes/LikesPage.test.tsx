import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, HttpResponse, http } from 'msw'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiUrl } from '../../../src/api/client'
import { ToastProvider } from '../../../src/components/Toast'
import { LikesPage } from '../../../src/features/likes'
import { SessionProvider } from '../../../src/shared/session/SessionProvider'
import { stubDialog } from '../../support/dialog'
import {
  LIKES_URL,
  RECEIVED_LIKES_URL,
  receivedLikeBody,
  receivedLikesBody,
  SKIP_URL,
  SKIPS_URL,
  skipBody,
  skipsBody,
} from '../../support/handlers/matchingApi'
import { sentRequests, server } from '../../support/server'

// 届いたいいねの画面（/likes）の今の動き（FR-LIKE-010〜013・FR-UI-064〜067）。画面を移す前に足した、今の動きを確かめるテスト。
// 本物の SessionProvider で包み、API は MSW で偽物にする（届いたいいね2人・スキップした相手1人・送り返すとマッチ が既定）

// テストで使う値
// 年齢を数える「今日」（年齢は、今の年から生まれた年を引いて出す）
const TODAY = new Date('2026-11-24T12:00:00+09:00')

const renderLikes = (): void => {
  render(
    <SessionProvider>
      <ToastProvider>
        <MemoryRouter initialEntries={['/likes']}>
          <LikesPage />
        </MemoryRouter>
      </ToastProvider>
    </SessionProvider>,
  )
}

// 届いたいいねの一覧の、その相手の行
const cardOf = (nickname: string): HTMLElement => {
  const card = screen.getAllByRole('listitem').find((item) => within(item).queryByText(nickname) !== null)
  if (!card) throw new Error(`${nickname}さんの行がありません`)
  return card
}

// 一覧が出るまで待つ（見出しは、読み込みが終わってから出る）
const waitForList = async (): Promise<void> => {
  await screen.findByRole('heading', { name: 'いいね' })
}

beforeAll(() => {
  stubDialog()
})

beforeEach(() => {
  // 年齢の計算だけが今の日付を読むので、Date だけを偽物にする（タイマーは本物のまま）
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(TODAY)
})

afterEach(() => {
  vi.useRealTimers()
})

/**
 * 正常系：要件が通す操作
 */
describe('ログインした会員が、いいねのタブ（/likes）を開き、2人からいいねが届いている', () => {
  it('届いたいいねの一覧と、スキップした相手の一覧の2本だけを読む（FR-LIKE-010）', async () => {
    renderLikes()

    await waitForList()

    expect(sentRequests('GET', '/api/me/received-likes')).toHaveLength(1)
    expect(sentRequests('GET', '/api/me/skips')).toHaveLength(1)
  })

  it('相手ごとに、ニックネーム・年齢・都道府県・いいねした日と、「スキップ」「マッチする」が、API の順に並ぶ（FR-UI-064）', async () => {
    renderLikes()

    await waitForList()

    const yuki = cardOf('ゆき')
    expect(within(yuki).getByText('30歳')).toBeInTheDocument()
    expect(within(yuki).getByText('東京都 11/20 にいいね')).toBeInTheDocument()
    expect(within(yuki).getByRole('button', { name: 'スキップ' })).toBeEnabled()
    expect(within(yuki).getByRole('button', { name: 'マッチする' })).toBeEnabled()
    const aoi = cardOf('あおい')
    expect(within(aoi).getByText('28歳')).toBeInTheDocument()
    expect(within(aoi).getByText('大阪府 11/19 にいいね')).toBeInTheDocument()
    expect(yuki.compareDocumentPosition(aoi) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('相手を押すと、その相手のプロフィール（/users/<相手の ID>）に移るリンクになっている（FR-UI-064）', async () => {
    renderLikes()

    await waitForList()

    expect(within(cardOf('ゆき')).getByRole('link')).toHaveAttribute('href', '/users/user-b')
  })

  it('スキップしても相手に伝わらないことを、画面の上に書いている（FR-UI-065）', async () => {
    renderLikes()

    await waitForList()

    expect(
      screen.getByText(
        'あなたにいいねした人です。「マッチする」でメッセージを送れるようになります。スキップしても、相手には伝わりません。',
      ),
    ).toBeInTheDocument()
  })
})

describe('ログインした会員が、いいねのタブを開き、今年の誕生日がまだ来ていない相手からいいねが届いている', () => {
  // 分かっている不具合：要件は今日の年齢（29歳）。今の年から生まれた年を引くだけなので、誕生日の前は1歳多い
  it('年齢が、今の年から生まれた年を引いた数で出る（30歳）', async () => {
    server.use(http.get(RECEIVED_LIKES_URL, () => HttpResponse.json([receivedLikeBody({ birthday: '1996-12-31' })])))
    renderLikes()

    await waitForList()

    expect(within(cardOf('ゆき')).getByText('30歳')).toBeInTheDocument()
  })
})

describe('ログインした会員が、いいねのタブを開き、ニックネームのない相手からいいねが届いている', () => {
  it('ニックネームの代わりに「退会した会員」と出る', async () => {
    server.use(
      http.get(RECEIVED_LIKES_URL, () =>
        HttpResponse.json([receivedLikeBody({ nickname: null, birthday: null, prefecture: null })]),
      ),
    )
    renderLikes()

    await waitForList()

    expect(screen.getByText('退会した会員')).toBeInTheDocument()
  })
})

describe('ログインした会員が、いいねのタブを開き、一覧の応答がまだ来ない', () => {
  it('見出しと一覧の代わりに、読み込み中の形（スケルトン）だけが出る（FR-UI-025）', async () => {
    server.use(
      http.get(RECEIVED_LIKES_URL, async () => {
        await delay('infinite')
      }),
    )
    renderLikes()

    await vi.waitFor(() => expect(sentRequests('GET', '/api/me/received-likes')).toHaveLength(1))

    expect(screen.queryByRole('heading', { name: 'いいね' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'マッチする' })).not.toBeInTheDocument()
  })
})

describe('ログインした会員が、いいねのタブを開き、いいねが1つも届いていない', () => {
  it('「まだ、いいねは届いていません」と、検索へ移る「検索で相手を探す」が出る（FR-UI-064・FR-UI-033）', async () => {
    server.use(http.get(RECEIVED_LIKES_URL, () => HttpResponse.json([])))
    renderLikes()

    expect(await screen.findByText('まだ、いいねは届いていません')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '検索で相手を探す' })).toHaveAttribute('href', '/search')
  })
})

describe('ログインした会員が、届いたいいねの相手で「マッチする」を押す', () => {
  it('その相手にいいねを送り、マッチの演出を出し、その相手を一覧から外す（FR-LIKE-011・FR-UI-067・FR-UI-028）', async () => {
    renderLikes()
    await waitForList()

    await userEvent.click(within(cardOf('ゆき')).getByRole('button', { name: 'マッチする' }))

    const celebration = await screen.findByRole('dialog', { name: 'マッチしました' })
    expect(within(celebration).getByText('ゆきさんも、あなたにいいねしていました')).toBeInTheDocument()
    const [sent] = sentRequests('POST', '/api/me/likes')
    expect(await sent?.json()).toEqual({ user_id: 'user-b' })
    expect(screen.queryByRole('link', { name: /ゆき/ })).not.toBeInTheDocument()
    expect(cardOf('あおい')).toBeInTheDocument()
  })

  it('演出の「メッセージを送る」は、応答のトークルームの画面（/messages/<ルームの ID>）に移るリンク（FR-UI-069）', async () => {
    renderLikes()
    await waitForList()

    await userEvent.click(within(cardOf('ゆき')).getByRole('button', { name: 'マッチする' }))

    const celebration = await screen.findByRole('dialog', { name: 'マッチしました' })
    expect(within(celebration).getByRole('link', { name: 'メッセージを送る' })).toHaveAttribute(
      'href',
      '/messages/room-1',
    )
  })

  it('演出に出す自分の写真のために、自分（GET /api/me）と自分のプロフィール（GET /api/users/<自分の ID>）を読む（FR-UI-028）', async () => {
    renderLikes()
    await waitForList()
    // SessionProvider が開いたときに読む GET /api/me は、数えない
    const meBefore = sentRequests('GET', '/api/me').length

    await userEvent.click(within(cardOf('ゆき')).getByRole('button', { name: 'マッチする' }))

    await screen.findByRole('dialog', { name: 'マッチしました' })
    expect(sentRequests('GET', '/api/me')).toHaveLength(meBefore + 1)
    expect(sentRequests('GET', '/api/users/user-a')).toHaveLength(1)
  })

  it('演出の「あとで」を押すと、演出を閉じ、いいねのタブのまま（FR-UI-069）', async () => {
    renderLikes()
    await waitForList()
    await userEvent.click(within(cardOf('ゆき')).getByRole('button', { name: 'マッチする' }))

    await userEvent.click(await screen.findByRole('button', { name: 'あとで' }))

    expect(screen.queryByRole('dialog', { name: 'マッチしました' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'いいね' })).toBeInTheDocument()
  })
})

describe('ログインした会員が「マッチする」を押し、いいねの応答がまだ来ない', () => {
  it('その相手の「マッチする」と「スキップ」だけが押せなくなる（FR-UI-026）', async () => {
    server.use(
      http.post(LIKES_URL, async () => {
        await delay('infinite')
      }),
    )
    renderLikes()
    await waitForList()

    await userEvent.click(within(cardOf('ゆき')).getByRole('button', { name: 'マッチする' }))

    await vi.waitFor(() => expect(sentRequests('POST', '/api/me/likes')).toHaveLength(1))
    expect(within(cardOf('ゆき')).getByRole('button', { name: 'マッチする' })).toBeDisabled()
    expect(within(cardOf('ゆき')).getByRole('button', { name: 'スキップ' })).toBeDisabled()
    expect(within(cardOf('あおい')).getByRole('button', { name: 'マッチする' })).toBeEnabled()
  })
})

describe('ログインした会員が、届いたいいねの相手で「スキップ」を押す', () => {
  it('その相手をスキップし、「スキップしました」と出し、2つの一覧を読み直す（FR-LIKE-012・FR-UI-065）', async () => {
    // API の側でスキップが済んだあとの一覧（その相手が、届いたいいねから、スキップした相手に移る）
    let skipped = false
    server.use(
      http.post(SKIPS_URL, () => {
        skipped = true
        return HttpResponse.json({ id: 1, skipper_id: 1, skipped_id: 2 }, { status: 201 })
      }),
      http.get(RECEIVED_LIKES_URL, () => HttpResponse.json(skipped ? receivedLikesBody.slice(1) : receivedLikesBody)),
      http.get(SKIPS_URL, () =>
        HttpResponse.json(skipped ? [skipBody({ user_id: 'user-b', nickname: 'ゆき' }), ...skipsBody] : skipsBody),
      ),
    )
    renderLikes()
    await waitForList()

    await userEvent.click(within(cardOf('ゆき')).getByRole('button', { name: 'スキップ' }))

    expect(await screen.findByText('スキップしました')).toBeInTheDocument()
    expect(await screen.findByText('スキップした相手（2人）')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /ゆき/ })).not.toBeInTheDocument()
    const [sent] = sentRequests('POST', '/api/me/skips')
    expect(await sent?.json()).toEqual({ user_id: 'user-b' })
    expect(sentRequests('GET', '/api/me/received-likes')).toHaveLength(2)
    expect(sentRequests('GET', '/api/me/skips')).toHaveLength(2)
  })
})

describe('ログインした会員が、いいねのタブを開き、1人をスキップしている', () => {
  it('下の「スキップした相手（1人）」を開くと、ニックネーム・年齢・スキップした日と「元に戻す」が出る（FR-LIKE-013・FR-UI-066）', async () => {
    renderLikes()
    await waitForList()

    await userEvent.click(screen.getByText('スキップした相手（1人）'))

    expect(screen.getByText('みお')).toBeInTheDocument()
    expect(screen.getByText('31歳')).toBeInTheDocument()
    expect(screen.getByText('11/18 にスキップ')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'みおさんのスキップを元に戻す' })).toBeEnabled()
  })

  it('「元に戻す」を押すと、スキップを消し、「元に戻しました」と出し、2つの一覧を読み直す（FR-LIKE-013・FR-UI-066）', async () => {
    renderLikes()
    await waitForList()
    await userEvent.click(screen.getByText('スキップした相手（1人）'))

    await userEvent.click(screen.getByRole('button', { name: 'みおさんのスキップを元に戻す' }))

    expect(await screen.findByText('元に戻しました')).toBeInTheDocument()
    expect(sentRequests('DELETE', '/api/me/skips/user-d')).toHaveLength(1)
    await vi.waitFor(() => expect(sentRequests('GET', '/api/me/skips')).toHaveLength(2))
    expect(sentRequests('GET', '/api/me/received-likes')).toHaveLength(2)
  })
})

describe('ログインした会員が、いいねのタブを開き、だれもスキップしていない', () => {
  it('「スキップした相手」の欄を出さない（FR-UI-066）', async () => {
    server.use(http.get(SKIPS_URL, () => HttpResponse.json([])))
    renderLikes()

    await waitForList()

    expect(screen.queryByText(/スキップした相手/)).not.toBeInTheDocument()
  })
})

describe('ログインした会員が、いいねのタブを開き、同じ相手を2回スキップしている', () => {
  // 分かっている不具合：要件は1つのまま（FR-LIKE-012）。表に UNIQUE がなく、API が同じ相手を2行返すので、画面も2行出す
  it('同じ相手が2行出て、「スキップした相手（2人）」と数える', async () => {
    server.use(http.get(SKIPS_URL, () => HttpResponse.json([skipBody(), skipBody()])))
    renderLikes()
    await waitForList()

    await userEvent.click(screen.getByText('スキップした相手（2人）'))

    expect(screen.getAllByRole('button', { name: 'みおさんのスキップを元に戻す' })).toHaveLength(2)
  })
})

/**
 * 異常系：要件が断る操作
 */
describe('ログインした会員が「マッチする」を押し、いいねが断られる（403）', () => {
  it('有料会員への誘導のモーダルを出し、ボタンをまた押せるようにする（FR-UI-040）', async () => {
    server.use(http.post(LIKES_URL, () => HttpResponse.json({ message: '有料会員になると使えます' }, { status: 403 })))
    renderLikes()
    await waitForList()

    await userEvent.click(within(cardOf('ゆき')).getByRole('button', { name: 'マッチする' }))

    expect(await screen.findByRole('dialog', { name: '有料会員になると使えます' })).toBeInTheDocument()
    expect(within(cardOf('ゆき')).getByRole('button', { name: 'マッチする' })).toBeEnabled()
    expect(screen.queryByRole('dialog', { name: 'マッチしました' })).not.toBeInTheDocument()
  })
})

describe('ログインした会員が「マッチする」を押し、API が失敗する（500）', () => {
  it('「マッチできませんでした」と出し、その相手を一覧に残し、ボタンをまた押せるようにする', async () => {
    server.use(http.post(LIKES_URL, () => new HttpResponse(null, { status: 500 })))
    renderLikes()
    await waitForList()

    await userEvent.click(within(cardOf('ゆき')).getByRole('button', { name: 'マッチする' }))

    expect(await screen.findByText('マッチできませんでした')).toBeInTheDocument()
    expect(within(cardOf('ゆき')).getByRole('button', { name: 'マッチする' })).toBeEnabled()
    expect(screen.queryByRole('dialog', { name: '有料会員になると使えます' })).not.toBeInTheDocument()
  })
})

describe('ログインした会員が「マッチする」を押してマッチし、自分のプロフィールが読めない（500）', () => {
  it('自分の写真なしで、マッチの演出を出す（FR-UI-028）', async () => {
    server.use(http.get(apiUrl('/api/users/:publicId'), () => new HttpResponse(null, { status: 500 })))
    renderLikes()
    await waitForList()

    await userEvent.click(within(cardOf('ゆき')).getByRole('button', { name: 'マッチする' }))

    expect(await screen.findByRole('dialog', { name: 'マッチしました' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /ゆき/ })).not.toBeInTheDocument()
  })
})

describe('ログインした会員が「スキップ」を押し、API が失敗する（500）', () => {
  it('「スキップできませんでした」と出し、一覧を読み直さず、ボタンをまた押せるようにする', async () => {
    server.use(http.post(SKIPS_URL, () => new HttpResponse(null, { status: 500 })))
    renderLikes()
    await waitForList()

    await userEvent.click(within(cardOf('ゆき')).getByRole('button', { name: 'スキップ' }))

    expect(await screen.findByText('スキップできませんでした')).toBeInTheDocument()
    expect(within(cardOf('ゆき')).getByRole('button', { name: 'スキップ' })).toBeEnabled()
    expect(sentRequests('GET', '/api/me/received-likes')).toHaveLength(1)
  })
})

describe('ログインした会員が「元に戻す」を押し、API が失敗する（500）', () => {
  it('「元に戻せませんでした」と出し、一覧を読み直さず、ボタンをまた押せるようにする', async () => {
    server.use(http.delete(SKIP_URL, () => new HttpResponse(null, { status: 500 })))
    renderLikes()
    await waitForList()
    await userEvent.click(screen.getByText('スキップした相手（1人）'))

    await userEvent.click(screen.getByRole('button', { name: 'みおさんのスキップを元に戻す' }))

    expect(await screen.findByText('元に戻せませんでした')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'みおさんのスキップを元に戻す' })).toBeEnabled()
    expect(sentRequests('GET', '/api/me/skips')).toHaveLength(1)
  })
})
