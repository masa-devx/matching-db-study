<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * 12 メッセージの一覧（レガシー版）。10万件を created_at で並べ替えて、offset で 50件。毎回 count(*)。
 * 1件ごとに、送った人・ルーム・相手を読む（2＋6N 本）。本文を見られるのに、監査ログは書き忘れている。
 */
class MessageController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // AuthController::me() から写した
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $page = (int) $request->input('page', 1);
        $query = DB::table('messages');
        if ($request->filled('sender')) {
            $query->where('sender_id', DB::table('users')->where('public_id', $request->input('sender'))->value('id'));
        }
        if ($request->filled('from')) {
            $query->where('created_at', '>=', $request->input('from'));
        }
        if ($request->filled('to')) {
            $query->where('created_at', '<', $request->input('to'));
        }
        if ($request->filled('q')) {
            $query->where('body', 'like', '%'.$request->input('q').'%');
        }

        $total = (clone $query)->count();
        $rows = $query->orderBy('created_at', 'desc')->offset(($page - 1) * 50)->limit(50)->get();

        $data = [];
        foreach ($rows as $m) {
            // 1件ごとに6本（N+1）
            $senderName = DB::table('profiles')->where('user_id', $m->sender_id)->value('nickname');
            $senderId = DB::table('users')->where('id', $m->sender_id)->value('public_id');
            $room = DB::table('talk_rooms')->where('id', $m->talk_room_id)->first();
            $partnerUserId = DB::table('talk_room_members')->where('talk_room_id', $m->talk_room_id)
                ->where('user_id', '!=', $m->sender_id)->value('user_id');
            $partnerName = DB::table('profiles')->where('user_id', $partnerUserId)->value('nickname');
            $partnerId = DB::table('users')->where('id', $partnerUserId)->value('public_id');
            $data[] = [
                'id' => $m->id,
                'body' => $m->body,
                'created_at' => $m->created_at,
                'sender' => ['user_id' => $senderId, 'nickname' => $senderName],
                'partner' => ['user_id' => $partnerId, 'nickname' => $partnerName],
                'room_id' => $room?->public_id,
            ];
        }

        return response()->json(['total' => $total, 'page' => $page, 'data' => $data]);
    }
}
