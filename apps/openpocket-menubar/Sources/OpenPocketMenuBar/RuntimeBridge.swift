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

        let (execPath, args) = try resolveOpendroidExecutable(workingDir: workingDir)
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
            let (execPath, execArgs) = try resolveOpendroidExecutable(workingDir: workingDir)
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

    private func resolveOpendroidExecutable(workingDir: URL) throws -> (URL, [String]) {
        let envPath = ProcessInfo.processInfo.environment["PATH"] ?? ""
        let candidates = envPath
            .split(separator: ":")
            .map(String.init)
            .map { URL(fileURLWithPath: $0).appendingPathComponent("openpocket") }

        let fm = FileManager.default
        if let found = candidates.first(where: { fm.isExecutableFile(atPath: $0.path) }) {
            return (found, [])
        }

        let repoRoot = workingDir
        let distCli = repoRoot.appendingPathComponent("dist/cli.js")
        if fm.fileExists(atPath: distCli.path) {
            return (URL(fileURLWithPath: "/usr/bin/env"), ["node", distCli.path])
        }

        throw NSError(domain: "OpenPocketMenuBar", code: 1, userInfo: [
            NSLocalizedDescriptionKey: "Could not find `openpocket` in PATH and `dist/cli.js` was not found at \(distCli.path)."
        ])
    }
}
