<?php

declare(strict_types=1);

// API のエラーの応答に出す文。文は、ここにだけ書く（bootstrap/app.php から __('errors.<キー>') で読む）。
// キーは、何が起きたかを英語の小文字と _ で書く。使う所ができたときに足す
return [
    'user_not_found' => '会員が見つかりません',
    'unauthenticated' => 'ログインしてください',
];
