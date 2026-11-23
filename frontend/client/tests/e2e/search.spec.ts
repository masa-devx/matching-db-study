import { expect, test } from '@playwright/test'
import { login, SEED_MEMBER } from './support.ts'

// 主な流れ：検索（FR-SEARCH）。シードの会員で探す（読むだけ）

/**
 * 正常系：要件が通す操作
 */
test.describe('シードの会員が、検索のタブで相手を探し、カードを押す', () => {
  test('相手のカードが並び、カードを押すとその人のプロフィールが出る', async ({ page }) => {
    await login(page, SEED_MEMBER.email, SEED_MEMBER.password)

    await page.getByRole('link', { name: '検索' }).click()

    await expect(page).toHaveURL(/\/search/)
    const firstCard = page
      .getByRole('listitem')
      .filter({ has: page.getByRole('button', { name: /にいいねする$/ }) })
      .first()
    await expect(firstCard).toBeVisible()

    await firstCard.getByRole('link').click()

    await expect(page).toHaveURL(/\/users\/[0-9a-f-]+$/)
    await expect(page.getByRole('heading', { name: '自己紹介' })).toBeVisible()
  })
})
