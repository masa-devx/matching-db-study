<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（06）：ブロック（だれが・だれを・いつ）。マッチやメッセージは消さずに、読むときに除く。
 * (blocker_id, blocked_id) の UNIQUE と外部キーを持ち、インデックスは足さない（05 と同じ）。
 * UNIQUE のインデックスは blocker_id が先なので、「私をブロックした人」（blocked_id だけ）の検索には効かない（改善版で逆の順を足す）。
 * 自分で自分をブロックする行も入る（CHECK はない）。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('blocker_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('blocked_id')->constrained('users')->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['blocker_id', 'blocked_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('blocks');
    }
};
