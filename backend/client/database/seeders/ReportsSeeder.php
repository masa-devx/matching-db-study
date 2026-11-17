<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * M7・A7 通報の試しのデータ（docs/requirements/reports.md）。開発用の DB にだけ入れる:
 *   docker compose exec app php artisan db:seed --class=ReportsSeeder
 * 先に SearchMembersSeeder（会員 2万人）と MessagesSeeder（マッチとメッセージ）を流しておく。DatabaseSeeder からは呼ばない。
 *
 * - 案件 300：まだ（open）200・対応中（in_progress）40・済み（closed）60
 * - 通報 約3000件。案件に 1〜18件。3割ほどは、メッセージを指す（通報された会員が送ったもの。通報したのは、そのルームの相手）
 * - 1つ目の案件は、50人から 50件。2つ目の案件は、同じ1人から 10件（件数と人数が違う案件）
 * - 済みの案件のうち 20は、まだの案件のある会員と同じ会員（済みにしたあとに、新しい通報が来た形。FR-REPORT-017）
 * - search00001（画面を試す会員）は、通報した側にも、された側にも入れない
 *
 * 流し直すと、search00001 が通報したもの以外の通報と、通報が1件も残らない案件を消してから、入れ直す。
 */
class ReportsSeeder extends Seeder
{
    private const OPEN = 200;

    private const IN_PROGRESS = 40;

    private const CLOSED = 60;

    private const REASONS = ['harassment', 'harassment', 'harassment', 'solicitation', 'solicitation', 'money', 'inappropriate', 'impersonation', 'other'];

    private const DETAILS = [
        '何度断っても、メッセージが続きます。',
        '外のアプリの連絡先を、くり返し聞かれました。',
        '投資の話をされ、サイトに登録するよう言われました。',
        'プロフィールの写真が、別の人のものだと思います。',
        '会う前に、お金を貸してほしいと言われました。',
        '結婚していると、やり取りの中で言っていました。',
        '乱暴な言葉を送ってきます。',
        '副業の勧誘でした。',
    ];

    public function run(): void
    {
        $faker = fake('ja_JP');
        $faker->seed(13);
        $now = Carbon::now()->startOfMinute();

        $members = DB::table('users')->where('email', 'like', 'search%@example.test')->orderBy('email')->pluck('id')->all();
        if (count($members) < 20000) {
            $this->command->error('先に SearchMembersSeeder を流してください（試しの会員が足りません）');

            return;
        }
        $me = $members[0];
        $rest = array_slice($members, 300);
        $admin = DB::table('admins')->where('role', 'owner')->value('id');

        // メッセージを指す通報の材料：送った会員（通報される側）ごとに、メッセージと、そのルームの相手（通報する側）
        $bySender = [];
        $sample = DB::select(
            'select m.id, m.sender_id, t.user_id as partner_id from messages m
             join talk_room_members t on t.talk_room_id = m.talk_room_id and t.user_id <> m.sender_id
             where m.id % 53 = 0 and m.sender_id <> ? and t.user_id <> ? order by m.id',
            [$me, $me],
        );
        foreach ($sample as $row) {
            $bySender[$row->sender_id][] = $row;
        }
        $senders = array_slice(array_keys($bySender), 0, 120);

        DB::transaction(function () use ($faker, $now, $me, $rest, $admin, $bySender, $senders): void {
            DB::delete('delete from reports where reporter_id <> ?', [$me]);
            DB::delete('delete from report_cases where id not in (select report_case_id from reports)');

            // 通報される会員：メッセージのある会員（120人まで）と、ほかの試しの会員。あわせて 280人
            $distinct = self::OPEN + self::IN_PROGRESS + self::CLOSED - 20;
            $reported = $senders;
            foreach ($faker->randomElements($rest, $distinct) as $id) {
                if (count($reported) >= $distinct) {
                    break;
                }
                if (! in_array($id, $reported, true)) {
                    $reported[] = $id;
                }
            }
            shuffle($reported);

            $cases = [];
            $reports = [];
            $total = self::OPEN + self::IN_PROGRESS + self::CLOSED;
            for ($i = 0; $i < $total; $i++) {
                $status = $i < self::OPEN ? 'open' : ($i < self::OPEN + self::IN_PROGRESS ? 'in_progress' : 'closed');
                // 最後の 20（済み）は、最初の 20（まだ）と同じ会員
                $target = $i >= $total - 20 ? $reported[$i - ($total - 20)] : $reported[$i];
                $count = match ($i) {
                    0 => 50,
                    1 => 10,
                    default => $faker->numberBetween(1, 18),
                };
                $sameReporter = $i === 1 ? $faker->randomElement($rest) : null;
                // 済みの案件は、古い通報（30〜90日前）。それ以外は、この30日
                $from = $status === 'closed' ? 60 * 24 * 90 : 60 * 24 * 30;
                $to = $status === 'closed' ? 60 * 24 * 30 : 1;

                $publicId = (string) Str::uuid7();
                $first = null;
                $last = null;
                for ($n = 0; $n < $count; $n++) {
                    $at = $now->copy()->subMinutes($faker->numberBetween($to, $from));
                    $first = $first === null || $at->lt($first) ? $at : $first;
                    $last = $last === null || $at->gt($last) ? $at : $last;
                    $message = null;
                    $reporter = $sameReporter ?? $faker->randomElement($rest);
                    // 1つ目の案件（50人から 50件）は、メッセージを指さない（ルームの相手は数人しかいないため）
                    if ($i > 1 && isset($bySender[$target]) && $faker->boolean(80)) {
                        $picked = $faker->randomElement($bySender[$target]);
                        $message = $picked->id;
                        $reporter = $picked->partner_id;
                    }
                    if ($reporter === $target) {
                        continue;
                    }
                    $reason = $faker->randomElement(self::REASONS);
                    $reports[] = [
                        'case' => $publicId,
                        'reporter_id' => $reporter,
                        'reported_id' => $target,
                        'message_id' => $message,
                        'reason' => $reason,
                        'detail' => $reason === 'other' || $faker->boolean(50) ? $faker->randomElement(self::DETAILS) : null,
                        'created_at' => $at,
                        'updated_at' => $at,
                    ];
                }
                $closedAt = $status === 'closed' ? $last?->copy()->addHours($faker->numberBetween(2, 72)) : null;
                $cases[] = [
                    'public_id' => $publicId,
                    'reported_id' => $target,
                    'status' => $status,
                    'action' => $status === 'closed' ? $faker->randomElement(['none', 'none', 'warned', 'warned', 'suspended']) : null,
                    'note' => $status === 'closed' ? '通報の中身を確かめて、対応した。' : null,
                    'handled_by' => $status === 'open' ? null : $admin,
                    'closed_at' => $closedAt,
                    'created_at' => $first ?? $now,
                    'updated_at' => $closedAt ?? $last ?? $now,
                ];
            }

            DB::table('report_cases')->insert($cases);
            $ids = DB::table('report_cases')->whereIn('public_id', array_column($cases, 'public_id'))->pluck('id', 'public_id');
            foreach (array_chunk($reports, 1000) as $chunk) {
                DB::table('reports')->insert(array_map(function (array $r) use ($ids): array {
                    $r['report_case_id'] = $ids[$r['case']];
                    unset($r['case']);

                    return $r;
                }, $chunk));
            }
            // 通報が1件も入らなかった案件（通報した人が、された人と同じになった）は消す
            DB::delete('delete from report_cases where id not in (select report_case_id from reports)');

            $this->command->info(sprintf('案件 %d・通報 %d件を入れました', DB::table('report_cases')->count(), DB::table('reports')->count()));
        });
    }
}
