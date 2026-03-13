const fs = require('fs');
const app = JSON.parse(fs.readFileSync('app.json', 'utf8'));

if (!app.expo.ios) app.expo.ios = {};
if (!app.expo.ios.infoPlist) app.expo.ios.infoPlist = {};

app.expo.ios.infoPlist.NSPhotoLibraryUsageDescription = 'Entrevoz needs photo library access to share images.';
app.expo.ios.buildNumber = '5';

fs.writeFileSync('app.json', JSON.stringify(app, null, 2));
console.log('Done - added NSPhotoLibraryUsageDescription and bumped build to 5');
