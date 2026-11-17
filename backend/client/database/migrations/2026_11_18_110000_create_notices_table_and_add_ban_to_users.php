<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（A7。#213）：運営から会員へのお知らせ（notices）と、強制退会（users の2つの列）。
 * 設計は docs/api/m7-reports.md の「#213」。設計を考えずに「とりあえず使える」形で作る。
 * - notices：会員・管理者・通報の案件を指す列は、数の列だけ（外部キーなし）。種類（kind）は文字の列で、CHECK がない
 * - 読んだ日時（read_at）を、お知らせの行に持つ。1人に送るお知らせしか作れない（全員へのお知らせは、会員の数だけ行が要る）
 * - インデックスは主キーだけ。「私の、まだ読んでいないお知らせ」を探すと、表を全部読む
 * - 強制退会は、users に banned_at・banned_reason を足すだけ。だれが強制退会にしたかは、監査ログにしか残らない。
 *   退会（deleted_at）・停止（suspended_at）・強制退会（banned_at）の3つの列で、会員の状態を表すことになる
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notices', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->default(DB::raw('uuidv7()'));    // 外に見せる ID。UNIQUE なし
            $table->unsignedBigInteger('user_id');                      // 届ける会員
            $table->string('kind');                                     // warning（注意）・info（お知らせ）を入れる約束
            $table->string('title');
            $table->text('body');
            $table->unsignedBigInteger('sent_by');                      // 送った管理者（admins.id）
            $table->unsignedBigInteger('report_case_id')->nullable();   // もとになった通報の案件。なくてよい
            $table->timestamp('read_at')->nullable();                   // 会員が読んだ日時。空なら、まだ
            $table->timestamps();
        });

        Schema::table('users', function (Blueprint $table) {
            $table->timestamp('banned_at')->nullable();   // 強制退会にした日時
            $table->text('banned_reason')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['banned_at', 'banned_reason']);
        });
        Schema::dropIfExists('notices');
    }
};
