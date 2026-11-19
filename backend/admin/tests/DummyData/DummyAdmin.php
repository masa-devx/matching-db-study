<?php

declare(strict_types=1);

namespace Tests\DummyData;

use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use InvalidArgumentException;

use function Pest\Laravel\withHeader;

/**
 * テストの管理者と、ログインした状態（トークン）を作る。
 * 管理画面は Model を持たないので、表に直接入れる（DB::table は tests/DummyData/ の中だけ）。
 */
final class DummyAdmin
{
    private const array ROLES = ['owner', 'viewer'];

    private const int EIGHT_HOURS = 60 * 60 * 8;

    /**
     * 管理者を1人作る。パスワードは 'password'。監査ログは作らない。
     * 役割は owner（すべてできる）か viewer（見るだけ）。ほかの値は例外で止める（表に制約がないため）。
     */
    public static function create(string $role = 'owner', ?string $name = null): TestAdmin
    {
        if (! in_array($role, self::ROLES, true)) {
            throw new InvalidArgumentException("DummyAdmin::create() の役割は owner か viewer。渡された値：{$role}");
        }

        $email = 'admin-'.Str::lower(Str::random(10)).'@admin.example.test';
        $id = DB::table('admins')->insertGetId([
            'email' => $email,
            'password' => Hash::make('password'),
            'name' => $name ?? 'テスト管理者',
            'role' => $role,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return new TestAdmin($id, $email, $role);
    }

    /** その管理者としてログインした状態にする。使い方：DummyAdmin::actingAs($admin)->getJson('/api/members') */
    public static function actingAs(TestAdmin $admin): TestCase
    {
        return withHeader('Authorization', 'Bearer '.self::token($admin));
    }

    /** ログインの API が返すのと同じ形の JWT（sub・role・iat・exp）。期限は8時間。 */
    private static function token(TestAdmin $admin): string
    {
        return JWT::encode([
            'sub' => $admin->id,
            'role' => $admin->role,
            'iat' => time(),
            'exp' => time() + self::EIGHT_HOURS,
        ], (string) config('app.key'), 'HS256');
    }
}
