<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Models\Profile;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 07 プランの一覧（レガシー版。docs/api/07-paid-members.md）。男性の会員だけが使える。
 * だれが使うかは、ルートの user.authenticate（ログインを確かめる Middleware）が決め、loginUserId() で番号を読む。
 * 性別は、プロフィールの今の値で確かめる（編集で書き換えられる）。
 */
class PlanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $loginUserId = $this->loginUserId($request);   // user.authenticate が載せた、ログインしている会員の番号

        // 有料会員は男性だけ（購入まわりの3か所に同じものを写す）
        $profile = Profile::where('user_id', $loginUserId)->first();
        if ($profile?->gender !== 'male') {
            return response()->json(['message' => '有料会員は男性の会員だけです'], 403);
        }

        // plans の行をそのまま返す
        return response()->json(Plan::orderBy('id')->get());
    }
}
