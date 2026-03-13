const fs = require('fs');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));
if (!app.expo.plugins) app.expo.plugins = [];
app.expo.plugins = app.expo.plugins.filter(function(p) {
  return !(Array.isArray(p) && p[0] === 'expo-build-properties');
});
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
console.log('app.json updated');
