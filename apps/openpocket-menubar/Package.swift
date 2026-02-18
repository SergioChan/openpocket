// swift-tools-version: 5.9
import PackageDescription
let sdkRoot = "/Applications/Xcode.app/Contents/Developer/Platforms/MacOSX.platform/Developer/SDKs/MacOSX.sdk"

let package = Package(
    name: "OpenPocketMenuBar",
    platforms: [
        .macOS(.v13),
    ],
    products: [
        .executable(name: "OpenPocketMenuBar", targets: ["OpenPocketMenuBar"]),
    ],
    targets: [
        .executableTarget(
            name: "OpenPocketMenuBar",
            path: "Sources/OpenPocketMenuBar",
            swiftSettings: [
                .unsafeFlags([
                    "-Xcc",
                    "-isysroot",
                    "-Xcc",
                    sdkRoot,
                ]),
            ]
        ),
    ]
)
