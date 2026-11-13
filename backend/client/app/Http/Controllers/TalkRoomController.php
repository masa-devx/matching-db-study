<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Block;
use App\Models\Message;
use App\Models\Profile;
use App\Models\TalkRoom;
use App\Models\TalkRoomMember;
use App\Models\User;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 05 トークの一覧（レガシー版。docs/api/05-messages.md）。
 * だれが見るかは、AuthController::me() の JWT の処理を写して決める（これで6か所目）。
 * 自分の参加者の行を全部読み、ルームごとに6本ずつ読む（1＋6N 本）。messages にインデックスがないので、
 * 最新の1件と未読の数は、ルームごとに表を全部読む。並べるのは PHP。改善する段階で、要件 ID のテストにする。
 * 06 で、ブロックした・された相手を除いた（向きごとに2本足す。退会した相手は除かない。docs/api/06-blocks-withdrawal.md）。
 */
class TalkRoomController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // AuthController::me() から写した（トークンがなければ 401、壊れていれば 500）
        $token = $request->bearerToken();
        if (! $token) {
            return response()->json(['message' => 'ログインしてください'], 401);
        }
        $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));
        $me = $payload->sub;

        // 06：ブロックした・された相手を、向きごとに PHP に持ってくる（検索から写した）
        $blocked = Block::where('blocker_id', $me)->pluck('blocked_id');     // UNIQUE の先頭なので索引が効く
        $blockedMe = Block::where('blocked_id', $me)->pluck('blocker_id');   // 索引がなく、表を全部読む
        $blockIds = $blocked->merge($blockedMe);

        // 自分が入っているルーム。UNIQUE は (talk_room_id, user_id) の順なので、user_id だけでは使えず表を全部読む
        $members = TalkRoomMember::where('user_id', $me)->get();

        $result = [];
        foreach ($members as $member) {
            // ルームごとに6本（N+1）
            $room = TalkRoom::where('id', $member->talk_room_id)->first();
            // 相手（同じルームの、自分でない参加者）。いなければ null で、次の行が 500
            $partner = TalkRoomMember::where('talk_room_id', $room->id)->where('user_id', '!=', $me)->first();
            // 06：ブロックした・された相手のルームは飛ばす（退会した相手は飛ばさない）
            if ($blockIds->contains($partner->user_id)) {
                continue;
            }
            $profile = Profile::where('user_id', $partner->user_id)->first();
            $publicId = User::where('id', $partner->user_id)->value('public_id');
            // 最新の1件と未読の数：talk_room_id にインデックスがないので、どちらも表を全部読む
            $last = Message::where('talk_room_id', $room->id)->orderBy('created_at', 'desc')->first();
            // 未読の数は、最後に読んだ時刻より新しい相手のもの（時刻で比べるので、同じ秒に届いたものの境目がずれる）
            $query = Message::where('talk_room_id', $room->id)->where('sender_id', '!=', $me);
            // まだ開いていない（last_read_at が null）なら、相手のものを全部数える。
            // #58 で測ったとき、null のまま「> null」と書いて Laravel が例外を投げ、一覧の全体が 500 になったので、ここだけ直した
            if ($member->last_read_at) {
                $query->where('created_at', '>', $member->last_read_at);
            }
            $unread = $query->count();
            $result[] = [
                'room_id' => $room->public_id,
                'user_id' => $publicId,
                'nickname' => $profile?->nickname,
                'birthday' => $profile?->birthday,   // 年齢ではなく生年月日をそのまま返す
                'image' => $profile?->image,
                'last_message' => $last ? ['body' => $last->body, 'created_at' => $last->created_at] : null,
                'unread_count' => $unread,
                'created_at' => $room->created_at,
            ];
        }

        // 最新のメッセージ（なければルームを作った日時）の新しい順に、PHP で並べる
        usort($result, function (array $a, array $b): int {
            $at = fn (array $r) => (string) ($r['last_message']['created_at'] ?? $r['created_at']);

            return strcmp($at($b), $at($a));
        });

        return response()->json($result);
    }
}
