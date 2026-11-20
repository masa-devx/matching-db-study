<?php

declare(strict_types=1);

// アーキテクチャのテスト（agents/rules/architecture-backend.md の8章）。依存の向き（Controller → Service → Model）・名前・final・strict_types を確かめる。
// 新しい置き場（App\Services・App\Exceptions・業務のまとまりのフォルダの Controller）にファイルがまだないあいだは、
// 当てはまるものがなく、どれも通る。移したファイルが、決まりを破ったときに落ちる。足すとき・直すときは、わざと違反を置いて、落ちるのを見る

// ==== このアプリだけのもの（会員の側と管理画面で、違うのはこの一覧だけ）====

// まだ移していない古いコントローラー（app/Http/Controllers の直下）。この一覧が、そのまま移行の残り。移したら消す。
// ignoring は、渡した名前で始まる「使われる側」の依存も消すので、古いコントローラーの名前だけを渡す
const LEGACY_CONTROLLERS = [
    'App\Http\Controllers\AuthController',
    'App\Http\Controllers\BlockController',
    'App\Http\Controllers\EmailVerificationController',
    'App\Http\Controllers\FirebaseTokenController',
    'App\Http\Controllers\LikeController',
    'App\Http\Controllers\MessageController',
    'App\Http\Controllers\NoticeController',
    'App\Http\Controllers\PasswordController',
    'App\Http\Controllers\PasswordResetController',
    'App\Http\Controllers\PlanController',
    'App\Http\Controllers\PurchaseController',
    'App\Http\Controllers\ReceivedLikeController',
    'App\Http\Controllers\ReportController',
    'App\Http\Controllers\SearchConditionController',
    'App\Http\Controllers\SkipController',
    'App\Http\Controllers\TalkRoomController',
    'App\Http\Controllers\UserController',
    'App\Http\Controllers\UserMatchController',
];

// ==== ここから下は、会員の側（backend/client/tests/Arch/LayersTest.php。正本）と管理画面（backend/admin/tests/Arch/LayersTest.php）で同じ。片方を直したら、もう片方も直す（管理画面の SameRulesAsClientTest が、違えば落ちる）====

// arch() は、クラス・名前空間を「名前の始まり」で、関数を「完全一致」で比べる（'abort' は abort_if を止めない。#239 で確かめた）。
// 期待は、無名関数の中に書く
// （arch('名前')->expect(…) と鎖でつなぐ書き方は、Larastan が「ないメソッド」と指摘する）。
// 名前空間は1つずつ expect() に渡す。expect() に名前空間を配列で渡すと、not->toUse() は違反があっても通ってしまう
// （#234 で、Request にトークンを読む処理を置いて確かめた）

// Service・Model・業務の例外で使わない、HTTP の物。関数は完全一致で比べるので、abort_if・abort_unless も並べる
// Symfony の HttpKernel は、例外の名前空間だけにする（全体を指定すると、中の古いクラスまで読み込み、警告が出る）
const HTTP_THINGS = [
    'App\Http', 'Illuminate\Http', 'Illuminate\Routing', 'Illuminate\Contracts\Auth', 'Symfony\Component\HttpKernel\Exception', 'Symfony\Component\HttpFoundation',
    'Illuminate\Support\Facades\Auth', 'Illuminate\Support\Facades\Request', 'Illuminate\Support\Facades\Session',
    'Illuminate\Support\Facades\Response', 'Illuminate\Support\Facades\Redirect',
    'request', 'auth', 'session', 'response', 'redirect', 'abort', 'abort_if', 'abort_unless',
];

// 名前を渡して中身を取り出す物（app('db') など）。クラスの名前が出てこないので、DB を使わない決まりをすり抜ける（#234・#239 で確かめた）
const CONTAINER_THINGS = ['app', 'resolve', 'Illuminate\Support\Facades\App', 'Illuminate\Container\Container'];

const DB_THINGS = ['Illuminate\Support\Facades\DB', 'Illuminate\Support\Facades\Schema', 'Illuminate\Database'];

// ---- Http（Controller・Request・Resource・Middleware）----

// Controller は「受け取る → Service を呼ぶ → 返す」だけ。Model・DB を直接使わず、トークンも読まない（2章）。
// Illuminate\Database は名前の始まりで比べるので、DB の例外の型（ModelNotFoundException など）も止まる。
// これは意図どおり：見つからないときは、Service の firstOrFail() が投げ、Laravel が 404 に変える（Controller で受け止めない）
arch('新しい Controller は、Model・DB・トークンを直接使わない', function (): void {
    expect('App\Http\Controllers')
        ->not->toUse(['App\Models', ...DB_THINGS, 'Firebase\JWT'])
        ->ignoring(LEGACY_CONTROLLERS);
});

// 使うものは、引数（コンストラクタやメソッドの型）で受け取る。Controller だけでなく、Request・Resource・Middleware も同じ
// （Resource に app('db') を置くと、Controller だけを見る決まりでは通った。#239 で確かめた）。response() などは止めない
arch('新しい Http の層は、app()・resolve()・コンテナで中身を取り出さない', function (): void {
    foreach (['App\Http\Controllers', 'App\Http\Requests', 'App\Http\Resources', 'App\Http\Middleware'] as $layer) {
        expect($layer)
            ->not->toUse(CONTAINER_THINGS)
            ->ignoring(LEGACY_CONTROLLERS);
    }
});

// 対象を Controller だけにすると、DB の処理を Request に移すだけで避けられる（#234 のレビューで確かめた）
arch('Request と Middleware は、Model・DB を使わない', function (): void {
    foreach (['App\Http\Requests', 'App\Http\Middleware'] as $layer) {
        expect($layer)
            ->not->toUse(['App\Models', ...DB_THINGS]);
    }
});

// Resource は、Service が返した Model から、返してよい項目を選ぶ（Model の型は使ってよい）。新しくクエリを書かない。
// Model の型を使ってよいので、User::query() やリレーションの ->count() は、このテストでは見られない（レビューで見る。architecture-backend.md の8章）
arch('Resource は、DB を使わない', function (): void {
    expect('App\Http\Resources')
        ->not->toUse(['Illuminate\Support\Facades\DB', 'Illuminate\Support\Facades\Schema', 'Illuminate\Database\Query', 'Illuminate\Database\Eloquent\Builder']);
});

// トークンを読むのは Middleware だけ。$request->bearerToken() で読む形は、このテストでは見られない（レビューで見る）
arch('トークンを読むのは Middleware だけ（Request・Resource は読まない）', function (): void {
    foreach (['App\Http\Requests', 'App\Http\Resources'] as $layer) {
        expect($layer)
            ->not->toUse('Firebase\JWT');
    }
});

// ファサードの別名（\DB:: など。use を書かずに呼べる）は、名前が Illuminate で始まらないので、arch() では落ちない。
// 別名を「使わない」一覧に足すと、名前の始まりで比べるので、'Log' が LogicException に当たる。
// ファイルの文字を読んで、別名と完全に一致するものだけを探す。
// $skipFilesIn を渡すと、そのフォルダの直下のファイルは見ない（app/Http/Controllers の直下は、古いコントローラー）
/**
 * @param  list<string>  $aliases
 * @return list<string>
 */
function archFindFacadeAliases(string $root, array $aliases, ?string $skipFilesIn = null): array
{
    if (! is_dir($root)) {
        return [];
    }
    $pattern = implode('|', array_map(static fn (string $alias): string => preg_quote($alias, '/'), $aliases));
    $found = [];
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root, FilesystemIterator::SKIP_DOTS)) as $file) {
        if (! $file instanceof SplFileInfo || $file->getExtension() !== 'php') {
            continue;
        }
        if ($skipFilesIn !== null && $file->getPath() === $skipFilesIn) {
            continue;
        }
        $source = (string) file_get_contents($file->getPathname());
        $name = 'app'.substr($file->getPathname(), strlen(dirname(__DIR__, 2).'/app'));

        // ① \DB:: のように、先頭に \ を付けて呼ぶ形（\App\…\DB のような、名前空間つきの名前は当てない）
        preg_match_all('/(?<![\w\\\\])\\\\('.$pattern.')\b(?!\\\\)/', $source, $calls);
        foreach ($calls[0] as $call) {
            $found[] = $name.'：'.$call;
        }

        // ② use で読み込む形。use DB;・use DB as Database;・use Log, DB; のどれも、1つずつに分けて、名前を比べる
        preg_match_all('/^\s*use\s+(?!function\b|const\b)([^;(]+);/m', $source, $uses);
        foreach ($uses[1] as $statement) {
            foreach (explode(',', $statement) as $part) {
                $imported = ltrim(trim((string) preg_replace('/\s+as\s+\w+\s*$/i', '', trim($part))), '\\');
                if (in_array($imported, $aliases, true)) {
                    $found[] = $name.'：use '.trim($part);
                }
            }
        }
    }

    return $found;
}

test('新しい Http の層は、DB のファサードの別名（\DB::・use DB;）も使わない', function (): void {
    // app/Http/Controllers の直下は古いコントローラー（上の LEGACY_CONTROLLERS）なので見ない。新しい Controller は、業務のまとまりのフォルダに置く
    $http = dirname(__DIR__, 2).'/app/Http';
    expect(archFindFacadeAliases($http, ['DB', 'Schema', 'App'], skipFilesIn: $http.'/Controllers'))->toBe([]);
});

// 標準の5つ以外のメソッドが欲しくなったら、隠れている名詞を探して Controller を分ける（architecture-backend.md の3章）。
// 1つの操作だけの Controller は __invoke でもよい。ログインと新規登録をまとめた Auth\AuthController だけ、login・logout も許す
test('新しい Controller の public のメソッドは、index・show・store・update・destroy（と __invoke）だけ', function (): void {
    $extra = [];
    foreach (glob(dirname(__DIR__, 2).'/app/Http/Controllers/*/*Controller.php') ?: [] as $file) {
        $class = 'App\Http\Controllers\\'.basename(dirname($file)).'\\'.basename($file, '.php');
        $allowed = ['__construct', '__invoke', 'index', 'show', 'store', 'update', 'destroy'];
        if ($class === 'App\Http\Controllers\Auth\AuthController') {
            $allowed = [...$allowed, 'login', 'logout'];
        }
        if (! class_exists($class)) {
            $extra[] = $class.'（クラスが読めない）';

            continue;
        }
        foreach ((new ReflectionClass($class))->getMethods(ReflectionMethod::IS_PUBLIC) as $method) {
            if ($method->getDeclaringClass()->getName() === $class && ! in_array($method->getName(), $allowed, true)) {
                $extra[] = $class.'::'.$method->getName();
            }
        }
    }

    expect($extra)->toBe([]);
});

// ignoring は、名前の始まりで比べる。直下に UserControllerV2 のような名前のクラスを置くと、上のテストと
// strict_types のテストから、黙って外れる。直下にあってよいのは、基底の Controller と、古い一覧のものだけ
test('app/Http/Controllers の直下には、基底の Controller と、古いコントローラーだけがある', function (): void {
    $files = array_map(
        static fn (string $path): string => 'App\Http\Controllers\\'.basename($path, '.php'),
        glob(dirname(__DIR__, 2).'/app/Http/Controllers/*.php') ?: [],
    );
    sort($files);
    $allowed = [...LEGACY_CONTROLLERS, 'App\Http\Controllers\Controller'];
    sort($allowed);

    expect($files)->toBe($allowed);
});

// ---- Service ----

// Service は HTTP を知らない（同じ Service を、コマンド・キュー・テストからも呼べるようにする。2章）。
// ログインしている人や入力は、Controller から値で受け取る。断るときは業務の例外を投げる（abort() で状態コードを決めない）。
// 外の API の呼び出し（Illuminate\Http\Client）の例外は、Service で受け止めてよい（名前の始まりで比べるので、外さないと巻き添えで落ちる。#239）
arch('Service は、Http を使わない', function (): void {
    expect('App\Services')
        ->not->toUse(HTTP_THINGS)
        ->ignoring('Illuminate\Http\Client');
});

test('Service と Model は、HTTP のファサードの別名（\Auth::・use Request; など）も使わない', function (): void {
    $app = dirname(__DIR__, 2).'/app';
    $aliases = ['Auth', 'Request', 'Session', 'Response', 'Redirect', 'App'];
    expect([...archFindFacadeAliases($app.'/Services', $aliases), ...archFindFacadeAliases($app.'/Models', $aliases)])->toBe([]);
});

arch('Service は final', function (): void {
    expect('App\Services')
        ->classes()
        ->toBeFinal();
});

arch('Service は Service で終わる', function (): void {
    expect('App\Services')
        ->classes()
        ->toHaveSuffix('Service');
});

// ---- クラスの名前（architecture-backend.md の3章「クラスの名前」）----

arch('Mail は Mail で終わる', function (): void {
    expect('App\Mail')
        ->classes()
        ->toHaveSuffix('Mail');
});

// Laravel の公式の付け方に合わせ、何をするかを動詞から書く（AuthenticateUser）。種類の名前は付けない
arch('Middleware と Listener には、種類の名前を付けない', function (): void {
    expect('App\Http\Middleware')
        ->classes()
        ->not->toHaveSuffix('Middleware');
    expect('App\Listeners')
        ->classes()
        ->not->toHaveSuffix('Listener');
});

// Controller → Service → Model の形にした（D-025）。UseCase と Repository の層は作らない
arch('UseCase と Repository のクラスを作らない', function (): void {
    expect('App')
        ->classes()
        ->not->toHaveSuffix('UseCase');
    expect('App')
        ->classes()
        ->not->toHaveSuffix('Repository');
});

// ---- Model ----

// Model は DB とのやり取りだけ（2章）。Service・Client・Http・ログを使わない。
// Observer（ObservedBy）を使うと、保存したときの裏の動きが、Service を読んでも見えなくなる。
// booted() の中の static::created()・$dispatchesEvents・Provider での observe() は、このテストでは見られない（レビューで見る。architecture-backend.md の8章）
arch('Model は、Service・Client・Http・ログ・Observer を使わない', function (): void {
    expect('App\Models')
        ->not->toUse(['App\Services', 'App\Clients', 'App\Support\Logging', 'Illuminate\Database\Eloquent\Attributes\ObservedBy', ...HTTP_THINGS]);
});

// ---- Client（外のサービスの呼び出し）----

arch('Client は、Http・Service・Model を使わない', function (): void {
    expect('App\Clients')
        ->not->toUse(['App\Http', 'App\Services', 'App\Models']);
});

// ---- 例外・基盤 ----

arch('業務の例外は、Http を使わない（状態コードは bootstrap/app.php で決める）', function (): void {
    expect('App\Exceptions')
        ->not->toUse(HTTP_THINGS);
});

arch('Support（基盤）は、Http・Service・Model を使わない', function (): void {
    expect('App\Support')
        ->not->toUse(['App\Http', 'App\Services', 'App\Models', 'App\Clients']);
});

// Model は移さずに今の置き場に残り、管理画面ではこれから作る。Model も対象にする（#239）
arch('新しいコードのファイルは strict_types', function (): void {
    expect(['App\Http', 'App\Services', 'App\Clients', 'App\Exceptions', 'App\Models', 'App\Support'])
        ->toUseStrictTypes()
        ->ignoring(LEGACY_CONTROLLERS);
});
