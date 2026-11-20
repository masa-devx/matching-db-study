<?php

declare(strict_types=1);

use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

// GET /api/me：自分のアカウントを見る（URL は /me のまま、コードでは Account と呼ぶ。docs/glossary.md）。
// 確認していない会員にも、確認用の文字は返さない（不変条件 2）

describe('ログインしている人が見る', function (): void {
    it('自分のメールアドレスが返り、確認用の文字とパスワードは返らない（不変条件 2）', function (): void {
        $loginUser = DummyUser::create(unverified: true);

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::account())
            ->assertOk()
            ->assertJsonPath('email', $loginUser->email)
            ->assertJsonPath('email_verified_at', null)
            ->assertJsonMissingPath('verification_token')
            ->assertJsonMissingPath('password');
    });
});
