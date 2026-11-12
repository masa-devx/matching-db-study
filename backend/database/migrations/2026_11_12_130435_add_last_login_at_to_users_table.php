<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（04）：最終ログインの時刻。検索の並び（新しい順）に使う。
 * NULL 可（まだ一度もログインしていない会員と、今いる会員は NULL）・時間帯なし・インデックスなし。
 * PostgreSQL は desc で並べると NULL を先頭に置くので、ログインしていない会員が最初に出る（改善する段階で NOT NULL にする）。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('last_login_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('last_login_at');
        });
    }
};
