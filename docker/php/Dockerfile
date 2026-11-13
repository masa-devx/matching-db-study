# バックエンド（Laravel）を動かす PHP。手元の PHP は使わない（docs/decisions.md の D-011）
FROM php:8.5.12-cli

# pdo_pgsql：PostgreSQL につなぐ。intl：数や日付の書式。zip・unzip・git：Composer がパッケージを取ってくるのに使う
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev libicu-dev libzip-dev unzip git \
    && docker-php-ext-install pdo_pgsql intl zip \
    && rm -rf /var/lib/apt/lists/*

# Composer は公式のイメージから写す（版を固定する）
COPY --from=composer:2.11.2 /usr/bin/composer /usr/bin/composer

WORKDIR /app/backend/client
