<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（05）：トークルームの参加者（ルームの中の一人ひとりの状態。D-023）。マッチした2人を入れる。
 * (talk_room_id, user_id) の UNIQUE と外部キーを持ち、インデックスは足さない。
 * UNIQUE のインデックスは talk_room_id が先なので、「自分のルーム」（user_id だけ）の検索には効かない（改善版で逆の順を足す）。
 * 未読は「最後に読んだ時刻」で持つ（まだ開いていなければ NULL）。改善版で、読んだメッセージの ID に変える。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('talk_room_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('talk_room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamp('last_read_at')->nullable();
            $table->timestamps();
            $table->unique(['talk_room_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('talk_room_members');
    }
};
