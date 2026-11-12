<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Mail\VerifyMail;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

/**
 * 01b メールアドレスの確認と、確認のメールの再送（素朴な版。docs/api/01b-auth.md）。
 * 確認用の文字は消さず、期限もない。再送はだれでも・何回でもできる。
 */
class EmailVerificationController extends Controller
{
    // 確認のメールのリンクを開く
    public function show(string $token): JsonResponse
    {
        // verification_token にインデックスがないので、表を全部読む
        $user = User::where('verification_token', $token)->first();
        if (! $user) {
            return response()->json(['message' => '確認のリンクが正しくありません'], 404);
        }

        $user->email_verified_at = now();   // 確認用の文字は消さないので、何度でも使える
        $user->save();

        return response()->json(['message' => 'メールアドレスを確認しました']);
    }

    // 確認のメールをもう一度送る
    public function store(Request $request): JsonResponse
    {
        $user = User::where('email', $request->input('email'))->first();
        if (! $user) {
            // 登録されていないことが分かってしまう
            return response()->json(['message' => '会員が見つかりません'], 404);
        }

        // 確認済みでも送る。同じ確認用の文字を送り直す
        Mail::to($user->email)->send(new VerifyMail($user));

        return response()->json(['message' => '確認のメールを送りました']);
    }
}
