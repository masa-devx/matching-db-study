<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * M3 届いたいいねと、スキップの試しのデータ（#184。docs/requirements/likes.md）。開発用の DB にだけ入れる:
 *   docker compose exec app php artisan db:seed --class=ReceivedLikesSeeder
 * 先に SearchMembersSeeder（会員 2万人）を流しておく。DatabaseSeeder からは呼ばない。
 *
 * - まだ返事をしていない「届いたいいね」を入れる（相手から自分へのいいねだけ。自分からは送っていない形）
 *   - search00001（男性・無料）：女性の会員から 30件
 *   - search00002（女性）：男性の会員から 20件
 *   - search00301 以降の 2000人：違う性別の会員から、1人あたり 5〜15件（全部で約 2万件）
 * - スキップを、search00301 以降の会員どうしで 3万件（表を全部読むことを測るため）
 * - いいねは、同じ組がもうあれば入れない（流し直しても増えない）。スキップは、試しの会員の分を消してから入れ直す
 */
class ReceivedLikesSeeder extends Seeder
{
    private const CHUNK = 1000;

    public function run(): void
    {
        $faker = fake('ja_JP');
        $faker->seed(3);
        $now = Carbon::now()->startOfMinute();

        $members = DB::table('users')
            ->join('profiles', 'profiles.user_id', '=', 'users.id')
            ->where('users.email', 'like', 'search%@example.test')
            ->orderBy('users.email')
            ->get(['users.id', 'users.email', 'profiles.gender'])
            ->all();
        if (count($members) < 3000) {
            $this->command->error('先に SearchMembersSeeder を流してください（試しの会員が足りません）');

            return;
        }
        $males = array_values(array_map(fn ($m) => $m->id, array_filter($members, fn ($m) => $m->gender === 'male')));
        $females = array_values(array_map(fn ($m) => $m->id, array_filter($members, fn ($m) => $m->gender !== 'male')));

        // だれに・何件届くか
        $targets = [];
        foreach ($members as $i => $m) {
            if ($m->email === 'search00001@example.test') {
                $targets[] = [$m, 30];
            } elseif ($m->email === 'search00002@example.test') {
                $targets[] = [$m, 20];
            } elseif ($i >= 300 && $i < 2300) {
                $targets[] = [$m, $faker->numberBetween(5, 15)];
            }
        }

        $rows = [];
        $likes = 0;
        foreach ($targets as [$m, $count]) {
            $from = $faker->randomElements($m->gender === 'male' ? $females : $males, $count);
            foreach ($from as $fromId) {
                $at = $now->copy()->subDays($faker->numberBetween(0, 30))->subMinutes($faker->numberBetween(0, 1439));
                $rows[] = ['from_user_id' => $fromId, 'to_user_id' => $m->id, 'created_at' => $at, 'updated_at' => $at];
            }
            if (count($rows) >= self::CHUNK) {
                $likes += DB::table('likes')->insertOrIgnore($rows);
                $rows = [];
            }
        }
        $likes += DB::table('likes')->insertOrIgnore($rows);

        // スキップ：試しの会員の分を消してから、3万件
        $ids = array_map(fn ($m) => $m->id, $members);
        foreach (array_chunk($ids, self::CHUNK) as $chunk) {
            DB::table('skips')->whereIn('skipper_id', $chunk)->delete();
        }
        $pool = array_slice($ids, 300);
        $rows = [];
        for ($n = 0; $n < 30000; $n++) {
            $at = $now->copy()->subDays($faker->numberBetween(0, 60));
            $rows[] = [
                'skipper_id' => $faker->randomElement($pool),
                'skipped_id' => $faker->randomElement($pool),
                'created_at' => $at,
                'updated_at' => $at,
            ];
            if (count($rows) >= self::CHUNK) {
                DB::table('skips')->insert($rows);
                $rows = [];
            }
        }

        $this->command->info("届いたいいねを {$likes} 件・スキップを 30000 件入れました（search00001 に 30件・search00002 に 20件）");
    }
}
