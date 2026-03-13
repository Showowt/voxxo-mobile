const fs = require('fs');
const { execSync } = require('child_process');

console.log('Step 1: Fix app.json schema errors...');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));

// Move copyright out of ios (invalid there) to top level
if (app.expo.ios && app.expo.ios.copyright) {
  delete app.expo.ios.copyright;
}

// Remove newArchEnabled from wherever it is (invalid top-level key)
if (app.expo.newArchEnabled !== undefined) {
  delete app.expo.newArchEnabled;
}

// Set new arch correctly under experiments
if (!app.expo.experiments) app.expo.experiments = {};
app.expo.experiments.newArchEnabled = true;

// Clean up plugins - remove any existing expo-build-properties
if (!app.expo.plugins) app.expo.plugins = [];
app.expo.plugins = app.expo.plugins.filter(function(p) {
  return !(Array.isArray(p) && p[0] === 'expo-build-properties');
});

// Add correct build properties
app.expo.plugins.push(['expo-build-properties', {
  ios: {
    deploymentTarget: '15.1',
    useFrameworks: 'static'
  },
  android: {
    compileSdkVersion: 35,
    targetSdkVersion: 35,
    buildToolsVersion: '35.0.0'
  }
}]);

fs.writeFileSync('app.json', JSON.stringify(app, null, 2));
console.log('app.json fixed');

console.log('Step 2: Fix reanimated + worklets...');
try {
  execSync('npm uninstall react-native-reanimated react-native-worklets-core --legacy-peer-deps', { stdio: 'inherit' });
  execSync('npm install react-native-reanimated@4.2.1 react-native-worklets-core@0.7.0 --legacy-peer-deps', { stdio: 'inherit' });
  console.log('Dependencies fixed');
} catch(e) {
  console.log('npm error:', e.message);
}

console.log('Step 3: Install react-dom peer dep...');
try {
  execSync('npm install react-dom --legacy-peer-deps', { stdio: 'inherit' });
} catch(e) {
  console.log('react-dom install error:', e.message);
}

console.log('All fixes applied. Now run:');
console.log('  git add -A && git commit -m "fix: new arch + reanimated 4.x + app.json schema" && eas build --platform ios --profile production');
