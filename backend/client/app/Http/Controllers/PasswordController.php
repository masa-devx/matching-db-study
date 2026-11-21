<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

/**
 * M1 設定画面：パスワードを変える（レガシー版。docs/api/01b-auth.md の「#181」）。
 * 設計を考えずに「とりあえず使える」形で作る。
 * だれが使うかは、ルートの user.authenticate（ログインを確かめる Middleware）が決め、loginUserId() で番号を読む。
 * - 新しいパスワードを確かめない（1文字でも通る。登録のときの決まり（8〜64文字）と違ってしまう）
 * - 変えても、前に配ったトークン（JWT）は止めない（30日のあいだ、前のトークンで使い続けられる）
 * - 何回でも試せる（今のパスワードを当てる試しを、止める仕組みがない）
 * - 変えたことを、メールで知らせない
 */
class PasswordController extends Controller
{
    public function update(Request $request): JsonResponse
    {
        $loginUserId = $this->loginUserId($request);   // user.authenticate が載せた、ログインしている会員の番号

        $user = User::find($loginUserId);
        // 退会と同じ形（UserController::destroy）で、今のパスワードを確かめる
        if (! Hash::check((string) $request->input('current_password'), $user->password)) {
            return response()->json(['message' => '今のパスワードがちがいます'], 422);
        }

        // 新しいパスワードは確かめない。なければ null になり、NOT NULL の違反で 500。
        // Model の 'hashed' のキャストが、保存するときに bcrypt にする
        $user->update(['password' => $request->input('password')]);

        return response()->json(['message' => 'パスワードを変えました']);
    }
}
