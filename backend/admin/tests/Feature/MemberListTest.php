<?php

declare(strict_types=1);

use function Pest\Laravel\getJson;
use function Tests\Support\actingAsAdmin;
use function Tests\Support\createAdmin;
use function Tests\Support\createMember;

// 見本：部品（createAdmin・createMember・actingAsAdmin）だけで書いた、管理画面の API テスト。
// 今のレガシー版の動きを、そのまま確かめる（直すのは、あとのチケット）。要件は docs/requirements/admin.md

test('FR-ADMIN-004 会員の一覧に、会員と全部の件数が出る（見るだけの管理者でも）', function (): void {
    $sakura = createMember(nickname: 'さくら');
    $withdrawn = createMember(withdrawn: true, nickname: 'やめた人');
    $suspended = createMember(suspended: true, nickname: '止めた人');

    $response = actingAsAdmin(createAdmin('viewer'))->getJson('/api/members')
        ->assertOk()
        ->assertJsonPath('total', 3);

    // 絞り込みなしなら、退会した会員も、止めた会員も出る。並びには頼らず、ID の集まりで比べる
    /** @var list<array{public_id: string, nickname: string|null}> $rows */
    $rows = $response->json('data');
    $actual = array_column($rows, 'nickname', 'public_id');
    ksort($actual);
    $expected = [$sakura->publicId => 'さくら', $withdrawn->publicId => 'やめた人', $suspended->publicId => '止めた人'];
    ksort($expected);

    expect($actual)->toBe($expected);
});

test('FR-ADMIN-004 状態（退会）で絞ると、退会した会員だけが出る', function (): void {
    createMember();
    createMember(suspended: true);
    $withdrawn = createMember(withdrawn: true);

    actingAsAdmin(createAdmin())->getJson('/api/members?status=withdrawn')
        ->assertOk()
        ->assertJsonPath('total', 1)
        ->assertJsonPath('data.0.public_id', $withdrawn->publicId);
});

test('FR-ADMIN-012 ログインしていなければ、会員の一覧は 401', function (): void {
    // 会員がいても、中身を返さずに 401 になることを確かめるために、1人作っておく
    createMember();

    getJson('/api/members')
        ->assertUnauthorized()
        ->assertJsonMissingPath('data');
});
