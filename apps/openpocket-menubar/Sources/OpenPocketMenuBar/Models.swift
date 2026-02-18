import Foundation

struct OpenPocketModelProfile: Codable, Hashable {
    var baseUrl: String
    var model: String
    var apiKey: String
    var apiKeyEnv: String
    var maxTokens: Int
    var reasoningEffort: String?
    var temperature: Double?
}

struct OpenPocketEmulatorConfig: Codable {
    var avdName: String
    var androidSdkRoot: String
    var headless: Bool
    var bootTimeoutSec: Int
}

struct OpenPocketTelegramConfig: Codable {
    var botToken: String
    var botTokenEnv: String
    var allowedChatIds: [Int]
    var pollTimeoutSec: Int
}

struct OpenPocketAgentConfig: Codable {
    var maxSteps: Int
    var loopDelayMs: Int
    var progressReportInterval: Int
    var returnHomeOnTaskEnd: Bool
    var lang: String
    var verbose: Bool
    var deviceId: String?
}

struct OpenPocketScreenshotConfig: Codable {
    var saveStepScreenshots: Bool
    var directory: String
    var maxCount: Int
}

struct OpenPocketScriptExecutorConfig: Codable {
    var enabled: Bool
    var timeoutSec: Int
    var maxOutputChars: Int
    var allowedCommands: [String]
}

struct OpenPocketHeartbeatConfig: Codable {
    var enabled: Bool
    var everySec: Int
    var stuckTaskWarnSec: Int
    var writeLogFile: Bool
}

struct OpenPocketCronConfig: Codable {
    var enabled: Bool
    var tickSec: Int
    var jobsFile: String
}

struct OpenPocketConfigFile: Codable {
    var projectName: String
    var workspaceDir: String
    var stateDir: String
    var defaultModel: String
    var emulator: OpenPocketEmulatorConfig
    var telegram: OpenPocketTelegramConfig
    var agent: OpenPocketAgentConfig
    var screenshots: OpenPocketScreenshotConfig
    var scriptExecutor: OpenPocketScriptExecutorConfig
    var heartbeat: OpenPocketHeartbeatConfig
    var cron: OpenPocketCronConfig
    var models: [String: OpenPocketModelProfile]
}

struct OnboardingStateFile: Codable {
    var updatedAt: String
    var consentAcceptedAt: String?
    var modelProfile: String?
    var modelProvider: String?
    var modelConfiguredAt: String?
    var apiKeyEnv: String?
    var apiKeySource: String?
    var apiKeyConfiguredAt: String?
    var emulatorStartedAt: String?
    var gmailLoginConfirmedAt: String?
    var playStoreDetected: Bool?
}

struct MenuBarPermissionSettings: Codable {
    var allowLocalStorageView: Bool
    var storageDirectoryPath: String
    var allowedSubpaths: [String]
    var allowedExtensions: [String]
}

struct PromptFileEntry: Codable, Hashable {
    var id: String
    var title: String
    var path: String
}

struct MenuBarControlSettings: Codable {
    var updatedAt: String
    var permission: MenuBarPermissionSettings
    var promptFiles: [PromptFileEntry]
}

struct EmulatorStatusSnapshot: Codable {
    var avdName: String
    var devices: [String]
    var bootedDevices: [String]
}
