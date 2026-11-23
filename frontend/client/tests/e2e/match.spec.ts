import { expect, test } from '@playwright/test'
import { likeFromProfile, matchFromReceivedLikes, signUpVerified } from './support.ts'

// 主な流れ：マッチ（FR-MATCH）。毎回、新しい男性と女性を登録して使う

/**
 * 正常系：要件が通す操作
 */
test.describe('いいねが届いた女性の会員が、届いたいいねの画面で「マッチする」を押す', () => {
  test('「マッチしました」が出て、トークを開ける。相手のメッセージのタブにも出る', async ({ browser }) => {
    const man = await signUpVerified(browser, 'matchM', 'male')
    const woman = await signUpVerified(browser, 'matchW', 'female')
    await likeFromProfile(man.page, woman.member)

    await matchFromReceivedLikes(woman.page, man.member)
    await woman.page.getByRole('link', { name: 'メッセージを送る' }).click()

    await expect(woman.page).toHaveURL(/\/messages\/[0-9a-f-]+$/)
    await man.page.goto('/messages')
    await expect(man.page.getByRole('link', { name: new RegExp(woman.member.nickname) })).toBeVisible()

    await man.context.close()
    await woman.context.close()
  })
})
