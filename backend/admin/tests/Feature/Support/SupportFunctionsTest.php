<?php

declare(strict_types=1);

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

use function Pest\Laravel\getJson;
use function Tests\Support\actingAsAdmin;
use function Tests\Support\createAdmin;
use function Tests\Support\createMember;

// テストの部品（tests/Support/functions.php）が、説明のとおりの行を作ることを確かめる。
// 部品が壊れると、それを使う API テストが、関係ない理由で落ちるため

test('テストは、管理画面のテスト用の DB（matching_admin_test）につながっている', function (): void {
    expect(DB::connection()->getDatabaseName())->toBe('matching_admin_test');
});

test('表は、会員の側のマイグレーションで作られている（管理画面は、マイグレーションを持たない）', function (): void {
    foreach (['users', 'profiles', 'admins', 'admin_audit_logs', 'messages', 'purchases', 'reports', 'report_cases'] as $table) {
        expect(DB::getSchemaBuilder()->hasTable($table))->toBeTrue("表 {$table} がない");
    }
});

test('createAdmin() は、役割を引数で決めて、管理者を1人作る', function (): void {
    $owner = createAdmin();
    $viewer = createAdmin('viewer');

    expect($owner->role)->toBe('owner')
        ->and($viewer->role)->toBe('viewer')
        ->and(DB::table('admins')->count())->toBe(2);

    $row = DB::table('admins')->where('id', $viewer->id)->first();
    expect($row?->role)->toBe('viewer')
        ->and(Hash::check('password', (string) $row?->password))->toBeTrue();
});

test('createAdmin() は、監査ログを作らない', function (): void {
    createAdmin();

    expect(DB::table('admin_audit_logs')->count())->toBe(0);
});

test('createMember() は、メールアドレスを確認した・無料の・利用中の会員と、プロフィールを作る', function (): void {
    $member = createMember(nickname: 'さくら');

    $user = DB::table('users')->where('id', $member->id)->first();
    $profile = DB::table('profiles')->where('user_id', $member->id)->first();

    expect($user?->public_id)->toBe($member->publicId)
        ->and($user?->email_verified_at)->not->toBeNull()
        ->and($user?->is_paid)->toBeFalse()
        ->and($user?->suspended_at)->toBeNull()
        ->and($user?->deleted_at)->toBeNull()
        ->and($profile?->nickname)->toBe('さくら')
        ->and($profile?->gender)->toBe('female')
        ->and($member->gender)->toBe('female')
        ->and($member->nickname)->toBe('さくら');
});

test('createMember() は、引数で、男性の会員を作る', function (): void {
    $member = createMember(gender: 'male');

    expect(DB::table('profiles')->where('user_id', $member->id)->value('gender'))->toBe('male')
        ->and($member->gender)->toBe('male');
});

test('createMember() は、引数で、有料・停止・退会の会員を作る', function (): void {
    $paid = createMember(paid: true);
    $suspended = createMember(suspended: true);
    $withdrawn = createMember(withdrawn: true);

    $row = fn (int $id): ?object => DB::table('users')->where('id', $id)->first();

    expect($row($paid->id)?->is_paid)->toBeTrue()
        ->and($row($paid->id)?->paid_until)->not->toBeNull()
        ->and($row($suspended->id)?->suspended_at)->not->toBeNull()
        ->and($row($suspended->id)?->suspended_reason)->not->toBeNull()
        ->and($row($withdrawn->id)?->deleted_at)->not->toBeNull()
        ->and($row($withdrawn->id)?->email)->toContain('#deleted#')
        // 返り値のメールアドレスは、書き換える前のもの
        ->and($withdrawn->email)->not->toContain('#deleted#')
        ->and($row($withdrawn->id)?->email)->toStartWith($withdrawn->email);
});

test('createMember() は、購入・停止の履歴・いいね・マッチ・メッセージ・監査ログを作らない', function (): void {
    createMember(paid: true, suspended: true);
    createMember(withdrawn: true);

    foreach (['purchases', 'suspensions', 'likes', 'user_matches', 'messages', 'admin_audit_logs'] as $table) {
        expect(DB::table($table)->count())->toBe(0, "表 {$table} に行がある");
    }
});

test('部品に、決まっていない役割・性別・空のニックネームを渡すと、例外で止まる', function (): void {
    expect(fn () => createAdmin('editor'))->toThrow(InvalidArgumentException::class)
        ->and(fn () => createMember(gender: 'x'))->toThrow(InvalidArgumentException::class)
        ->and(fn () => createMember(nickname: ' '))->toThrow(InvalidArgumentException::class)
        ->and(DB::table('admins')->count())->toBe(0)
        ->and(DB::table('users')->count())->toBe(0);
});

// 管理画面の部品は、表に直接入れる（会員の側の Factory を使えない）。表の作りは、会員の側のマイグレーションが決めるので、
// 列が増えた・減った・名前が変わったときに、部品が古い形の行を作り続けても、だれも気づけない。
// 部品が入れる3つの表の列を、ここに書いておく。会員の側のマイグレーションが変わると、このテストが落ちる。
// 落ちたら、tests/Support/functions.php（createAdmin・createMember）を見直してから、この一覧を直す
test('部品が行を入れる表（users・profiles・admins）の列は、部品を書いたときのまま', function (): void {
    $columns = fn (string $table): array => collect(DB::getSchemaBuilder()->getColumnListing($table))->sort()->values()->all();

    expect($columns('users'))->toBe([
        'banned_at', 'banned_reason', 'created_at', 'deleted_at', 'email', 'email_verified_at', 'id', 'is_paid',
        'last_login_at', 'paid_until', 'password', 'public_id', 'remember_token', 'suspended_at', 'suspended_reason',
        'updated_at', 'verification_token',
    ])->and($columns('profiles'))->toBe([
        'birthday', 'body_type', 'created_at', 'drinking', 'gender', 'height', 'id', 'image', 'income', 'introduction',
        'job', 'marital_status', 'nickname', 'prefecture', 'smoking', 'updated_at', 'user_id',
    ])->and($columns('admins'))->toBe([
        'created_at', 'email', 'id', 'last_login_at', 'name', 'password', 'role', 'updated_at',
    ]);
});

test('actingAsAdmin() のあとは、その管理者として API を呼べる', function (): void {
    $admin = createAdmin('viewer', '閲覧 花子');

    actingAsAdmin($admin)->getJson('/api/me')
        ->assertOk()
        ->assertJsonPath('name', '閲覧 花子')
        ->assertJsonPath('role', 'viewer');
});

test('actingAsAdmin() を呼ばなければ、ログインしていない（401）', function (): void {
    createAdmin();

    getJson('/api/me')->assertUnauthorized();
});
