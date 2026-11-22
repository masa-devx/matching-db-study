<?php

declare(strict_types=1);

use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyMatching;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\getJson;

// GET /api/me/talk-rooms：トークの一覧を見る。ほかの会員に見せない相手（退会・アカウント停止・強制退会）を除くかのテスト。
// ほかの動き（並び・最新の1件・未読の数）は、トークの API を移すチケットで足す

/**
 * 正常系：要件が通す操作
 */
describe('ログインしている人が、トークの一覧を見る', function (): void {
    it('退会した相手とのトークルームは、一覧に出ない（FR-WD-006）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $usable = DummyUser::create();
        $withdrawn = DummyUser::create(withdrawn: true);
        DummyMatching::match($loginUser, $usable);
        DummyMatching::match($loginUser, $withdrawn);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::talkRooms())->assertOk();

        expect($response->json('*.user_id'))->toBe([$usable->publicId]);
    });

    it('アカウント停止された相手とのトークルームは、一覧に出ない。ルームの行は残る（FR-WD-014）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $usable = DummyUser::create();
        $suspended = DummyUser::create(suspended: true);
        DummyMatching::match($loginUser, $usable);
        $roomId = DummyMatching::match($loginUser, $suspended);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::talkRooms())->assertOk();

        expect($response->json('*.user_id'))->toBe([$usable->publicId]);
        assertDatabaseHas('talk_rooms', ['public_id' => $roomId]);
    });

    it('強制退会になった相手とのトークルームは、一覧に出ない（FR-WD-014）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $usable = DummyUser::create();
        $banned = DummyUser::create(banned: true);
        DummyMatching::match($loginUser, $usable);
        DummyMatching::match($loginUser, $banned);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::talkRooms())->assertOk();

        expect($response->json('*.user_id'))->toBe([$usable->publicId]);
    });

    it('アカウント停止が解かれた相手とのトークルームは、また一覧に出る（FR-WD-014）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $lifted = DummyUser::create(suspended: true);
        $roomId = DummyMatching::match($loginUser, $lifted);
        DummyUser::liftSuspension($lifted);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::talkRooms())->assertOk();

        expect($response->json('*.room_id'))->toBe([$roomId]);
    });
});

/**
 * 異常系：要件が断る操作
 */
describe('ログインしていない人が、トークの一覧を見る', function (): void {
    it('見られない（401「ログインしてください」。FR-MSG-012）', function (): void {
        getJson(Endpoints::talkRooms())
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });
});
