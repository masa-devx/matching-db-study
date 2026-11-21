<?php

declare(strict_types=1);

use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

// POST /api/auth/logout：ログアウトする（docs/api/01b-auth.md）。今の動きを確かめるテスト。
// 要件と違う所は「分かっている不具合」

describe('ログインした会員が、ログアウトしてから、同じログインのまま自分のアカウントを見る', function (): void {
    // 分かっている不具合：要件は、ログアウトは 204 で、そのあとは 401（FR-AUTH-016）。今は、サーバーで何もしない
    it('ログアウトは 200 で、そのあとも同じトークンで見られる（200）', function (): void {
        $loginUser = DummyUser::create();
        $request = DummyAuth::actingAs($loginUser);

        $request->postJson(Endpoints::logout())->assertOk();

        $request->getJson(Endpoints::account())->assertOk();
    });
});
