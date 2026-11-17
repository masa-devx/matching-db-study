<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\Profile;
use App\Models\TalkRoom;
use App\Models\TalkRoomMember;
use App\Models\User;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Http\Request;

/**
 * レガシー版（01）：Laravel 5 系のころの Fat Controller。
 * コントローラの中で Eloquent を直接使い、Model をそのまま JSON で返す。
 * 入力の確かめも、だれが編集できるかの確かめもしない（docs/api/01-members.md の「レガシー版」）。
 * 表は users（アカウント）と profiles（その会員についての情報）に分かれている（D-015）。
 * #46：会員は URL の public_id（UUID）で探す。形は確かめないので、UUID でない文字は PostgreSQL のエラー（500）になる。
 */
class ProfileController extends Controller
{
    public function show(Request $request, string $publicId): User
    {
        $user = User::where('public_id', $publicId)->firstOrFail();
        $user->load('profile');   // ここで2本目の SQL が流れ、応答に profile が入る

        // M3（#187）：見ている人とこの会員がマッチしていれば、トークルームの ID を足す（画面が「メッセージを送る」を出せるように）。
        // この API は、もともとトークンを見ない（ログインしていなくても読める）。トークンがあるときだけ、JWT を読んで探す。
        // 送ったいいねの一覧（LikeController::index）に書いた探し方を、ここにもコピーした（3本増える）
        $roomId = null;
        $token = $request->bearerToken();
        if ($token) {
            $payload = JWT::decode($token, new Key(config('app.key'), 'HS256'));
            $myRooms = TalkRoomMember::where('user_id', $payload->sub)->pluck('talk_room_id');
            $shared = TalkRoomMember::whereIn('talk_room_id', $myRooms)->where('user_id', $user->id)->value('talk_room_id');
            $roomId = TalkRoom::where('id', $shared)->value('public_id');
        }
        $user->setAttribute('room_id', $roomId);

        return $user;
    }

    public function update(Request $request, string $publicId): Profile
    {
        // UUID から中の id を読む（1本増える）。いない会員なら null になり、プロフィールも見つからない
        $id = User::where('public_id', $publicId)->value('id');
        $profile = Profile::where('user_id', $id)->first();   // 見つからなければ null
        $profile->fill($request->all());
        $profile->save();

        return $profile;
    }
}
