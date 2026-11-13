<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（12）：会員の利用を止めた日時と理由（管理画面が書く）。NULL なら止めていない。
 * 止めた会員を断るのは会員の側の API の仕事（#90 で入口に写す）。インデックスは足さない。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('suspended_at')->nullable();
            $table->string('suspended_reason')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['suspended_at', 'suspended_reason']);
        });
    }
};
