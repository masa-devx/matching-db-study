<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Block;
use App\Models\Profile;
use App\Models\User;
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
 * #46 で、相手を public_id（UUID）で返すようにした（1件ごとに1本増え、1＋2N 本）。
 * 06 で、ブロックした・された相手を除いた（向きごとに2本足す。退会した相手は除かない。docs/api/06-blocks-withdrawal.md）。
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

        // 06：ブロックした・された相手を、向きごとに PHP に持ってくる（検索から写した）
        $blocked = Block::where('blocker_id', $me)->pluck('blocked_id');     // UNIQUE の先頭なので索引が効く
        $blockedMe = Block::where('blocked_id', $me)->pluck('blocker_id');   // 索引がなく、表を全部読む
        $blockIds = $blocked->merge($blockedMe);

        // 自分が組のどちら側にいてもよいので OR で探す
        $matches = UserMatch::where('user1_id', $me)
            ->orWhere('user2_id', $me)
            ->orderBy('created_at', 'desc')
            ->get();

        $result = [];
        foreach ($matches as $match) {
            // 組のどちら側に自分がいるかで、相手を選ぶ（自分とのマッチなら、相手も自分になる）
            $partnerId = $match->user1_id == $me ? $match->user2_id : $match->user1_id;
            // 06：ブロックした・された相手は飛ばす（退会した相手は飛ばさない）
            if ($blockIds->contains($partnerId)) {
                continue;
            }
            // マッチ1件ごとに1本（N+1）。相手が消えても、マッチの行は残る
            $profile = Profile::where('user_id', $partnerId)->first();
            // #46：画面がユーザー詳細へのリンクに使うので、相手の public_id を返す。1件ごとにもう1本
            $publicId = User::where('id', $partnerId)->value('public_id');
            $result[] = [
                'user_id' => $publicId,
                'nickname' => $profile?->nickname,
                'birthday' => $profile?->birthday,   // 年齢ではなく生年月日をそのまま返す
                'image' => $profile?->image,
                'matched_at' => $match->created_at,
            ];
        }

        return response()->json($result);
    }
}
