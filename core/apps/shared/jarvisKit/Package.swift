// swift-tools-version: 6.2

import PackageDescription

let package = Package(
    name: "JARVISKit",
    platforms: [
        .iOS(.v18),
        .macOS(.v15),
    ],
    products: [
        .library(name: "JARVISProtocol", targets: ["JARVISProtocol"]),
        .library(name: "JARVISKit", targets: ["JARVISKit"]),
        .library(name: "JARVISChatUI", targets: ["JARVISChatUI"]),
    ],
    dependencies: [
        .package(url: "https://github.com/steipete/ElevenLabsKit", exact: "0.1.0"),
        .package(url: "https://github.com/gonzalezreal/textual", exact: "0.3.1"),
    ],
    targets: [
        .target(
            name: "JARVISProtocol",
            path: "Sources/JARVISProtocol",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "JARVISKit",
            dependencies: [
                "JARVISProtocol",
                .product(name: "ElevenLabsKit", package: "ElevenLabsKit"),
            ],
            path: "Sources/JARVISKit",
            resources: [
                .process("Resources"),
            ],
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .target(
            name: "JARVISChatUI",
            dependencies: [
                "JARVISKit",
                .product(
                    name: "Textual",
                    package: "textual",
                    condition: .when(platforms: [.macOS, .iOS])),
            ],
            path: "Sources/JARVISChatUI",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
            ]),
        .testTarget(
            name: "JARVISKitTests",
            dependencies: ["JARVISKit", "JARVISChatUI"],
            path: "Tests/JARVISKitTests",
            swiftSettings: [
                .enableUpcomingFeature("StrictConcurrency"),
                .enableExperimentalFeature("SwiftTesting"),
            ]),
    ])
