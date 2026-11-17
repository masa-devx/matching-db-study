<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Notice;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * A7 運営からのお知らせを見る・読んだことにする（レガシー版。#213。docs/api/m7-reports.md の「#213」）。
 * - だれが使うかは、BlockController::store() の JWT の処理をコピーして決める
 * - 一覧は、全部を一度に返す（分けて読む仕組みはない）
 * - 読んだことにするとき、持ち主を確かめない（ID を知っていれば、他人のお知らせを読んだことにできる）
 */
class NoticeController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // BlockController::store() からコピーした
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));

        $rows = Notice::where('user_id', $payload->sub)->orderBy('created_at', 'desc')->get();

        $result = [];
        foreach ($rows as $n) {
            $result[] = [
                'id' => $n->public_id,
                'kind' => $n->kind,
                'title' => $n->title,
                'body' => $n->body,
                'read_at' => $n->read_at,
                'created_at' => $n->created_at,
            ];
        }

        return response()->json($result);
    }

    public function read(Request $request, string $publicId): JsonResponse
    {
        // index() と同じ処理を、もう一度書いた
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key(config('app.key'), 'HS256'));

        // だれのお知らせかを見ない。もう読んでいても、読んだ日時を書き換える
        $count = Notice::where('public_id', $publicId)->update(['read_at' => now()]);
        if ($count === 0) {
            return response()->json(['message' => 'お知らせが見つかりません'], 404);
        }

        return response()->json(['message' => '読みました']);
    }
}
