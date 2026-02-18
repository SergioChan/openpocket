import Foundation

enum StoreError: LocalizedError {
    case missingConfig(path: String)
    case parseFailed(path: String, reason: String)

    var errorDescription: String? {
        switch self {
        case .missingConfig(let path):
            return "OpenPocket config.json not found at \(path). Run `openpocket init` first."
        case .parseFailed(let path, let reason):
            return "Failed to parse JSON at \(path): \(reason)"
        }
    }
}

final class OpenPocketPaths {
    static let shared = OpenPocketPaths()

    let homeDir: URL
    let configPath: URL
    let stateDir: URL
    let workspaceDir: URL
    let controlPanelPath: URL
    let onboardingPath: URL

    private init() {
        let envConfigPath = ProcessInfo.processInfo.environment["OPENPOCKET_CONFIG_PATH"]?.trimmingCharacters(in: .whitespacesAndNewlines)
            ?? ProcessInfo.processInfo.environment["OPENPOCKET_CONFIG"]?.trimmingCharacters(in: .whitespacesAndNewlines)

        if let envConfigPath, !envConfigPath.isEmpty {
            let expanded = Self.expandPath(envConfigPath)
            configPath = URL(fileURLWithPath: expanded)
            homeDir = configPath.deletingLastPathComponent()
        } else {
            let envHome = ProcessInfo.processInfo.environment["OPENPOCKET_HOME"]?.trimmingCharacters(in: .whitespacesAndNewlines)
            if let envHome, !envHome.isEmpty {
                homeDir = URL(fileURLWithPath: Self.expandPath(envHome))
            } else {
                homeDir = FileManager.default.homeDirectoryForCurrentUser.appendingPathComponent(".openpocket", isDirectory: true)
            }
            configPath = homeDir.appendingPathComponent("config.json")
        }
        stateDir = homeDir.appendingPathComponent("state", isDirectory: true)
        workspaceDir = homeDir.appendingPathComponent("workspace", isDirectory: true)
        controlPanelPath = stateDir.appendingPathComponent("control-panel.json")
        onboardingPath = stateDir.appendingPathComponent("onboarding.json")
    }

    private static func expandPath(_ value: String) -> String {
        (value as NSString).expandingTildeInPath
    }
}

final class ConfigStore {
    private let fm = FileManager.default
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init() {
        encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
    }

    func loadConfig() throws -> OpenPocketConfigFile {
        let path = OpenPocketPaths.shared.configPath
        guard fm.fileExists(atPath: path.path) else {
            throw StoreError.missingConfig(path: path.path)
        }

        do {
            let data = try Data(contentsOf: path)
            if let text = String(data: data, encoding: .utf8),
               text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                let defaults = defaultConfigFile()
                try saveConfig(defaults)
                return defaults
            }

            do {
                return try decoder.decode(OpenPocketConfigFile.self, from: data)
            } catch {
                let repaired = try decodeWithDefaults(data)
                try? saveConfig(repaired)
                return repaired
            }
        } catch {
            throw StoreError.parseFailed(path: path.path, reason: error.localizedDescription)
        }
    }

    func saveConfig(_ config: OpenPocketConfigFile) throws {
        let path = OpenPocketPaths.shared.configPath
        try ensureParent(path)
        let data = try encoder.encode(config)
        try data.write(to: path, options: .atomic)
    }

    func loadOnboardingState() -> OnboardingStateFile {
        let path = OpenPocketPaths.shared.onboardingPath
        guard fm.fileExists(atPath: path.path), let data = try? Data(contentsOf: path) else {
            return OnboardingStateFile(
                updatedAt: Self.nowIso(),
                consentAcceptedAt: nil,
                modelProfile: nil,
                modelProvider: nil,
                modelConfiguredAt: nil,
                apiKeyEnv: nil,
                apiKeySource: nil,
                apiKeyConfiguredAt: nil,
                emulatorStartedAt: nil,
                gmailLoginConfirmedAt: nil,
                playStoreDetected: nil
            )
        }

        return (try? decoder.decode(OnboardingStateFile.self, from: data)) ?? OnboardingStateFile(
            updatedAt: Self.nowIso(),
            consentAcceptedAt: nil,
            modelProfile: nil,
            modelProvider: nil,
            modelConfiguredAt: nil,
            apiKeyEnv: nil,
            apiKeySource: nil,
            apiKeyConfiguredAt: nil,
            emulatorStartedAt: nil,
            gmailLoginConfirmedAt: nil,
            playStoreDetected: nil
        )
    }

    func saveOnboardingState(_ state: OnboardingStateFile) throws {
        let path = OpenPocketPaths.shared.onboardingPath
        try ensureParent(path)
        let data = try encoder.encode(state)
        try data.write(to: path, options: .atomic)
    }

    func loadControlSettings(workspaceDir: URL) -> MenuBarControlSettings {
        let path = OpenPocketPaths.shared.controlPanelPath
        if fm.fileExists(atPath: path.path), let data = try? Data(contentsOf: path), let parsed = try? decoder.decode(MenuBarControlSettings.self, from: data) {
            return parsed
        }

        let defaults = defaultPromptFiles(workspaceDir: workspaceDir)
        return MenuBarControlSettings(
            updatedAt: Self.nowIso(),
            permission: MenuBarPermissionSettings(
                allowLocalStorageView: false,
                storageDirectoryPath: workspaceDir.path,
                allowedSubpaths: ["sessions", "memory", "skills", "scripts", "cron"],
                allowedExtensions: ["md", "json", "txt", "log", "sh"]
            ),
            promptFiles: defaults
        )
    }

    func saveControlSettings(_ settings: MenuBarControlSettings) throws {
        let path = OpenPocketPaths.shared.controlPanelPath
        try ensureParent(path)
        let data = try encoder.encode(settings)
        try data.write(to: path, options: .atomic)
    }

    private func ensureParent(_ path: URL) throws {
        let parent = path.deletingLastPathComponent()
        try fm.createDirectory(at: parent, withIntermediateDirectories: true)
    }

    private func defaultPromptFiles(workspaceDir: URL) -> [PromptFileEntry] {
        let base = [
            ("agents", "AGENTS", workspaceDir.appendingPathComponent("AGENTS.md")),
            ("soul", "SOUL", workspaceDir.appendingPathComponent("SOUL.md")),
            ("user", "USER", workspaceDir.appendingPathComponent("USER.md")),
            ("identity", "IDENTITY", workspaceDir.appendingPathComponent("IDENTITY.md")),
            ("tools", "TOOLS", workspaceDir.appendingPathComponent("TOOLS.md")),
            ("heartbeat", "HEARTBEAT", workspaceDir.appendingPathComponent("HEARTBEAT.md")),
            ("memory", "MEMORY", workspaceDir.appendingPathComponent("MEMORY.md")),
        ]

        return base.map { item in
            PromptFileEntry(id: item.0, title: item.1, path: item.2.path)
        }
    }

    static func nowIso() -> String {
        ISO8601DateFormatter().string(from: Date())
    }

    private func decodeWithDefaults(_ data: Data) throws -> OpenPocketConfigFile {
        let raw = try JSONSerialization.jsonObject(with: data, options: [])
        guard let dict = raw as? [String: Any] else {
            throw NSError(domain: "OpenPocketMenuBar", code: 2, userInfo: [
                NSLocalizedDescriptionKey: "config.json root must be a JSON object."
            ])
        }

        let normalized = (normalizeKeys(dict) as? [String: Any]) ?? [:]
        let merged = deepMerge(base: defaultConfigDictionary(), incoming: normalized)
        let mergedData = try JSONSerialization.data(withJSONObject: merged, options: [])
        return try decoder.decode(OpenPocketConfigFile.self, from: mergedData)
    }

    private func defaultConfigDictionary() -> [String: Any] {
        guard let data = try? encoder.encode(defaultConfigFile()),
              let json = try? JSONSerialization.jsonObject(with: data, options: []),
              let dict = json as? [String: Any] else {
            return [:]
        }
        return dict
    }

    private func defaultConfigFile() -> OpenPocketConfigFile {
        let paths = OpenPocketPaths.shared
        let stateDir = paths.stateDir.path
        let workspaceDir = paths.workspaceDir.path
        let sdkRoot = ProcessInfo.processInfo.environment["ANDROID_SDK_ROOT"] ?? ""
        return OpenPocketConfigFile(
            projectName: "OpenPocket",
            workspaceDir: workspaceDir,
            stateDir: stateDir,
            defaultModel: "gpt-5.2-codex",
            emulator: OpenPocketEmulatorConfig(
                avdName: "OpenPocket_AVD",
                androidSdkRoot: sdkRoot,
                headless: false,
                bootTimeoutSec: 180
            ),
            telegram: OpenPocketTelegramConfig(
                botToken: "",
                botTokenEnv: "TELEGRAM_BOT_TOKEN",
                allowedChatIds: [],
                pollTimeoutSec: 25
            ),
            agent: OpenPocketAgentConfig(
                maxSteps: 50,
                loopDelayMs: 1200,
                progressReportInterval: 1,
                returnHomeOnTaskEnd: true,
                lang: "en",
                verbose: true,
                deviceId: nil
            ),
            screenshots: OpenPocketScreenshotConfig(
                saveStepScreenshots: true,
                directory: stateDir + "/screenshots",
                maxCount: 400
            ),
            scriptExecutor: OpenPocketScriptExecutorConfig(
                enabled: true,
                timeoutSec: 60,
                maxOutputChars: 6000,
                allowedCommands: [
                    "adb", "am", "pm", "input", "echo", "pwd", "ls", "cat",
                    "grep", "rg", "sed", "awk", "bash", "sh", "node", "npm"
                ]
            ),
            heartbeat: OpenPocketHeartbeatConfig(
                enabled: true,
                everySec: 30,
                stuckTaskWarnSec: 600,
                writeLogFile: true
            ),
            cron: OpenPocketCronConfig(
                enabled: true,
                tickSec: 10,
                jobsFile: workspaceDir + "/cron/jobs.json"
            ),
            models: [
                "gpt-5.2-codex": OpenPocketModelProfile(
                    baseUrl: "https://api.openai.com/v1",
                    model: "gpt-5.2-codex",
                    apiKey: "",
                    apiKeyEnv: "OPENAI_API_KEY",
                    maxTokens: 4096,
                    reasoningEffort: "medium",
                    temperature: nil
                ),
                "gpt-5.3-codex": OpenPocketModelProfile(
                    baseUrl: "https://api.openai.com/v1",
                    model: "gpt-5.3-codex",
                    apiKey: "",
                    apiKeyEnv: "OPENAI_API_KEY",
                    maxTokens: 4096,
                    reasoningEffort: "medium",
                    temperature: nil
                ),
                "claude-sonnet-4.6": OpenPocketModelProfile(
                    baseUrl: "https://openrouter.ai/api/v1",
                    model: "claude-sonnet-4.6",
                    apiKey: "",
                    apiKeyEnv: "OPENROUTER_API_KEY",
                    maxTokens: 4096,
                    reasoningEffort: "medium",
                    temperature: nil
                ),
                "claude-opus-4.6": OpenPocketModelProfile(
                    baseUrl: "https://openrouter.ai/api/v1",
                    model: "claude-opus-4.6",
                    apiKey: "",
                    apiKeyEnv: "OPENROUTER_API_KEY",
                    maxTokens: 4096,
                    reasoningEffort: "medium",
                    temperature: nil
                ),
                "autoglm-phone": OpenPocketModelProfile(
                    baseUrl: "https://api.z.ai/api/paas/v4",
                    model: "autoglm-phone-multilingual",
                    apiKey: "",
                    apiKeyEnv: "AUTOGLM_API_KEY",
                    maxTokens: 3000,
                    reasoningEffort: nil,
                    temperature: nil
                ),
            ]
        )
    }

    private func normalizeKeys(_ value: Any) -> Any {
        if let dict = value as? [String: Any] {
            var output: [String: Any] = [:]
            for (key, child) in dict {
                output[camelCaseKey(key)] = normalizeKeys(child)
            }
            return output
        }
        if let array = value as? [Any] {
            return array.map { normalizeKeys($0) }
        }
        return value
    }

    private func camelCaseKey(_ key: String) -> String {
        guard key.contains("_") else { return key }
        let parts = key.split(separator: "_")
        guard let first = parts.first else { return key }
        let head = String(first)
        let tail = parts.dropFirst().map { segment -> String in
            guard let firstChar = segment.first else { return "" }
            return String(firstChar).uppercased() + segment.dropFirst()
        }
        return ([head] + tail).joined()
    }

    private func deepMerge(base: [String: Any], incoming: [String: Any]) -> [String: Any] {
        var out = base
        for (key, value) in incoming {
            if let baseDict = out[key] as? [String: Any], let incomingDict = value as? [String: Any] {
                out[key] = deepMerge(base: baseDict, incoming: incomingDict)
            } else {
                out[key] = value
            }
        }
        return out
    }
}
