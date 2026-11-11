<?php

namespace Database\Factories;

use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

/**
 * @extends Factory<User>
 */
class UserFactory extends Factory
{
    /**
     * The current password being used by the factory.
     */
    protected static ?string $password;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        // 素朴な版（01）：プロフィールも文字で持つ。シードでは、それらしい値だけを入れる
        $faker = fake('ja_JP');

        return [
            'name' => $faker->firstName(),
            'email' => fake()->unique()->safeEmail(),
            'email_verified_at' => now(),
            // casts() の 'hashed' があるので、ここでハッシュ化したものは2回はかからない
            'password' => static::$password ??= Hash::make('password'),
            'remember_token' => Str::random(10),
            'gender' => $faker->randomElement(['male', 'female']),
            'birthday' => $faker->dateTimeBetween('-45 years', '-18 years')->format('Y-m-d'),
            'prefecture' => $faker->randomElement(['北海道', '宮城県', '東京都', '神奈川県', '愛知県', '大阪府', '福岡県', '沖縄県']),
            'height' => (string) $faker->numberBetween(150, 185),
            'introduction' => $faker->realText(80),
            'image' => '/images/avatars/demo-'.$faker->numberBetween(1, 6).'.svg',
        ];
    }

    /**
     * Indicate that the model's email address should be unverified.
     */
    public function unverified(): static
    {
        return $this->state(fn (array $attributes) => [
            'email_verified_at' => null,
        ]);
    }
}
