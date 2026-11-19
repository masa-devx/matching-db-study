<?php

declare(strict_types=1);

namespace App\Exceptions;

use RuntimeException;

/**
 * 業務の例外の親。業務の決まりどおりに断ったこと（見つからない・決まりに反する）を表す。
 * Service はこれを継いだ例外を投げるだけで、状態コードは知らない。状態コードと文に変えるのは bootstrap/app.php の1か所。
 * 決まりどおりに断っただけなので、エラーのログには出さない（bootstrap/app.php の dontReport）。
 */
abstract class BusinessException extends RuntimeException {}
