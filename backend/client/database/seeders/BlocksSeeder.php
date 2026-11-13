<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * 06 ブロックと退会の試しのデータ（docs/requirements/blocks.md・withdrawal.md の「制約」）。開発用の DB にだけ入れる:
 *   docker compose exec app php artisan db:seed --class=BlocksSeeder
 * 先に SearchMembersSeeder（会員 2万人）と MessagesSeeder（マッチとメッセージ）を流しておく。DatabaseSeeder からは呼ばない。
 *
 * search00001 の相手は、MessagesSeeder で search00002〜00101 がマッチ（search00002 が 2万件のルーム）。それ以外はマッチしていない。
 * - search00001 がブロックした：マッチした 5人（search00003〜00007）・マッチしていない 20人（search00201〜00220）
 * - search00001 をブロックした：マッチした 5人（search00008〜00012）・マッチしていない 20人（search00221〜00240）
 * - お互いにブロック：マッチした 1人（search00013）・マッチしていない 1人（search00241）
 * - 退会した：マッチした 5人（search00014〜00018）・マッチしていない 20人（search00251〜00270）と、ほかに 1000人
 * - ほかの試しの会員どうしのブロックを 3万件（向きつき。同じ組は1回）
 *
 * 退会した会員は deleted_at だけを入れ、メールアドレスは書き換えない（書き換えると、04・05 のシーダーが試しの会員を数えられなくなる）。
 * 退会の API（#74）のメールアドレスの書き換えは、API で確かめる。
 * 流し直すと、試しの会員どうしのブロックを消し、試しの会員の deleted_at を空に戻してから入れ直す。
 */
class BlocksSeeder extends Seeder
{
    private const OTHER_BLOCKS = 30000;

    private const OTHER_WITHDRAWN = 1000;

    private const CHUNK = 1000;

    public function run(): void
    {
        $faker = fake('ja_JP');
        $faker->seed(6);
        $now = Carbon::now()->startOfMinute();

        // 番号（00001 からの1つ目）→ id
        $members = DB::table('users')->where('email', 'like', 'search%@example.test')->orderBy('email')->pluck('id')->all();
        if (count($members) < 20000) {
            $this->command->error('先に SearchMembersSeeder を流してください（試しの会員が足りません）');

            return;
        }
        $m = fn (int $n): int => $members[$n - 1];
        $range = fn (int $from, int $to): array => array_map($m, range($from, $to));

        DB::transaction(function () use ($faker, $now, $members, $m, $range): void {
            $search = "select id from users where email like 'search%@example.test'";
            DB::delete("delete from blocks where blocker_id in ($search) and blocked_id in ($search)");
            DB::update("update users set deleted_at = null where id in ($search)");

            $me = $m(1);
            $rows = [];
            $seen = [];
            $add = function (int $blocker, int $blocked) use (&$rows, &$seen, $faker, $now): void {
                $key = $blocker.'-'.$blocked;
                if ($blocker === $blocked || isset($seen[$key])) {
                    return;
                }
                $seen[$key] = true;
                $at = $now->copy()->subMinutes($faker->numberBetween(1, 60 * 24 * 90));
                $rows[] = ['blocker_id' => $blocker, 'blocked_id' => $blocked, 'created_at' => $at, 'updated_at' => $at];
            };

            // search00001 がブロックした・された・お互い
            foreach (array_merge($range(3, 7), $range(201, 220), [$m(13), $m(241)]) as $to) {
                $add($me, $to);
            }
            foreach (array_merge($range(8, 12), $range(221, 240), [$m(13), $m(241)]) as $from) {
                $add($from, $me);
            }

            // ほかの試しの会員どうし（search00001 と、上で決めた相手は入れない）
            $rest = array_slice($members, 300);
            while (count($rows) < self::OTHER_BLOCKS + 54) {
                $add($faker->randomElement($rest), $faker->randomElement($rest));
            }
            foreach (array_chunk($rows, self::CHUNK) as $chunk) {
                DB::table('blocks')->insert($chunk);
            }

            // 退会した会員（search00001 のマッチの相手・マッチしていない相手・ほか）
            $withdrawn = array_merge($range(14, 18), $range(251, 270), $faker->randomElements($rest, self::OTHER_WITHDRAWN));
            foreach (array_chunk($withdrawn, self::CHUNK) as $chunk) {
                DB::table('users')->whereIn('id', $chunk)->update([
                    'deleted_at' => $now->copy()->subDays($faker->numberBetween(1, 60)),
                ]);
            }
        });

        $this->command->info(sprintf(
            'ブロック %d件（試しの会員どうし）・退会した会員 %d人',
            DB::table('blocks')->count(),
            DB::table('users')->whereNotNull('deleted_at')->count(),
        ));
    }
}
