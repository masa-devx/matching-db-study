<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * 04 検索の試しの会員（2万人。docs/requirements/search.md の「制約」）。開発用の DB にだけ入れる:
 *   docker compose exec app php artisan db:seed --class=SearchMembersSeeder
 * DatabaseSeeder からは呼ばない（テストやふだんのシードで2万人を作らないため）。
 *
 * - メールアドレスは search00001@example.test〜。流し直すと、前に入れた試しの会員を消してから入れ直す
 * - 値はレガシー版の列のまま（性別・生年月日・身長は文字）。乱数の種を決めているので、毎回同じ会員になる
 * - 1割はメールアドレスを確認していない。5% は一度もログインしていない（last_login_at が NULL）
 * - 最終ログインは、この90日のあいだで、分の単位にそろえる（同じ時刻の会員ができ、並びが決まらない問題を測れる）
 * - 身長の 0.5% は、入力の誤りのような2桁の値（文字で比べると '99' >= '170' になる問題を測れる）
 * - 1000人ずつまとめて insert する（1人ずつ Eloquent で作ると、2万人で数分かかるため）
 */
class SearchMembersSeeder extends Seeder
{
    private const COUNT = 20000;

    private const CHUNK = 1000;

    private const PREFECTURES = [
        '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県', '茨城県', '栃木県', '群馬県',
        '埼玉県', '千葉県', '東京都', '神奈川県', '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
        '岐阜県', '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
        '鳥取県', '島根県', '岡山県', '広島県', '山口県', '徳島県', '香川県', '愛媛県', '高知県', '福岡県',
        '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
    ];

    /** 人の多い都道府県を多めに選ぶ（都市に会員が集まる形） */
    private const POPULAR = ['東京都', '神奈川県', '大阪府', '埼玉県', '千葉県', '愛知県', '福岡県', '北海道', '兵庫県'];

    private const INTRODUCTIONS = [
        '休みの日はカフェ巡りをしています。',
        '映画とドラマが好きです。おすすめを教えてください。',
        '週末はよく走っています。',
        '料理が趣味です。',
        'のんびり話せる人と出会えたらうれしいです。',
        '旅行の写真を撮るのが好きです。',
    ];

    public function run(): void
    {
        $faker = fake('ja_JP');
        $faker->seed(42);
        $password = Hash::make('password');
        $now = Carbon::parse('2026-11-12 09:00:00');

        // 前に入れた試しの会員を消す（外部キーがないので、プロフィールも自分で消す）
        $old = DB::table('users')->where('email', 'like', 'search%@example.test')->pluck('id');
        foreach ($old->chunk(self::CHUNK) as $ids) {
            DB::table('profiles')->whereIn('user_id', $ids)->delete();
            DB::table('users')->whereIn('id', $ids)->delete();
        }

        for ($start = 1; $start <= self::COUNT; $start += self::CHUNK) {
            $users = [];
            $plans = [];
            for ($n = $start; $n < $start + self::CHUNK && $n <= self::COUNT; $n++) {
                $createdAt = $now->copy()->subDays($faker->numberBetween(1, 365))->subMinutes($faker->numberBetween(0, 1439));
                $lastLogin = $faker->boolean(95)
                    ? $now->copy()->subMinutes($faker->numberBetween(0, 90 * 24 * 60))->startOfMinute()
                    : null;
                $email = sprintf('search%05d@example.test', $n);
                $users[] = [
                    'email' => $email,
                    'email_verified_at' => $faker->boolean(90) ? $createdAt : null,
                    'password' => $password,
                    'last_login_at' => $lastLogin,
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ];
                $plans[$email] = $createdAt;
            }
            DB::table('users')->insert($users);

            // 入れた会員の id を読み、プロフィールを作る
            $ids = DB::table('users')->whereIn('email', array_keys($plans))->pluck('id', 'email');
            $profiles = [];
            foreach ($plans as $email => $createdAt) {
                $profiles[] = [
                    'user_id' => $ids[$email],
                    'nickname' => $faker->firstName(),
                    'gender' => $faker->randomElement(['male', 'female']),
                    'birthday' => $faker->dateTimeBetween('-60 years', '-18 years')->format('Y-m-d'),
                    'prefecture' => $faker->boolean(60)
                        ? $faker->randomElement(self::POPULAR)
                        : $faker->randomElement(self::PREFECTURES),
                    'height' => $faker->boolean(10)
                        ? null
                        : (string) ($faker->numberBetween(1, 1000) <= 5 ? $faker->numberBetween(10, 99) : $faker->numberBetween(145, 190)),
                    'introduction' => $faker->randomElement(self::INTRODUCTIONS),
                    'image' => '/images/avatars/demo-'.$faker->numberBetween(1, 6).'.svg',
                    'created_at' => $createdAt,
                    'updated_at' => $createdAt,
                ];
            }
            DB::table('profiles')->insert($profiles);
        }
    }
}
