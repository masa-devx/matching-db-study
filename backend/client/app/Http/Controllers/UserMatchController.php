<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Block;
use App\Models\Profile;
use App\Models\User;
use App\Models\UserMatch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 03 マッチした相手の一覧（レガシー版。docs/api/03-matches.md）。
 * だれが使うかは、ルートの user.authenticate（ログインを確かめる Middleware）が決め、loginUserId() で番号を読む。
 * user_matches にインデックスがないので OR は表を全部読み、相手のプロフィールは1件ごとに読む（1＋N 本）。
 * 同じ組が2行あれば、同じ相手が2回出る。改善する段階で、要件 ID のテストにする。
 * #46 で、相手を public_id（UUID）で返すようにした（1件ごとに1本増え、1＋2N 本）。
 * 06 で、ブロックした・された相手を除いた（向きごとに2本足す。退会した相手は除かない。docs/api/06-blocks-withdrawal.md）。
 * #269 で、退会・アカウント停止・強制退会の相手も除いた（User の accountUsable()。Controller → Service には、まだ移していない）。
 */
class UserMatchController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $loginUserId = $this->loginUserId($request);

        // 06：ブロックした・された相手を、向きごとに PHP に持ってくる（検索から写した）
        $blocked = Block::where('blocker_id', $loginUserId)->pluck('blocked_id');     // UNIQUE の先頭なので索引が効く
        $blockedMe = Block::where('blocked_id', $loginUserId)->pluck('blocker_id');   // 索引がなく、表を全部読む
        $blockIds = $blocked->merge($blockedMe);

        // 自分が組のどちら側にいてもよいので OR で探す
        $matches = UserMatch::where('user1_id', $loginUserId)
            ->orWhere('user2_id', $loginUserId)
            ->orderBy('created_at', 'desc')
            ->get();

        $result = [];
        foreach ($matches as $match) {
            // 組のどちら側に自分がいるかで、相手を選ぶ（自分とのマッチなら、相手も自分になる）
            $partnerId = $match->user1_id == $loginUserId ? $match->user2_id : $match->user1_id;
            // 06：ブロックした・された相手は飛ばす
            if ($blockIds->contains($partnerId)) {
                continue;
            }
            // #46：画面がユーザー詳細へのリンクに使うので、相手の public_id を返す。1件ごとに1本。
            // ほかの会員に見せない相手（退会・アカウント停止・強制退会）は読めないので飛ばす。条件は User の accountUsable() の1か所（FR-WD-006・014）
            $publicId = User::query()->accountUsable()->where('id', $partnerId)->value('public_id');
            if ($publicId === null) {
                continue;
            }
            // マッチ1件ごとにもう1本（N+1）。相手が消えても、マッチの行は残る
            $profile = Profile::where('user_id', $partnerId)->first();
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
