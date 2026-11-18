<?php

declare(strict_types=1);

// アーキテクチャのテスト（agents/rules/architecture.md の8章）。依存の向き（Controller → Service → Model）・名前・final・strict_types を確かめる。
// 新しい置き場（App\Services・App\Exceptions・業務のまとまりのフォルダの Controller）にファイルがまだないあいだは、
// 当てはまるものがなく、どれも通る。移したファイルが、決まりを破ったときに落ちる。足すとき・直すときは、わざと違反を置いて、落ちるのを見る

// ==== このアプリだけのもの（会員の側と管理画面で、違うのはこの一覧だけ）====

// まだ移していない古いコントローラー（app/Http/Controllers の直下）。管理画面には、まだ Model がない（全部 DB:: で書いている）。
// 移すときに、使う表の Model を app/Models に作る（architecture.md の「管理画面での当てはめ」）。この一覧が、そのまま移行の残り。移したら消す。
// ignoring は、渡した名前で始まる「使われる側」の依存も消すので、古いコントローラーの名前だけを渡す
const LEGACY_CONTROLLERS = [
    'App\Http\Controllers\AuditLogController',
    'App\Http\Controllers\AuthController',
    'App\Http\Controllers\DashboardController',
    'App\Http\Controllers\MemberActivityController',
    'App\Http\Controllers\MemberController',
    'App\Http\Controllers\MemberNoteController',
    'App\Http\Controllers\MessageController',
    'App\Http\Controllers\NoticeController',
    'App\Http\Controllers\PlanController',
    'App\Http\Controllers\ReportCaseController',
    'App\Http\Controllers\SalesController',
    'App\Http\Controllers\SuspensionController',
    'App\Http\Controllers\TalkRoomController',
];

// ==== ここから下は、会員の側（backend/client/tests/Arch/LayersTest.php。正本）と管理画面（backend/admin/tests/Arch/LayersTest.php）で同じ。片方を直したら、もう片方も直す（管理画面の SameRulesAsClientTest が、違えば落ちる）====

// arch() の比べ方は「名前の始まり」。期待は、無名関数の中に書く
// （arch('名前')->expect(…) と鎖でつなぐ書き方は、Larastan が「ないメソッド」と指摘する）。
// 名前空間は1つずつ expect() に渡す。expect() に名前空間を配列で渡すと、not->toUse() は違反があっても通ってしまう
// （#234 で、Request にトークンを読む処理を置いて確かめた）

// ---- Http（Controller・Request・Resource・Middleware）----

// Controller は「受け取る → Service を呼ぶ → 返す」だけ。Model・DB を直接使わず、トークンも読まない（2章）。
// Illuminate\Database は名前の始まりで比べるので、DB の例外の型（ModelNotFoundException など）も止まる。
// これは意図どおり：見つからないときは、Service の firstOrFail() が投げ、Laravel が 404 に変える（Controller で受け止めない）
arch('新しい Controller は、Model・DB・トークンを直接使わない', function (): void {
    expect('App\Http\Controllers')
        ->not->toUse(['App\Models', 'Illuminate\Support\Facades\DB', 'Illuminate\Database', 'Firebase\JWT'])
        ->ignoring(LEGACY_CONTROLLERS);
});

// app('db')・resolve(User::class) のように、名前を渡して中身を取り出すと、クラスの名前が出てこないので、上の決まりをすり抜ける
// （#234 のレビューで確かめた）。使うものは、引数（コンストラクタやメソッドの型）で受け取る。response() などは止めない
arch('新しい Controller は、app()・resolve() で中身を取り出さない', function (): void {
    expect('App\Http\Controllers')
        ->not->toUse(['app', 'resolve'])
        ->ignoring(LEGACY_CONTROLLERS);
});

// 対象を Controller だけにすると、DB の処理を Request に移すだけで避けられる（#234 のレビューで確かめた）
arch('Request と Middleware は、Model・DB を使わない', function (): void {
    foreach (['App\Http\Requests', 'App\Http\Middleware'] as $layer) {
        expect($layer)
            ->not->toUse(['App\Models', 'Illuminate\Support\Facades\DB', 'Illuminate\Database']);
    }
});

// Resource は、Service が返した Model から、返してよい項目を選ぶ（Model の型は使ってよい）。新しくクエリを書かない
arch('Resource は、DB を使わない', function (): void {
    expect('App\Http\Resources')
        ->not->toUse(['Illuminate\Support\Facades\DB', 'Illuminate\Database\Query', 'Illuminate\Database\Eloquent\Builder']);
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
    expect(archFindFacadeAliases($http, ['DB', 'Schema'], skipFilesIn: $http.'/Controllers'))->toBe([]);
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
// ログインしている人や入力は、Controller から値で受け取る。断るときは業務の例外を投げる（abort() で状態コードを決めない）
arch('Service は、Http を使わない', function (): void {
    expect('App\Services')
        ->not->toUse(['App\Http', 'Illuminate\Http', 'Illuminate\Routing', 'request', 'auth', 'session', 'response', 'redirect', 'abort']);
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

// ---- Model ----

// Model は DB とのやり取りだけ（2章）。Service と Http を使わない。
// Observer（ObservedBy）を使うと、保存したときの裏の動きが、Service を読んでも見えなくなる。
// booted() の中の static::created() などは、このテストでは見られない（レビューで見る）
arch('Model は、Service・Http・Observer を使わない', function (): void {
    expect('App\Models')
        ->not->toUse(['App\Services', 'App\Http', 'Illuminate\Http', 'Illuminate\Database\Eloquent\Attributes\ObservedBy', 'request', 'auth', 'session']);
});

// ---- 例外・基盤 ----

arch('業務の例外は、Http を使わない（状態コードは bootstrap/app.php で決める）', function (): void {
    expect('App\Exceptions')
        ->not->toUse(['App\Http', 'Illuminate\Http', 'abort', 'response']);
});

arch('Support（基盤）は、Http・Service・Model を使わない', function (): void {
    expect('App\Support')
        ->not->toUse(['App\Http', 'App\Services', 'App\Models']);
});

arch('新しいコードのファイルは strict_types', function (): void {
    expect(['App\Http', 'App\Services', 'App\Exceptions', 'App\Support'])
        ->toUseStrictTypes()
        ->ignoring(LEGACY_CONTROLLERS);
});
