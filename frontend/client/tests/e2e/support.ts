import { type APIRequestContext, type Browser, type BrowserContext, expect, type Page } from '@playwright/test'

// E2E で使う値と、会員を用意する手順。会員の操作と同じく、画面から登録・確認・ログインする。
// API の応答は偽物にしない（testing.md の「テストを弱めて通さない」）

// 手元のメールの受信箱（Mailpit。compose.yaml の mailpit）
const MAILPIT_URL = 'http://127.0.0.1:58025'

// 読むだけの流れ（ログイン・検索）で使う、シードの会員（backend/client/database/seeders/SearchMembersSeeder.php）。
// メールアドレスを確認した、無料の男性。パスワードは、シードの会員のどれも password
export const SEED_MEMBER = { email: 'search00001@example.test', password: 'password' }

export type Gender = 'male' | 'female'

export type Member = {
  email: string
  password: string
  nickname: string
  publicId: string
}

// ログインした会員と、その会員のブラウザ（2人の会員を同時に動かすため、会員ごとに別のブラウザの状態にする）
export type SignedInMember = {
  member: Member
  context: BrowserContext
  page: Page
}

// 毎回ちがう印（くり返し流しても、登録のメールアドレスが重ならないように）
const uniqueLabel = (): string => {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
}

export const login = async (page: Page, email: string, password: string): Promise<void> => {
  await page.goto('/login')
  await page.getByLabel('メールアドレス').fill(email)
  await page.getByLabel('パスワード', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'ログイン' }).click()
  await expect(page).toHaveURL(/\/home$/)
}

// 登録の画面から登録する（18歳以上の生年月日・同意のチェックを入れる）
export const register = async (page: Page, member: Omit<Member, 'publicId'>, gender: Gender): Promise<void> => {
  await page.goto('/register')
  await page.getByLabel('メールアドレス').fill(member.email)
  // ラベルの名前には、下の案内（8〜64文字）も入る
  await page.getByLabel(/^パスワード\s*8〜64文字/).fill(member.password)
  await page.getByLabel('パスワード（もう一度）').fill(member.password)
  await page.getByLabel('ニックネーム').fill(member.nickname)
  await page.getByLabel('性別').selectOption(gender)
  await page.getByLabel('生まれた年').selectOption('1996')
  await page.getByLabel('生まれた月').selectOption('4')
  await page.getByLabel('生まれた日').selectOption('1')
  await page.getByLabel('18歳以上で、独身です').check()
  await page.getByRole('checkbox', { name: /に同意します/ }).check()
  await page.getByRole('button', { name: '登録する' }).click()
  await expect(page.getByRole('heading', { name: '確認のメールを送りました' })).toBeVisible()
}

// 確認のメールのリンク（/verify/<確認用の文字>）を、受信箱から探す。まだ届いていなければ null
const findVerifyPath = async (request: APIRequestContext, email: string): Promise<string | null> => {
  const search = await request.get(`${MAILPIT_URL}/api/v1/search`, { params: { query: `to:"${email}"` } })
  const found: { messages: { ID: string }[] } = await search.json()
  const latest = found.messages[0]
  if (latest === undefined) return null
  const message = await request.get(`${MAILPIT_URL}/api/v1/message/${latest.ID}`)
  const body: { Text: string } = await message.json()
  return body.Text.match(/\/verify\/[^\s"<>]+/)?.[0] ?? null
}

// 届いた確認のメールのリンクを開き、メールアドレスを確認する
export const verifyEmail = async (page: Page, email: string): Promise<void> => {
  let path: string | null = null
  await expect
    .poll(async () => {
      path = await findVerifyPath(page.request, email)
      return path
    })
    .not.toBeNull()
  await page.goto(path ?? '')
  await expect(page.getByText('メールアドレスを確認しました')).toBeVisible()
}

// 新しい会員の、メールアドレスと名前を決める（ニックネームは20文字まで）
export const newMember = (label: string): Omit<Member, 'publicId'> => {
  const unique = uniqueLabel()
  return {
    email: `e2e-${label}-${unique}@example.test`,
    password: 'e2e-password',
    nickname: `${label}${unique}`.slice(0, 20),
  }
}

// 手元の API と、画面のオリジン（API は、画面のオリジンから来た要求だけをセッションで見る。D-027）
const API_URL = 'http://localhost:8000'
const SCREEN_ORIGIN = 'http://localhost:5173'

// ログインしている自分の public_id を、そのブラウザのセッションの Cookie で API に聞く（相手のプロフィールの URL に使う）
const publicIdOf = async (page: Page): Promise<string> => {
  const res = await page.request.get(`${API_URL}/api/me`, {
    headers: { Accept: 'application/json', Origin: SCREEN_ORIGIN, Referer: `${SCREEN_ORIGIN}/` },
  })
  const me: unknown = await res.json()
  if (typeof me === 'object' && me !== null && 'public_id' in me && typeof me.public_id === 'string') {
    return me.public_id
  }
  throw new Error(`GET /api/me の応答に public_id がありません（${res.status()}）`)
}

// 新しい会員を登録し、メールアドレスを確認して、ログインした状態にする
export const signUpVerified = async (browser: Browser, label: string, gender: Gender): Promise<SignedInMember> => {
  const context = await browser.newContext()
  const page = await context.newPage()
  const member = newMember(label)
  await register(page, member, gender)
  await verifyEmail(page, member.email)
  await login(page, member.email, member.password)
  return { member: { ...member, publicId: await publicIdOf(page) }, context, page }
}

// 相手のプロフィールの画面から、いいねする
export const likeFromProfile = async (page: Page, partner: Member): Promise<void> => {
  await page.goto(`/users/${partner.publicId}`)
  await page.getByRole('button', { name: 'いいね', exact: true }).click()
  await expect(page.getByRole('button', { name: 'いいね済み' })).toBeVisible()
}

// 届いたいいねの画面で、相手に「マッチする」を押す
export const matchFromReceivedLikes = async (page: Page, partner: Member): Promise<void> => {
  await page.goto('/likes')
  const card = page.getByRole('listitem').filter({ hasText: partner.nickname })
  await card.getByRole('button', { name: 'マッチする' }).click()
  await expect(page.getByRole('dialog', { name: 'マッチしました' })).toBeVisible()
}
