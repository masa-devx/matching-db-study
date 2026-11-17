<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * 04b 保存した検索条件の試しのデータ（docs/requirements/saved-searches.md）。開発用の DB にだけ入れる:
 *   docker compose exec app php artisan db:seed --class=SearchConditionsSeeder
 * 先に SearchMembersSeeder（会員 2万人）を流しておく。DatabaseSeeder からは呼ばない。
 *
 * - 試しの会員 1人に 1〜5件（平均 3件。全部で約 6万件）
 * - search00001 は 4件（同時に保存して、上限の 5件を超えるかを測るため）・search00002 は 5件（上限）
 * - 5件に1件ほど、身長の条件（有料の機能）を入れる。無料の男性の分にも入る（有料のときに保存して、無料に戻った形）
 * - 流し直すと、試しの会員の保存した検索条件を消してから入れ直す
 */
class SearchConditionsSeeder extends Seeder
{
    private const CHUNK = 1000;

    private const PREFECTURES = ['東京都', '神奈川県', '大阪府', '埼玉県', '千葉県', '愛知県', '福岡県', '北海道', '兵庫県', '京都府'];

    public function run(): void
    {
        $faker = fake('ja_JP');
        $faker->seed(4);
        $now = Carbon::parse('2026-11-17 09:00:00');

        $members = DB::table('users')
            ->where('email', 'like', 'search%@example.test')
            ->orderBy('email')
            ->pluck('id', 'email')
            ->all();
        if ($members === []) {
            $this->command->error('先に SearchMembersSeeder を流してください（試しの会員がいません）');

            return;
        }

        // 外部キーがないので、前に入れた分を自分で消す
        foreach (array_chunk(array_values($members), self::CHUNK) as $ids) {
            DB::table('search_conditions')->whereIn('user_id', $ids)->delete();
        }

        $rows = [];
        $total = 0;
        foreach ($members as $email => $userId) {
            $count = match ($email) {
                'search00001@example.test' => 4,
                'search00002@example.test' => 5,
                default => $faker->numberBetween(1, 5),
            };
            for ($i = 1; $i <= $count; $i++) {
                $ageMin = $faker->numberBetween(18, 40);
                $prefectures = $faker->randomElements(self::PREFECTURES, $faker->numberBetween(1, 3));
                $conditions = [
                    'age_min' => $ageMin,
                    'age_max' => $ageMin + $faker->numberBetween(3, 15),
                    'prefecture' => $prefectures,
                ];
                if ($faker->boolean(20)) {
                    $conditions['height_min'] = $faker->numberBetween(150, 175);
                }
                $at = $now->copy()->subDays($faker->numberBetween(0, 180))->subMinutes($faker->numberBetween(0, 1439));
                $rows[] = [
                    'user_id' => $userId,
                    'name' => $prefectures[0].'・'.$ageMin.'歳から',
                    'conditions' => json_encode($conditions, JSON_UNESCAPED_UNICODE),
                    'created_at' => $at,
                    'updated_at' => $at,
                ];
            }
            if (count($rows) >= self::CHUNK) {
                DB::table('search_conditions')->insert($rows);
                $total += count($rows);
                $rows = [];
            }
        }
        if ($rows !== []) {
            DB::table('search_conditions')->insert($rows);
            $total += count($rows);
        }

        $this->command->info("保存した検索条件を {$total} 件入れました（search00001 は 4件・search00002 は 5件）");
    }
}
