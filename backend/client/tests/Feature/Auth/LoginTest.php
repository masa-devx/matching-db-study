<?php

declare(strict_types=1);

use Tests\DummyData\DummyUser;
use Tests\Endpoints;

use function Pest\Laravel\postJson;

// POST /api/auth/login：ログインする（docs/api/01b-auth.md）。今の動きを確かめるテスト。
// 要件と違う所は「分かっている不具合」

describe('会員が、正しいメールアドレスとパスワードでログインする', function (): void {
    // 分かっている不具合：要件はセッションの Cookie で、JSON にトークンを入れない（FR-AUTH-010）。今は 30日の JWT を JSON で返す
    it('ログインでき、トークンを JSON で返す（200・`token`）', function (): void {
        $user = DummyUser::create();

        postJson(Endpoints::login(), ['email' => $user->email, 'password' => 'password'])
            ->assertOk()
            ->assertJsonStructure(['token']);
    });
});
