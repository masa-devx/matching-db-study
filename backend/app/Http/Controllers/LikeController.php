<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Like;
use App\Models\Profile;
use App\Models\TalkRoom;
use App\Models\TalkRoomMember;
use App\Models\User;
use App\Models\UserMatch;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

/**
 * 02 いいねを送る・送った相手の一覧（レガシー版。docs/api/02-likes.md）。
 * だれが送るかは、AuthController::me() の JWT の処理を、メソッドごとに写して決める。
 * エラーは扱わない（UNIQUE の違反も例外も 500）。一覧は 1＋N 本。改善する段階で、要件 ID のテストにする。
 * 03 で、送るときにマッチを作り（docs/api/02-likes.md の「03 で変えること」）、一覧に「マッチ済み」を足した（1＋2N 本）。
 * #46 で、相手を public_id（UUID）で受け取り・返すようにした（送るときは1本、一覧は1件ごとに1本増える）。
 * 05 で、マッチしたときにトークルームと参加者2人を作るようにした（送ってマッチしたときに3本増える）。
 * 05c で、マッチしたときに Firestore（手元の Emulator）にもルームと2人の受信箱を作るようにした（SQL 2本・HTTP 3本が増える）。
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

        // #46：相手は public_id（UUID）で来るので、中の id を読む。いない UUID なら null（下の insert が NOT NULL で 500）
        $toUserId = User::where('public_id', $request->input('user_id'))->value('id');

        $like = Like::create([
            'from_user_id' => $payload->sub,
            // 自分でも入る（CHECK がない）。2回目は UNIQUE の違反で 500
            'to_user_id' => $toUserId,
        ]);

        // 03：相手から自分へのいいねがあれば、マッチを作る（トランザクションなし。1本ずつすぐ確定する）
        // 自分あてのいいねは、今入れた行そのものが「逆向き」として見つかり、自分とのマッチができる
        $reverse = Like::where('from_user_id', $toUserId)
            ->where('to_user_id', $payload->sub)
            ->first();
        $matched = false;
        if ($reverse) {
            // user1_id に送り返した人、user2_id に先に送っていた人（向きがそろわない。組の UNIQUE もない）
            $match = UserMatch::create([
                'user1_id' => $payload->sub,
                'user2_id' => $toUserId,
            ]);
            // 05：マッチしたらトークルームを作り、2人を参加者に入れる（D-023）。トランザクションなし（3本がそれぞれすぐ確定する）。
            // 途中で失敗すると、マッチはあるのにルームがない・1人しかいないルームが残る
            $room = TalkRoom::create(['match_id' => $match->id]);
            TalkRoomMember::create(['talk_room_id' => $room->id, 'user_id' => $toUserId]);
            TalkRoomMember::create(['talk_room_id' => $room->id, 'user_id' => $payload->sub]);

            // 05c：Firestore（手元の Emulator）にも、ルームと2人の受信箱を作る（docs/api/05c-firestore.md）。
            // 3件を別々の HTTP で書く（途中で失敗すると残りは書かれない）。上の PostgreSQL の行はもう入っているので、
            // Firestore につながらないと 500 を返すのに、いいね・マッチ・ルームは残る
            $room->refresh();   // public_id は DB の既定の値で入るので、読み直す
            $meUid = User::where('id', $payload->sub)->value('public_id');
            $toUid = $request->input('user_id');
            $base = 'http://'.getenv('FIRESTORE_EMULATOR_HOST').'/v1/projects/'.getenv('FIREBASE_PROJECT_ID').'/databases/(default)/documents';
            // Emulator だけの管理者（owner）で書くので、ルールを通らない
            Http::withToken('owner')->post("{$base}/rooms?documentId={$room->public_id}", ['fields' => [
                'members' => ['arrayValue' => ['values' => [['stringValue' => $meUid], ['stringValue' => $toUid]]]],
            ]])->throw();
            Http::withToken('owner')->post("{$base}/users/{$meUid}/rooms?documentId={$room->public_id}", ['fields' => [
                'partnerUid' => ['stringValue' => $toUid],
                'lastReadAt' => ['nullValue' => null],
            ]])->throw();
            Http::withToken('owner')->post("{$base}/users/{$toUid}/rooms?documentId={$room->public_id}", ['fields' => [
                'partnerUid' => ['stringValue' => $meUid],
                'lastReadAt' => ['nullValue' => null],
            ]])->throw();
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
            // #46：画面がユーザー詳細へのリンクに使うので、相手の public_id を返す。1件ごとにもう1本
            $publicId = User::where('id', $like->to_user_id)->value('public_id');
            $result[] = [
                'user_id' => $publicId,
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
