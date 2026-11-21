<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Message;
use App\Models\Profile;
use App\Models\TalkRoom;
use App\Models\TalkRoomMember;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * 05 トークの履歴・送る（レガシー版。docs/api/05-messages.md）。
 * だれが使うかは、ルートの user.authenticate（ログインを確かめる Middleware）が決め、loginUserId() で番号を読む。
 * ルームは public_id（UUID）だけで探し、参加者かを確かめない（UUID を知っていれば、だれでも読めて送れる）。
 * 入力も確かめず、エラーの扱いは考えない。改善する段階で、要件 ID のテストにする。
 * 07 で、送るときに男性の無料の会員を断るようにした（is_paid だけを見る。2本増える。docs/api/07-paid-members.md）。
 */
class MessageController extends Controller
{
    public function index(Request $request, string $publicId): JsonResponse
    {
        $loginUserId = $this->loginUserId($request);   // user.authenticate が載せた、ログインしている会員の番号

        // 参加者かを確かめない。ないルームなら null で、次の行が 500
        $room = TalkRoom::where('public_id', $publicId)->first();

        // 新しい50件ずつ（OFFSET）。インデックスがないので、表を全部読んで並べ替える。page=0 なら offset -50 で 500
        $page = (int) $request->input('page', 1);
        $messages = Message::where('talk_room_id', $room->id)
            ->orderBy('created_at', 'desc')
            ->offset(($page - 1) * 50)
            ->limit(50)
            ->get();

        // 開いたら読んだことにする（GET の中で書き込む。画面は5秒ごとに呼ぶので、そのたびに書く）
        TalkRoomMember::where('talk_room_id', $room->id)
            ->where('user_id', $loginUserId)
            ->update(['last_read_at' => now()]);

        // messages の行をそのまま返す（中の連番の id・sender_id が出る）
        return response()->json($messages);
    }

    public function store(Request $request, string $publicId): JsonResponse
    {
        $loginUserId = $this->loginUserId($request);   // user.authenticate が載せた、ログインしている会員の番号

        // 07：男性の無料の会員は使えない（is_paid だけを見る。paid_until は見ない。送る・いいね・検索に写した）
        $myProfile = Profile::where('user_id', $loginUserId)->first();
        $myUser = User::find($loginUserId);
        if ($myProfile?->gender === 'male' && ! $myUser->is_paid) {
            return response()->json(['message' => '有料会員になると使えます'], 403);
        }

        // 参加者かを確かめない（マッチしていない人も送れる）
        $room = TalkRoom::where('public_id', $publicId)->first();

        // 本文を確かめない。空・空白だけは Laravel が null に変えるので、NOT NULL の違反で 500。1万文字でも入る
        $message = Message::create([
            'talk_room_id' => $room->id,
            'sender_id' => $loginUserId,
            'body' => $request->input('body'),
        ]);

        return response()->json($message, 201);
    }
}
