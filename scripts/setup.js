/* Gera o projeto Android (pasta android/) e aplica as personalizações do TEDEAGA.
   Pode ser executado várias vezes sem problema. */
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os');
const root = path.join(__dirname, '..');
const and = path.join(root, 'android');
const run = (cmd, opt = {}) => cp.execSync(cmd, { stdio: 'inherit', cwd: root, shell: true, ...opt });

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, f.name), d = path.join(dst, f.name);
    if (f.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}
function walk(dir, fn) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, fn); else fn(p);
  }
}
const read = f => fs.readFileSync(f, 'utf8');
const write = (f, t) => fs.writeFileSync(f, t, 'utf8');

function setup() {
  if (!fs.existsSync(path.join(root, 'node_modules', '@capacitor', 'cli'))) {
    throw new Error('Rode "npm install" antes (dentro da pasta tedeaga-android).');
  }
  if (!fs.existsSync(and)) { console.log('> Criando o projeto Android…'); run('npx cap add android'); }
  const main = path.join(and, 'app', 'src', 'main'), res = path.join(main, 'res');

  console.log('> Copiando código nativo, ícones e sons…');
  copyDir(path.join(root, 'native', 'res'), res);
  copyDir(path.join(root, 'native', 'java'), path.join(main, 'java', 'app', 'tedeaga', 'mobile'));
  walk(res, p => {
    const b = path.basename(p);
    if (b === 'splash.png') fs.copyFileSync(path.join(root, 'assets', 'splash.png'), p);
    if (/^ic_launcher_(foreground|background)\.xml$/.test(b) && /drawable/.test(p)) fs.unlinkSync(p);
  });

  // Manifesto: permissões, link de retorno do login Google e widgets
  const mf = path.join(main, 'AndroidManifest.xml');
  let m = read(mf);
  if (!m.includes('tedeaga-patched')) {
    const perms = ['POST_NOTIFICATIONS', 'SCHEDULE_EXACT_ALARM', 'USE_EXACT_ALARM', 'VIBRATE', 'WAKE_LOCK', 'RECEIVE_BOOT_COMPLETED']
      .map(p => `    <uses-permission android:name="android.permission.${p}" />`).join('\n');
    m = m.replace('<application', `<!-- tedeaga-patched -->\n${perms}\n\n    <application`);
    m = m.replace('</activity>', `    <intent-filter>
                <action android:name="android.intent.action.VIEW" />
                <category android:name="android.intent.category.DEFAULT" />
                <category android:name="android.intent.category.BROWSABLE" />
                <data android:scheme="app.tedeaga.mobile" />
            </intent-filter>
        </activity>`);
    const rec = ['Agenda', 'Rotina', 'Contas', 'Nutri'].map(n => `        <receiver android:name=".${n}Widget" android:exported="true">
            <intent-filter><action android:name="android.appwidget.action.APPWIDGET_UPDATE" /></intent-filter>
            <meta-data android:name="android.appwidget.provider" android:resource="@xml/widget_${n.toLowerCase()}_info" />
        </receiver>`).join('\n');
    m = m.replace('</application>', `${rec}\n    </application>`);
    write(mf, m);
  }

  // HTTP em rede local (sincronização por Wi-Fi com o PC)
  m = read(mf);
  if (!m.includes('usesCleartextTraffic')) { m = m.replace('<application', '<application android:usesCleartextTraffic="true"'); write(mf, m); }

  // Gradle: assinatura fixa (o SHA-1 não muda), versão e targetSdk
  const bg = path.join(and, 'app', 'build.gradle');
  let g = read(bg);
  if (!g.includes('tedeaga-signing')) {
    g = g.replace(/^android\s*\{/m, `android {
    // tedeaga-signing
    signingConfigs {
        debug {
            storeFile rootProject.file('../assets/tedeaga-debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }`);
  }
  g = g.replace(/versionCode\s+\d+/, 'versionCode 114').replace(/versionName\s+"[^"]*"/, 'versionName "1.1.4"');
  write(bg, g);
  const vf = path.join(and, 'variables.gradle');
  if (fs.existsSync(vf)) write(vf, read(vf).replace(/targetSdkVersion\s*=\s*\d+/, 'targetSdkVersion = 34'));

  console.log('> Sincronizando o app (www) com o Android…');
  run('npx cap sync android');
  console.log('\nProjeto Android pronto em: ' + and);
}

function findSdk() {
  const c = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk'),
    path.join(os.homedir(), 'Android', 'Sdk'), path.join(os.homedir(), 'Library', 'Android', 'sdk')].filter(Boolean);
  return c.find(p => fs.existsSync(p));
}
function findJava() {
  const c = [process.env.JAVA_HOME, 'C:\\Program Files\\Android\\Android Studio\\jbr', '/Applications/Android Studio.app/Contents/jbr/Contents/Home', '/opt/android-studio/jbr'].filter(Boolean);
  return c.find(p => fs.existsSync(p));
}
module.exports = { setup, findSdk, findJava, root, and };
if (require.main === module) setup();
