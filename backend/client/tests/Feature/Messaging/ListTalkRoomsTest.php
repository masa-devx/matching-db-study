<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyMatching;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\getJson;

// GET /api/me/talk-rooms：トークの一覧を見る。退会・アカウント停止・強制退会の相手を除くかのテスト。
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

    // 内訳：Middleware の2本・ブロックの2向き・参加者の行・4つのルームごとにルームと相手の参加者と相手を確かめる3本・使える相手1人のプロフィールと最新の1件と未読の数
    it('退会・アカウント停止・強制退会の相手のルームは、相手を確かめる所で飛ばし、メッセージを読まない（20本。NFR-WD-002）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $usable = DummyUser::create();
        $withdrawn = DummyUser::create(withdrawn: true);
        $suspended = DummyUser::create(suspended: true);
        $banned = DummyUser::create(banned: true);
        foreach ([$usable, $withdrawn, $suspended, $banned] as $partner) {
            DummyMatching::match($loginUser, $partner);
        }
        $request = DummyAuth::actingAs($loginUser);   // ダミーが会員の Model を読むので、数え始める前に作る
        DB::enableQueryLog();

        $request->getJson(Endpoints::talkRooms())->assertOk();

        expect(DB::getQueryLog())->toHaveCount(20);
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
