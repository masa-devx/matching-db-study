<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * 05 メッセージの試しのデータ（マッチ 1000組・メッセージ 10万件。docs/requirements/messages.md の「制約」）。開発用の DB にだけ入れる:
 *   docker compose exec app php artisan db:seed --class=MessagesSeeder
 * 先に SearchMembersSeeder（試しの会員 2万人）を流しておく。DatabaseSeeder からは呼ばない。
 *
 * - ① 03 より前からあるマッチで、ルームがないものに、ルームと参加者2人を作る（試しの会員でないマッチも含む）
 * - ② 試しの会員どうしのマッチを 1000組作る（お互いのいいね・マッチ・ルーム・参加者2人）。
 *   search00001 は 100組（ルーム 100 の一覧を測る）。残りの 900組は、ほかの試しの会員どうし
 * - ③ メッセージを 10万件。search00001 の1つ目のルームに 2万件、2〜10個目に 2000件ずつ、51〜100個目は 0件（やり取りのない相手）、
 *   残り 6万2000件を、ほかのルームにばらまく。全部を時刻の順に並べてから入れる（id の順と時刻の順をそろえる）
 * - 参加者の 3割は、まだ一度も開いていない（last_read_at が NULL）。残りは、最後に読んだ時刻をばらつかせる
 * - 時刻は流したときの今を基準にする（中身は乱数の種で毎回同じ。時刻だけが動く）
 * - 流し直すと、前に入れた試しの会員どうしのいいねとマッチを消してから入れ直す（ルーム・参加者・メッセージは外部キーの CASCADE で消える）
 */
class MessagesSeeder extends Seeder
{
    private const OTHER_MATCHES = 900;

    private const MY_MATCHES = 100;

    private const MESSAGES = 100000;

    private const CHUNK = 1000;

    private const BODIES = [
        'はじめまして！', 'よろしくお願いします。', '今日は何をしていましたか？', 'いいですね！',
        '週末は空いていますか？', 'おすすめのお店があります。', 'ありがとうございます。', 'また話しましょう。',
        '映画は好きですか？', 'お仕事おつかれさまです。', '写真すてきですね。', 'それは楽しそうです！',
    ];

    public function run(): void
    {
        $faker = fake('ja_JP');
        $faker->seed(42);
        // 時刻は流したときの「今」を基準にする（決まった日時にすると、DB の今より未来のメッセージになり、
        // 送ったものが新しい50件に入らず、読んだことにしても未来の分が未読に残る。#59 で画面を測って分かった）
        $now = Carbon::now()->startOfMinute();

        $members = DB::table('users')->where('email', 'like', 'search%@example.test')->orderBy('email')->pluck('id')->all();
        if (count($members) < 20000) {
            $this->command->error('先に SearchMembersSeeder を流してください（試しの会員が足りません）');

            return;
        }

        // 前に入れた試しの会員どうしのいいねとマッチを消す（ルーム・参加者・メッセージは CASCADE で消える）
        $search = "select id from users where email like 'search%@example.test'";
        DB::delete("delete from user_matches where user1_id in ($search) and user2_id in ($search)");
        DB::delete("delete from likes where from_user_id in ($search) and to_user_id in ($search)");

        DB::transaction(function () use ($faker, $now, $members): void {
            // ① ルームのないマッチに、ルームと参加者2人を作る
            $orphans = DB::table('user_matches')->whereNotIn('id', DB::table('talk_rooms')->select('match_id'))->get();
            foreach ($orphans as $match) {
                $this->createRoom((int) $match->id, (int) $match->user1_id, (int) $match->user2_id, Carbon::parse($match->created_at ?? $now));
            }

            // ② 試しの会員どうしのマッチ（search00001 と 00002〜00101、ほかは 00102〜 から重ならない組）
            $me = $members[0];
            $pairs = [];
            for ($i = 1; $i <= self::MY_MATCHES; $i++) {
                $pairs[] = [$members[$i], $me];
            }
            $rest = array_slice($members, self::MY_MATCHES + 1);
            $seen = [];
            while (count($pairs) < self::MY_MATCHES + self::OTHER_MATCHES) {
                $a = $faker->randomElement($rest);
                $b = $faker->randomElement($rest);
                $key = min($a, $b).'-'.max($a, $b);
                if ($a === $b || isset($seen[$key])) {
                    continue;
                }
                $seen[$key] = true;
                $pairs[] = [$a, $b];
            }

            $rooms = [];
            foreach ($pairs as [$a, $b]) {
                $matchedAt = $now->copy()->subDays($faker->numberBetween(31, 120))->subSeconds($faker->numberBetween(0, 86399));
                DB::table('likes')->insert([
                    ['from_user_id' => $b, 'to_user_id' => $a, 'created_at' => $matchedAt->copy()->subDay(), 'updated_at' => $matchedAt->copy()->subDay()],
                    ['from_user_id' => $a, 'to_user_id' => $b, 'created_at' => $matchedAt, 'updated_at' => $matchedAt],
                ]);
                $matchId = DB::table('user_matches')->insertGetId(['user1_id' => $a, 'user2_id' => $b, 'created_at' => $matchedAt, 'updated_at' => $matchedAt]);
                $rooms[] = ['id' => $this->createRoom($matchId, $a, $b, $matchedAt), 'users' => [$a, $b]];
            }

            // ③ メッセージ。ルームごとの件数を決めてから、時刻を付けて全部を時刻の順に並べる
            $plan = [];
            $plan[0] = 20000;
            for ($i = 1; $i < 10; $i++) {
                $plan[$i] = 2000;
            }
            $pool = array_merge(range(10, 49), range(self::MY_MATCHES, count($rooms) - 1));   // 50〜99 個目（search00001 の相手）は 0件
            $left = self::MESSAGES - array_sum($plan);
            for ($n = 0; $n < $left; $n++) {
                $r = $faker->randomElement($pool);
                $plan[$r] = ($plan[$r] ?? 0) + 1;
            }

            $rows = [];
            foreach ($plan as $r => $count) {
                // 多いルームほど短い期間に詰める（2万件のルームは3日。同じ秒のメッセージができる）
                $span = $count >= 20000 ? 3 * 86400 : 30 * 86400;
                for ($k = 0; $k < $count; $k++) {
                    $rows[] = [
                        'talk_room_id' => $rooms[$r]['id'],
                        'sender_id' => $rooms[$r]['users'][$faker->numberBetween(0, 1)],
                        'body' => $faker->randomElement(self::BODIES),
                        'at' => $now->getTimestamp() - $faker->numberBetween(0, $span),
                    ];
                }
            }
            usort($rows, fn (array $x, array $y): int => $x['at'] <=> $y['at']);
            foreach (array_chunk($rows, self::CHUNK) as $chunk) {
                DB::table('messages')->insert(array_map(function (array $row): array {
                    $at = Carbon::createFromTimestamp($row['at'], config('app.timezone'))->format('Y-m-d H:i:s');

                    return ['talk_room_id' => $row['talk_room_id'], 'sender_id' => $row['sender_id'], 'body' => $row['body'], 'created_at' => $at, 'updated_at' => $at];
                }, $chunk));
            }

            // 参加者の最後に読んだ時刻：3割は NULL（一度も開いていない）、残りはこの30日のどこか
            foreach ($rooms as $room) {
                foreach ($room['users'] as $userId) {
                    DB::table('talk_room_members')->where('talk_room_id', $room['id'])->where('user_id', $userId)->update([
                        'last_read_at' => $faker->boolean(70) ? $now->copy()->subSeconds($faker->numberBetween(0, 30 * 86400)) : null,
                    ]);
                }
            }
        });
    }

    /** ルームと参加者2人を作り、ルームの id を返す */
    private function createRoom(int $matchId, int $a, int $b, Carbon $at): int
    {
        $roomId = DB::table('talk_rooms')->insertGetId(['match_id' => $matchId, 'created_at' => $at, 'updated_at' => $at]);
        DB::table('talk_room_members')->insert([
            ['talk_room_id' => $roomId, 'user_id' => $a, 'created_at' => $at, 'updated_at' => $at],
            ['talk_room_id' => $roomId, 'user_id' => $b, 'created_at' => $at, 'updated_at' => $at],
        ]);

        return $roomId;
    }
}
