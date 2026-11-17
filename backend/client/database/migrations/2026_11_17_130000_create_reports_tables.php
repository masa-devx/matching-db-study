<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（M7・A7。#201）：通報（reports）と、通報された会員ごとの案件（report_cases）。
 * 要件は docs/requirements/reports.md、設計は docs/api/m7-reports.md の「表の作り」。
 * 設計を考えずに「とりあえず使える」形で作る。
 * - 会員・メッセージ・案件・管理者を指す列は、数の列だけ（外部キーなし）。いない会員・ないメッセージを指す行が入る
 * - 「まだ済みでない案件は、会員に1つ」を止めるものがない（UNIQUE なし）。同時に通報が来ると、2つできる
 * - 状態（status）・理由（reason）・何をしたか（action）は文字の列で、決まった文字を入れる約束だけ（CHECK なし）
 * - インデックスは主キーだけ。案件の通報を探す・状態で絞る・会員の案件を探す、のどれも表を全部読む
 * - 通報された会員を、reports と report_cases の2か所に持つ（食い違っても気づけない）
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('report_cases', function (Blueprint $table) {
            $table->id();
            $table->uuid('public_id')->default(DB::raw('uuidv7()'));   // 外に見せる ID。UNIQUE なし
            $table->unsignedBigInteger('reported_id');                 // 通報された会員
            $table->string('status');                                  // open・in_progress・closed を入れる約束
            $table->string('action')->nullable();                      // none・warned・suspended。済みのときに入れる約束
            $table->text('note')->nullable();                          // 対応のメモ
            $table->unsignedBigInteger('handled_by')->nullable();      // 対応した管理者（admins.id）
            $table->timestamp('closed_at')->nullable();
            $table->timestamps();
        });

        Schema::create('reports', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('report_case_id');              // 入っている案件
            $table->unsignedBigInteger('reporter_id');                 // 通報した会員
            $table->unsignedBigInteger('reported_id');                 // 通報された会員（案件にもある）
            $table->unsignedBigInteger('message_id')->nullable();      // 指したメッセージ。なくてよい
            $table->string('reason');                                  // 6つのうちの1つを入れる約束
            $table->text('detail')->nullable();                        // 自由な文。長さを見ない
            $table->timestamps();                                      // created_at が通報した日時
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reports');
        Schema::dropIfExists('report_cases');
    }
};
