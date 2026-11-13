<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（07）：有料会員かどうか（真偽値）と、いつまで有料か。
 * 機能を使えるかは is_paid だけで決める（paid_until を見るところはない）。期限が過ぎても、だれも false に戻さない。
 * paid_until は時間帯なし（ほかの日時の列と同じ）。インデックスは足さない。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_paid')->default(false);
            $table->timestamp('paid_until')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['is_paid', 'paid_until']);
        });
    }
};
