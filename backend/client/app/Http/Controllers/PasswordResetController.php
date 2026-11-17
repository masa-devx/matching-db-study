<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Mail\ResetPasswordMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * M2 パスワードを忘れたときの再設定（レガシー版。docs/api/01b-auth.md の「#196」）。
 * 設計を考えずに「とりあえず使える」形で作る。ログインしていない人が使う（トークンを見ない）。
 * 表は、Laravel が最初から用意している password_reset_tokens（email が主キー・token・created_at）を使う。
 * - 再設定用の文字を、平文のまま保存する（DB を見られたら、だれのパスワードでも変えられる）
 * - 期限を見ない。使ったあとも消さない（同じリンクで、何度でも変えられる）
 * - 登録されていないメールアドレスは 404（登録されているかが分かる）
 * - 何回でも送れる（メールを大量に送らせられる）
 * - 新しいパスワードを確かめない。変えても、前に配った JWT は止めない
 */
class PasswordResetController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $user = User::where('email', $request->input('email'))->first();
        if (! $user) {
            // 登録されていないことが分かってしまう（確認のメールの再送と同じ）
            return response()->json(['message' => '会員が見つかりません'], 404);
        }

        // 再設定用の文字を作り、平文のまま入れる。前のものがあれば、書き換える（email が主キーなので、1人に1つ）
        $token = Str::random(40);
        DB::table('password_reset_tokens')->updateOrInsert(
            ['email' => $user->email],
            ['token' => $token, 'created_at' => now()],
        );

        Mail::to($user->email)->send(new ResetPasswordMail($token));

        return response()->json(['message' => '再設定のメールを送りました']);
    }

    public function update(Request $request, string $token): JsonResponse
    {
        // token にインデックスがないので、表を全部読む。created_at（いつ作ったか）は見ない
        $row = DB::table('password_reset_tokens')->where('token', $token)->first();
        if (! $row) {
            return response()->json(['message' => '再設定のリンクが正しくありません'], 404);
        }

        // 退会した会員は、メールアドレスが書き換わっているので見つからず、null に update() で 500
        $user = User::where('email', $row->email)->first();
        // 新しいパスワードは確かめない（1文字でも通る。なければ NOT NULL の違反で 500）。'hashed' のキャストが bcrypt にする
        $user->update(['password' => $request->input('password')]);

        // 再設定用の文字は消さない（同じリンクを、もう一度使える）
        return response()->json(['message' => 'パスワードを変えました']);
    }
}
