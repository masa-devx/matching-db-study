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
    it('401 で「ログインしてください」（FR-AUTH-020）', function (): void {
        $target = DummyUser::create();

        getJson(Endpoints::profile($target->publicId))
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });

    it('401 のときは、DB を読まない', function (): void {
        $target = DummyUser::create();
        DB::enableQueryLog();

        getJson(Endpoints::profile($target->publicId))->assertUnauthorized();

        expect(DB::getQueryLog())->toHaveCount(0);
    });
});

describe('使えない会員の、前のトークンで見る', function (): void {
    it('止められた会員なら 401 で「ログインしてください」', function (): void {
        $loginUser = DummyUser::create(suspended: true);
        $target = DummyUser::create();

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });

    it('退会した会員なら 401 で「ログインしてください」', function (): void {
        $loginUser = DummyUser::create(withdrawn: true);
        $target = DummyUser::create();

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });

    it('強制退会の会員なら 401 で「ログインしてください」', function (): void {
        $loginUser = DummyUser::create(banned: true);
        $target = DummyUser::create();

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });

    it('いなくなった会員の番号のトークンなら 401', function (): void {
        $gone = DummyUser::create();
        $target = DummyUser::create();
        $token = DummyAuth::token($gone);
        DB::table('profiles')->where('user_id', $gone->id)->delete();
        DB::table('users')->where('id', $gone->id)->delete();

        DummyAuth::withToken($token)->getJson(Endpoints::profile($target->publicId))
            ->assertUnauthorized();
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

    // ログインを確かめる Middleware が、見る人の会員を1本読む（退会・停止・強制退会を見るため）
    it('マッチしている相手なら、SQL は6本（見る人・会員・プロフィール・トークルームを探す3本）', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create();
        DummyMatching::match($loginUser, $target);
        DB::enableQueryLog();

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))->assertOk();

        expect(DB::getQueryLog())->toHaveCount(6);
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
    it('壊れたトークンなら 401 で「ログインしてください」（FR-AUTH-013）', function (): void {
        $target = DummyUser::create();

        DummyAuth::withToken('abc')->getJson(Endpoints::profile($target->publicId))
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });

    it('ほかの鍵で署名したトークンなら 401（FR-AUTH-013）', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create();
        $forged = DummyAuth::tokenSignedWithOtherKey($loginUser);

        DummyAuth::withToken($forged)->getJson(Endpoints::profile($target->publicId))
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });

    it('期限の切れたトークンなら 401（FR-AUTH-013）', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create();
        $expired = DummyAuth::token($loginUser, expiresAt: time() - 60);

        DummyAuth::withToken($expired)->getJson(Endpoints::profile($target->publicId))
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });

    it('いない会員の URL でも、壊れたトークンなら 401（先にログインを確かめる）', function (): void {
        DummyAuth::withToken('abc')->getJson(Endpoints::profile(DummyUser::MISSING_PUBLIC_ID))
            ->assertUnauthorized();
    });

    it('401 は、エラーのログに出さない', function (): void {
        Exceptions::fake();   // 決まりどおりに断っただけなので、エラーとして記録しない

        DummyAuth::withToken('abc')->getJson(Endpoints::profile(DummyUser::MISSING_PUBLIC_ID))->assertUnauthorized();

        Exceptions::assertNothingReported();
    });
});

describe('URL の番号がおかしい', function (): void {
    it('いない会員なら 404 で、「会員が見つかりません」（FR-004）', function (): void {
        $loginUser = DummyUser::create();

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile(DummyUser::MISSING_PUBLIC_ID))
            ->assertNotFound()
            ->assertExactJson(['message' => '会員が見つかりません']);   // 文まで見る（URL を間違えたときの、ルートがない 404 と見分ける）
    });

    it('いない会員を見ても、エラーのログには出さない', function (): void {
        $loginUser = DummyUser::create();
        Exceptions::fake();   // 決まりどおりに断っただけなので、エラーとして記録しない（architecture-backend.md の7章）

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile(DummyUser::MISSING_PUBLIC_ID))->assertNotFound();

        Exceptions::assertNothingReported();
    });

    // 分かっている不具合：404 が望ましい。形を確かめずに UUID の列を探し、PostgreSQL のエラーになる
    it('UUID の形でないなら 500', function (): void {
        $loginUser = DummyUser::create();

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile('abc'))->assertInternalServerError();
    });
});
