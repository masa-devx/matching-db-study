<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（A1。#216）：会員ごとの、対応のメモ。サポートが、問い合わせと答え・気づいたことを残す。会員には見せない。
 * 設計を考えずに「とりあえず使える」形で作る。
 * - 会員・管理者を指す列は、数の列だけ（外部キーなし）
 * - インデックスは主キーだけ。会員のメモを探すと、表を全部読む
 * - 直す・消す仕組みはない（書きまちがえても、残る）
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('member_notes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');    // どの会員のメモか
            $table->unsignedBigInteger('admin_id');   // 書いた管理者（admins.id）
            $table->text('body');                     // 本文。長さを見ない
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('member_notes');
    }
};
