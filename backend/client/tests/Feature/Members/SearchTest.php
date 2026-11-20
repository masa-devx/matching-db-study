<?php

declare(strict_types=1);

use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

// GET /api/users：会員を検索する。応答に出さない項目のテスト。
// 確認用の文字は、確認のメールにだけ入れる（不変条件 2）。ほかの検索の動きは、検索を移すチケットで足す

describe('ログインしている人が、会員を検索する', function (): void {
    it('結果の会員に、確認用の文字とパスワードは入らない（FR-SEARCH-001・FR-AUTH-005）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $target = DummyUser::create();

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::searchUsers())
            ->assertOk()
            ->assertJsonPath('0.public_id', $target->publicId)
            ->assertJsonMissingPath('0.verification_token')
            ->assertJsonMissingPath('0.password');
    });
});
