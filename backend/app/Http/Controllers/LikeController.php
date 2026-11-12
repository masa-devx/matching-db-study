<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Like;
use App\Models\Profile;
use App\Models\UserMatch;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 02 いいねを送る・送った相手の一覧（レガシー版。docs/api/02-likes.md）。
 * だれが送るかは、AuthController::me() の JWT の処理を、メソッドごとに写して決める。
 * エラーは扱わない（UNIQUE の違反も例外も 500）。一覧は 1＋N 本。改善する段階で、要件 ID のテストにする。
 * 03 で、送るときにマッチを作り（docs/api/02-likes.md の「03 で変えること」）、一覧に「マッチ済み」を足した（1＋2N 本）。
 */
class LikeController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        // AuthController::me() から写した（トークンがなければ 401、壊れていれば 500）
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));

        $like = Like::create([
            'from_user_id' => $payload->sub,
            // 自分でも・いない会員でも入る（CHECK・外部キーがない）。2回目は UNIQUE の違反で 500
            'to_user_id' => $request->input('user_id'),
        ]);

        // 03：相手から自分へのいいねがあれば、マッチを作る（トランザクションなし。1本ずつすぐ確定する）
        // 自分あてのいいねは、今入れた行そのものが「逆向き」として見つかり、自分とのマッチができる
        $reverse = Like::where('from_user_id', $request->input('user_id'))
            ->where('to_user_id', $payload->sub)
            ->first();
        $matched = false;
        if ($reverse) {
            // user1_id に送り返した人、user2_id に先に送っていた人（向きがそろわない。組の UNIQUE もない）
            UserMatch::create([
                'user1_id' => $payload->sub,
                'user2_id' => $request->input('user_id'),
            ]);
            $matched = true;
        }

        return response()->json(array_merge($like->toArray(), ['matched' => $matched]), 201);
    }

    public function index(Request $request): JsonResponse
    {
        // store() と同じ処理を、もう一度写した
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));

        $likes = Like::where('from_user_id', $payload->sub)->orderBy('created_at', 'desc')->get();

        $result = [];
        foreach ($likes as $like) {
            // いいね1件ごとに1本（N+1）。相手が消えても、いいねの行は残る（プロフィールも消えていれば nickname などが null）
            $profile = Profile::where('user_id', $like->to_user_id)->first();
            // 03：相手から自分へのいいねがあれば「マッチ済み」。user_matches は見ない（正が2つになる）。1件ごとにもう1本
            $matched = Like::where('from_user_id', $like->to_user_id)
                ->where('to_user_id', $payload->sub)
                ->exists();
            $result[] = [
                'user_id' => $like->to_user_id,
                'nickname' => $profile?->nickname,
                'birthday' => $profile?->birthday,   // 年齢ではなく生年月日をそのまま返す
                'image' => $profile?->image,
                'liked_at' => $like->created_at,
                'matched' => $matched,
            ];
        }

        return response()->json($result);
    }
}
