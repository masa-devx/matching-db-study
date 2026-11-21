<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Block;
use App\Models\Like;
use App\Models\Profile;
use App\Models\Skip;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * M3 届いたいいねの一覧（レガシー版。docs/api/02-likes.md の「#184」）。
 * 無料でも有料でも見られる（2026-11-17 に決めた）。
 * だれが使うかは、ルートの user.authenticate（ログインを確かめる Middleware）が決め、loginUserId() で番号を読む。
 * 送ったいいねの一覧（LikeController::index）と同じ形で、向きだけを逆にした。
 * - もう送り返した相手（マッチした相手）・ブロックした／された相手・スキップした相手を、PHP に ID を持ってきて除く
 * - 1件ごとに、プロフィールと public_id を読む（1＋2N 本）
 * - likes.to_user_id にインデックスがないので、表を全部読む
 * - ページ送りがない（届いた分を全部返す）。退会した相手・止められた相手も、そのまま出る
 */
class ReceivedLikeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $loginUserId = $this->loginUserId($request);

        // もう自分からもいいねした相手（＝マッチした相手）は、返事が済んでいるので出さない
        $likedIds = Like::where('from_user_id', $loginUserId)->pluck('to_user_id');

        // 06：ブロックした・された相手（送ったいいねの一覧からコピーした）
        $blocked = Block::where('blocker_id', $loginUserId)->pluck('blocked_id');
        $blockedMe = Block::where('blocked_id', $loginUserId)->pluck('blocker_id');   // 索引がなく、表を全部読む
        $blockIds = $blocked->merge($blockedMe);

        // スキップした相手。索引がなく、表を全部読む
        $skipIds = Skip::where('skipper_id', $loginUserId)->pluck('skipped_id');

        $likes = Like::where('to_user_id', $loginUserId)
            ->whereNotIn('from_user_id', $likedIds)
            ->whereNotIn('from_user_id', $blockIds)
            ->whereNotIn('from_user_id', $skipIds)
            ->orderBy('created_at', 'desc')
            ->get();

        $result = [];
        foreach ($likes as $like) {
            // いいね1件ごとに2本（N+1）
            $profile = Profile::where('user_id', $like->from_user_id)->first();
            $publicId = User::where('id', $like->from_user_id)->value('public_id');
            $result[] = [
                'user_id' => $publicId,
                'nickname' => $profile?->nickname,
                'birthday' => $profile?->birthday,   // 年齢ではなく生年月日をそのまま返す
                'prefecture' => $profile?->prefecture,
                'image' => $profile?->image,
                'liked_at' => $like->created_at,
            ];
        }

        return response()->json($result);
    }
}
