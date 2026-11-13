<?php

declare(strict_types=1);

namespace Database\Seeders;

use App\Models\Profile;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 01：会員を 20人（アカウントとプロフィール）。1人目は、確かめに使う決まった会員にする
        User::factory()
            ->has(Profile::factory()->state(['nickname' => 'テスト']))
            ->create(['email' => 'test@example.com']);

        User::factory(19)->has(Profile::factory())->create();
    }
}
