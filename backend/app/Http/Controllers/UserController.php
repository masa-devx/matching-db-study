<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Mail\VerifyMail;
use App\Models\Profile;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;

/**
 * 01b 登録（素朴な版。docs/api/01b-auth.md）。
 * 入力を確かめない・トランザクションがない・応答に確認用の文字が出る。直す段階で、要件 ID のテストにする。
 */
class UserController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        // password は User の casts の 'hashed' で bcrypt になる
        $user = User::create($request->only(['email', 'password']) + [
            'verification_token' => Str::random(40),   // 平文・期限なし
        ]);

        Profile::create($request->only(['nickname', 'gender', 'birthday']) + ['user_id' => $user->id]);

        // ここで失敗しても、会員とプロフィールは残る（トランザクションがない）
        Mail::to($user->email)->send(new VerifyMail($user));

        return response()->json($user, 201);
    }
}
