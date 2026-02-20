import AppKit

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.accessory)

// IMPORTANT: NSApplication.delegate is a WEAK reference.
// Without withExtendedLifetime, Swift's ARC optimizer may release
// the delegate before applicationDidFinishLaunching fires, causing
// the status bar item to never be created.
withExtendedLifetime(delegate) {
    app.run()
}
