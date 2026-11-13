<?php

declare(strict_types=1);

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * 12 管理画面の試しの管理者（2人）。開発用の DB にだけ入れる:
 *   docker compose exec app php artisan db:seed --class=AdminsSeeder
 * 表の作りは backend/client にまとめているので、シーダーもここに置く。DatabaseSeeder からは呼ばない。
 * - owner@admin.example.test（すべてできる）・viewer@admin.example.test（見るだけ）。パスワードは password（試しの値）
 * - 流し直すと、この2人を消してから入れ直す（監査ログは外部キーで消せないので、2人の分も消す）
 */
class AdminsSeeder extends Seeder
{
    public function run(): void
    {
        $emails = ['owner@admin.example.test', 'viewer@admin.example.test'];
        $now = now();

        DB::transaction(function () use ($emails, $now): void {
            $ids = DB::table('admins')->whereIn('email', $emails)->pluck('id');
            DB::table('admin_audit_logs')->whereIn('admin_id', $ids)->delete();
            DB::table('admins')->whereIn('id', $ids)->delete();

            DB::table('admins')->insert([
                ['email' => $emails[0], 'password' => Hash::make('password'), 'name' => '運営 太郎', 'role' => 'owner', 'created_at' => $now, 'updated_at' => $now],
                ['email' => $emails[1], 'password' => Hash::make('password'), 'name' => '閲覧 花子', 'role' => 'viewer', 'created_at' => $now, 'updated_at' => $now],
            ]);
        });

        $this->command->info('試しの管理者 2人（owner・viewer）');
    }
}
