<?php

declare(strict_types=1);

use Tests\DummyData\DummyAuth;
use Tests\DummyData\DummyMember;

use function Pest\Laravel\assertDatabaseHas;
use function Pest\Laravel\putJson;

// PUT /api/users/{user_id}：プロフィールを書き換える。今の動きを確かめるテスト。
// 要件と違う所は「分かっている不具合」。DB は表の名前で確かめ、ほかの会員の行が変わらないことも見る

describe('自分のプロフィールを書き換える', function (): void {
    it('ニックネームを変えると、自分の行だけが変わる（FR-005）', function (): void {
        $me = DummyMember::create(nickname: 'まえ');
        $someone = DummyMember::create(nickname: 'べつのひと');

        DummyAuth::actingAs($me)->putJson("/api/users/{$me->publicId}", ['nickname' => 'あと'])->assertOk();

        assertDatabaseHas('profiles', ['user_id' => $me->id, 'nickname' => 'あと']);
        assertDatabaseHas('profiles', ['user_id' => $someone->id, 'nickname' => 'べつのひと']);
    });

    // 分かっている不具合：要件（FR-006）は 422 で、保存しない。空の文字は Laravel が null に変える
    it('空のニックネームを送ると、null で保存される', function (): void {
        $me = DummyMember::create(nickname: 'まえ');

        DummyAuth::actingAs($me)->putJson("/api/users/{$me->publicId}", ['nickname' => ''])->assertOk();

        assertDatabaseHas('profiles', ['user_id' => $me->id, 'nickname' => null]);
    });

    // 分かっている不具合：要件（FR-010）は、性別と生年月日は変わらない。送った項目を全部入れている
    it('性別と生年月日を一緒に送ると、それも変わる', function (): void {
        $me = DummyMember::create(gender: 'female');
        $input = ['nickname' => 'あと', 'gender' => 'male', 'birthday' => '2010-01-01'];

        DummyAuth::actingAs($me)->putJson("/api/users/{$me->publicId}", $input)->assertOk();

        assertDatabaseHas('profiles', ['user_id' => $me->id, ...$input]);
    });
});

describe('他人のプロフィールを書き換える', function (): void {
    // 分かっている不具合：要件（FR-AUTH-020・022）は 401 で、変わらない。update はトークンを読まない
    it('ログインしていなくても、書き換えられる', function (): void {
        $other = DummyMember::create(nickname: 'まえ');

        putJson("/api/users/{$other->publicId}", ['nickname' => 'かきかえ'])->assertOk();

        assertDatabaseHas('profiles', ['user_id' => $other->id, 'nickname' => 'かきかえ']);
    });

    // 分かっている不具合：要件（FR-AUTH-022）は 403 で、変わらない。だれが送ったかと、URL の番号を比べない
    it('ログインしている人も、書き換えられる', function (): void {
        $me = DummyMember::create(gender: 'male', nickname: 'じぶん');
        $other = DummyMember::create(nickname: 'まえ');

        DummyAuth::actingAs($me)->putJson("/api/users/{$other->publicId}", ['nickname' => 'かきかえ'])->assertOk();

        assertDatabaseHas('profiles', ['user_id' => $other->id, 'nickname' => 'かきかえ']);
        assertDatabaseHas('profiles', ['user_id' => $me->id, 'nickname' => 'じぶん']);
    });
});

describe('URL の番号がおかしい', function (): void {
    // 分かっている不具合：404 が望ましい。プロフィールが見つからず、null のまま fill() を呼ぶ
    it('いない会員なら 500', function (): void {
        $me = DummyMember::create();

        DummyAuth::actingAs($me)->putJson('/api/users/00000000-0000-0000-0000-000000000000', ['nickname' => 'あと'])
            ->assertInternalServerError();
    });
});
