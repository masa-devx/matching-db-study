<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（12）：管理画面の管理者。会員（users）とは別の表で、別にログインする（12 の解説）。
 * 表は会員の側と共通の DB に置き、表の作りは backend/client にまとめる（管理画面の Laravel はマイグレーションを持たない）。
 * 役割（role）は owner（すべてできる）と viewer（見るだけ）。CHECK はないので、ほかの文字も入る。インデックスは足さない。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admins', function (Blueprint $table) {
            $table->id();
            $table->string('email')->unique();
            $table->string('password');
            $table->string('name');
            $table->string('role');
            $table->timestamp('last_login_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admins');
    }
};
