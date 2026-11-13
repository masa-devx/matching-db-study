<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Plan;
use App\Models\Profile;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 07 プランの一覧（レガシー版。docs/api/07-paid-members.md）。男性の会員だけが使える。
 * だれが使うかは、AuthController::me() の JWT の処理を写して決める（これで14か所目）。
 * 性別は、プロフィールの今の値で確かめる（編集で書き換えられる）。
 */
class PlanController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // AuthController::me() から写した（トークンがなければ 401、壊れていれば 500）
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));

        // 有料会員は男性だけ（購入まわりの3か所に同じものを写す）
        $profile = Profile::where('user_id', $payload->sub)->first();
        if ($profile?->gender !== 'male') {
            return response()->json(['message' => '有料会員は男性の会員だけです'], 403);
        }

        // plans の行をそのまま返す
        return response()->json(Plan::orderBy('id')->get());
    }
}
