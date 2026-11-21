<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（A1。#211）：会員の利用を止めた・解いた履歴。
 * 今の状態（止めているか）は、前からある users.suspended_at・suspended_reason に持ったまま。
 * 設計を考えずに「とりあえず使える」形で作る。
 * - 同じこと（止めた日時・理由）を、users とこの表の2か所に持つ。片方だけ書き換わると、食い違う
 * - 会員・管理者を指す列は、数の列だけ（外部キーなし）
 * - 「まだ解いていない停止は、会員に1つ」を止めるものがない（UNIQUE なし）。止めている会員をもう一度止めると、2行できる
 * - インデックスは主キーだけ。会員の履歴を探すと、表を全部読む
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('suspensions', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');                // アカウント停止された会員
            $table->text('reason')->nullable();                   // 理由。なくても入る
            $table->unsignedBigInteger('suspended_by');           // 止めた管理者（admins.id）
            $table->timestamp('lifted_at')->nullable();           // 解いた日時。空なら、まだ止めている
            $table->unsignedBigInteger('lifted_by')->nullable();  // 解いた管理者
            $table->timestamps();                                 // created_at が止めた日時
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('suspensions');
    }
};
