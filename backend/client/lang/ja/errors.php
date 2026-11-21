<?php

declare(strict_types=1);

// API のエラーの応答に出す文。文は、ここにだけ書く（bootstrap/app.php から __('errors.<キー>') で読む）。
// キーは、何が起きたかを英語の小文字と _ で書く。使う所ができたときに足す
return [
    'user_not_found' => '会員が見つかりません',
    'unauthenticated' => 'ログインしてください',
    'account_suspended' => 'このアカウントは停止されています',
    'email_unverified' => 'この機能は使えません',
    'maintenance' => 'ただいまメンテナンス中です',
    'csrf' => '画面を読み込み直してください',
    // ログインの失敗。分かっている不具合：要件は、どちらが違うかを教えない同じ文（FR-AUTH-011）
    'login_unknown_email' => 'メールアドレスが違います',
    'login_wrong_password' => 'パスワードが違います',
    'login_suspended' => '利用を停止しています',
    'login_banned' => '強制退会になっています',
];
