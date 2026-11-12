<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Profile;
use App\Models\UserMatch;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 03 マッチした相手の一覧（レガシー版。docs/api/03-matches.md）。
 * だれが見るかは、AuthController::me() の JWT の処理を写して決める（これで4か所目）。
 * user_matches にインデックスがないので OR は表を全部読み、相手のプロフィールは1件ごとに読む（1＋N 本）。
 * 同じ組が2行あれば、同じ相手が2回出る。改善する段階で、要件 ID のテストにする。
 */
class UserMatchController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // AuthController::me() から写した（トークンがなければ 401、壊れていれば 500）
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));
        $me = $payload->sub;

        // 自分が組のどちら側にいてもよいので OR で探す
        $matches = UserMatch::where('user1_id', $me)
            ->orWhere('user2_id', $me)
            ->orderBy('created_at', 'desc')
            ->get();

        $result = [];
        foreach ($matches as $match) {
            // 組のどちら側に自分がいるかで、相手を選ぶ（自分とのマッチなら、相手も自分になる）
            $partnerId = $match->user1_id == $me ? $match->user2_id : $match->user1_id;
            // マッチ1件ごとに1本（N+1）。相手が消えても、マッチの行は残る
            $profile = Profile::where('user_id', $partnerId)->first();
            $result[] = [
                'user_id' => $partnerId,
                'nickname' => $profile?->nickname,
                'birthday' => $profile?->birthday,   // 年齢ではなく生年月日をそのまま返す
                'image' => $profile?->image,
                'matched_at' => $match->created_at,
            ];
        }

        return response()->json($result);
    }
}
