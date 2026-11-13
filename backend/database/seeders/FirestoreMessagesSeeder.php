<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/**
 * 05c の試しのデータ。PostgreSQL のトークルームとメッセージ（MessagesSeeder で入れたもの）を、
 * 手元の Firestore の Emulator に写す（レガシー版の形。explanations/05c-firestore.html）:
 *   docker compose exec app php artisan db:seed --class=FirestoreMessagesSeeder
 * 先に SearchMembersSeeder と MessagesSeeder を流しておく。DatabaseSeeder からは呼ばない。
 *
 * - 写す前に、Emulator のデータを全部消す（Emulator だけにある消すための入口を使う）
 * - users/{uid}/rooms/{roomId}：partnerUid・lastReadAt（必要な情報だけ）
 * - rooms/{roomId}：members。rooms/{roomId}/messages/{messageId}：senderId・body・createdAt
 * - ID は PostgreSQL の public_id（会員・ルーム）と、messages の id をそのまま使う
 * - 書くのは REST の documents:commit（1回 500件まで）。Authorization: Bearer owner は Emulator だけの管理者で、ルールを通らない
 */
class FirestoreMessagesSeeder extends Seeder
{
    private const CHUNK = 500;

    public function run(): void
    {
        $host = env('FIRESTORE_EMULATOR_HOST');
        $project = env('FIREBASE_PROJECT_ID', 'demo-matching');
        if (! $host || ! str_starts_with((string) $project, 'demo-')) {
            $this->command->error('FIRESTORE_EMULATOR_HOST がないか、プロジェクトが demo- で始まらない（本物にはつながない）');

            return;
        }
        $base = "http://{$host}/v1/projects/{$project}/databases/(default)/documents";
        $name = fn (string $path): string => "projects/{$project}/databases/(default)/documents/{$path}";
        $time = fn (?string $at): array => $at === null
            ? ['nullValue' => null]
            : ['timestampValue' => Carbon::parse($at, 'UTC')->toIso8601ZuluString()];

        Http::withToken('owner')->delete("http://{$host}/emulator/v1/projects/{$project}/databases/(default)/documents")->throw();

        $writes = [];
        $flush = function (bool $force = false) use (&$writes, $base): void {
            if (count($writes) >= self::CHUNK || ($force && $writes)) {
                Http::withToken('owner')->post("{$base}:commit", ['writes' => $writes])->throw();
                $writes = [];
            }
        };

        // ルームと、2人の受信箱
        $members = DB::table('talk_room_members as m')
            ->join('talk_rooms as r', 'r.id', '=', 'm.talk_room_id')
            ->join('users as u', 'u.id', '=', 'm.user_id')
            ->orderBy('r.id')
            ->get(['r.id as room_id', 'r.public_id as room', 'u.public_id as uid', 'm.last_read_at']);
        foreach ($members->groupBy('room_id') as $pair) {
            $room = $pair[0]->room;
            $uids = $pair->pluck('uid')->all();
            $writes[] = ['update' => ['name' => $name("rooms/{$room}"), 'fields' => [
                'members' => ['arrayValue' => ['values' => array_map(fn ($u) => ['stringValue' => $u], $uids)]],
            ]]];
            foreach ($pair as $me) {
                $partner = $pair->firstWhere('uid', '!=', $me->uid);
                $writes[] = ['update' => ['name' => $name("users/{$me->uid}/rooms/{$room}"), 'fields' => [
                    'partnerUid' => $partner ? ['stringValue' => $partner->uid] : ['nullValue' => null],
                    'lastReadAt' => $time($me->last_read_at),
                ]]];
            }
            $flush();
        }

        // メッセージ（ルームの下のサブコレクション）
        DB::table('messages as m')
            ->join('talk_rooms as r', 'r.id', '=', 'm.talk_room_id')
            ->join('users as u', 'u.id', '=', 'm.sender_id')
            ->orderBy('m.id')
            ->select(['m.id', 'r.public_id as room', 'u.public_id as sender', 'm.body', 'm.created_at'])
            ->chunk(5000, function ($rows) use (&$writes, $flush, $name, $time): void {
                foreach ($rows as $m) {
                    $writes[] = ['update' => ['name' => $name("rooms/{$m->room}/messages/{$m->id}"), 'fields' => [
                        'senderId' => ['stringValue' => $m->sender],
                        'body' => ['stringValue' => $m->body],
                        'createdAt' => $time($m->created_at),
                    ]]];
                    $flush();
                }
            });
        $flush(true);
    }
}
