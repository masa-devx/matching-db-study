<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（M3。#184）：スキップ（だれが・だれを・いつ）。届いたいいねや検索で「この人は見送る」と決めた記録。
 * 相手には伝えない。いいねは消さずに、読むときに除く（ブロックと同じ考え方）。
 * 設計を考えずに「とりあえず使える」形で作る。
 * - 2つの列は数の列だけ（外部キーなし）。会員を消しても行が残る
 * - (skipper_id, skipped_id) の UNIQUE がない。同じ相手を2回スキップすると、2行できる
 * - インデックスがない。「私がスキップした相手」を探すと、表を全部読む
 * - 自分で自分をスキップする行も入る（CHECK はない）
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('skips', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('skipper_id');   // スキップした会員。外部キーもインデックスもなし
            $table->unsignedBigInteger('skipped_id');   // スキップされた会員
            $table->timestamps();                       // created_at がスキップした日時
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('skips');
    }
};
