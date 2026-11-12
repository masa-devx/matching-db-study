<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Profile;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * レガシー版（01）：Laravel 5 系のころの Fat Controller。
 * コントローラの中で Eloquent を直接使い、Model をそのまま JSON で返す。
 * 入力の確かめも、だれが編集できるかの確かめもしない（docs/api/01-members.md の「レガシー版」）。
 * 表は users（アカウント）と profiles（その会員についての情報）に分かれている（D-015）。
 * #46：会員は URL の public_id（UUID）で探す。形は確かめないので、UUID でない文字は PostgreSQL のエラー（500）になる。
 */
class ProfileController extends Controller
{
    public function show(string $publicId): User
    {
        $user = User::where('public_id', $publicId)->firstOrFail();
        $user->load('profile');   // ここで2本目の SQL が流れ、応答に profile が入る

        return $user;
    }

    public function update(Request $request, string $publicId): Profile
    {
        // UUID から中の id を読む（1本増える）。いない会員なら null になり、プロフィールも見つからない
        $id = User::where('public_id', $publicId)->value('id');
        $profile = Profile::where('user_id', $id)->first();   // 見つからなければ null
        $profile->fill($request->all());
        $profile->save();

        return $profile;
    }
}
