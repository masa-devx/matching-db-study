<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（#153）：プロフィールに、検索に使う6項目を足す（体型・お仕事・年収・タバコ・お酒・結婚歴）。
 * 今のプロフィール（性別・都道府県）と同じく、選択肢の名前（日本語の文字）をそのまま入れる。
 * - 書かなくてよいので NULL 可。NULL は「未回答」
 * - 選択肢にない文字も入る（CHECK もマスタの表もない）。選択肢の名前を変えると、前の行と合わなくなる
 * - 年収も文字なので、「500万円以上」のような大小の比べができない
 * - インデックスは足さない
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            $table->string('body_type')->nullable();        // 体型
            $table->string('job')->nullable();              // お仕事
            $table->string('income')->nullable();           // 年収（区分の名前）
            $table->string('smoking')->nullable();          // タバコ
            $table->string('drinking')->nullable();         // お酒
            $table->string('marital_status')->nullable();   // 結婚歴
        });
    }

    public function down(): void
    {
        Schema::table('profiles', function (Blueprint $table) {
            $table->dropColumn(['body_type', 'job', 'income', 'smoking', 'drinking', 'marital_status']);
        });
    }
};
