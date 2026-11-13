<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * 07 有料会員の試しのデータ（docs/requirements/paid-members.md の「制約」）。開発用の DB にだけ入れる:
 *   docker compose exec app php artisan db:seed --class=PaidMembersSeeder
 * 先に SearchMembersSeeder（会員 2万人）を流しておく。DatabaseSeeder からは呼ばない。
 *
 * - search00301 以降の男性から 3000人を有料にしたことがある会員にする（search00001〜00300 は 05・06 の相手なので触らない）
 *   - 期限の中：1500人（期限は 4〜180日後）
 *   - もうすぐ切れる：300人（期限は 1〜3日後）
 *   - 期限が過ぎた：1200人（期限は 1〜300日前。is_paid は true のまま。レガシー版はだれも false に戻さない）
 * - 1人あたり 1〜15回の購入（続けて買った人を混ぜる）。期限は、レガシー版の購入と同じく「前の期限に月を足す」形で、最後の期限から逆にたどって作る
 * - 決まった人：男性の search00301 以降の最初の3人を、期限の中・期限が過ぎた・もうすぐ切れる、にする（名前は流したときに出す）
 * - search00001 は男性の無料の会員のまま
 * - 流し直すと、試しの会員の購入を消し、is_paid と paid_until を戻してから入れ直す
 */
class PaidMembersSeeder extends Seeder
{
    private const ACTIVE = 1500;

    private const SOON = 300;

    private const EXPIRED = 1200;

    private const CHUNK = 1000;

    public function run(): void
    {
        $faker = fake('ja_JP');
        $faker->seed(7);
        $now = Carbon::now()->startOfMinute();

        // search00301 以降の男性（メールアドレスの順）
        $males = DB::table('users')
            ->join('profiles', 'profiles.user_id', '=', 'users.id')
            ->where('users.email', 'like', 'search%@example.test')
            ->where('users.email', '>=', 'search00301@example.test')
            ->where('profiles.gender', 'male')
            ->orderBy('users.email')
            ->pluck('users.id', 'users.email')
            ->all();
        if (count($males) < self::ACTIVE + self::SOON + self::EXPIRED) {
            $this->command->error('先に SearchMembersSeeder を流してください（試しの会員が足りません）');

            return;
        }
        $plans = DB::table('plans')->orderBy('months')->get(['id', 'months'])->all();

        $emails = array_keys($males);
        $named = array_slice($emails, 0, 3);
        $rest = array_slice($emails, 3);
        $faker->shuffle($rest);
        $picked = array_merge($named, array_slice($rest, 0, self::ACTIVE + self::SOON + self::EXPIRED - 3));

        // どの区分か（決まった3人：期限の中・期限が過ぎた・もうすぐ切れる）
        $kinds = array_merge(
            ['active', 'expired', 'soon'],
            array_fill(0, self::ACTIVE - 1, 'active'),
            array_fill(0, self::EXPIRED - 1, 'expired'),
            array_fill(0, self::SOON - 1, 'soon'),
        );

        DB::transaction(function () use ($faker, $now, $males, $plans, $picked, $kinds): void {
            $search = "select id from users where email like 'search%@example.test'";
            DB::delete("delete from purchases where user_id in ($search)");
            DB::update("update users set is_paid = false, paid_until = null where id in ($search)");

            $purchases = [];
            $updates = [];
            foreach ($picked as $i => $email) {
                $userId = $males[$email];
                $until = match ($kinds[$i]) {
                    'active' => $now->copy()->addDays($faker->numberBetween(4, 180)),
                    'soon' => $now->copy()->addDays($faker->numberBetween(1, 3)),
                    default => $now->copy()->subDays($faker->numberBetween(1, 300)),
                };
                $updates[] = [$userId, $until];

                // 最後の期限から逆にたどる（それぞれの購入は、前の期限の少し前に買った）
                $count = $faker->numberBetween(1, 15);
                $end = $until->copy();
                $rows = [];
                for ($n = 0; $n < $count; $n++) {
                    $plan = $faker->randomElement($plans);
                    $start = $end->copy()->subMonths($plan->months);
                    $bought = $start->copy()->subDays($faker->numberBetween(0, 5))->subMinutes($faker->numberBetween(0, 600));
                    if ($bought->greaterThan($now)) {
                        $bought = $now->copy()->subMinutes($n + 1);
                    }
                    $rows[] = ['user_id' => $userId, 'plan_id' => $plan->id, 'created_at' => $bought, 'updated_at' => $bought];
                    $end = $start;
                }
                array_push($purchases, ...array_reverse($rows));
            }

            // 古い順に入れる（id の順と買った順をそろえる）
            usort($purchases, fn (array $a, array $b): int => $a['created_at'] <=> $b['created_at']);
            foreach (array_chunk($purchases, self::CHUNK) as $chunk) {
                DB::table('purchases')->insert($chunk);
            }
            foreach ($updates as [$userId, $until]) {
                DB::table('users')->where('id', $userId)->update(['is_paid' => true, 'paid_until' => $until]);
            }
        });

        $this->command->info(sprintf(
            '有料にしたことがある会員 %d人（期限が過ぎた %d人）・購入 %d件。期限の中 %s・期限が過ぎた %s・もうすぐ切れる %s',
            DB::table('users')->where('is_paid', true)->count(),
            DB::table('users')->where('is_paid', true)->where('paid_until', '<', $now)->count(),
            DB::table('purchases')->count(),
            $picked[0], $picked[1], $picked[2],
        ));
    }
}
