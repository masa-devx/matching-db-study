<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * A1・A7 会員ごとの、やり取り・違反・ブロックと、ブロックの多い会員の一覧（レガシー版。#227。docs/api/12-admin.md の「#227」）。
 * MessageController::index() の JWT の処理を、4つのメソッドにコピーした。役割は確かめない（見るだけの人も見られる。要件どおり）。
 * - どれも、全部を一度に返す（分けて読む仕組みはない）。1件ごとに、相手の会員・ニックネームを読む（N+1）
 * - 会員の今の状態（利用中・停止中・退会）を、ここでも決める（4か所目。強制退会は見ていない）
 * - やり取りの相手・ブロックの相手・通報した会員という、会員どうしの関係を読むのに、監査ログに残さない
 */
class MemberActivityController extends Controller
{
    public function talkRooms(Request $request, string $publicId): JsonResponse
    {
        // MessageController::index() からコピーした
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $user = DB::table('users')->where('public_id', $publicId)->first();
        if (! $user) {
            return response()->json(['message' => '会員が見つかりません'], 404);
        }

        $rooms = [];
        // talk_room_members.user_id から探すインデックスはない（UNIQUE は talk_room_id が先）
        foreach (DB::table('talk_room_members')->where('user_id', $user->id)->get() as $member) {
            // 1ルームごとに7本（N+1）
            $room = DB::table('talk_rooms')->where('id', $member->talk_room_id)->first();
            $partnerId = DB::table('talk_room_members')->where('talk_room_id', $member->talk_room_id)
                ->where('user_id', '!=', $user->id)->value('user_id');
            $partner = DB::table('users')->where('id', $partnerId)->first();
            $last = DB::table('messages')->where('talk_room_id', $member->talk_room_id)->orderBy('created_at', 'desc')->first();
            $rooms[] = [
                'room_id' => $room?->public_id,
                'partner' => [
                    'user_id' => $partner?->public_id,
                    'nickname' => DB::table('profiles')->where('user_id', $partnerId)->value('nickname'),
                    'state' => $partner?->deleted_at ? 'withdrawn' : ($partner?->suspended_at ? 'suspended' : 'active'),
                ],
                'message_count' => DB::table('messages')->where('talk_room_id', $member->talk_room_id)->count(),
                // この会員が送った数（相手に一方的に送っていないかを見る）
                'sent_count' => DB::table('messages')->where('talk_room_id', $member->talk_room_id)
                    ->where('sender_id', $user->id)->count(),
                'last_message' => $last ? ['body' => $last->body, 'created_at' => $last->created_at, 'mine' => $last->sender_id === $user->id] : null,
                'created_at' => $room?->created_at,
            ];
        }
        // 最後のメッセージの新しい順に、PHP の中で並べ替える（メッセージのないルームは、最後）
        usort($rooms, fn (array $a, array $b): int => ($b['last_message']['created_at'] ?? '') <=> ($a['last_message']['created_at'] ?? ''));

        return response()->json($rooms);
    }

    public function violations(Request $request, string $publicId): JsonResponse
    {
        // talkRooms() と同じ処理を、もう一度書いた
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $user = DB::table('users')->where('public_id', $publicId)->first();
        if (! $user) {
            return response()->json(['message' => '会員が見つかりません'], 404);
        }

        // この会員が通報された案件。新しい順。1件ごとに、通報の件数・理由の内訳を読む
        $cases = [];
        foreach (DB::table('report_cases')->where('reported_id', $user->id)->orderBy('created_at', 'desc')->get() as $case) {
            $cases[] = [
                'id' => $case->public_id,
                'status' => $case->status,
                'action' => $case->action,
                'report_count' => DB::table('reports')->where('report_case_id', $case->id)->count(),
                'reasons' => DB::table('reports')->where('report_case_id', $case->id)->distinct()->pluck('reason'),
                'created_at' => $case->created_at,
                'closed_at' => $case->closed_at,
            ];
        }

        // この会員が、ほかの会員を通報した記録（通報をくり返す会員を見つけるため）。全部返す
        $made = [];
        foreach (DB::table('reports')->where('reporter_id', $user->id)->orderBy('created_at', 'desc')->get() as $report) {
            $target = DB::table('users')->where('id', $report->reported_id)->first();
            $made[] = [
                'reported' => [
                    'user_id' => $target?->public_id,
                    'nickname' => DB::table('profiles')->where('user_id', $report->reported_id)->value('nickname'),
                ],
                'case_id' => DB::table('report_cases')->where('id', $report->report_case_id)->value('public_id'),
                'reason' => $report->reason,
                'created_at' => $report->created_at,
            ];
        }

        return response()->json(['cases' => $cases, 'reports_made' => $made]);
    }

    public function blocks(Request $request, string $publicId): JsonResponse
    {
        // talkRooms() と同じ処理を、もう一度書いた
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        $user = DB::table('users')->where('public_id', $publicId)->first();
        if (! $user) {
            return response()->json(['message' => '会員が見つかりません'], 404);
        }

        // ブロックした相手（UNIQUE のインデックスが使える）と、ブロックされた相手（blocked_id から探すインデックスはない）
        $made = [];
        foreach (DB::table('blocks')->where('blocker_id', $user->id)->orderBy('created_at', 'desc')->get() as $block) {
            $made[] = $this->blockRow($block->blocked_id, $block->created_at, $user->id);
        }
        $received = [];
        foreach (DB::table('blocks')->where('blocked_id', $user->id)->orderBy('created_at', 'desc')->get() as $block) {
            $received[] = $this->blockRow($block->blocker_id, $block->created_at, $user->id);
        }

        return response()->json(['made' => $made, 'received' => $received]);
    }

    public function blockRanking(Request $request): JsonResponse
    {
        // talkRooms() と同じ処理を、もう一度書いた
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        JWT::decode($token, new Key((string) config('app.key'), 'HS256'));

        // 多くの人からブロックされている会員の、上から 50人。3万件を全部読んで、会員ごとに数える
        $rows = DB::table('blocks')->selectRaw('blocked_id, count(*) as blocked_count, max(created_at) as last_blocked_at')
            ->groupBy('blocked_id')->orderByDesc('blocked_count')->limit(50)->get();

        $data = [];
        foreach ($rows as $row) {
            // 1人ごとに4本（N+1）
            $target = DB::table('users')->where('id', $row->blocked_id)->first();
            $data[] = [
                'user_id' => $target?->public_id,
                'nickname' => DB::table('profiles')->where('user_id', $row->blocked_id)->value('nickname'),
                'state' => $target?->deleted_at ? 'withdrawn' : ($target?->suspended_at ? 'suspended' : 'active'),
                'blocked_count' => $row->blocked_count,
                'last_blocked_at' => $row->last_blocked_at,
                'report_count' => DB::table('reports')->where('reported_id', $row->blocked_id)->count(),
                'open_case' => DB::table('report_cases')->where('reported_id', $row->blocked_id)
                    ->where('status', '!=', 'closed')->value('public_id'),
            ];
        }

        return response()->json($data);
    }

    /**
     * ブロックの1行（相手の会員・ニックネーム・状態・2人がマッチしていたか）。1行ごとに4本。
     *
     * @return array<string, mixed>
     */
    private function blockRow(int $otherId, ?string $at, int $userId): array
    {
        $other = DB::table('users')->where('id', $otherId)->first();

        return [
            'user_id' => $other?->public_id,
            'nickname' => DB::table('profiles')->where('user_id', $otherId)->value('nickname'),
            'state' => $other?->deleted_at ? 'withdrawn' : ($other?->suspended_at ? 'suspended' : 'active'),
            'blocked_at' => $at,
            // 2人がマッチしていたか（やり取りのあとのブロックかを見る）。user1・user2 のどちら向きにも探す
            'matched' => DB::table('user_matches')
                ->where(fn ($w) => $w->where('user1_id', $userId)->where('user2_id', $otherId))
                ->orWhere(fn ($w) => $w->where('user1_id', $otherId)->where('user2_id', $userId))->exists(),
        ];
    }
}
