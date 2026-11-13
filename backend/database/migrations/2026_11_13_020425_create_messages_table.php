<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * レガシー版（05）：メッセージ（やり取りの中身。D-023）。受け取った人は持たない（ルームの参加者のうち、送った人でない人）。
 * 外部キーは持つが、インデックスは足さない。PostgreSQL は外部キーの列にインデックスを自動で作らないので、
 * talk_room_id で探すたびに表を全部読み、会員を消すと（sender_id の CASCADE）表を全部読む。
 * 本文は長さの決まりなし（空も1万文字も入る）。改善版で public_id・type・CHECK・(talk_room_id, id) などを足す。
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('talk_room_id')->constrained()->cascadeOnDelete();
            $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
            $table->text('body');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('messages');
    }
};
