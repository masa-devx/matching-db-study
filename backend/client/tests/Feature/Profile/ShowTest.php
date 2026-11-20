<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Exceptions;
use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyMatching;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

use function Pest\Laravel\getJson;

// GET /api/users/{user_id}：相手のプロフィールを見る。今の動きを確かめるテスト。
// 要件と違う所は「分かっている不具合」。手で試すシナリオは bruno/client/profile/

describe('ログインしていない人が見る', function (): void {
    // 分かっている不具合：要件（FR-AUTH-020）は 401。ルートに、ログインを求める Middleware がない
    it('200 で見られる', function (): void {
        $target = DummyUser::create();

        getJson(Endpoints::profile($target->publicId))->assertOk();
    });

    it('確認していない相手を見ても、確認用の文字は返らない（FR-002・FR-AUTH-005）', function (): void {
        $target = DummyUser::create(unverified: true);

        getJson(Endpoints::profile($target->publicId))
            ->assertOk()
            ->assertJsonMissingPath('verification_token');
    });

    it('マッチしている2人の片方を見ても、room_id は null', function (): void {
        $someone = DummyUser::create();
        $target = DummyUser::create();
        DummyMatching::match($someone, $target);

        getJson(Endpoints::profile($target->publicId))
            ->assertOk()
            ->assertJsonPath('room_id', null);
    });

    it('SQL は2本（会員とプロフィール）', function (): void {
        $target = DummyUser::create();
        DB::enableQueryLog();

        getJson(Endpoints::profile($target->publicId))->assertOk();

        expect(DB::getQueryLog())->toHaveCount(2);
    });
});

describe('ログインしている人が見る', function (): void {
    // 分かっている不具合：要件（FR-002）は、メールアドレス・生年月日を返さない。表の列を全部返している
    it('ニックネームと一緒に、メールアドレス・生年月日も返る', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create(nickname: 'さき');

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertOk()
            ->assertJsonPath('profile.nickname', 'さき')
            ->assertJsonPath('email', $target->email)
            ->assertJsonStructure(['profile' => ['birthday']])
            ->assertJsonMissingPath('password')
            ->assertJsonMissingPath('remember_token');
    });

    it('確認していない相手を見ても、確認用の文字は返らない（FR-002・FR-AUTH-005）', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create(unverified: true);

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertOk()
            ->assertJsonMissingPath('verification_token');
    });

    it('プロフィールのない会員なら、profile は null', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create(withProfile: false);

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertOk()
            ->assertJsonPath('profile', null);
    });

    it('マッチしていない相手なら、room_id は null', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create();

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertOk()
            ->assertJsonPath('room_id', null);
    });

    it('マッチしている相手なら、room_id に2人のトークルームの番号が入る', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create();
        $roomId = DummyMatching::match($loginUser, $target);

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertOk()
            ->assertJsonPath('room_id', $roomId);
    });

    it('2人とも、ほかの人とだけマッチしているなら、room_id は null', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create();
        DummyMatching::match($loginUser, DummyUser::create());
        DummyMatching::match(DummyUser::create(), $target);

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertOk()
            ->assertJsonPath('room_id', null);
    });

    it('マッチしている相手なら、SQL は5本（会員・プロフィール・トークルームを探す3本）', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create();
        DummyMatching::match($loginUser, $target);
        DB::enableQueryLog();

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))->assertOk();

        expect(DB::getQueryLog())->toHaveCount(5);
    });

    // 分かっている不具合：自分とのトークルームはないので、null が望ましい。見る人と相手が同じときを分けていない
    it('自分を見ると、room_id に自分のトークルームのどれかが入る', function (): void {
        $loginUser = DummyUser::create();
        $roomIds = [
            DummyMatching::match($loginUser, DummyUser::create()),
            DummyMatching::match($loginUser, DummyUser::create()),
        ];

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($loginUser->publicId))->assertOk();

        expect($response->json('room_id'))->toBeIn($roomIds);
    });
});

describe('トークンがおかしい', function (): void {
    // 分かっている不具合：要件は 401（期限切れは FR-AUTH-013）。IdentifyUser が JWT の例外を受けず、そのまま 500 になる
    it('壊れたトークンなら 500', function (): void {
        $target = DummyUser::create();

        DummyAuth::withToken('abc')->getJson(Endpoints::profile($target->publicId))
            ->assertInternalServerError();
    });

    it('ほかの鍵で署名したトークンなら 500', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create();
        $forged = DummyAuth::tokenSignedWithOtherKey($loginUser);

        DummyAuth::withToken($forged)->getJson(Endpoints::profile($target->publicId))
            ->assertInternalServerError();
    });

    it('期限の切れたトークンなら 500', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create();
        $expired = DummyAuth::token($loginUser, expiresAt: time() - 60);

        DummyAuth::withToken($expired)->getJson(Endpoints::profile($target->publicId))
            ->assertInternalServerError();
    });

    // 移す前と違う：移す前は、先に会員を探していたので 404。今は IdentifyUser が先にトークンを読む
    it('いない会員でも、壊れたトークンなら 500', function (): void {
        DummyAuth::withToken('abc')->getJson(Endpoints::profile(DummyUser::MISSING_PUBLIC_ID))
            ->assertInternalServerError();
    });
});

describe('URL の番号がおかしい', function (): void {
    it('いない会員なら 404 で、「会員が見つかりません」（FR-004）', function (): void {
        getJson(Endpoints::profile(DummyUser::MISSING_PUBLIC_ID))
            ->assertNotFound()
            ->assertExactJson(['message' => '会員が見つかりません']);   // 文まで見る（URL を間違えたときの、ルートがない 404 と見分ける）
    });

    it('いない会員を見ても、エラーのログには出さない', function (): void {
        Exceptions::fake();   // 決まりどおりに断っただけなので、エラーとして記録しない（architecture-backend.md の7章）

        getJson(Endpoints::profile(DummyUser::MISSING_PUBLIC_ID))->assertNotFound();

        Exceptions::assertNothingReported();
    });

    // 分かっている不具合：404 が望ましい。形を確かめずに UUID の列を探し、PostgreSQL のエラーになる
    it('UUID の形でないなら 500', function (): void {
        getJson(Endpoints::profile('abc'))->assertInternalServerError();
    });
});
