<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Profile;
use App\Models\Skip;
use App\Models\User;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * M3 スキップする・スキップした相手の一覧・元に戻す（レガシー版。docs/api/02-likes.md の「#184」）。
 * ブロック（BlockController）とほぼ同じ形を、コピーして作った。
 * だれが使うかは、AuthController::me() の JWT の処理を、メソッドごとにコピーして決める（23〜25か所目）。
 * - UNIQUE がないので、同じ相手を2回スキップすると、2行できる（一覧に2回出る）
 * - いない相手・形の違う ID を確かめない
 * - 相手には伝えない（スキップされた側が、それを知る API はない）
 */
class SkipController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        // AuthController::me() からコピーした（トークンがなければ 401、壊れていれば 500）
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));

        // 相手は public_id（UUID）で来る。いなければ null（下の insert が NOT NULL で 500）。退会したかは見ない
        $skippedId = User::where('public_id', $request->input('user_id'))->value('id');

        // 自分でも入る。2回目も入る（UNIQUE がない）
        $skip = Skip::create(['skipper_id' => $payload->sub, 'skipped_id' => $skippedId]);

        // skips の行をそのまま返す（中の連番の id が出る）
        return response()->json($skip, 201);
    }

    public function index(Request $request): JsonResponse
    {
        // store() と同じ処理を、もう一度コピーした
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));

        $skips = Skip::where('skipper_id', $payload->sub)->orderBy('created_at', 'desc')->get();

        $result = [];
        foreach ($skips as $skip) {
            // 1件ごとに2本（N+1）。退会した相手も、そのまま出る
            $profile = Profile::where('user_id', $skip->skipped_id)->first();
            $publicId = User::where('id', $skip->skipped_id)->value('public_id');
            $result[] = [
                'user_id' => $publicId,
                'nickname' => $profile?->nickname,
                'birthday' => $profile?->birthday,
                'prefecture' => $profile?->prefecture,
                'image' => $profile?->image,
                'skipped_at' => $skip->created_at,
            ];
        }

        return response()->json($result);
    }

    public function destroy(Request $request, string $publicId): JsonResponse|Response
    {
        // これで3回目のコピー
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));

        $skippedId = User::where('public_id', $publicId)->value('id');

        // 2回スキップしていれば、2行とも消える。消えた行がなくても 204
        Skip::where('skipper_id', $payload->sub)->where('skipped_id', $skippedId)->delete();

        return response()->noContent();
    }
}
