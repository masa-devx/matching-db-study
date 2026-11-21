<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Block;
use App\Models\Profile;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * 06 ブロックする・ブロックした相手の一覧・解除する（レガシー版。docs/api/06-blocks-withdrawal.md）。
 * だれが使うかは、ルートの user.authenticate（ログインを確かめる Middleware）が決め、loginUserId() で番号を読む。
 * 会員がいるか・退会したかは見ない。入力も確かめず、エラーは扱わない（UNIQUE の違反も 500）。
 * 一覧は 1＋2N 本。改善する段階で、要件 ID のテストにする。
 */
class BlockController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $loginUserId = $this->loginUserId($request);   // user.authenticate が載せた、ログインしている会員の番号

        // 相手は public_id（UUID）で来る。いなければ null（下の insert が NOT NULL で 500）。退会したかは見ない
        $blockedId = User::where('public_id', $request->input('user_id'))->value('id');

        // 自分でも入る。2回目は UNIQUE の違反で 500
        $block = Block::create(['blocker_id' => $loginUserId, 'blocked_id' => $blockedId]);

        // blocks の行をそのまま返す（中の連番の id が出る）
        return response()->json($block, 201);
    }

    public function index(Request $request): JsonResponse
    {
        $loginUserId = $this->loginUserId($request);   // user.authenticate が載せた、ログインしている会員の番号

        $blocks = Block::where('blocker_id', $loginUserId)->orderBy('created_at', 'desc')->get();

        $result = [];
        foreach ($blocks as $block) {
            // 1件ごとに2本（N+1）。退会した相手も、そのまま出る
            $profile = Profile::where('user_id', $block->blocked_id)->first();
            $publicId = User::where('id', $block->blocked_id)->value('public_id');
            $result[] = [
                'user_id' => $publicId,
                'nickname' => $profile?->nickname,
                'image' => $profile?->image,
                'blocked_at' => $block->created_at,
            ];
        }

        return response()->json($result);
    }

    public function destroy(Request $request, string $publicId): JsonResponse|Response
    {
        $loginUserId = $this->loginUserId($request);   // user.authenticate が載せた、ログインしている会員の番号

        $blockedId = User::where('public_id', $publicId)->value('id');

        // 自分がした分だけを消す。消すものがなくても（いない相手・ブロックしていない相手）204
        Block::where('blocker_id', $loginUserId)->where('blocked_id', $blockedId)->delete();

        return response()->noContent();
    }
}
