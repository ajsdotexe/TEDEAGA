/* Gera o APK: node scripts/build-apk.js  (ou: npm run apk) */
const fs = require('fs'), path = require('path'), cp = require('child_process');
const { setup, findSdk, findJava, root, and } = require('./setup');

setup();
const sdk = findSdk(), java = findJava();
if (!sdk) { console.error('\nNão achei o Android SDK. Instale o Android Studio (ele instala o SDK) ou defina a variável ANDROID_HOME.'); process.exit(1); }
const env = { ...process.env, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk };
if (!process.env.JAVA_HOME && java) env.JAVA_HOME = java;
const lp = path.join(and, 'local.properties');
if (!fs.existsSync(lp)) fs.writeFileSync(lp, 'sdk.dir=' + sdk.replace(/\\/g, '/') + '\n');

console.log('\n> Compilando o APK (a primeira vez demora alguns minutos)…');
const win = process.platform === 'win32';
cp.execSync(win ? 'gradlew.bat assembleDebug' : './gradlew assembleDebug', { cwd: and, stdio: 'inherit', env, shell: true });
const out = path.join(and, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
const dest = path.join(root, 'TEDEAGA-1.1.4.apk');
fs.copyFileSync(out, dest);
console.log('\n✅ APK pronto: ' + dest);
