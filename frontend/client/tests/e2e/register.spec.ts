import { expect, test } from '@playwright/test'
import { login, newMember, register, verifyEmail } from './support.ts'

// 主な流れ：登録（FR-AUTH-001・FR-AUTH-006・FR-AUTH-021）。毎回ちがうメールアドレスで、新しい会員を登録する

/**
 * 正常系：要件が通す操作
 */
test.describe('はじめての人が登録し、確認のメールのリンクを開く', () => {
  // 分かっている不具合：確認待ちの画面からログアウトすると、ときどき「ログインが切れました」の画面に移る（#297）。
  // そのため、この流れではログアウトせず、ログインしたまま確認のリンクを開く
  test('確認する前は「確認待ち」が出て、確認のメールのリンクを開いたあとは、ホームを使える（FR-AUTH-021）', async ({
    page,
  }) => {
    const member = newMember('reg')
    await register(page, member, 'female')

    await login(page, member.email, member.password)

    // 確認する前は、ログインが要る画面の代わりに「確認待ち」が出る
    await expect(page.getByText('この機能は使えません')).toBeVisible()

    // ログインしたまま、届いた確認のメールのリンクを開き、ホームを開き直す
    await verifyEmail(page, member.email)
    await page.goto('/home')

    // ホームに、登録したニックネームが出る（確認待ちの画面には出ない）
    await expect(page.getByText(member.nickname, { exact: false })).toBeVisible()
    await expect(page.getByText('この機能は使えません')).toBeHidden()
  })
})
