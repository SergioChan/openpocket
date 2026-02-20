import AppKit
import Combine
import Foundation
import UniformTypeIdentifiers

final class OpenPocketController: ObservableObject {
    @Published var config: OpenPocketConfigFile?
    @Published var onboarding: OnboardingStateFile
    @Published var controlSettings: MenuBarControlSettings

    @Published var selectedModelProfile: String = ""
    @Published var onboardingApiKeyInput: String = ""
    @Published var onboardingUseEnvKey: Bool = true
    @Published var onboardingConsentAccepted: Bool = false
    @Published var onboardingGmailDone: Bool = false

    @Published var logLines: [String] = []
    @Published var gatewayRunning: Bool = false
    @Published var emulatorStatusText: String = "Unknown"
    @Published var emulatorPreviewImage: NSImage?
    @Published var emulatorPreviewPixelSize: CGSize = .zero
    @Published var emulatorPreviewStatusText: String = "No preview captured yet."
    @Published var emulatorPreviewAutoRefresh: Bool = false
    @Published var emulatorInputText: String = ""
    @Published var emulatorControlStatusText: String = ""
    @Published var selectedPromptFile: PromptFileEntry?
    @Published var promptEditorText: String = ""
    @Published var promptEditorDirty: Bool = false

    @Published var scopePathText: String = ""
    @Published var scopeExtText: String = ""
    @Published var fileList: [URL] = []
    @Published var selectedFile: URL?
    @Published var selectedFileContent: String = ""
    @Published var statusMessage: String = ""

    let paths = OpenPocketPaths.shared
    private let store = ConfigStore()
    private let bridge = RuntimeBridge()
    private let fm = FileManager.default
    private var fileListRefreshToken: Int = 0
    private var emulatorStatusRefreshToken: Int = 0
    private var emulatorPreviewRefreshing: Bool = false

    let repoRoot: URL

    init() {
        let fallbackRepo = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
        let packageCwd = URL(fileURLWithPath: FileManager.default.currentDirectoryPath)
        let detected = [packageCwd, fallbackRepo].first(where: {
            FileManager.default.fileExists(atPath: $0.appendingPathComponent("package.json").path)
        }) ?? packageCwd
        repoRoot = detected

        let loadedOnboarding = store.loadOnboardingState()
        onboarding = loadedOnboarding

        let initialWorkspace = paths.workspaceDir
        let loadedControl = store.loadControlSettings(workspaceDir: initialWorkspace)
        controlSettings = loadedControl

        scopePathText = loadedControl.permission.allowedSubpaths.joined(separator: "\n")
        scopeExtText = loadedControl.permission.allowedExtensions.joined(separator: "\n")

        bridge.onGatewayLogLine = { [weak self] line in
            DispatchQueue.main.async {
                self?.appendLog(line)
            }
        }
        bridge.onGatewayExit = { [weak self] code in
            DispatchQueue.main.async {
                self?.gatewayRunning = false
                self?.appendLog("[OpenPocket][menubar] gateway exited code=\(code)")
            }
        }

        loadAll()
    }

    func loadAll() {
        do {
            let cfg = try store.loadConfig()
            config = cfg
            selectedModelProfile = cfg.defaultModel
            onboardingConsentAccepted = onboarding.consentAcceptedAt != nil
            onboardingGmailDone = onboarding.gmailLoginConfirmedAt != nil

            if controlSettings.promptFiles.isEmpty {
                controlSettings.promptFiles = defaultPromptEntries(workspaceDir: URL(fileURLWithPath: cfg.workspaceDir))
            }
            normalizePromptFiles()
            if selectedPromptFile == nil || !controlSettings.promptFiles.contains(where: { $0.id == selectedPromptFile?.id }) {
                selectedPromptFile = controlSettings.promptFiles.first
            }
            loadSelectedPromptFile()

            refreshFileList()
            refreshEmulatorStatus()
            gatewayRunning = bridge.isGatewayRunning()
            statusMessage = "Loaded config at \(paths.configPath.path)"
        } catch {
            config = nil
            statusMessage = error.localizedDescription
            appendLog("[OpenPocket][menubar][error] \(error.localizedDescription)")
        }
    }

    func openControlPanelWindow() {
        NSApp.activate(ignoringOtherApps: true)
        for window in NSApp.windows {
            if window.identifier?.rawValue == "openpocket-control-panel" {
                window.makeKeyAndOrderFront(nil)
                return
            }
        }
    }

    func appendLog(_ line: String) {
        logLines.append(line)
        if logLines.count > 2000 {
            logLines.removeFirst(logLines.count - 2000)
        }
    }

    func clearLogs() {
        logLines.removeAll(keepingCapacity: true)
    }

    func chooseStorageDirectory() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.directoryURL = URL(fileURLWithPath: controlSettings.permission.storageDirectoryPath)
        if panel.runModal() == .OK, let url = panel.url {
            controlSettings.permission.storageDirectoryPath = url.path
            saveControlSettings()
            refreshFileList()
        }
    }

    func chooseWorkspaceDirectoryForConfig() {
        guard var cfg = config else { return }
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.directoryURL = URL(fileURLWithPath: cfg.workspaceDir)
        if panel.runModal() == .OK, let url = panel.url {
            cfg.workspaceDir = url.path
            config = cfg
            persistConfig()
        }
    }

    func chooseStateDirectoryForConfig() {
        guard var cfg = config else { return }
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.allowsMultipleSelection = false
        panel.directoryURL = URL(fileURLWithPath: cfg.stateDir)
        if panel.runModal() == .OK, let url = panel.url {
            cfg.stateDir = url.path
            config = cfg
            persistConfig()
        }
    }

    func persistConfig() {
        guard let cfg = config else { return }
        do {
            try store.saveConfig(cfg)
            statusMessage = "Saved config.json"
        } catch {
            statusMessage = "Failed to save config: \(error.localizedDescription)"
        }
    }

    func saveControlSettings() {
        var next = controlSettings
        next.updatedAt = ConfigStore.nowIso()
        do {
            try store.saveControlSettings(next)
            controlSettings = next
            statusMessage = "Saved control panel settings"
        } catch {
            statusMessage = "Failed to save control settings: \(error.localizedDescription)"
        }
    }

    func applyScopeTextFields() {
        controlSettings.permission.allowedSubpaths = scopePathText
            .split(separator: "\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
        controlSettings.permission.allowedExtensions = scopeExtText
            .split(separator: "\n")
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() }
            .filter { !$0.isEmpty }
        saveControlSettings()
        refreshFileList()
    }

    func refreshFileList() {
        fileList.removeAll(keepingCapacity: true)
        selectedFile = nil
        selectedFileContent = ""

        let permission = controlSettings.permission
        guard permission.allowLocalStorageView else { return }

        fileListRefreshToken += 1
        let token = fileListRefreshToken

        DispatchQueue.global(qos: .userInitiated).async {
            let root = URL(fileURLWithPath: permission.storageDirectoryPath, isDirectory: true)
            guard self.fm.fileExists(atPath: root.path) else {
                DispatchQueue.main.async {
                    if token == self.fileListRefreshToken {
                        self.fileList = []
                    }
                }
                return
            }

            let prefixes = self.normalizedAllowedPrefixURLs(root: root, allowedSubpaths: permission.allowedSubpaths)
            let allowedExt = Set(permission.allowedExtensions.map { $0.lowercased() })
            let enumerator = self.fm.enumerator(
                at: root,
                includingPropertiesForKeys: [.isRegularFileKey, .isDirectoryKey],
                options: [.skipsHiddenFiles],
                errorHandler: nil
            )

            var nextFiles: [URL] = []
            var count = 0
            while let next = enumerator?.nextObject() as? URL {
                guard count < 2000 else { break }
                let values = try? next.resourceValues(forKeys: [.isRegularFileKey, .isDirectoryKey])
                if values?.isDirectory == true { continue }
                guard values?.isRegularFile == true else { continue }

                let ext = next.pathExtension.lowercased()
                if !allowedExt.isEmpty && !allowedExt.contains(ext) {
                    continue
                }
                if !prefixes.contains(where: { next.path.hasPrefix($0.path) }) {
                    continue
                }

                nextFiles.append(next)
                count += 1
            }

            nextFiles.sort { $0.path < $1.path }
            DispatchQueue.main.async {
                if token == self.fileListRefreshToken {
                    self.fileList = nextFiles
                }
            }
        }
    }

    func loadSelectedFile() {
        guard let selectedFile else {
            selectedFileContent = ""
            return
        }

        guard controlSettings.permission.allowLocalStorageView else {
            selectedFileContent = "Local file view permission is disabled."
            return
        }

        do {
            let data = try Data(contentsOf: selectedFile)
            if data.count > 2_000_000 {
                selectedFileContent = "File too large (\(data.count) bytes)."
                return
            }
            selectedFileContent = String(data: data, encoding: .utf8) ?? "(Binary file)"
        } catch {
            selectedFileContent = "Failed to read file: \(error.localizedDescription)"
        }
    }

    private func normalizedAllowedPrefixURLs(root: URL, allowedSubpaths: [String]) -> [URL] {
        let parts = allowedSubpaths
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }

        if parts.isEmpty {
            return [root]
        }

        return parts.map { segment in
            if segment.hasPrefix("/") {
                return URL(fileURLWithPath: segment)
            }
            return root.appendingPathComponent(segment)
        }
    }

    func loadSelectedPromptFile() {
        guard let entry = selectedPromptFile else {
            promptEditorText = ""
            promptEditorDirty = false
            return
        }

        let path = URL(fileURLWithPath: entry.path)
        if !fm.fileExists(atPath: path.path) {
            promptEditorText = ""
            promptEditorDirty = false
            return
        }

        do {
            promptEditorText = try String(contentsOf: path)
            promptEditorDirty = false
        } catch {
            promptEditorText = "Failed to read prompt file: \(error.localizedDescription)"
            promptEditorDirty = false
        }
    }

    func selectPromptFile(byId id: String?) {
        guard let id else {
            selectedPromptFile = nil
            promptEditorText = ""
            promptEditorDirty = false
            return
        }
        guard let match = controlSettings.promptFiles.first(where: { $0.id == id }) else {
            selectedPromptFile = nil
            promptEditorText = ""
            promptEditorDirty = false
            return
        }
        selectedPromptFile = match
        loadSelectedPromptFile()
    }

    func savePromptEditor() {
        guard let entry = selectedPromptFile else { return }
        let path = URL(fileURLWithPath: entry.path)
        do {
            try fm.createDirectory(at: path.deletingLastPathComponent(), withIntermediateDirectories: true)
            try promptEditorText.write(to: path, atomically: true, encoding: .utf8)
            promptEditorDirty = false
            statusMessage = "Saved prompt: \(entry.title)"
        } catch {
            statusMessage = "Failed to save prompt: \(error.localizedDescription)"
        }
    }

    func addPromptFile() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = true
        panel.canChooseDirectories = false
        panel.allowedContentTypes = [.plainText, UTType(filenameExtension: "md") ?? .plainText]
        panel.allowsMultipleSelection = false

        if panel.runModal() == .OK, let fileURL = panel.url {
            if let existing = controlSettings.promptFiles.first(where: { $0.path == fileURL.path }) {
                selectedPromptFile = existing
                loadSelectedPromptFile()
                statusMessage = "Prompt already exists. Selected existing entry."
                return
            }
            let title = fileURL.deletingPathExtension().lastPathComponent
            let entry = PromptFileEntry(id: UUID().uuidString, title: title, path: fileURL.path)
            controlSettings.promptFiles.append(entry)
            selectedPromptFile = entry
            saveControlSettings()
            loadSelectedPromptFile()
        }
    }

    func removeSelectedPromptFile() {
        guard let selectedPromptFile else { return }
        controlSettings.promptFiles.removeAll(where: { $0.id == selectedPromptFile.id })
        self.selectedPromptFile = controlSettings.promptFiles.first
        saveControlSettings()
        loadSelectedPromptFile()
    }

    func applyOnboardingToConfig() {
        guard var cfg = config else { return }

        guard onboardingConsentAccepted else {
            statusMessage = "Consent is required before onboarding can be saved."
            return
        }

        guard cfg.models[selectedModelProfile] != nil else {
            statusMessage = "Selected model profile is invalid."
            return
        }

        cfg.defaultModel = selectedModelProfile

        if !onboardingUseEnvKey {
            let trimmed = onboardingApiKeyInput.trimmingCharacters(in: .whitespacesAndNewlines)
            if trimmed.isEmpty {
                statusMessage = "API key cannot be empty when not using env variable."
                return
            }
            applyApiKeyByProvider(config: &cfg, selectedProfile: selectedModelProfile, apiKey: trimmed)
        }

        config = cfg
        persistConfig()

        var state = onboarding
        state.updatedAt = ConfigStore.nowIso()
        state.consentAcceptedAt = state.consentAcceptedAt ?? ConfigStore.nowIso()
        state.modelProfile = selectedModelProfile
        if let selected = cfg.models[selectedModelProfile] {
            state.modelProvider = providerLabel(baseURL: selected.baseUrl)
            state.apiKeyEnv = selected.apiKeyEnv
        }
        state.modelConfiguredAt = ConfigStore.nowIso()
        state.apiKeySource = onboardingUseEnvKey ? "env" : "config"
        state.apiKeyConfiguredAt = ConfigStore.nowIso()
        state.gmailLoginConfirmedAt = onboardingGmailDone ? ConfigStore.nowIso() : nil

        do {
            try store.saveOnboardingState(state)
            onboarding = state
            statusMessage = "Onboarding saved to state/onboarding.json"
        } catch {
            statusMessage = "Failed to save onboarding state: \(error.localizedDescription)"
        }
    }

    private func applyApiKeyByProvider(config: inout OpenPocketConfigFile, selectedProfile: String, apiKey: String) {
        guard let selected = config.models[selectedProfile] else { return }
        let providerHost = hostFromBaseURL(selected.baseUrl)

        for (profileKey, profile) in config.models {
            let sameProvider = hostFromBaseURL(profile.baseUrl) == providerHost || profile.apiKeyEnv == selected.apiKeyEnv
            if sameProvider {
                var next = profile
                next.apiKey = apiKey
                next.apiKeyEnv = selected.apiKeyEnv
                config.models[profileKey] = next
            }
        }
    }

    private func hostFromBaseURL(_ baseURL: String) -> String {
        guard let host = URL(string: baseURL)?.host else {
            return baseURL
        }
        return host.lowercased()
    }

    func providerLabel(baseURL: String) -> String {
        let lower = baseURL.lowercased()
        if lower.contains("api.openai.com") { return "OpenAI" }
        if lower.contains("openrouter.ai") { return "OpenRouter" }
        if lower.contains("api.z.ai") { return "AutoGLM" }
        if let host = URL(string: baseURL)?.host { return host }
        return "custom"
    }

    func envKeyStatusForSelectedModel() -> String {
        guard let cfg = config, let model = cfg.models[selectedModelProfile] else {
            return "Unknown"
        }

        let configKey = model.apiKey.trimmingCharacters(in: .whitespacesAndNewlines)
        let envName = model.apiKeyEnv
        let value = ProcessInfo.processInfo.environment[envName]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        if !configKey.isEmpty {
            if value.isEmpty {
                return "Credential source: config.json (detected, length \(configKey.count)). \(envName) is optional."
            }
            return "Credential source: config.json (detected, length \(configKey.count)). \(envName) also detected (length \(value.count))."
        }

        if !value.isEmpty {
            return "Credential source: \(envName) env var (detected, length \(value.count))."
        }
        return "No API key found in config.json or \(envName)."
    }

    func startGateway() {
        do {
            try bridge.startGateway(workingDir: repoRoot)
            gatewayRunning = true
        } catch {
            statusMessage = "Failed to start gateway: \(error.localizedDescription)"
        }
    }

    func stopGateway() {
        bridge.stopGateway()
        gatewayRunning = false
    }

    func runSingleCli(args: [String], logPrefix: String? = nil) {
        DispatchQueue.global(qos: .userInitiated).async {
            let result = self.bridge.runCommand(workingDir: self.repoRoot, args: args)
            DispatchQueue.main.async {
                if let logPrefix {
                    self.appendLog("\(logPrefix) exit=\(result.exitCode)")
                }
                if !result.stdout.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    self.appendLog(result.stdout.trimmingCharacters(in: .whitespacesAndNewlines))
                }
                if !result.stderr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    self.appendLog(result.stderr.trimmingCharacters(in: .whitespacesAndNewlines))
                }
                self.refreshEmulatorStatus()
            }
        }
    }

    func startEmulator() {
        runSingleCli(args: ["emulator", "start"], logPrefix: "[menu] emulator start")
    }

    func stopEmulator() {
        runSingleCli(args: ["emulator", "stop"], logPrefix: "[menu] emulator stop")
    }

    func hideEmulator() {
        runSingleCli(args: ["emulator", "hide"], logPrefix: "[menu] emulator hide")
    }

    func showEmulator() {
        runSingleCli(args: ["emulator", "show"], logPrefix: "[menu] emulator show")
    }

    func refreshEmulatorStatus() {
        emulatorStatusRefreshToken += 1
        let token = emulatorStatusRefreshToken
        emulatorStatusText = "Checking..."

        DispatchQueue.global(qos: .utility).async {
            let result = self.bridge.runCommand(workingDir: self.repoRoot, args: ["emulator", "status"])
            DispatchQueue.main.async {
                if token != self.emulatorStatusRefreshToken {
                    return
                }

                guard result.ok else {
                    self.emulatorStatusText = "Unknown"
                    return
                }

                guard let data = result.stdout.data(using: .utf8),
                      let parsed = try? JSONDecoder().decode(EmulatorStatusSnapshot.self, from: data) else {
                    self.emulatorStatusText = result.stdout.trimmingCharacters(in: .whitespacesAndNewlines)
                    return
                }

                if parsed.bootedDevices.isEmpty {
                    self.emulatorStatusText = "Stopped"
                } else {
                    self.emulatorStatusText = "Running (\(parsed.bootedDevices.joined(separator: ", ")))"
                }
            }
        }
    }

    func refreshEmulatorPreview() {
        if emulatorPreviewRefreshing {
            return
        }
        emulatorPreviewRefreshing = true
        emulatorPreviewStatusText = "Capturing preview..."

        let previewDir = paths.stateDir.appendingPathComponent("panel-preview", isDirectory: true)
        let previewPath = previewDir.appendingPathComponent("emulator-preview.png")

        DispatchQueue.global(qos: .utility).async {
            do {
                try self.fm.createDirectory(at: previewDir, withIntermediateDirectories: true)
            } catch {
                DispatchQueue.main.async {
                    self.emulatorPreviewRefreshing = false
                    self.emulatorPreviewStatusText = "Failed to create preview directory."
                }
                return
            }

            let result = self.bridge.runCommand(
                workingDir: self.repoRoot,
                args: ["emulator", "screenshot", "--out", previewPath.path],
                timeoutSec: 45
            )

            DispatchQueue.main.async {
                self.emulatorPreviewRefreshing = false

                guard result.ok else {
                    self.emulatorPreviewStatusText = "Preview capture failed."
                    if !result.stderr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        self.appendLog("[preview] \(result.stderr.trimmingCharacters(in: .whitespacesAndNewlines))")
                    }
                    return
                }

                guard self.fm.fileExists(atPath: previewPath.path),
                      let image = NSImage(contentsOf: previewPath) else {
                    self.emulatorPreviewStatusText = "Preview image is unavailable."
                    self.emulatorPreviewPixelSize = .zero
                    return
                }

                self.emulatorPreviewImage = image
                if let data = try? Data(contentsOf: previewPath),
                   let bitmap = NSBitmapImageRep(data: data) {
                    self.emulatorPreviewPixelSize = CGSize(
                        width: CGFloat(bitmap.pixelsWide),
                        height: CGFloat(bitmap.pixelsHigh)
                    )
                } else {
                    self.emulatorPreviewPixelSize = image.size
                }
                let formatter = DateFormatter()
                formatter.dateFormat = "HH:mm:ss"
                self.emulatorPreviewStatusText = "Updated at \(formatter.string(from: Date()))"
            }
        }
    }

    func sendEmulatorTap(x: Int, y: Int) {
        emulatorControlStatusText = "Sending tap (\(x), \(y))..."
        DispatchQueue.global(qos: .userInitiated).async {
            let result = self.bridge.runCommand(
                workingDir: self.repoRoot,
                args: ["emulator", "tap", "--x", String(x), "--y", String(y)],
                timeoutSec: 20
            )

            DispatchQueue.main.async {
                if result.ok {
                    self.emulatorControlStatusText = "Tap sent at (\(x), \(y))."
                    self.refreshEmulatorPreview()
                } else {
                    self.emulatorControlStatusText = "Tap failed."
                    if !result.stderr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        self.appendLog("[tap] \(result.stderr.trimmingCharacters(in: .whitespacesAndNewlines))")
                    }
                }
            }
        }
    }

    func sendEmulatorTextInput() {
        let raw = emulatorInputText
        if raw.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            emulatorControlStatusText = "Input text is empty."
            return
        }

        emulatorControlStatusText = "Sending text input..."
        DispatchQueue.global(qos: .userInitiated).async {
            let result = self.bridge.runCommand(
                workingDir: self.repoRoot,
                args: ["emulator", "type", "--text", raw],
                timeoutSec: 25
            )

            DispatchQueue.main.async {
                if result.ok {
                    self.emulatorControlStatusText = "Text input sent."
                    self.refreshEmulatorPreview()
                } else {
                    self.emulatorControlStatusText = "Text input failed."
                    if !result.stderr.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        self.appendLog("[type] \(result.stderr.trimmingCharacters(in: .whitespacesAndNewlines))")
                    }
                }
            }
        }
    }

    private func defaultPromptEntries(workspaceDir: URL) -> [PromptFileEntry] {
        let names = ["AGENTS", "SOUL", "USER", "IDENTITY", "TOOLS", "HEARTBEAT", "MEMORY"]
        return names.map { name in
            PromptFileEntry(id: name.lowercased(), title: name, path: workspaceDir.appendingPathComponent("\(name).md").path)
        }
    }

    private func normalizePromptFiles() {
        var seen = Set<String>()
        var normalized: [PromptFileEntry] = []
        for item in controlSettings.promptFiles {
            let cleanedPath = item.path.trimmingCharacters(in: .whitespacesAndNewlines)
            if cleanedPath.isEmpty {
                continue
            }

            var cleanedId = item.id.trimmingCharacters(in: .whitespacesAndNewlines)
            if cleanedId.isEmpty || seen.contains(cleanedId) {
                cleanedId = UUID().uuidString
            }

            let cleanedTitleRaw = item.title.trimmingCharacters(in: .whitespacesAndNewlines)
            let cleanedTitle = cleanedTitleRaw.isEmpty
                ? URL(fileURLWithPath: cleanedPath).deletingPathExtension().lastPathComponent
                : cleanedTitleRaw

            seen.insert(cleanedId)
            normalized.append(PromptFileEntry(id: cleanedId, title: cleanedTitle, path: cleanedPath))
        }

        if normalized.isEmpty, let cfg = config {
            normalized = defaultPromptEntries(workspaceDir: URL(fileURLWithPath: cfg.workspaceDir))
        }
        controlSettings.promptFiles = normalized
    }
}
