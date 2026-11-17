<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * A2 トークルームのやり取りを、続けて読む（レガシー版。#221。docs/api/12-admin.md の「#221」）。
 * MessageController::index() の JWT の処理をコピーした。
 * - 新しい方から 100件ずつ（offset）。古い方へさかのぼるほど、読み飛ばす行が増える
 * - 毎回、全部の件数を数える。1件ごとに、送った人のニックネームを読む（N+1）
 * - 2人のやり取りの中身を読むのに、監査ログに残さない（メッセージの一覧と同じ、書き忘れ）
 */
class TalkRoomController extends Controller
{
    public function show(Request $request, string $publicId): JsonResponse
    {
        // MessageController::index() からコピーした
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $room = DB::table('talk_rooms')->where('public_id', $publicId)->first();
        if (! $room) {
            return response()->json(['message' => 'ルームが見つかりません'], 404);
        }

        // ルームの2人。1人ごとに、会員とニックネームを読む
        $members = [];
        foreach (DB::table('talk_room_members')->where('talk_room_id', $room->id)->orderBy('id')->get() as $member) {
            $user = DB::table('users')->where('id', $member->user_id)->first();
            $members[] = [
                'user_id' => $user?->public_id,
                'nickname' => DB::table('profiles')->where('user_id', $member->user_id)->value('nickname'),
                // 会員の今の状態を、ここでも決める（通報の案件にある決め方を、もう一度書いた。強制退会は見ていない）
                'state' => $user?->deleted_at ? 'withdrawn' : ($user?->suspended_at ? 'suspended' : 'active'),
                'last_read_at' => $member->last_read_at,
            ];
        }

        $page = (int) $request->input('page', 1);
        $total = DB::table('messages')->where('talk_room_id', $room->id)->count();
        // 新しい方から 100件を取り、画面で読みやすいように、古い順に並べ直して返す
        $rows = DB::table('messages')->where('talk_room_id', $room->id)
            ->orderBy('created_at', 'desc')->offset(($page - 1) * 100)->limit(100)->get()->reverse()->values();

        $messages = [];
        foreach ($rows as $m) {
            $messages[] = [
                'id' => $m->id,
                'sender_id' => DB::table('users')->where('id', $m->sender_id)->value('public_id'),   // 1件ごとに1本
                'body' => $m->body,
                'created_at' => $m->created_at,
            ];
        }

        return response()->json([
            'room_id' => $room->public_id,
            'created_at' => $room->created_at,
            'members' => $members,
            'total' => $total,
            'page' => $page,
            'messages' => $messages,
        ]);
    }
}
