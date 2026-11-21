<?php

declare(strict_types=1);

use Tests\DummyData\DummyAdmin;
use Tests\DummyData\DummyMember;

use function Pest\Laravel\getJson;

// GET /api/members：会員の一覧。今のレガシー版の動きを確かめるテスト（要件は docs/requirements/admin.md）。
// ダミーデータ（DummyAdmin・DummyMember）だけで書いた、管理画面の API テストの見本

test('FR-ADMIN-004 会員の一覧に、会員と全部の件数が出る（見るだけの管理者でも）', function (): void {
    $sakura = DummyMember::create(nickname: 'さくら');
    $withdrawn = DummyMember::create(withdrawn: true, nickname: 'やめた人');
    $suspended = DummyMember::create(suspended: true, nickname: '止めた人');

    $response = DummyAdmin::actingAs(DummyAdmin::create('viewer'))->getJson('/api/members')
        ->assertOk()
        ->assertJsonPath('total', 3);

    // 絞り込みなしなら、退会した会員も、アカウント停止された会員も出る。並びには頼らず、ID の集まりで比べる
    /** @var list<array{public_id: string, nickname: string|null}> $rows */
    $rows = $response->json('data');
    $actual = array_column($rows, 'nickname', 'public_id');
    ksort($actual);
    $expected = [$sakura->publicId => 'さくら', $withdrawn->publicId => 'やめた人', $suspended->publicId => '止めた人'];
    ksort($expected);

    expect($actual)->toBe($expected);
});

test('FR-ADMIN-004 状態（退会）で絞ると、退会した会員だけが出る', function (): void {
    DummyMember::create();
    DummyMember::create(suspended: true);
    $withdrawn = DummyMember::create(withdrawn: true);

    DummyAdmin::actingAs(DummyAdmin::create())->getJson('/api/members?status=withdrawn')
        ->assertOk()
        ->assertJsonPath('total', 1)
        ->assertJsonPath('data.0.public_id', $withdrawn->publicId);
});

test('FR-ADMIN-012 ログインしていなければ、会員の一覧は 401', function (): void {
    // 会員がいても、中身を返さずに 401 になることを確かめるために、1人作っておく
    DummyMember::create();

    // 応答は、理由の文（message）だけ。別の名前で、会員の中身を返していないことも、これで分かる
    getJson('/api/members')
        ->assertUnauthorized()
        ->assertExactJson(['message' => 'ログインしてください']);
});
