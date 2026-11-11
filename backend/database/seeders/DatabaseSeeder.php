<?php

namespace Database\Seeders;

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
        // 01：会員を 20人。1人目は、確かめに使う決まった会員にする
        User::factory()->create([
            'name' => 'テスト',
            'email' => 'test@example.com',
        ]);

        User::factory(19)->create();
    }
}
