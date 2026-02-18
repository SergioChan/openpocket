import AppKit
import SwiftUI

final class AppDelegate: NSObject, NSApplicationDelegate {
    private let controller = OpenPocketController()
    private var statusItem: NSStatusItem?
    private var controlPanelWindow: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildStatusItem()
        showControlPanelWindow()
    }

    func applicationWillTerminate(_ notification: Notification) {
        controller.stopGateway()
    }

    private func buildStatusItem() {
        let item = NSStatusBar.system.statusItem(withLength: NSStatusItem.squareLength)
        let primary = NSImage(systemSymbolName: "iphone.gen3.radiowaves.left.and.right", accessibilityDescription: "OpenPocket")
        let fallback = NSImage(systemSymbolName: "iphone", accessibilityDescription: "OpenPocket")
        if let image = primary ?? fallback {
            image.isTemplate = true
            item.button?.image = image
        } else {
            item.button?.title = "OD"
        }
        item.button?.toolTip = "OpenPocket"

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
