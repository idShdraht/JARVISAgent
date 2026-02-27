// swift-tools-version: 6.2
// Package manifest for the JARVIS macOS companion (menu bar app + IPC library).

import PackageDescription

let package = Package(
    name: "JARVIS",
    platforms: [
        .macOS(.v15),
    ],
    products: [
        .library(name: "JARVISIPC", targets: ["JARVISIPC"]),
        .library(name: "JARVISDiscovery", targets: ["JARVISDiscovery"]),
        .executable(name: "JARVIS", targets: ["JARVIS"]),
        .executable(name: "jarvis-mac", targets: ["JARVISMacCLI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/orchetect/MenuBarExtraAccess", exact: "1.2.2"),
        .package(url: "https://github.com/swiftlang/swift-subprocess.git", from: "0.1.0"),
        .package(url: "https://github.com/apple/swift-log.git", from: "1.8.0"),
        .package(url: "https://github.com/sparkle-project/Sparkle", from: "2.8.1"),
        .package(url: "https://github.com/steipete/Peekaboo.git", branch: "main"),
        .package(path: "../shared/JARVISKit"),
        .package(path: "../../Swabble"),
    ],
    targets: [
        .target(
            name: "JARVISIPC",
            dependencies: [],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "JARVISDiscovery",
            dependencies: [
                .product(name: "JARVISKit", package: "JARVISKit"),
            ],
            path: "Sources/JARVISDiscovery",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "JARVIS",
            dependencies: [
                "JARVISIPC",
                "JARVISDiscovery",
                .product(name: "JARVISKit", package: "JARVISKit"),
                .product(name: "JARVISChatUI", package: "JARVISKit"),
                .product(name: "JARVISProtocol", package: "JARVISKit"),
                .product(name: "SwabbleKit", package: "swabble"),
                .product(name: "MenuBarExtraAccess", package: "MenuBarExtraAccess"),
                .product(name: "Subprocess", package: "swift-subprocess"),
                .product(name: "Logging", package: "swift-log"),
                .product(name: "Sparkle", package: "Sparkle"),
                .product(name: "PeekabooBridge", package: "Peekaboo"),
                .product(name: "PeekabooAutomationKit", package: "Peekaboo"),
            ],
            exclude: [
                "Resources/Info.plist",
            ],
            resources: [
                .copy("Resources/JARVIS.icns"),
                .copy("Resources/DeviceModels"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .executableTarget(
            name: "JARVISMacCLI",
            dependencies: [
                "JARVISDiscovery",
                .product(name: "JARVISKit", package: "JARVISKit"),
                .product(name: "JARVISProtocol", package: "JARVISKit"),
            ],
            path: "Sources/JARVISMacCLI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "JARVISIPCTests",
            dependencies: [
                "JARVISIPC",
                "JARVIS",
                "JARVISDiscovery",
                .product(name: "JARVISProtocol", package: "JARVISKit"),
                .product(name: "SwabbleKit", package: "swabble"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
