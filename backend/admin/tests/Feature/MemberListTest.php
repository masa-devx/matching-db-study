<?php

declare(strict_types=1);

use function Pest\Laravel\getJson;
use function Tests\Support\actingAsAdmin;
use function Tests\Support\createAdmin;
use function Tests\Support\createMember;

// 見本：部品（createAdmin・createMember・actingAsAdmin）だけで書いた、管理画面の API テスト。
// 今のレガシー版の動きを、そのまま確かめる（直すのは、あとのチケット）。要件は docs/requirements/admin.md

test('FR-ADMIN-004 見るだけの管理者も、会員の一覧を見られる', function (): void {
    $member = createMember(nickname: 'さくら');

    actingAsAdmin(createAdmin('viewer'))->getJson('/api/members')
        ->assertOk()
        ->assertJsonPath('total', 1)
        ->assertJsonPath('data.0.public_id', $member->publicId)
        ->assertJsonPath('data.0.nickname', 'さくら');
});

test('FR-ADMIN-004 状態（退会）で絞ると、退会した会員だけが出る', function (): void {
    createMember();
    $withdrawn = createMember(withdrawn: true);

    actingAsAdmin(createAdmin())->getJson('/api/members?status=withdrawn')
        ->assertOk()
        ->assertJsonPath('total', 1)
        ->assertJsonPath('data.0.public_id', $withdrawn->publicId);
});

test('FR-ADMIN-012 ログインしていなければ、会員の一覧は 401', function (): void {
    createMember();

    getJson('/api/members')->assertUnauthorized();
});
