import { expect, test } from '@playwright/test'
import { signUpVerified } from './support.ts'

// 主な流れ：有料（FR-PAID-001・FR-PAID-006）。毎回、新しい男性を登録して購入する（お金は払わない。学習用）

/**
 * 正常系：要件が通す操作
 */
test.describe('無料の男性の会員が、有料会員の画面でプランを選んで購入する', () => {
  test('有料会員の画面に戻り、「有料会員です」と期限が出る（FR-PAID-001・FR-PAID-006）', async ({ browser }) => {
    const man = await signUpVerified(browser, 'paidM', 'male')
    await man.page.goto('/plans')
    await expect(man.page.getByText('有料会員になると、できることが増えます。')).toBeVisible()

    await man.page.getByRole('link', { name: /^1か月/ }).click()
    await man.page.getByRole('button', { name: '購入する' }).click()

    await expect(man.page.getByText('有料会員になりました')).toBeVisible()
    await expect(man.page).toHaveURL(/\/plans$/)
    await expect(man.page.getByText(/^有料会員です（.+ まで）$/)).toBeVisible()

    await man.context.close()
  })
})
