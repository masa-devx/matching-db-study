<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Exceptions;
use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyUser;
use Tests\Endpoints;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\putJson;

// PUT /api/users/{user_id}：プロフィールを書き換える。今の動きを確かめるテスト。
// 要件と違う所は「分かっている不具合」。DB は表の名前で確かめ、ほかの会員の行が変わらないことも見る

describe('ログインしている人が、自分のプロフィールを書き換える', function (): void {
    it('ニックネームを変えると、自分の行だけが変わる（FR-005）', function (): void {
        $loginUser = DummyUser::create(nickname: 'まえ');
        $someone = DummyUser::create(nickname: 'べつのひと');

        DummyAuth::actingAs($loginUser)->putJson(Endpoints::profile($loginUser->publicId), ['nickname' => 'あと'])
            ->assertOk()
            ->assertJsonPath('nickname', 'あと');   // ホームは、この応答をそのままプロフィールとして使う

        assertDatabaseHas('profiles', ['user_id' => $loginUser->id, 'nickname' => 'あと']);
        assertDatabaseHas('profiles', ['user_id' => $someone->id, 'nickname' => 'べつのひと']);
    });

    // 内訳：送った人のアカウントの状態（Middleware）・URL の会員の番号・プロフィール・書き換え
    it('書き換えるときの SQL は、決まった本数で済む（4本）', function (): void {
        $loginUser = DummyUser::create(nickname: 'まえ');
        DB::enableQueryLog();

        DummyAuth::actingAs($loginUser)->putJson(Endpoints::profile($loginUser->publicId), ['nickname' => 'あと'])->assertOk();

        expect(DB::getQueryLog())->toHaveCount(4);
    });

    // 分かっている不具合：要件（FR-006）は 422 で、保存しない。空の文字は Laravel が null に変える
    it('空のニックネームを送ると、ニックネームが消える（null で保存される）', function (): void {
        $loginUser = DummyUser::create(nickname: 'まえ');

        DummyAuth::actingAs($loginUser)->putJson(Endpoints::profile($loginUser->publicId), ['nickname' => ''])->assertOk();

        assertDatabaseHas('profiles', ['user_id' => $loginUser->id, 'nickname' => null]);
    });

    // 分かっている不具合：要件（FR-010）は、性別と生年月日は変わらない。送った項目を全部入れている
    it('性別と生年月日を一緒に送ると、それも書き換わる', function (): void {
        $loginUser = DummyUser::create(gender: 'female');
        $input = ['nickname' => 'あと', 'gender' => 'male', 'birthday' => '2010-01-01'];

        DummyAuth::actingAs($loginUser)->putJson(Endpoints::profile($loginUser->publicId), $input)->assertOk();

        assertDatabaseHas('profiles', ['user_id' => $loginUser->id, ...$input]);
    });
});

describe('ログインしていない人や使えなくなった会員が、プロフィールを書き換えようとする', function (): void {
    it('ログインしていなければ、書き換えられない（401「ログインしてください」。FR-AUTH-020）', function (): void {
        $target = DummyUser::create(nickname: 'まえ');

        putJson(Endpoints::profile($target->publicId), ['nickname' => 'かきかえ'])
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);

        assertDatabaseHas('profiles', ['user_id' => $target->id, 'nickname' => 'まえ']);
    });

    it('壊れたトークンでは、書き換えられない（401「ログインしてください」。FR-AUTH-020）', function (): void {
        $target = DummyUser::create(nickname: 'まえ');

        DummyAuth::withToken('abc')->putJson(Endpoints::profile($target->publicId), ['nickname' => 'かきかえ'])
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'ログインしてください']);

        assertDatabaseHas('profiles', ['user_id' => $target->id, 'nickname' => 'まえ']);
    });

    it('停止させられた会員は、前にもらったトークンでは自分のプロフィールも書き換えられない（401。NFR-AUTH-001）', function (): void {
        $loginUser = DummyUser::create(suspended: true, nickname: 'まえ');

        DummyAuth::actingAs($loginUser)->putJson(Endpoints::profile($loginUser->publicId), ['nickname' => 'かきかえ'])
            ->assertUnauthorized();

        assertDatabaseHas('profiles', ['user_id' => $loginUser->id, 'nickname' => 'まえ']);
    });

    it('退会した会員は、前にもらったトークンでは自分のプロフィールも書き換えられない（401。NFR-AUTH-001）', function (): void {
        $loginUser = DummyUser::create(withdrawn: true, nickname: 'まえ');

        DummyAuth::actingAs($loginUser)->putJson(Endpoints::profile($loginUser->publicId), ['nickname' => 'かきかえ'])
            ->assertUnauthorized();

        assertDatabaseHas('profiles', ['user_id' => $loginUser->id, 'nickname' => 'まえ']);
    });
});

describe('ログインしているほかの会員が、他人のプロフィールを書き換える', function (): void {
    // 分かっている不具合：要件（FR-AUTH-022）は 403 で、変わらない。だれが送ったかと、URL の番号を比べない
    it('他人のプロフィールでも、書き換えられてしまう', function (): void {
        $loginUser = DummyUser::create(nickname: 'じぶん');
        $target = DummyUser::create(nickname: 'まえ');

        DummyAuth::actingAs($loginUser)->putJson(Endpoints::profile($target->publicId), ['nickname' => 'かきかえ'])->assertOk();

        assertDatabaseHas('profiles', ['user_id' => $target->id, 'nickname' => 'かきかえ']);
        assertDatabaseHas('profiles', ['user_id' => $loginUser->id, 'nickname' => 'じぶん']);
    });
});

describe('ログインしている人が、いない会員やプロフィールのない会員のプロフィールを書き換える', function (): void {
    it('いない会員なら、見つからない（404「会員が見つかりません」。FR-004）', function (): void {
        $loginUser = DummyUser::create();

        DummyAuth::actingAs($loginUser)->putJson(Endpoints::profile(DummyUser::MISSING_PUBLIC_ID), ['nickname' => 'あと'])
            ->assertNotFound()
            ->assertExactJson(['message' => '会員が見つかりません']);
    });

    it('いない会員を書き換えようとしても、エラーのログには出さない', function (): void {
        $loginUser = DummyUser::create();
        Exceptions::fake();   // 前は RuntimeException の 500 で、エラーのログに残っていた

        DummyAuth::actingAs($loginUser)->putJson(Endpoints::profile(DummyUser::MISSING_PUBLIC_ID), ['nickname' => 'あと'])
            ->assertNotFound();

        Exceptions::assertNothingReported();
    });

    // 分かっている不具合：要件は 404。会員はいるがプロフィールがないとき、ProfileService が RuntimeException を投げる
    it('プロフィールのない会員なら、書き換えられずにサーバーのエラーになり、エラーのログに出る（500）', function (): void {
        $loginUser = DummyUser::create();
        $target = DummyUser::create(withProfile: false);
        Exceptions::fake();   // 思っていなかった失敗は、業務の例外と違って記録される（dontReport が広すぎないかも、ここで確かめる）

        DummyAuth::actingAs($loginUser)->putJson(Endpoints::profile($target->publicId), ['nickname' => 'あと'])->assertInternalServerError();

        Exceptions::assertReported(RuntimeException::class);
    });
});
