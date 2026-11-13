<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（12）：監査ログ（だれが・いつ・何に・何をしたか）。管理画面が書き足す。
 * 対象は会員なら public_id（UUID）を文字で持つ（対象の種類が増えても同じ列で持てるよう、外部キーにしない）。
 * 書き換え・削除を止める仕組み（DB の権限・トリガー）はない（改善版で足す）。インデックスは足さない。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('admin_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->constrained('admins');
            $table->string('action');
            $table->string('target_type')->nullable();
            $table->string('target_id')->nullable();
            $table->jsonb('detail')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_audit_logs');
    }
};
