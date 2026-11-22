<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyMatching;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\getJson;

// GET /api/me/matches：マッチした相手の一覧を見る。退会・アカウント停止・強制退会の相手を除くかのテスト。
// ほかの動き（並び・応答の項目）は、マッチの API を移すチケットで足す

/**
 * 正常系：要件が通す操作
 */
describe('ログインしている人が、マッチした相手の一覧を見る', function (): void {
    it('退会した相手とのマッチは、一覧に出ない（FR-WD-006）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $usable = DummyUser::create();
        $withdrawn = DummyUser::create(withdrawn: true);
        DummyMatching::match($loginUser, $usable);
        DummyMatching::match($loginUser, $withdrawn);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::matches())->assertOk();

        expect($response->json('*.user_id'))->toBe([$usable->publicId]);
    });

    it('アカウント停止された相手とのマッチは、一覧に出ない。マッチの行は残る（FR-WD-014）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $usable = DummyUser::create();
        $suspended = DummyUser::create(suspended: true);
        DummyMatching::match($loginUser, $usable);
        DummyMatching::match($loginUser, $suspended);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::matches())->assertOk();

        expect($response->json('*.user_id'))->toBe([$usable->publicId]);
        assertDatabaseHas('user_matches', ['user1_id' => $suspended->id, 'user2_id' => $loginUser->id]);
    });

    it('強制退会になった相手とのマッチは、一覧に出ない（FR-WD-014）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $usable = DummyUser::create();
        $banned = DummyUser::create(banned: true);
        DummyMatching::match($loginUser, $usable);
        DummyMatching::match($loginUser, $banned);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::matches())->assertOk();

        expect($response->json('*.user_id'))->toBe([$usable->publicId]);
    });

    it('アカウント停止が解かれた相手とのマッチは、また一覧に出る（FR-WD-014）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $lifted = DummyUser::create(suspended: true);
        DummyMatching::match($loginUser, $lifted);
        DummyUser::liftSuspension($lifted);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::matches())->assertOk();

        expect($response->json('*.user_id'))->toBe([$lifted->publicId]);
    });

    // 内訳：Middleware の2本・ブロックの2向き・マッチの一覧・4人の相手を確かめる4本・使える相手1人のプロフィール
    it('退会・アカウント停止・強制退会の相手は、相手を確かめる1本だけで飛ばし、プロフィールを読まない（10本。NFR-WD-002）', function (): void {
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

        $request->getJson(Endpoints::matches())->assertOk();

        expect(DB::getQueryLog())->toHaveCount(10);
    });
});

/**
 * 異常系：要件が断る操作
 */
describe('ログインしていない人が、マッチした相手の一覧を見る', function (): void {
    it('見られない（401「ログインしてください」。FR-MATCH-008）', function (): void {
        getJson(Endpoints::matches())
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });
});
