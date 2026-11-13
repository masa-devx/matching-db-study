<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Expression;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（05）：トークルーム（やり取りの場所。D-023）。マッチしたときに1つ作る。
 * 主キー・UNIQUE・外部キーは持ち、インデックスは足さない（UNIQUE の分だけ、自動でインデックスができる）。
 * public_id は URL でルームを指す ID（D-022。DB の uuidv7() で入る）。
 * match_id の UNIQUE で、1つのマッチにルームは1つ。ただし 03 で2行になった組（(A, B) と (B, A)）には、それぞれできる。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('talk_rooms', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->default(new Expression('uuidv7()'))->unique();
            $table->foreignId('match_id')->unique()->constrained('user_matches')->cascadeOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('talk_rooms');
    }
};
