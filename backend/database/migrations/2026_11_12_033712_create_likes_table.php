<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（02）：いいねの中間テーブル。会員（users）と会員を、向きつきでつなぐ。
 * 同じ組の二重は UNIQUE で断るが、外部キー・自分あての CHECK・to_user_id のインデックスはない。
 * 改善する段階で、違反している行を直してから足す（explanations/02-likes.html）。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('likes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('from_user_id');   // 送った会員。外部キーなし
            $table->unsignedBigInteger('to_user_id');     // もらった会員。外部キーもインデックスもなし
            $table->timestamps();                         // created_at がいいねした日時
            $table->unique(['from_user_id', 'to_user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('likes');
    }
};
