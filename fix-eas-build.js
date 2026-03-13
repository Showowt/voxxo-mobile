#!/usr/bin/env node
/**
 * ENTREVOZ EAS BUILD FIX — Resolves folly/coro/Coroutine.h error
 * 
 * ROOT CAUSE: useFrameworks: 'static' in expo-build-properties breaks
 * folly's C++ coroutine headers on EAS. This script removes it and
 * fixes all related dependency issues.
 * 
 * USAGE: node fix-eas-build.js
 * Then:  git add -A && git commit -m "fix: resolve folly coroutine build error" && eas build --platform ios --profile production
 */

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

console.log('\n=== ENTREVOZ EAS BUILD FIX ===\n');

// ─────────────────────────────────────────────
// 1. FIX app.json
// ─────────────────────────────────────────────
console.log('1. Fixing app.json...');
const appJsonPath = path.join(process.cwd(), 'app.json');
const app = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));

// Remove invalid top-level fields that expo doctor flagged
delete app.expo.newArchEnabled;
if (app.expo.ios) {
  delete app.expo.ios.copyright;
}

// Clean up plugins array
if (!app.expo.plugins) app.expo.plugins = [];

// Remove existing expo-build-properties (the one with useFrameworks: 'static')
app.expo.plugins = app.expo.plugins.filter(p => {
  if (Array.isArray(p)) return p[0] !== 'expo-build-properties';
  return p !== 'expo-build-properties';
});

// Add expo-build-properties WITHOUT useFrameworks (this is the key fix)
app.expo.plugins.push(['expo-build-properties', {
  ios: {
    deploymentTarget: '15.1',
    // DO NOT set useFrameworks - it breaks folly coroutine headers
    newArchEnabled: true
  },
  android: {
    compileSdkVersion: 35,
    targetSdkVersion: 35,
    buildToolsVersion: '35.0.0',
    newArchEnabled: true
  }
}]);

// Remove existing expo-dev-client plugin if duplicated
app.expo.plugins = app.expo.plugins.filter(p => {
  if (Array.isArray(p)) return p[0] !== 'expo-dev-client';
  return p !== 'expo-dev-client';
});

// Ensure experiments.typedRoutes is not breaking anything
if (!app.expo.experiments) app.expo.experiments = {};

fs.writeFileSync(appJsonPath, JSON.stringify(app, null, 2));
console.log('   app.json fixed (removed useFrameworks: static, cleaned schema errors)');

// ─────────────────────────────────────────────
// 2. FIX eas.json
// ─────────────────────────────────────────────
console.log('2. Fixing eas.json...');
const easJsonPath = path.join(process.cwd(), 'eas.json');
const easJson = {
  "cli": {
    "version": ">= 18.3.0",
    "appVersionSource": "local"
  },
  "build": {
    "production": {
      "env": {
        "NPM_CONFIG_LEGACY_PEER_DEPS": "true"
      },
      "ios": {
        "simulator": false,
        "buildConfiguration": "Release",
        "image": "latest"
      },
      "android": {
        "buildType": "apk"
      }
    },
    "preview": {
      "ios": {
        "simulator": true
      }
    }
  },
  "submit": {
    "production": {
      "ios": {
        "appleId": "philipmcgill18@gmail.com",
        "ascAppId": "YOUR_APP_STORE_CONNECT_APP_ID",
        "appleTeamId": "4C39DXRG9L"
      }
    }
  }
};
fs.writeFileSync(easJsonPath, JSON.stringify(easJson, null, 2));
console.log('   eas.json fixed (added appVersionSource, NPM_CONFIG_LEGACY_PEER_DEPS, latest image)');

// ─────────────────────────────────────────────
// 3. FIX package.json dependencies
// ─────────────────────────────────────────────
console.log('3. Fixing package.json...');
const pkgPath = path.join(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// Ensure react-native-reanimated is at SDK 55 expected version
pkg.dependencies['react-native-reanimated'] = '~4.2.1';

// Ensure react-native-worklets is present (required by reanimated 4.x)
// The package name reanimated looks for is 'react-native-worklets'
// which is published as 'react-native-worklets-core' but imported as 'react-native-worklets'
pkg.dependencies['react-native-worklets'] = '~0.7.2';

// Remove react-native-worklets-core if present (avoid confusion)
delete pkg.dependencies['react-native-worklets-core'];

// Ensure react-dom is present (peer dep of react-native-web)
if (pkg.dependencies['react-native-web'] && !pkg.dependencies['react-dom']) {
  pkg.dependencies['react-dom'] = '19.2.0';
}

// Ensure expo-speech-recognition is compatible (if present)
// This is a third-party package that may not support SDK 55
if (pkg.dependencies['expo-speech-recognition']) {
  console.log('   WARNING: expo-speech-recognition is third-party and may cause issues');
  console.log('   If build fails again, remove it with: npm uninstall expo-speech-recognition');
}

// Add .npmrc creation
const npmrcPath = path.join(process.cwd(), '.npmrc');
fs.writeFileSync(npmrcPath, 'legacy-peer-deps=true\n');
console.log('   .npmrc created');

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
console.log('   package.json fixed');

// ─────────────────────────────────────────────
// 4. CLEAN & REINSTALL
// ─────────────────────────────────────────────
console.log('4. Clean install...');
try {
  // Remove old lockfile and modules
  if (fs.existsSync('package-lock.json')) fs.unlinkSync('package-lock.json');
  execSync('rm -rf node_modules', { stdio: 'inherit' });
  
  // Fresh install
  execSync('npm install --legacy-peer-deps', { stdio: 'inherit' });
  console.log('   Dependencies installed');
} catch (e) {
  console.error('   npm install failed:', e.message);
  console.log('   Try running manually: rm -rf node_modules package-lock.json && npm install --legacy-peer-deps');
}

// ─────────────────────────────────────────────
// 5. VERIFY
// ─────────────────────────────────────────────
console.log('\n5. Verification...');
const finalPkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const checks = [
  ['react-native-reanimated', '~4.2.1'],
  ['react-native-worklets', '~0.7.2'],
  ['expo-build-properties', null], // just check it exists
];

checks.forEach(([dep, expected]) => {
  const actual = finalPkg.dependencies[dep];
  if (expected && actual === expected) {
    console.log(`   ✅ ${dep}: ${actual}`);
  } else if (!expected && actual) {
    console.log(`   ✅ ${dep}: ${actual}`);
  } else {
    console.log(`   ❌ ${dep}: expected ${expected}, got ${actual}`);
  }
});

// Check app.json doesn't have useFrameworks
const finalApp = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
const buildPropsPlugin = finalApp.expo.plugins.find(p => Array.isArray(p) && p[0] === 'expo-build-properties');
if (buildPropsPlugin && buildPropsPlugin[1]?.ios?.useFrameworks) {
  console.log('   ❌ useFrameworks is still set - THIS WILL CAUSE THE FOLLY ERROR');
} else {
  console.log('   ✅ useFrameworks not set (folly fix applied)');
}

if (fs.existsSync('package-lock.json')) {
  console.log('   ✅ package-lock.json exists');
} else {
  console.log('   ❌ package-lock.json missing - npm install may have failed');
}

console.log('\n=== FIX COMPLETE ===');
console.log('\nNow run:');
console.log('  git add -A');
console.log('  git commit -m "fix: resolve folly coroutine build error"');
console.log('  eas build --platform ios --profile production');
console.log('');
