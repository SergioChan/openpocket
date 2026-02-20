import Foundation

struct CommandResult {
    let exitCode: Int32
    let stdout: String
    let stderr: String

    var ok: Bool { exitCode == 0 }
}

final class RuntimeBridge {
    private var gatewayProcess: Process?
    private var gatewayStdoutPipe: Pipe?
    private var gatewayStderrPipe: Pipe?

    var onGatewayLogLine: ((String) -> Void)?
    var onGatewayExit: ((Int32) -> Void)?

    func isGatewayRunning() -> Bool {
        gatewayProcess?.isRunning == true
    }

    func startGateway(workingDir: URL) throws {
        if isGatewayRunning() {
            return
        }

        let (execPath, args) = try resolveOpenPocketExecutable(workingDir: workingDir)
        let process = Process()
        process.executableURL = execPath
        process.arguments = args + ["gateway", "start"]
        process.currentDirectoryURL = workingDir

        let out = Pipe()
        let err = Pipe()
        process.standardOutput = out
        process.standardError = err

        out.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
            self?.emitGatewayLines(text)
        }
        err.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let text = String(data: data, encoding: .utf8) else { return }
            self?.emitGatewayLines(text)
        }

        process.terminationHandler = { [weak self] proc in
            DispatchQueue.main.async {
                self?.gatewayStdoutPipe?.fileHandleForReading.readabilityHandler = nil
                self?.gatewayStderrPipe?.fileHandleForReading.readabilityHandler = nil
                self?.gatewayProcess = nil
                self?.gatewayStdoutPipe = nil
                self?.gatewayStderrPipe = nil
                self?.onGatewayExit?(proc.terminationStatus)
            }
        }

        try process.run()
        gatewayProcess = process
        gatewayStdoutPipe = out
        gatewayStderrPipe = err
        onGatewayLogLine?("[OpenPocket][menubar] gateway process started pid=\(process.processIdentifier)")
    }

    func stopGateway() {
        guard let process = gatewayProcess, process.isRunning else {
            return
        }
        process.terminate()
    }

    func runCommand(workingDir: URL, args: [String], timeoutSec: Int = 120) -> CommandResult {
        do {
            let (execPath, execArgs) = try resolveOpenPocketExecutable(workingDir: workingDir)
            let process = Process()
            process.executableURL = execPath
            process.arguments = execArgs + args
            process.currentDirectoryURL = workingDir

            let out = Pipe()
            let err = Pipe()
            process.standardOutput = out
            process.standardError = err

            try process.run()

            let deadline = Date().addingTimeInterval(TimeInterval(timeoutSec))
            while process.isRunning && Date() < deadline {
                Thread.sleep(forTimeInterval: 0.1)
            }
            if process.isRunning {
                process.terminate()
            }

            let stdoutData = out.fileHandleForReading.readDataToEndOfFile()
            let stderrData = err.fileHandleForReading.readDataToEndOfFile()
            return CommandResult(
                exitCode: process.terminationStatus,
                stdout: String(data: stdoutData, encoding: .utf8) ?? "",
                stderr: String(data: stderrData, encoding: .utf8) ?? ""
            )
        } catch {
            return CommandResult(
                exitCode: 1,
                stdout: "",
                stderr: "Failed to run command: \(error.localizedDescription)"
            )
        }
    }

    private func emitGatewayLines(_ chunk: String) {
        let lines = chunk
            .replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .split(separator: "\n", omittingEmptySubsequences: false)
            .map(String.init)
        for line in lines where !line.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            DispatchQueue.main.async {
                self.onGatewayLogLine?(line)
            }
        }
    }

    private func resolveOpenPocketExecutable(workingDir: URL) throws -> (URL, [String]) {
        let fm = FileManager.default
        let env = ProcessInfo.processInfo.environment
        var searched: [String] = []

        func trimmedEnv(_ name: String) -> String? {
            let raw = env[name]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            return raw.isEmpty ? nil : raw
        }

        func resolvePath(_ raw: String) -> String {
            if raw.hasPrefix("~/") {
                return (raw as NSString).expandingTildeInPath
            }
            return raw
        }

        func appendUnique(_ value: String, to list: inout [String]) {
            if !list.contains(value) {
                list.append(value)
            }
        }

        func pickExecutable(_ rawPath: String?) -> URL? {
            guard let rawPath else {
                return nil
            }
            let resolved = resolvePath(rawPath)
            appendUnique(resolved, to: &searched)
            if fm.isExecutableFile(atPath: resolved) {
                return URL(fileURLWithPath: resolved)
            }
            return nil
        }

        func pickNodeScript(_ rawPath: String?) -> (URL, [String])? {
            guard let rawPath else {
                return nil
            }
            let resolved = resolvePath(rawPath)
            appendUnique(resolved, to: &searched)
            guard fm.fileExists(atPath: resolved) else {
                return nil
            }
            return (URL(fileURLWithPath: "/usr/bin/env"), ["node", resolved])
        }

        let homeDir = FileManager.default.homeDirectoryForCurrentUser.path
        let envRepoRoot = trimmedEnv("OPENPOCKET_REPO_ROOT")
        let envCliPath = trimmedEnv("OPENPOCKET_CLI_PATH")

        if let explicit = pickExecutable(envCliPath) {
            return (explicit, [])
        }
        if let explicitNode = pickNodeScript(envCliPath), envCliPath?.lowercased().hasSuffix(".js") == true {
            return explicitNode
        }

        if let localLauncher = pickExecutable(workingDir.appendingPathComponent("openpocket").path) {
            return (localLauncher, [])
        }
        if let repoRoot = envRepoRoot {
            let repoLauncher = URL(fileURLWithPath: resolvePath(repoRoot)).appendingPathComponent("openpocket").path
            if let launcher = pickExecutable(repoLauncher) {
                return (launcher, [])
            }
        }

        var searchDirs: [String] = []
        let envPath = env["PATH"] ?? ""
        for segment in envPath.split(separator: ":").map(String.init) where !segment.isEmpty {
            appendUnique(segment, to: &searchDirs)
        }
        ["/opt/homebrew/bin", "/usr/local/bin", "\(homeDir)/.local/bin", "\(homeDir)/bin"]
            .forEach { appendUnique($0, to: &searchDirs) }

        for dir in searchDirs {
            if let found = pickExecutable(URL(fileURLWithPath: resolvePath(dir)).appendingPathComponent("openpocket").path) {
                return (found, [])
            }
        }

        var distCandidates: [String] = [workingDir.appendingPathComponent("dist/cli.js").path]
        if let repoRoot = envRepoRoot {
            distCandidates.append(
                URL(fileURLWithPath: resolvePath(repoRoot))
                    .appendingPathComponent("dist/cli.js")
                    .path
            )
        }
        for distPath in distCandidates {
            if let nodeRunner = pickNodeScript(distPath) {
                return nodeRunner
            }
        }

        throw NSError(domain: "OpenPocketMenuBar", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "Could not resolve OpenPocket CLI executable. Checked: \(searched.joined(separator: ", "))"
        ])
    }
}
