import Foundation

// Stable identifier used for both the macOS LaunchAgent label and Nix-managed defaults suite.
// nix-jarvis writes app defaults into this suite to survive app bundle identifier churn.
let launchdLabel = "ai.jarvis.mac"
let gatewayLaunchdLabel = "ai.jarvis.gateway"
let onboardingVersionKey = "jarvis.onboardingVersion"
let onboardingSeenKey = "jarvis.onboardingSeen"
let currentOnboardingVersion = 7
let pauseDefaultsKey = "jarvis.pauseEnabled"
let iconAnimationsEnabledKey = "jarvis.iconAnimationsEnabled"
let swabbleEnabledKey = "jarvis.swabbleEnabled"
let swabbleTriggersKey = "jarvis.swabbleTriggers"
let voiceWakeTriggerChimeKey = "jarvis.voiceWakeTriggerChime"
let voiceWakeSendChimeKey = "jarvis.voiceWakeSendChime"
let showDockIconKey = "jarvis.showDockIcon"
let defaultVoiceWakeTriggers = ["jarvis"]
let voiceWakeMaxWords = 32
let voiceWakeMaxWordLength = 64
let voiceWakeMicKey = "jarvis.voiceWakeMicID"
let voiceWakeMicNameKey = "jarvis.voiceWakeMicName"
let voiceWakeLocaleKey = "jarvis.voiceWakeLocaleID"
let voiceWakeAdditionalLocalesKey = "jarvis.voiceWakeAdditionalLocaleIDs"
let voicePushToTalkEnabledKey = "jarvis.voicePushToTalkEnabled"
let talkEnabledKey = "jarvis.talkEnabled"
let iconOverrideKey = "jarvis.iconOverride"
let connectionModeKey = "jarvis.connectionMode"
let remoteTargetKey = "jarvis.remoteTarget"
let remoteIdentityKey = "jarvis.remoteIdentity"
let remoteProjectRootKey = "jarvis.remoteProjectRoot"
let remoteCliPathKey = "jarvis.remoteCliPath"
let canvasEnabledKey = "jarvis.canvasEnabled"
let cameraEnabledKey = "jarvis.cameraEnabled"
let systemRunPolicyKey = "jarvis.systemRunPolicy"
let systemRunAllowlistKey = "jarvis.systemRunAllowlist"
let systemRunEnabledKey = "jarvis.systemRunEnabled"
let locationModeKey = "jarvis.locationMode"
let locationPreciseKey = "jarvis.locationPreciseEnabled"
let peekabooBridgeEnabledKey = "jarvis.peekabooBridgeEnabled"
let deepLinkKeyKey = "jarvis.deepLinkKey"
let modelCatalogPathKey = "jarvis.modelCatalogPath"
let modelCatalogReloadKey = "jarvis.modelCatalogReload"
let cliInstallPromptedVersionKey = "jarvis.cliInstallPromptedVersion"
let heartbeatsEnabledKey = "jarvis.heartbeatsEnabled"
let debugPaneEnabledKey = "jarvis.debugPaneEnabled"
let debugFileLogEnabledKey = "jarvis.debug.fileLogEnabled"
let appLogLevelKey = "jarvis.debug.appLogLevel"
let voiceWakeSupported: Bool = ProcessInfo.processInfo.operatingSystemVersion.majorVersion >= 26
