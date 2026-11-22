<?php

declare(strict_types=1);

use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyMatching;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\getJson;

// GET /api/me/likes：送ったいいねの一覧を見る。ほかの会員に見せない相手（退会・アカウント停止・強制退会）を除くかのテスト。
// ほかの動き（並び・マッチ済みの印・応答の項目）は、いいねの API を移すチケットで足す

/**
 * 正常系：要件が通す操作
 */
describe('ログインしている人が、送ったいいねの一覧を見る', function (): void {
    it('退会した相手に送ったいいねは、一覧に出ない（FR-WD-006）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $usable = DummyUser::create();
        $withdrawn = DummyUser::create(withdrawn: true);
        DummyMatching::like($loginUser, $usable);
        DummyMatching::like($loginUser, $withdrawn);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::sentLikes())->assertOk();

        expect($response->json('*.user_id'))->toBe([$usable->publicId]);
    });

    it('アカウント停止された相手に送ったいいねは、一覧に出ない。いいねの行は残る（FR-WD-014）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $usable = DummyUser::create();
        $suspended = DummyUser::create(suspended: true);
        DummyMatching::like($loginUser, $usable);
        DummyMatching::like($loginUser, $suspended);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::sentLikes())->assertOk();

        expect($response->json('*.user_id'))->toBe([$usable->publicId]);
        assertDatabaseHas('likes', ['from_user_id' => $loginUser->id, 'to_user_id' => $suspended->id]);
    });

    it('強制退会になった相手に送ったいいねは、一覧に出ない（FR-WD-014）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $usable = DummyUser::create();
        $banned = DummyUser::create(banned: true);
        DummyMatching::like($loginUser, $usable);
        DummyMatching::like($loginUser, $banned);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::sentLikes())->assertOk();

        expect($response->json('*.user_id'))->toBe([$usable->publicId]);
    });

    it('アカウント停止が解かれた相手に送ったいいねは、また一覧に出る（FR-WD-014）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $lifted = DummyUser::create(suspended: true);
        DummyMatching::like($loginUser, $lifted);
        DummyUser::liftSuspension($lifted);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::sentLikes())->assertOk();

        expect($response->json('*.user_id'))->toBe([$lifted->publicId]);
    });
});

/**
 * 異常系：要件が断る操作
 */
describe('ログインしていない人が、送ったいいねの一覧を見る', function (): void {
    it('見られない（401「ログインしてください」。FR-LIKE-007）', function (): void {
        getJson(Endpoints::sentLikes())
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });
});
