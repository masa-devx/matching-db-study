<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * 01b ログイン・自分の情報・ログアウト（レガシー版。docs/api/01b-auth.md）。
 * JWT は 30日・止める仕組みなし・中身に個人情報。鍵は APP_KEY を使い回す。何回でもログインを試せる。
 * 改善する段階で、要件 ID のテストにする。
 */
class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $user = User::where('email', $request->input('email'))->first();
        if (! $user) {
            // 言葉が違うので、そのメールアドレスが登録されているかが分かる
            return response()->json(['message' => 'メールアドレスが違います'], 401);
        }

        // 会員がいないときは、ここ（bcrypt の照合）を飛ばすので、返るまでの時間でも見分けられる
        if (! Hash::check($request->input('password'), $user->password)) {
            return response()->json(['message' => 'パスワードが違います'], 401);
        }

        // 中身は base64 なので、だれでも読める（署名はあるが、暗号化はしていない）
        $token = JWT::encode([
            'sub' => $user->id,
            'email' => $user->email,
            'nickname' => $user->profile?->nickname,
            'iat' => time(),
            'exp' => time() + 60 * 60 * 24 * 30,   // 30日。途中で止める仕組みはない
        ], config('app.key'), 'HS256');            // 暗号化や Cookie と同じ鍵を使い回す

        return response()->json(['token' => $token]);
    }

    public function me(Request $request): JsonResponse
    {
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }

        // 署名が違う・期限が切れた JWT の例外をつかまえないので、401 ではなく 500 になる
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));

        // 呼ぶたびに DB を読む。users の行をそのまま返す（verification_token も出る）
        return response()->json(User::find($payload->sub));
    }

    public function logout(): JsonResponse
    {
        // サーバーは何もしない。画面がトークンを消さなければ、30日のあいだ使える
        return response()->json(['message' => 'ログアウトしました']);
    }
}
