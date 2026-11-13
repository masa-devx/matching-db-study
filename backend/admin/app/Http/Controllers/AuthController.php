<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * 12 管理者のログインと自分（レガシー版。docs/api/12-admin.md）。
 * JWT は管理画面の APP_KEY で署名する（会員の側の鍵とは別）。中身に役割を入れ、8時間で切れる。止める仕組みはない。
 * 表は DB::table() で直接読む（管理画面は会員の側のコードを読み込まない）。
 */
class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $admin = DB::table('admins')->where('email', $request->input('email'))->first();
        if (! $admin || ! Hash::check((string) $request->input('password'), $admin->password)) {
            return response()->json(['message' => 'メールアドレスかパスワードが違います'], 401);
        }

        DB::table('admins')->where('id', $admin->id)->update(['last_login_at' => now()]);

        $token = JWT::encode([
            'sub' => $admin->id,
            'role' => $admin->role,   // 役割を JWT に入れるので、役割を変えても期限まで前の役割のまま
            'iat' => time(),
            'exp' => time() + 60 * 60 * 8,
        ], (string) config('app.key'), 'HS256');

        return response()->json(['token' => $token, 'admin' => ['name' => $admin->name, 'role' => $admin->role]]);
    }

    public function me(Request $request): JsonResponse
    {
        // 管理者の JWT を読む（コントローラごとに写す。1か所目）。壊れた JWT・会員の JWT は例外のまま 500
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        return response()->json(DB::table('admins')->where('id', $payload->sub)->first(['name', 'email', 'role']));
    }
}
