<?php

declare(strict_types=1);

namespace App\Exceptions\Auth;

use App\Exceptions\BusinessException;

/**
 * アカウント停止された会員が、前にもらったトークンで API を呼んだ。API では 401「このアカウントは停止されています」と
 * code「account_suspended」になる（bootstrap/app.php）。画面は code を見て、ログインの画面に停止されていることを出す。
 * 退会・強制退会は、理由を言わずに 401「ログインしてください」にする（NFR-AUTH-001）
 */
final class AccountSuspendedException extends BusinessException {}
