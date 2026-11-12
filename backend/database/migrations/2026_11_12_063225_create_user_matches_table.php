<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（03）：マッチ（お互いにいいねした2人の組）。1組を1行で持つ。
 * user1_id にいいねを送り返した人、user2_id に先に送っていた人を入れる（向きがそろわない）。
 * 組の UNIQUE・CHECK・外部キー・インデックスはない。同じ組が2行入り、(A, B) と (B, A) も両方入る。
 * 改善する段階で、行の向きをそろえて重なりを消してから足す（explanations/03-matches.html）。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_matches', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user1_id');   // いいねを送り返した会員。外部キーなし
            $table->unsignedBigInteger('user2_id');   // 先に送っていた会員。外部キーもインデックスもなし
            $table->timestamps();                     // created_at がマッチした日時
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_matches');
    }
};
