<?php

declare(strict_types=1);

namespace Database\Factories;

use App\Models\Profile;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Profile>
 */
class ProfileFactory extends Factory
{
    /**
     * レガシー版（01）：プロフィールは文字で持つ。シードでは、それらしい値だけを入れる
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $faker = fake('ja_JP');

        return [
            'user_id' => User::factory(),
            'nickname' => $faker->firstName(),
            'gender' => $faker->randomElement(['male', 'female']),
            'birthday' => $faker->dateTimeBetween('-45 years', '-18 years')->format('Y-m-d'),
            'prefecture' => $faker->randomElement(['北海道', '宮城県', '東京都', '神奈川県', '愛知県', '大阪府', '福岡県', '沖縄県']),
            'height' => (string) $faker->numberBetween(150, 185),
            'introduction' => $faker->realText(80),
            'image' => '/images/avatars/demo-'.$faker->numberBetween(1, 6).'.svg',
        ];
    }
}
