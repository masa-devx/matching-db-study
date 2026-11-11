<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Profile;
use App\Models\User;
use Illuminate\Http\Request;

/**
 * 素朴な版（01）：Laravel 5 系のころの Fat Controller。
 * コントローラの中で Eloquent を直接使い、Model をそのまま JSON で返す。
 * 入力の確かめも、だれが編集できるかの確かめもしない（docs/api.md の「素朴な版」）。
 * 表は users（アカウント）と profiles（その会員についての情報）に分かれている（D-015）。
 */
class ProfileController extends Controller
{
    public function show(int $id): User
    {
        $user = User::findOrFail($id);
        $user->load('profile');   // ここで2本目の SQL が流れ、応答に profile が入る

        return $user;
    }

    public function update(Request $request, int $id): Profile
    {
        $profile = Profile::where('user_id', $id)->first();   // 見つからなければ null
        $profile->fill($request->all());
        $profile->save();

        return $profile;
    }
}
