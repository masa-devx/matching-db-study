<?php

declare(strict_types=1);

use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

// GET /api/me：自分のアカウントを見る（名前は docs/glossary.md の「アカウント」）。
// 確認していない会員にも、確認用の文字は返さない（不変条件 2）

describe('ログインしている人が、自分のアカウントを見る', function (): void {
    it('自分のメールアドレスが返り、確認用の文字とパスワードは返らない（FR-AUTH-017・FR-AUTH-005）', function (): void {
        $loginUser = DummyUser::create(unverified: true);

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::account())
            ->assertOk()
            ->assertJsonPath('email', $loginUser->email)
            ->assertJsonPath('email_verified_at', null)
            ->assertJsonMissingPath('verification_token')
            ->assertJsonMissingPath('password');
    });
});
