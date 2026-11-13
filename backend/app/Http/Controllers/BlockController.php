<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Block;
use App\Models\Profile;
use App\Models\User;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * 06 ブロックする・ブロックした相手の一覧・解除する（レガシー版。docs/api/06-blocks-withdrawal.md）。
 * だれが使うかは、AuthController::me() の JWT の処理を、メソッドごとに写して決める（これで10〜12か所目）。
 * 会員がいるか・退会したかは見ない。入力も確かめず、エラーは扱わない（UNIQUE の違反も 500）。
 * 一覧は 1＋2N 本。改善する段階で、要件 ID のテストにする。
 */
class BlockController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        // AuthController::me() から写した（トークンがなければ 401、壊れていれば 500）
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));

        // 相手は public_id（UUID）で来る。いなければ null（下の insert が NOT NULL で 500）。退会したかは見ない
        $blockedId = User::where('public_id', $request->input('user_id'))->value('id');

        // 自分でも入る。2回目は UNIQUE の違反で 500
        $block = Block::create(['blocker_id' => $payload->sub, 'blocked_id' => $blockedId]);

        // blocks の行をそのまま返す（中の連番の id が出る）
        return response()->json($block, 201);
    }

    public function index(Request $request): JsonResponse
    {
        // store() と同じ処理を、もう一度写した
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));

        $blocks = Block::where('blocker_id', $payload->sub)->orderBy('created_at', 'desc')->get();

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
        // store() と同じ処理を、もう一度写した
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));

        $blockedId = User::where('public_id', $publicId)->value('id');

        // 自分がした分だけを消す。消すものがなくても（いない相手・ブロックしていない相手）204
        Block::where('blocker_id', $payload->sub)->where('blocked_id', $blockedId)->delete();

        return response()->noContent();
    }
}
