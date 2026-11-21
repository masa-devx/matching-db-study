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

describe('ログインしていない人が、相手のプロフィールを見る', function (): void {
    it('見られない（401「ログインしてください」。FR-AUTH-020）', function (): void {
        $target = DummyUser::create();

        getJson(Endpoints::profile($target->publicId))
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });

    it('ログインしていなければ、会員の情報にもプロフィールにもアクセスできない（DB を読まない）', function (): void {
        $target = DummyUser::create();
        DB::enableQueryLog();

        getJson(Endpoints::profile($target->publicId))->assertUnauthorized();

        expect(DB::getQueryLog())->toHaveCount(0);
    });
});

describe('使えなくなった会員が、前にもらったトークンで相手のプロフィールを見る', function (): void {
    it('アカウント停止された会員は、見られず、停止されていると知らされる（401「このアカウントは停止されています」。NFR-AUTH-001）', function (): void {
        $loginUser = DummyUser::create(suspended: true);
        $target = DummyUser::create();

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'このアカウントは停止されています', 'code' => 'account_suspended']);
    });

    it('退会した会員は、見られない（401「ログインしてください」。NFR-AUTH-001）', function (): void {
        $loginUser = DummyUser::create(withdrawn: true);
        $target = DummyUser::create();

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });

    it('強制退会になった会員は、見られない（401「ログインしてください」。NFR-AUTH-001）', function (): void {
        $loginUser = DummyUser::create(banned: true);
        $target = DummyUser::create();

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });

    it('会員の行がもうない番号のトークンでは、見られない（401。NFR-AUTH-001）', function (): void {
        $gone = DummyUser::create();
        $target = DummyUser::create();
        $token = DummyAuth::token($gone);
        DB::table('profiles')->where('user_id', $gone->id)->delete();
        DB::table('users')->where('id', $gone->id)->delete();

        DummyAuth::withToken($token)->getJson(Endpoints::profile($target->publicId))
            ->assertUnauthorized();
    });
});

describe('ログインしている人が、相手のプロフィールを見る', function (): void {
    // 分かっている不具合：要件（FR-002）は、メールアドレス・生年月日を返さない。表の列を全部返している
    it('ニックネームと一緒に、メールアドレスと生年月日も返る', function (): void {
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

    it('相手がメールアドレスを確認していなくても、確認用の文字は返らない（FR-002・FR-AUTH-005）', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create(unverified: true);

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertOk()
            ->assertJsonMissingPath('verification_token');
    });

    it('相手がプロフィールを作っていなければ、プロフィールは空（`profile` が null）', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create(withProfile: false);

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertOk()
            ->assertJsonPath('profile', null);
    });

    it('マッチしていない相手なら、トークルームの番号は空（`room_id` が null）', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create();

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertOk()
            ->assertJsonPath('room_id', null);
    });

    it('マッチしている相手なら、2人のトークルームの番号が返る（`room_id`）', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create();
        $roomId = DummyMatching::match($loginUser, $target);

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertOk()
            ->assertJsonPath('room_id', $roomId);
    });

    it('2人とも、ほかの人とだけマッチしているなら、トークルームの番号は空（`room_id` が null）', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create();
        DummyMatching::match($loginUser, DummyUser::create());
        DummyMatching::match(DummyUser::create(), $target);

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($target->publicId))
            ->assertOk()
            ->assertJsonPath('room_id', null);
    });

    // 内訳：見る人のアカウントの状態と、メールアドレスを確認したか（Middleware が2本）・相手の会員・プロフィール・トークルームを探す3本
    it('マッチしている相手を見るときの SQL は、決まった本数で済む（7本）', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create();
        DummyMatching::match($loginUser, $target);
        $request = DummyAuth::actingAs($loginUser);   // ダミーが会員の Model を読むので、数え始める前に作る
        DB::enableQueryLog();

        $request->getJson(Endpoints::profile($target->publicId))->assertOk();

        expect(DB::getQueryLog())->toHaveCount(7);
    });

    // 分かっている不具合：自分とのトークルームはないので、null が望ましい。見る人と相手が同じときを分けていない
    it('自分を見ると、自分のトークルームのどれかの番号が返る', function (): void {
        $loginUser = DummyUser::create();
        $roomIds = [
            DummyMatching::match($loginUser, DummyUser::create()),
            DummyMatching::match($loginUser, DummyUser::create()),
        ];

        $response = DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile($loginUser->publicId))->assertOk();

        expect($response->json('room_id'))->toBeIn($roomIds);
    });
});

describe('壊れた・偽の・期限切れのトークンを送る人が、相手のプロフィールを見る', function (): void {
    it('壊れたトークンでは、見られない（401「ログインしてください」。FR-AUTH-020）', function (): void {
        $target = DummyUser::create();

        DummyAuth::withToken('abc')->getJson(Endpoints::profile($target->publicId))
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });

    it('ほかの鍵で署名した偽のトークンでは、見られない（401「ログインしてください」。FR-AUTH-020）', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create();
        $forged = DummyAuth::tokenSignedWithOtherKey($loginUser);

        DummyAuth::withToken($forged)->getJson(Endpoints::profile($target->publicId))
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });

    it('JWT の期限（30日）が切れたトークンでは、見られない（401「ログインしてください」。FR-AUTH-020）', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create();
        $expired = DummyAuth::token($loginUser, expiresAt: time() - 60);

        DummyAuth::withToken($expired)->getJson(Endpoints::profile($target->publicId))
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    });

    it('ヘッダーの形がおかしいトークンでも、見られない（401「ログインしてください」。FR-AUTH-020）', function (string $headerJson): void {
        $target = DummyUser::create();

        DummyAuth::withToken(DummyAuth::tokenWithHeader($headerJson))->getJson(Endpoints::profile($target->publicId))
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);
    })->with([
        'alg が配列' => ['{"alg":["HS256"]}'],
        'alg がオブジェクト' => ['{"alg":{}}'],
        'kid が配列' => ['{"alg":"HS256","kid":[1]}'],
    ]);

    it('いない会員の URL でも、先にトークンを確かめて断る（401）', function (): void {
        DummyAuth::withToken('abc')->getJson(Endpoints::profile(DummyUser::MISSING_PUBLIC_ID))
            ->assertUnauthorized();
    });

    it('トークンで断ったことは、エラーのログに出さない', function (): void {
        Exceptions::fake();   // 決まりどおりに断っただけなので、エラーとして記録しない

        DummyAuth::withToken('abc')->getJson(Endpoints::profile(DummyUser::MISSING_PUBLIC_ID))->assertUnauthorized();
        DummyAuth::withToken(DummyAuth::tokenWithHeader('{"alg":["HS256"]}'))->getJson(Endpoints::profile(DummyUser::MISSING_PUBLIC_ID))->assertUnauthorized();

        Exceptions::assertNothingReported();
    });
});

describe('ログインしている人が、いない会員や形の違う番号のプロフィールを見る', function (): void {
    it('いない会員なら、見つからない（404「会員が見つかりません」。FR-004）', function (): void {
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
    it('番号が UUID の形でないと、見られずにサーバーのエラーになる（500）', function (): void {
        $loginUser = DummyUser::create();

        DummyAuth::actingAs($loginUser)->getJson(Endpoints::profile('abc'))->assertInternalServerError();
    });
});
