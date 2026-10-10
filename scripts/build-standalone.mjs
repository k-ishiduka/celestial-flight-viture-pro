// Python もサーバーも要らない「ダブルクリックで開く」版を dist/ に作る。
// file:// では ES モジュール・fetch・WebGLテクスチャが使えないため、
// JS を1ファイルにまとめ、JSON と画像を埋め込み、読み込み側(fetch / Image)を差し替える。
import { build } from 'esbuild';
import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'outputs');
const out = join(root, 'dist');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 1) JS を1ファイルへ。トップレベル await を含むため ESM のまま束ね、あとで async 関数で包む。
const bundled = await build({
  entryPoints: [join(src, 'app.js')],
  bundle: true,
  format: 'esm',
  target: 'es2022',
  minify: true,
  legalComments: 'none',
  write: false,
});
const code = bundled.outputFiles[0].text;

// 2) 埋め込むデータ(fetch で読むJSON、Image で読む画像)。
const jsonFiles = [
  'stars.json',
  'playlist.json',
  'constellations.json',
  'named-stars.json',
  'constellation-names.json',
  'constellation-members.json',
  'star-identities.json',
  'constellation-art.json',
];
const mime = { '.jpg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' };
const files = {};
for (const name of jsonFiles) files[name] = readFileSync(join(src, name), 'utf8');
for (const dir of ['planet-textures', 'constellation-art']) {
  for (const name of readdirSync(join(src, dir))) {
    const type = mime[name.slice(name.lastIndexOf('.'))];
    if (!type) continue;
    files[`${dir}/${name}`] = `data:${type};base64,${readFileSync(join(src, dir, name)).toString('base64')}`;
  }
}

// 3) file:// 用の差し替え。JSON は fetch、画像は img.src を埋め込みデータへ向ける。
const prelude = `(()=>{
const FILES=${JSON.stringify(files)};
const base=location.href.slice(0,location.href.lastIndexOf('/')+1);
const key=u=>{try{return new URL(u,location.href).href.slice(base.length)}catch{return ''}};
const realFetch=window.fetch.bind(window);
window.fetch=(input,init)=>{
  const url=new URL(typeof input==='string'?input:input.url,location.href);
  if(url.pathname.startsWith('/api/'))return Promise.resolve(new Response('',{status:404}));
  const f=FILES[key(url.href)];
  if(f&&!f.startsWith('data:'))return Promise.resolve(new Response(f,{status:200,headers:{'Content-Type':'application/json'}}));
  return realFetch(input,init);
};
const d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
Object.defineProperty(HTMLImageElement.prototype,'src',{configurable:true,enumerable:d.enumerable,get:d.get,set(v){const f=FILES[key(v)];d.set.call(this,f&&f.startsWith('data:')?f:v)}});
})();
`;
writeFileSync(join(out, 'app.bundle.js'), `${prelude}(async()=>{${code}})();\n`);

// 4) HTML・CSS・その他の静的ファイル。
let html = readFileSync(join(src, 'index.html'), 'utf8');
const moduleTag = '<script type="module" src="app.js"></script>';
if (!html.includes(moduleTag)) throw Error('index.html の app.js の読み込みが見つかりません');
html = html.replace(moduleTag, '<script src="app.bundle.js"></script>');
writeFileSync(join(out, 'index.html'), html);
for (const name of ['interface.css', 'boot.js', 'astronomy.browser.min.js'])
  cpSync(join(src, name), join(out, name));
cpSync(join(src, 'music'), join(out, 'music'), { recursive: true });
for (const name of readdirSync(src)) {
  if (/LICENSE|CREDITS|使い方|音楽一覧/.test(name)) cpSync(join(src, name), join(out, name));
}

writeFileSync(
  join(out, 'はじめに.txt'),
  [
    '夜の航路 — スタンドアロン版',
    '',
    '1. このフォルダの index.html をダブルクリックして、Chrome(または Edge)で開きます。',
    '2. Python・Node・サーバーは不要です。Windows / Mac / Linux で同じように動きます。',
    '3. グラス(WebHID)を使う場合は Chrome / Edge で開いてください。',
    '4. 解説の音声はブラウザの読み上げを使います。自然な日本語音声は、リポジトリ版で別途セットアップした場合のみ使えます。',
    '5. 住所検索はインターネットに接続されていると使えます(国土地理院へ直接問い合わせます)。',
    '',
    '詳しい使い方は 使い方.md、クレジットは *CREDITS* / *LICENSE* を参照してください。',
    '',
  ].join('\n'),
);

// 5) 結果の概要。
const size = dir =>
  readdirSync(dir, { withFileTypes: true }).reduce(
    (sum, e) => sum + (e.isDirectory() ? size(join(dir, e.name)) : statSync(join(dir, e.name)).size),
    0,
  );
const mb = n => (n / 1048576).toFixed(1) + 'MB';
console.log(
  `dist/ を作成しました: 全体 ${mb(size(out))}(app.bundle.js ${mb(statSync(join(out, 'app.bundle.js')).size)})`,
);
console.log('開き方: dist/index.html をChromeで開く(サーバー不要)');
