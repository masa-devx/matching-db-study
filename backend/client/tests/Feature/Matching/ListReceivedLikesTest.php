<?php

declare(strict_types=1);

use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyMatching;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\getJson;

// GET /api/me/received-likes：届いたいいねの一覧を見る。ほかの会員に見せない相手（退会・アカウント停止・強制退会）を除くかのテスト。
// ほかの動き（送り返した・スキップした相手を除く・応答の項目）は、いいねの API を移すチケットで足す

/**
 * 正常系：要件が通す操作
 */
describe('ログインしている人が、届いたいいねの一覧を見る', function (): void {
    it('退会した相手から届いたいいねは、一覧に出ない（FR-WD-006）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $usable = DummyUser::create();
        $withdrawn = DummyUser::create(withdrawn: true);
        DummyMatching::like($usable, $loginUser);
        DummyMatching::like($withdrawn, $loginUser);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::receivedLikes())->assertOk();

        expect($response->json('*.user_id'))->toBe([$usable->publicId]);
    });

    it('アカウント停止された相手から届いたいいねは、一覧に出ない。いいねの行は残る（FR-WD-014）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $usable = DummyUser::create();
        $suspended = DummyUser::create(suspended: true);
        DummyMatching::like($usable, $loginUser);
        DummyMatching::like($suspended, $loginUser);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::receivedLikes())->assertOk();

        expect($response->json('*.user_id'))->toBe([$usable->publicId]);
        assertDatabaseHas('likes', ['from_user_id' => $suspended->id, 'to_user_id' => $loginUser->id]);
    });

    it('強制退会になった相手から届いたいいねは、一覧に出ない（FR-WD-014）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $usable = DummyUser::create();
        $banned = DummyUser::create(banned: true);
        DummyMatching::like($usable, $loginUser);
        DummyMatching::like($banned, $loginUser);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::receivedLikes())->assertOk();

        expect($response->json('*.user_id'))->toBe([$usable->publicId]);
    });

    it('アカウント停止が解かれた相手から届いたいいねは、また一覧に出る（FR-WD-014）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $lifted = DummyUser::create(suspended: true);
        DummyMatching::like($lifted, $loginUser);
        DummyUser::liftSuspension($lifted);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::receivedLikes())->assertOk();

        expect($response->json('*.user_id'))->toBe([$lifted->publicId]);
    });
});

/**
 * 異常系：要件が断る操作
 */
describe('ログインしていない人が、届いたいいねの一覧を見る', function (): void {
    it('見られない（401「ログインしてください」。FR-LIKE-007）', function (): void {
        getJson(Endpoints::receivedLikes())
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });
});
