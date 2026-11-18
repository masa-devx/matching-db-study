<?php

declare(strict_types=1);
use Illuminate\Support\Facades\Facade;

// アーキテクチャのテスト（agents/rules/architecture.md の8章）。層の依存の向き・名前・final・strict_types を確かめる。
// 新しい層（App\Domain・App\Application・App\Infrastructure）にファイルがまだないあいだは、当てはまるものがなく、どれも通る。
// 移したファイルが、決まりを破ったときに落ちる。足すとき・直すときは、わざと違反を置いて、落ちるのを見る

// ==== このアプリだけのもの（会員の側と管理画面で、違うのはこの3つの一覧だけ）====

// まだ移していない古いファイル。この一覧が、そのまま移行の残り。移したら消す。
// ignoring に渡すのは古いコントローラーだけ。ignoring は、渡した名前で始まる「使われる側」の依存も消すので、
// App\Models を渡すと、新しいコードが App\Models を使っても落ちなくなる
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
const LEGACY_MODELS = 'App\Models';   // 管理画面には Model がない（全部 DB:: で書いている）。新しいコードが Model を作って Http から使わないよう、会員の側と同じく止める

// 設計の図（3章）にない、全部を知ってよい Providers。Domain と Application は使わない（管理画面に App\Mail はない）
const OUTSIDE_LAYERS = ['App\Providers'];

// ==== ここから下は、会員の側（backend/client/tests/Arch/LayersTest.php。正本）と管理画面（backend/admin/tests/Arch/LayersTest.php）で同じ。片方を直したら、もう片方も直す（管理画面の SameRulesAsClientTest が、違えば落ちる）====

// Domain と Application で使わない、Laravel のヘルパー関数。名前の始まりで比べるので、'app' は app_path() なども止める
const LARAVEL_HELPERS = [
    'now', 'today', 'config', 'env', 'app', 'resolve', 'collect', 'abort', 'response', 'request', 'logger', 'logs', 'info',
    'auth', 'session', 'cache', 'event', 'dispatch', 'report', 'rescue', 'retry', 'validator', '__', 'trans',
];

// arch() の比べ方は「名前の始まり」。期待は、無名関数の中に書く
// （arch('名前')->expect(…) と鎖でつなぐ書き方は、Larastan が「ないメソッド」と指摘する）

arch('Domain はほかの層・Laravel・Carbon・基盤を使わない', function (): void {
    expect('App\Domain')
        ->not->toUse(['App\Http', 'App\Application', 'App\Infrastructure', 'App\Models', 'App\Support', ...OUTSIDE_LAYERS, 'Illuminate', 'Carbon']);
});

arch('Application は Http・Infrastructure・Laravel・Carbon・基盤を使わない', function (): void {
    expect('App\Application')
        ->not->toUse(['App\Http', 'App\Infrastructure', 'App\Models', 'App\Support', ...OUTSIDE_LAYERS, 'Illuminate', 'Carbon']);
});

// 層の側から「使わない」と書く。expect() に関数の一覧・toBeUsedIn() に層の一覧、と両方に配列を渡す書き方は、
// 違反があっても通ってしまう（#106 で、Domain に now()・Application に config() を置いて確かめた）
arch('Domain は Laravel のヘルパー関数を使わない', function (): void {
    expect('App\Domain')
        ->not->toUse(LARAVEL_HELPERS);
});

arch('Application は Laravel のヘルパー関数を使わない', function (): void {
    expect('App\Application')
        ->not->toUse(LARAVEL_HELPERS);
});

// ファサードの別名（\DB::・\Log::・\Cache:: など。use を書かずに呼べる）は、名前が Illuminate で始まらないので、
// arch() では落ちない。別名を「使わない」一覧に足すと、名前の始まりで比べるので、'Log' が LogicException に、
// 'Date' が DateTimeImmutable に当たる。ファイルの文字を読んで、別名と完全に一致するものだけを探す。
// $skipTopLevel が true なら、$root の直下のファイルは見ない（app/Http/Controllers の直下は、古いコントローラー）
/**
 * @param  list<string>  $aliases
 * @return list<string>
 */
function archFindFacadeAliases(string $root, array $aliases, bool $skipTopLevel = false): array
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
        if ($skipTopLevel && $file->getPath() === $root) {
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

test('Domain と Application は、ファサードの別名（\DB:: など）を使わない', function (): void {
    $aliases = array_keys(Facade::defaultAliases()->all());
    $app = dirname(__DIR__, 2).'/app';

    expect([...archFindFacadeAliases($app.'/Domain', $aliases), ...archFindFacadeAliases($app.'/Application', $aliases)])->toBe([]);
});

// Controller は「受け取る → 呼ぶ → 返す」だけ。SQL・トランザクションを書かず、トークンも読まない（4-1）。
// これで、新しい Controller が書き込むには、UseCase（役割の確かめと監査ログがある所）を通すしかなくなる。
// UseCase の中で役割の確かめを書き忘れることは、このテストでは見られない（API テストで、見るだけの管理者は 403 を確かめる）
arch('新しい Controller は、DB を直接使わず、トークンも読まない', function (): void {
    expect('App\Http\Controllers')
        ->not->toUse(['Illuminate\Support\Facades\DB', 'Illuminate\Database', 'Firebase\JWT'])
        ->ignoring(LEGACY_CONTROLLERS);
});

test('新しい Controller は、DB のファサードの別名（\DB::・use DB;）も使わない', function (): void {
    // 直下は古いコントローラー（上の LEGACY_CONTROLLERS）なので見ない。新しい Controller は、業務のまとまりのフォルダに置く
    expect(archFindFacadeAliases(dirname(__DIR__, 2).'/app/Http/Controllers', ['DB', 'Schema'], skipTopLevel: true))->toBe([]);
});

arch('Http が使ってよい Infrastructure は QueryService だけ', function (): void {
    expect('App\Http')
        ->not->toUse(['App\Infrastructure\Models', 'App\Infrastructure\Repositories', 'App\Infrastructure\External', 'App\Infrastructure\Transaction', 'App\Infrastructure\Clock', LEGACY_MODELS])
        ->ignoring(LEGACY_CONTROLLERS);
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

arch('Infrastructure は UseCase と Http を使わない', function (): void {
    expect('App\Infrastructure')
        ->not->toUse(['App\Application\UseCases', 'App\Http']);
});

arch('QueryService は Application・Repository・Domain を使わない', function (): void {
    expect('App\Infrastructure\QueryServices')
        ->not->toUse(['App\Application', 'App\Infrastructure\Repositories', 'App\Domain']);   // ID は int で受け取る
});

arch('Support（基盤）は、層と Model を使わない', function (): void {
    expect('App\Support')
        ->not->toUse(['App\Http', 'App\Application', 'App\Domain', 'App\Infrastructure', 'App\Models', ...OUTSIDE_LAYERS]);
});

arch('Domain の interface は Interface で終わる', function (): void {
    expect('App\Domain')
        ->interfaces()
        ->toHaveSuffix('Interface');
});

// 1つのテストに、期待は1つ。classes() の絞り込みは、鎖の2つ目以降の期待には効かないため
arch('UseCase は final', function (): void {
    expect('App\Application\UseCases')
        ->classes()
        ->toBeFinal();
});

arch('UseCase は UseCase で終わる', function (): void {
    expect('App\Application\UseCases')
        ->classes()
        ->toHaveSuffix('UseCase');
});

arch('QueryService のフォルダのクラス（QueryService と読み取りの DTO）は final', function (): void {
    expect('App\Infrastructure\QueryServices')
        ->classes()
        ->toBeFinal();
});

arch('新しい層のファイルは strict_types', function (): void {
    expect(['App\Http', 'App\Application', 'App\Domain', 'App\Infrastructure', 'App\Support'])
        ->toUseStrictTypes()
        ->ignoring(LEGACY_CONTROLLERS);
});
