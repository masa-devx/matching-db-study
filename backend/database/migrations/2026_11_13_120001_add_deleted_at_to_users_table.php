<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（06）：退会した日時（論理削除）。NULL なら会員のまま。
 * メールアドレスの UNIQUE はそのまま（退会の API がメールアドレスを書き換えて空ける）。インデックスは足さない。
 * User に SoftDeletes は付けないので、退会した人を除くのは、条件を書いたクエリだけ。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('deleted_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('deleted_at');
        });
    }
};
