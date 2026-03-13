Pod::Spec.new do |s|
  s.name           = 'VoxlinkCallAudio'
  s.version        = '1.0.0'
  s.summary        = 'Voxxo Call Audio native module for iOS'
  s.description    = 'Native module for call detection, audio routing, and speech recognition for Call Wingman AI coaching'
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

  # Required frameworks for call detection and speech
  s.frameworks = 'CallKit', 'AVFoundation', 'Speech'
end
