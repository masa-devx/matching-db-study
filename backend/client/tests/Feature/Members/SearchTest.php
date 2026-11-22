<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

use function Pest\Laravel\getJson;

// GET /api/users：会員を検索する。応答に出さない項目と、退会・アカウント停止・強制退会の会員を除くかのテスト。
// 確認用の文字は、確認のメールにだけ入れる（不変条件 2）。ほかの検索の動きは、検索を移すチケットで足す

/**
 * 正常系：要件が通す操作
 */
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

    it('退会した会員は、結果に出ない（FR-WD-005）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $usable = DummyUser::create();
        DummyUser::create(withdrawn: true);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::searchUsers())->assertOk();

        expect($response->json('*.public_id'))->toBe([$usable->publicId]);
    });

    it('アカウント停止された会員は、結果に出ない（FR-WD-013）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $usable = DummyUser::create();
        $suspended = DummyUser::create(suspended: true);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::searchUsers())->assertOk();

        expect($response->json('*.public_id'))->toBe([$usable->publicId]);
    });

    it('強制退会になった会員は、結果に出ない（FR-WD-013）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $usable = DummyUser::create();
        $banned = DummyUser::create(banned: true);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::searchUsers())->assertOk();

        expect($response->json('*.public_id'))->toBe([$usable->publicId]);
    });

    it('アカウント停止が解かれた会員は、また結果に出る（FR-WD-013）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        $lifted = DummyUser::create(suspended: true);
        DummyUser::liftSuspension($lifted);

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::searchUsers())->assertOk();

        expect($response->json('*.public_id'))->toBe([$lifted->publicId]);
    });

    // 内訳：Middleware の2本・自分のプロフィール・いいね・ブロックの2向き・スキップ・会員の一覧・1人ごとのプロフィール（1人）
    it('退会・アカウント停止・強制退会の会員がいても、検索の SQL は、決まった本数で済む（9本。NFR-WD-002）', function (): void {
        $loginUser = DummyUser::create(gender: 'male');
        DummyUser::create();
        DummyUser::create(withdrawn: true);
        DummyUser::create(suspended: true);
        DummyUser::create(banned: true);
        $request = DummyAuth::actingAs($loginUser);   // ダミーが会員の Model を読むので、数え始める前に作る
        DB::enableQueryLog();

        $request->getJson(Endpoints::searchUsers())->assertOk();

        expect(DB::getQueryLog())->toHaveCount(9);
    });
});

/**
 * 異常系：要件が断る操作
 */
describe('ログインしていない人が、会員を検索する', function (): void {
    it('検索できない（401「ログインしてください」。FR-SEARCH-010）', function (): void {
        getJson(Endpoints::searchUsers())
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });
});
