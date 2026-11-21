<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * 01b ログイン・自分の情報・ログアウト（レガシー版。docs/api/01b-auth.md）。
 * JWT は 30日。ログアウト・パスワードの変更では止まらない（退会・アカウント停止・強制退会は、ほかの API でも user.authenticate が断る）。
 * 中身に個人情報。鍵は APP_KEY を使い回す。何回でもログインを試せる。
 * 改善する段階で、要件 ID のテストにする。
 * 12 で、管理画面でアカウント停止された会員をログインで断るようにした（docs/api/12-admin.md）。ほかの API は user.authenticate が断る。
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

        // 12：管理画面でアカウント停止された会員は、ログインさせない（止める前の JWT は、ほかの API でも user.authenticate が断る）
        if ($user->suspended_at !== null) {
            return response()->json(['message' => '利用を停止しています'], 403);
        }

        // A7（#213）：強制退会にした会員は、ログインさせない（前に配った JWT は、ほかの API でも user.authenticate が断る）
        if ($user->banned_at !== null) {
            return response()->json(['message' => '強制退会になっています'], 403);
        }

        // 04：最終ログインを残す（検索の並び）。save() は updated_at も書き換える。時刻はアプリのサーバーの時計
        $user->last_login_at = now();
        $user->save();

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
        $loginUserId = $this->loginUserId($request);

        // 呼ぶたびに DB を読む。users の行をそのまま返す（verification_token は User の #[Hidden] で隠す）
        return response()->json(User::find($loginUserId));
    }

    public function logout(): JsonResponse
    {
        // サーバーは何もしない。画面がトークンを消さなければ、30日のあいだ使える
        return response()->json(['message' => 'ログアウトしました']);
    }
}
