<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;

/**
 * 素朴な版（01）：Laravel 5 系のころの Fat Controller。
 * コントローラの中で Eloquent を直接使い、Model をそのまま JSON で返す。
 * 入力の確かめも、だれが編集できるかの確かめもしない（docs/api.md の「素朴な版」）。
 */
class ProfileController extends Controller
{
    public function show($id)
    {
        $user = User::findOrFail($id);

        return $user;
    }

    public function update(Request $request, $id)
    {
        $user = User::findOrFail($id);
        $user->fill($request->all());
        $user->save();

        return $user;
    }
}
