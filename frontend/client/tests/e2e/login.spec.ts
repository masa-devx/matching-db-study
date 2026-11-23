import { expect, test } from '@playwright/test'
import { login, SEED_MEMBER } from './support.ts'

// 主な流れ：ログイン（FR-AUTH-010・FR-AUTH-016・FR-AUTH-017）。シードの会員を使う（ログインの日時とセッションの行だけが変わる）

// テストで使う値
const WRONG_PASSWORD = 'wrong-password'

/**
 * 正常系：要件が通す操作
 */
test.describe('シードの会員が、正しいパスワードでログインし、ホームからログアウトする', () => {
  test('ログインするとホームが出て、読み込み直してもログインしたまま。ログアウトするとログインの画面に戻り、ログインが要る画面は開けない（FR-AUTH-016・FR-AUTH-017）', async ({
    page,
  }) => {
    await login(page, SEED_MEMBER.email, SEED_MEMBER.password)
    await expect(page.getByRole('button', { name: 'ログアウト' })).toBeVisible()

    await page.reload()

    await expect(page).toHaveURL(/\/home$/)

    await page.getByRole('button', { name: 'ログアウト' }).click()
    await page.getByRole('button', { name: 'ログアウトする' }).click()

    await expect(page).toHaveURL(/\/login$/)

    await page.goto('/home')

    await expect(page).toHaveURL(/\/login$/)
  })
})

/**
 * 異常系：要件が断る操作
 */
test.describe('シードの会員が、違うパスワードでログインする', () => {
  test('ログインの画面のまま、誤りの文を出す（401。FR-AUTH-011）', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('メールアドレス').fill(SEED_MEMBER.email)
    await page.getByLabel('パスワード', { exact: true }).fill(WRONG_PASSWORD)

    await page.getByRole('button', { name: 'ログイン' }).click()

    await expect(page.getByRole('alert')).toHaveText(/パスワードが違います/)
    await expect(page).toHaveURL(/\/login$/)
  })
})
