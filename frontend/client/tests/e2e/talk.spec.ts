import { expect, test } from '@playwright/test'
import { likeFromProfile, matchFromReceivedLikes, signUpVerified } from './support.ts'

// 主な流れ：トーク（FR-MSG・FR-PAID-007）。毎回、新しい男性と女性を登録し、マッチさせてから使う

/**
 * 正常系：要件が通す操作
 */
test.describe('マッチした女性の会員がメッセージを送り、無料の男性の会員がトークを開く', () => {
  test('送ったメッセージが男性のトークに出る。無料の男性には、送る欄の代わりに有料の案内が出る（FR-PAID-007）', async ({
    browser,
  }) => {
    const man = await signUpVerified(browser, 'talkM', 'male')
    const woman = await signUpVerified(browser, 'talkW', 'female')
    await likeFromProfile(man.page, woman.member)
    await matchFromReceivedLikes(woman.page, man.member)
    await woman.page.getByRole('link', { name: 'メッセージを送る' }).click()
    const message = `はじめまして（${woman.member.nickname}）`

    await woman.page.getByRole('textbox', { name: 'メッセージ', exact: true }).fill(message)
    await woman.page.getByRole('button', { name: '送る' }).click()
    await expect(woman.page.getByText(message)).toBeVisible()
    await man.page.goto('/messages')
    await man.page.getByRole('link', { name: new RegExp(woman.member.nickname) }).click()

    await expect(man.page.getByText(message)).toBeVisible()
    await expect(man.page.getByRole('link', { name: '有料会員になる' })).toBeVisible()
    await expect(man.page.getByRole('textbox', { name: 'メッセージ', exact: true })).toBeHidden()

    await man.context.close()
    await woman.context.close()
  })
})
