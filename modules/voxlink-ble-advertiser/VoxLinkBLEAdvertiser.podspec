Pod::Spec.new do |s|
  s.name           = 'VoxLinkBLEAdvertiser'
  s.version        = '1.0.0'
  s.summary        = 'Voxxo BLE Advertiser native module for iOS'
  s.description    = 'Native module for BLE peripheral advertising using CoreBluetooth'
  s.author         = 'MachineMind'
  s.homepage       = 'https://machinemind.co'
  s.platforms      = { :ios => '13.4' }
  s.source         = { :git => '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = "ios/**/*.{h,m,mm,swift}"
end
