import AppKit
import SwiftUI

final class AppDelegate: NSObject, NSApplicationDelegate {
    private let controller = OpenPocketController()
    private var statusItem: NSStatusItem?
    private var controlPanelWindow: NSWindow?
    private var statusItemRepairTimer: Timer?

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildStatusItem()
        scheduleStatusItemRepair()
    }

    func applicationWillTerminate(_ notification: Notification) {
        statusItemRepairTimer?.invalidate()
        statusItemRepairTimer = nil
        controller.stopGateway(managedOnly: true)
    }

    private func buildStatusItem() {
        if let existing = statusItem {
            NSStatusBar.system.removeStatusItem(existing)
            statusItem = nil
        }

        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.variableLength)
        let primary = NSImage(systemSymbolName: "iphone.gen3.radiowaves.left.and.right", accessibilityDescription: "OpenPocket")
        let fallback = NSImage(systemSymbolName: "iphone", accessibilityDescription: "OpenPocket")
        item.button?.image = nil
        item.button?.title = " OP"
        item.button?.font = NSFont.monospacedSystemFont(ofSize: 11, weight: .semibold)
        item.button?.toolTip = "OpenPocket"
        if let image = primary ?? fallback {
            image.isTemplate = true
            item.button?.image = image
            item.button?.imagePosition = .imageLeading
        } else {
            item.button?.imagePosition = .noImage
        }
        item.isVisible = true

        let menu = NSMenu()

        menu.addItem(NSMenuItem(title: "Open Control Panel", action: #selector(openControlPanel), keyEquivalent: "o"))
        menu.addItem(NSMenuItem.separator())

        menu.addItem(NSMenuItem(title: "Start Gateway", action: #selector(startGateway), keyEquivalent: "g"))
        menu.addItem(NSMenuItem(title: "Stop Gateway", action: #selector(stopGateway), keyEquivalent: "k"))
        menu.addItem(NSMenuItem.separator())

        menu.addItem(NSMenuItem(title: "Start Emulator", action: #selector(startEmulator), keyEquivalent: "s"))
        menu.addItem(NSMenuItem(title: "Stop Emulator", action: #selector(stopEmulator), keyEquivalent: "x"))
        menu.addItem(NSMenuItem(title: "Show Emulator", action: #selector(showEmulator), keyEquivalent: "u"))
        menu.addItem(NSMenuItem(title: "Hide Emulator", action: #selector(hideEmulator), keyEquivalent: "h"))
        menu.addItem(NSMenuItem.separator())

        menu.addItem(NSMenuItem(title: "Quit OpenPocket", action: #selector(quit), keyEquivalent: "q"))

        for item in menu.items {
            item.target = self
        }

        item.menu = menu
        statusItem = item
    }

    private func scheduleStatusItemRepair() {
        statusItemRepairTimer?.invalidate()
        statusItemRepairTimer = Timer.scheduledTimer(withTimeInterval: 5.0, repeats: true) { [weak self] _ in
            self?.ensureStatusItemVisible()
        }
    }

    private func ensureStatusItemVisible() {
        guard let item = statusItem else {
            buildStatusItem()
            return
        }
        if item.button == nil {
            buildStatusItem()
            return
        }
        item.button?.title = " OP"
        item.isVisible = true
    }

    @objc private func openControlPanel() {
        showControlPanelWindow()
    }

    @objc private func startGateway() {
        controller.startGateway()
    }

    @objc private func stopGateway() {
        controller.stopGateway()
    }

    @objc private func startEmulator() {
        controller.startEmulator()
    }

    @objc private func stopEmulator() {
        controller.stopEmulator()
    }

    @objc private func showEmulator() {
        controller.showEmulator()
    }

    @objc private func hideEmulator() {
        controller.hideEmulator()
    }

    @objc private func quit() {
        NSApp.terminate(nil)
    }

    private func showControlPanelWindow() {
        if let window = controlPanelWindow {
            NSApp.activate(ignoringOtherApps: true)
            window.makeKeyAndOrderFront(nil)
            return
        }

        let root = ControlPanelView()
            .environmentObject(controller)

        let host = NSHostingController(rootView: root)
        let window = NSWindow(contentViewController: host)
        window.identifier = NSUserInterfaceItemIdentifier("openpocket-control-panel")
        window.setContentSize(NSSize(width: 1180, height: 780))
        window.minSize = NSSize(width: 980, height: 700)
        window.title = "OpenPocket Control Panel"
        window.styleMask = [.titled, .closable, .resizable, .miniaturizable]
        window.isReleasedWhenClosed = false
        window.center()

        controlPanelWindow = window

        NSApp.activate(ignoringOtherApps: true)
        window.makeKeyAndOrderFront(nil)
    }
}
