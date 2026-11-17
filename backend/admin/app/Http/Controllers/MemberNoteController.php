<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * A1 会員の、対応のメモを足す（レガシー版。#216。docs/api/12-admin.md の「#216」）。
 * MessageController::index() の JWT の処理をコピーした。役割の確かめは、コピーしていない
 * （要件は owner だけだが、見るだけの人も書ける）。本文を確かめない（なければ NOT NULL の違反で 500）。
 * 監査ログにも残さない。
 */
class MemberNoteController extends Controller
{
    public function store(Request $request, string $publicId): JsonResponse
    {
        // MessageController::index() からコピーした
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $user = DB::table('users')->where('public_id', $publicId)->first();
        if (! $user) {
            return response()->json(['message' => '会員が見つかりません'], 404);
        }

        DB::table('member_notes')->insert([
            'user_id' => $user->id,
            'admin_id' => $payload->sub,
            'body' => $request->input('body'),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => '書きました'], 201);
    }
}
