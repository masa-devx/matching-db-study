<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

/**
 * #153 プロフィールの6項目（体型・お仕事・年収・タバコ・お酒・結婚歴）の試しのデータ。開発用の DB にだけ入れる:
 *   docker compose exec app php artisan db:seed --class=ProfileDetailsSeeder
 * 先に SearchMembersSeeder（会員 2万人）を流しておく。DatabaseSeeder からは呼ばない。
 *
 * - 試しの会員（search…@example.test）のプロフィールを書き換える。項目ごとに、7割ほどの会員が答えた形（残りは NULL＝未回答）
 * - 値は、会員の id から決める（流し直しても同じ値になる。ただし SearchMembersSeeder を流し直すと id が変わるので、値も変わる）。選択肢の名前は、画面（HomePage・SearchConditionsPage）と同じ文字
 * - search00001 は、6項目とも答えた形にする（画面で確かめやすいように）
 */
class ProfileDetailsSeeder extends Seeder
{
    /** @var array<string, list<string>> */
    private const OPTIONS = [
        'body_type' => ['スリム', 'やや細め', '普通', '筋肉質', 'ややぽっちゃり', 'ぽっちゃり'],
        'job' => ['会社員', '公務員', '経営者・役員', '自営業', '医療関係', 'IT 関係', '教育関係', '接客・販売', 'クリエイター', '学生', 'その他'],
        'income' => ['300万円未満', '300〜500万円', '500〜700万円', '700〜1000万円', '1000万円以上'],
        'smoking' => ['吸わない', 'ときどき吸う', '吸う', '電子タバコ'],
        'drinking' => ['飲まない', 'ときどき飲む', '飲む'],
        'marital_status' => ['未婚', '離婚', '死別'],
    ];

    public function run(): void
    {
        $ids = 'select id from users where email like \'search%@example.test\'';
        if (DB::selectOne("select count(*) as n from ({$ids}) t")->n === 0) {
            $this->command->error('先に SearchMembersSeeder を流してください（試しの会員がいません）');

            return;
        }

        // 6項目を、1本の update でまとめて書き換える（#159）。
        // 1列ずつ6本に分けると、そのたびに行が丸ごと書き直され、表が7倍ほどに膨らむ（消えた行の跡が空きとして残る）。
        // PostgreSQL の update は、行を上書きせず、新しい行を足して古い行を捨てるため
        $sets = [];
        foreach (self::OPTIONS as $column => $options) {
            $array = "array['".implode("','", $options)."']";
            $count = count($options);
            // 項目ごとに違う散らばり方にする（hashtext に列の名前を混ぜる）。10人に3人は未回答。
            // hashtext はマイナスにもなるので、& で下の31ビットだけを使う（abs は、いちばん小さい数で止まることがある）
            $sets[] = "{$column} = case
                    when (hashtext(user_id::text || '{$column}-answered') & 2147483647) % 10 < 3 then null
                    else ({$array})[1 + (hashtext(user_id::text || '{$column}') & 2147483647) % {$count}]
                end";
        }
        DB::statement('update profiles set '.implode(', ', $sets)." where user_id in ({$ids})");

        DB::table('profiles')
            ->where('user_id', DB::table('users')->where('email', 'search00001@example.test')->value('id'))
            ->update([
                'body_type' => '普通', 'job' => 'IT 関係', 'income' => '500〜700万円',
                'smoking' => '吸わない', 'drinking' => 'ときどき飲む', 'marital_status' => '未婚',
            ]);

        $answered = DB::selectOne("select count(*) filter (where income is not null) as income, count(*) as total from profiles where user_id in ({$ids})");
        $this->command->info("プロフィールの6項目を入れました（{$answered->total}人のうち、年収に答えたのは {$answered->income}人）");
    }
}
