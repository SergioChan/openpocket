import SwiftUI
import AppKit

struct ControlPanelView: View {
    @EnvironmentObject private var controller: OpenPocketController
    @State private var selectedTab: PanelTab = .runtime

    var body: some View {
        VStack(spacing: 0) {
            headerBar
            Divider()
            HStack(spacing: 0) {
                sidebar
                Divider()
                content
            }
            Divider()
            footerBar
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private var headerBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 4) {
                Text("OpenPocket")
                    .font(.system(size: 24, weight: .semibold))
                Text("Local Android agent control panel")
                    .foregroundStyle(.secondary)
            }
            Spacer()
            StatusBadge(title: controller.gatewayRunning ? "Gateway Running" : "Gateway Stopped", active: controller.gatewayRunning)
            StatusBadge(title: controller.emulatorStatusText, active: controller.emulatorStatusText.lowercased().contains("running"))
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 14)
        .background(Color(nsColor: .windowBackgroundColor))
    }

    private var sidebar: some View {
        VStack(alignment: .leading, spacing: 12) {
            ForEach(PanelTab.allCases) { tab in
                Button {
                    selectedTab = tab
                } label: {
                    HStack(spacing: 10) {
                        Image(systemName: tab.icon)
                            .frame(width: 16)
                        Text(tab.rawValue)
                            .font(.system(size: 14, weight: selectedTab == tab ? .semibold : .regular))
                        Spacer(minLength: 0)
                    }
                    .padding(.vertical, 8)
                    .padding(.horizontal, 10)
                    .contentShape(Rectangle())
                    .background(selectedTab == tab ? Color(nsColor: .controlBackgroundColor) : Color.clear)
                    .clipShape(RoundedRectangle(cornerRadius: 6, style: .continuous))
                }
                .buttonStyle(.plain)
            }

            Spacer(minLength: 0)

            HStack {
                Button("Reload") {
                    controller.loadAll()
                }
                .buttonStyle(.bordered)
                Spacer()
            }
        }
        .frame(width: 220)
        .padding(12)
        .background(Color(nsColor: .underPageBackgroundColor))
    }

    @ViewBuilder
    private var content: some View {
        switch selectedTab {
        case .runtime:
            RuntimeTabView()
        case .onboarding:
            OnboardingTabView()
        case .permissions:
            PermissionTabView()
        case .prompts:
            PromptTabView()
        case .logs:
            LogsTabView()
        }
    }

    private var footerBar: some View {
        HStack {
            Text(controller.statusMessage)
                .font(.system(size: 12))
                .foregroundStyle(.secondary)
                .lineLimit(2)
            Spacer()
            Text("Config: \(controller.paths.configPath.path)")
                .font(.system(size: 11))
                .foregroundStyle(.tertiary)
                .lineLimit(1)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 8)
    }
}

private enum PanelTab: String, CaseIterable, Identifiable {
    case runtime = "Runtime"
    case onboarding = "Onboarding"
    case permissions = "Permissions"
    case prompts = "Agent Prompts"
    case logs = "Logs"

    var id: String { rawValue }

    var icon: String {
        switch self {
        case .runtime: return "play.circle"
        case .onboarding: return "list.clipboard"
        case .permissions: return "lock.shield"
        case .prompts: return "doc.text"
        case .logs: return "terminal"
        }
    }
}

private struct StatusBadge: View {
    let title: String
    let active: Bool

    var body: some View {
        Text(title)
            .font(.system(size: 12, weight: .medium))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(active ? Color.green.opacity(0.18) : Color.gray.opacity(0.18))
            .clipShape(Capsule())
    }
}

private struct RuntimeTabView: View {
    @EnvironmentObject private var controller: OpenPocketController
    private let previewTicker = Timer.publish(every: 2.0, on: .main, in: .common).autoconnect()

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                GroupBox("Gateway") {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Run Telegram gateway in the background and stream runtime logs to this control panel.")
                            .foregroundStyle(.secondary)
                        HStack {
                            Button("Start Gateway") {
                                controller.startGateway()
                            }
                            .buttonStyle(.borderedProminent)

                            Button("Stop Gateway") {
                                controller.stopGateway()
                            }
                            .buttonStyle(.bordered)

                            if controller.gatewayRunning {
                                Text("Running")
                                    .foregroundStyle(.green)
                            } else {
                                Text("Stopped")
                                    .foregroundStyle(.secondary)
                            }
                        }
                    }
                    .padding(10)
                }

                GroupBox("Android Emulator") {
                    VStack(alignment: .leading, spacing: 12) {
                        Text("Control emulator lifecycle and visibility while agent tasks continue in background.")
                            .foregroundStyle(.secondary)

                        HStack {
                            Button("Start") { controller.startEmulator() }
                            Button("Stop") { controller.stopEmulator() }
                            Button("Show") { controller.showEmulator() }
                            Button("Hide") { controller.hideEmulator() }
                            Button("Refresh Status") { controller.refreshEmulatorStatus() }
                        }
                        .buttonStyle(.bordered)

                        Text("Status: \(controller.emulatorStatusText)")
                            .font(.system(size: 13, weight: .medium))
                    }
                    .padding(10)
                }

                GroupBox("Emulator Screen Preview") {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 12) {
                            Button("Refresh Preview") {
                                controller.refreshEmulatorPreview()
                            }
                            .buttonStyle(.bordered)

                            Toggle("Auto refresh (2s)", isOn: $controller.emulatorPreviewAutoRefresh)
                                .toggleStyle(.switch)

                            Text(controller.emulatorPreviewStatusText)
                                .font(.system(size: 12))
                                .foregroundStyle(.secondary)
                        }

                        ZStack {
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .fill(Color.black.opacity(0.88))

                            if let image = controller.emulatorPreviewImage {
                                Image(nsImage: image)
                                    .resizable()
                                    .scaledToFit()
                                    .padding(10)
                            } else {
                                Text("Preview unavailable. Start emulator and click Refresh Preview.")
                                    .foregroundStyle(.white.opacity(0.82))
                                    .font(.system(size: 12))
                                    .padding()
                            }
                        }
                        .frame(maxWidth: .infinity, minHeight: 240, maxHeight: 360)
                    }
                    .padding(10)
                }

                GroupBox("Core Paths") {
                    VStack(alignment: .leading, spacing: 12) {
                        if let cfg = controller.config {
                            HStack {
                                Text("Workspace")
                                    .frame(width: 90, alignment: .leading)
                                TextField("Workspace", text: Binding(
                                    get: { cfg.workspaceDir },
                                    set: { value in
                                        var next = cfg
                                        next.workspaceDir = value
                                        controller.config = next
                                    }
                                ))
                                Button("Browse") { controller.chooseWorkspaceDirectoryForConfig() }
                            }

                            HStack {
                                Text("State")
                                    .frame(width: 90, alignment: .leading)
                                TextField("State", text: Binding(
                                    get: { cfg.stateDir },
                                    set: { value in
                                        var next = cfg
                                        next.stateDir = value
                                        controller.config = next
                                    }
                                ))
                                Button("Browse") { controller.chooseStateDirectoryForConfig() }
                            }

                            Button("Save Config") {
                                controller.persistConfig()
                            }
                            .buttonStyle(.borderedProminent)
                        } else {
                            Text("Config is not available. Run `openpocket init` first.")
                                .foregroundStyle(.secondary)
                        }
                    }
                    .padding(10)
                }
            }
            .padding(20)
        }
        .onReceive(previewTicker) { _ in
            if controller.emulatorPreviewAutoRefresh {
                controller.refreshEmulatorPreview()
            }
        }
    }
}

private struct OnboardingTabView: View {
    @EnvironmentObject private var controller: OpenPocketController

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                GroupBox("User Consent") {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("All emulator data and runtime files are stored locally by default. If you use cloud model APIs, task text and screenshots may be sent to your model provider.")
                            .foregroundStyle(.secondary)
                        Toggle("I accept local automation and data handling terms.", isOn: $controller.onboardingConsentAccepted)
                    }
                    .padding(10)
                }

                GroupBox("Model Selection") {
                    VStack(alignment: .leading, spacing: 10) {
                        if let cfg = controller.config {
                            Picker("Default Model", selection: $controller.selectedModelProfile) {
                                ForEach(cfg.models.keys.sorted(), id: \.self) { key in
                                    let profile = cfg.models[key]!
                                    Text("\(key) (\(controller.providerLabel(baseURL: profile.baseUrl)))").tag(key)
                                }
                            }
                            .pickerStyle(.menu)

                            if let profile = cfg.models[controller.selectedModelProfile] {
                                Text("Model ID: \(profile.model)")
                                Text("Provider API env: \(profile.apiKeyEnv)")
                                Text(controller.envKeyStatusForSelectedModel())
                                    .foregroundStyle(.secondary)
                            }
                        } else {
                            Text("Config not loaded.")
                        }
                    }
                    .padding(10)
                }

                GroupBox("API Key Setup") {
                    VStack(alignment: .leading, spacing: 10) {
                        Toggle("Use environment variable for API key", isOn: $controller.onboardingUseEnvKey)
                        if !controller.onboardingUseEnvKey {
                            SecureField("Paste API key", text: $controller.onboardingApiKeyInput)
                                .textFieldStyle(.roundedBorder)
                        }
                    }
                    .padding(10)
                }

                GroupBox("Play Store Login") {
                    VStack(alignment: .leading, spacing: 10) {
                        Text("Use the runtime tab to start/show emulator, then manually sign in to Gmail on Play Store.")
                            .foregroundStyle(.secondary)
                        Toggle("I finished Gmail sign-in and verified Play Store access.", isOn: $controller.onboardingGmailDone)
                    }
                    .padding(10)
                }

                HStack {
                    Button("Save Onboarding to Config + State") {
                        controller.applyOnboardingToConfig()
                    }
                    .buttonStyle(.borderedProminent)

                    Button("Start Emulator") {
                        controller.startEmulator()
                    }
                    .buttonStyle(.bordered)

                    Button("Show Emulator") {
                        controller.showEmulator()
                    }
                    .buttonStyle(.bordered)
                }
            }
            .padding(20)
        }
    }
}

private struct PermissionTabView: View {
    @EnvironmentObject private var controller: OpenPocketController

    var body: some View {
        HStack(spacing: 14) {
            VStack(alignment: .leading, spacing: 16) {
                GroupBox("File Access Permissions") {
                    VStack(alignment: .leading, spacing: 12) {
                        Toggle("Allow local storage file view in control panel", isOn: Binding(
                            get: { controller.controlSettings.permission.allowLocalStorageView },
                            set: { value in
                                controller.controlSettings.permission.allowLocalStorageView = value
                                controller.saveControlSettings()
                                controller.refreshFileList()
                            }
                        ))

                        HStack {
                            Text("Storage root")
                                .frame(width: 90, alignment: .leading)
                            TextField("Storage directory", text: Binding(
                                get: { controller.controlSettings.permission.storageDirectoryPath },
                                set: { value in controller.controlSettings.permission.storageDirectoryPath = value }
                            ))
                            Button("Browse") { controller.chooseStorageDirectory() }
                            Button("Save") {
                                controller.saveControlSettings()
                                controller.refreshFileList()
                            }
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            Text("Allowed subpath scope (one per line)")
                                .font(.system(size: 12, weight: .medium))
                            TextEditor(text: $controller.scopePathText)
                                .font(.system(size: 12, design: .monospaced))
                                .frame(minHeight: 90)
                                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.2)))
                        }

                        VStack(alignment: .leading, spacing: 6) {
                            Text("Allowed file extensions (one per line)")
                                .font(.system(size: 12, weight: .medium))
                            TextEditor(text: $controller.scopeExtText)
                                .font(.system(size: 12, design: .monospaced))
                                .frame(minHeight: 90)
                                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.2)))
                        }

                        Button("Apply Scope") {
                            controller.applyScopeTextFields()
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    .padding(10)
                }

                Spacer()
            }
            .frame(minWidth: 520)

            GroupBox("Scoped File Viewer") {
                VStack(spacing: 10) {
                    HStack {
                        Button("Refresh") { controller.refreshFileList() }
                        Text("\(controller.fileList.count) files")
                            .foregroundStyle(.secondary)
                        Spacer()
                    }

                    HStack(spacing: 8) {
                        List(selection: Binding(
                            get: { controller.selectedFile },
                            set: { value in
                                controller.selectedFile = value
                                controller.loadSelectedFile()
                            }
                        )) {
                            ForEach(controller.fileList, id: \.path) { file in
                                Text(file.path)
                                    .font(.system(size: 11, design: .monospaced))
                                    .lineLimit(1)
                            }
                        }
                        .frame(minWidth: 260)

                        TextEditor(text: Binding(
                            get: { controller.selectedFileContent },
                            set: { _ in }
                        ))
                        .font(.system(size: 12, design: .monospaced))
                        .frame(minWidth: 320)
                        .disabled(true)
                    }
                }
                .padding(10)
            }
        }
        .padding(20)
    }
}

private struct PromptTabView: View {
    @EnvironmentObject private var controller: OpenPocketController

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Button("Add Prompt File") { controller.addPromptFile() }
                    Button("Remove") { controller.removeSelectedPromptFile() }
                        .disabled(controller.selectedPromptFile == nil)
                }

                List(selection: Binding(
                    get: { controller.selectedPromptFile?.id },
                    set: { value in
                        controller.selectPromptFile(byId: value)
                    }
                )) {
                    ForEach(controller.controlSettings.promptFiles, id: \.id) { item in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(item.title)
                            Text(item.path)
                                .font(.system(size: 11))
                                .foregroundStyle(.secondary)
                        }
                        .tag(Optional(item.id))
                    }
                }
                .frame(minWidth: 300)
            }

            VStack(alignment: .leading, spacing: 10) {
                HStack {
                    Text(controller.selectedPromptFile?.title ?? "No prompt selected")
                        .font(.headline)
                    Spacer()
                    Button("Reload") { controller.loadSelectedPromptFile() }
                    Button("Save") { controller.savePromptEditor() }
                        .buttonStyle(.borderedProminent)
                        .disabled(controller.selectedPromptFile == nil)
                }

                TextEditor(text: Binding(
                    get: { controller.promptEditorText },
                    set: { value in
                        controller.promptEditorText = value
                        controller.promptEditorDirty = true
                    }
                ))
                .font(.system(size: 13, design: .monospaced))
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Color.secondary.opacity(0.2)))
            }
        }
        .padding(20)
    }
}

private struct LogsTabView: View {
    @EnvironmentObject private var controller: OpenPocketController

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Button("Clear") { controller.clearLogs() }
                Spacer()
                Text("\(controller.logLines.count) lines")
                    .foregroundStyle(.secondary)
            }

            ScrollView {
                LazyVStack(alignment: .leading, spacing: 3) {
                    ForEach(Array(controller.logLines.enumerated()), id: \.offset) { _, line in
                        Text(line)
                            .font(.system(size: 12, design: .monospaced))
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(8)
            }
            .background(Color.black.opacity(0.88))
            .foregroundStyle(Color.green)
            .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
        }
        .padding(20)
    }
}
