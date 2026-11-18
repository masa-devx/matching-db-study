<?php

declare(strict_types=1);

namespace Tests\Support;

use Firebase\JWT\JWT;
use Illuminate\Foundation\Testing\TestCase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

use function Pest\Laravel\withHeader;

/*
 * 管理画面の API テストのデータと、ログインした状態を作る関数（agents/rules/testing.md）。
 * 管理画面は Model を持たないので、表に直接入れる（DB::table）。表に直接入れるのは、このファイルだけ。
 * Model を作ったら、ここだけを書き換える。会員の側の同じ名前の関数（backend/client/tests/Support/functions.php）とは別のもの
 * （管理画面は、会員の側のコードを読み込まない決まり）。
 * 日時の列には now() が入るので、決まった日時にしたいときは、呼ぶ前に travelTo() で時刻を止める。
 */

/**
 * 管理者を1人作る。パスワードは 'password'。
 * 作らないもの：監査ログ（admin_audit_logs）。
 *
 * @param  'owner'|'viewer'  $role  owner は、すべてできる。viewer は、見るだけ
 */
function createAdmin(string $role = 'owner', ?string $name = null): TestAdmin
{
    $email = 'admin-'.Str::lower(Str::random(10)).'@admin.example.test';
    $id = DB::table('admins')->insertGetId([
        'email' => $email,
        'password' => Hash::make('password'),
        'name' => $name ?? ($role === 'owner' ? '運営 太郎' : '閲覧 花子'),
        'role' => $role,
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    return new TestAdmin($id, $email, $role);
}

/**
 * 会員（users とプロフィール）を1人作る。メールアドレスは確認済み・無料・利用中。
 * 作らないもの：購入の行（purchases）・停止の履歴（suspensions）・いいね・マッチ・メッセージ。
 *
 * @param  'male'|'female'  $gender
 * @param  bool  $paid  有料会員（is_paid が true。期限は今から30日。purchases の行は作らない）
 * @param  bool  $withdrawn  退会した（deleted_at を入れ、メールアドレスを書き換える。会員の側の退会の API と同じ形）
 * @param  bool  $suspended  利用を止めた（users.suspended_at を入れる。停止の履歴と監査ログは作らない）
 */
function createMember(
    string $gender = 'female',
    bool $paid = false,
    bool $withdrawn = false,
    bool $suspended = false,
    ?string $nickname = null,
): TestMember {
    $email = 'member-'.Str::lower(Str::random(10)).'@example.test';
    $id = DB::table('users')->insertGetId([
        'email' => $withdrawn ? $email.'#deleted#'.now()->getTimestamp() : $email,
        'email_verified_at' => now(),
        'password' => Hash::make('password'),
        'is_paid' => $paid,
        'paid_until' => $paid ? now()->addDays(30) : null,
        'suspended_at' => $suspended ? now() : null,
        'suspended_reason' => $suspended ? 'テストで止めた' : null,
        'deleted_at' => $withdrawn ? now() : null,
        'created_at' => now(),
        'updated_at' => now(),
    ]);
    $nickname ??= 'テスト会員'.$id;
    DB::table('profiles')->insert([
        'user_id' => $id,
        'nickname' => $nickname,
        'gender' => $gender,
        'birthday' => '1995-04-01',
        'prefecture' => '東京都',
        'created_at' => now(),
        'updated_at' => now(),
    ]);

    // public_id は DB の既定の値（uuidv7()）で入るので、読み直す
    $publicId = (string) DB::table('users')->where('id', $id)->value('public_id');

    return new TestMember($id, $publicId, $email, $nickname);
}

/**
 * その管理者としてログインした状態にする（Authorization ヘッダーに、管理者の JWT を付ける）。
 * 返り値から、->getJson('/api/…') のように続けて呼ぶ。
 */
function actingAsAdmin(TestAdmin $admin): TestCase
{
    return withHeader('Authorization', 'Bearer '.adminToken($admin));
}

/**
 * 管理者の JWT を作る。中身と鍵は、AuthController::login() が作るものと同じ形（sub・role・iat・exp）。
 * 期限切れ・壊れたトークンを試すテストは、この関数を使わずに、自分で作る。
 */
function adminToken(TestAdmin $admin): string
{
    return JWT::encode([
        'sub' => $admin->id,
        'role' => $admin->role,
        'iat' => time(),
        'exp' => time() + 60 * 60 * 8,
    ], (string) config('app.key'), 'HS256');
}
