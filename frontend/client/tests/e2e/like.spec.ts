import { expect, test } from '@playwright/test'
import { likeFromProfile, signUpVerified } from './support.ts'

// 主な流れ：いいね（FR-LIKE）。毎回、新しい男性と女性を登録して使う（シードの会員にはいいねしない）

/**
 * 正常系：要件が通す操作
 */
test.describe('男性の会員が、女性の会員のプロフィールからいいねする', () => {
  test('「いいね済み」になり、相手の「いいね」のタブに、届いたいいねとして出る', async ({ browser }) => {
    const man = await signUpVerified(browser, 'likeM', 'male')
    const woman = await signUpVerified(browser, 'likeW', 'female')

    await likeFromProfile(man.page, woman.member)

    await expect(man.page.getByText('いいねしました')).toBeVisible()
    await woman.page.goto('/likes')
    const card = woman.page.getByRole('listitem').filter({ hasText: man.member.nickname })
    await expect(card.getByRole('button', { name: 'マッチする' })).toBeVisible()

    await man.context.close()
    await woman.context.close()
  })
})
