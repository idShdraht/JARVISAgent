import Foundation

public enum JARVISDeviceCommand: String, Codable, Sendable {
    case status = "device.status"
    case info = "device.info"
}

public enum JARVISBatteryState: String, Codable, Sendable {
    case unknown
    case unplugged
    case charging
    case full
}

public enum JARVISThermalState: String, Codable, Sendable {
    case nominal
    case fair
    case serious
    case critical
}

public enum JARVISNetworkPathStatus: String, Codable, Sendable {
    case satisfied
    case unsatisfied
    case requiresConnection
}

public enum JARVISNetworkInterfaceType: String, Codable, Sendable {
    case wifi
    case cellular
    case wired
    case other
}

public struct JARVISBatteryStatusPayload: Codable, Sendable, Equatable {
    public var level: Double?
    public var state: JARVISBatteryState
    public var lowPowerModeEnabled: Bool

    public init(level: Double?, state: JARVISBatteryState, lowPowerModeEnabled: Bool) {
        self.level = level
        self.state = state
        self.lowPowerModeEnabled = lowPowerModeEnabled
    }
}

public struct JARVISThermalStatusPayload: Codable, Sendable, Equatable {
    public var state: JARVISThermalState

    public init(state: JARVISThermalState) {
        self.state = state
    }
}

public struct JARVISStorageStatusPayload: Codable, Sendable, Equatable {
    public var totalBytes: Int64
    public var freeBytes: Int64
    public var usedBytes: Int64

    public init(totalBytes: Int64, freeBytes: Int64, usedBytes: Int64) {
        self.totalBytes = totalBytes
        self.freeBytes = freeBytes
        self.usedBytes = usedBytes
    }
}

public struct JARVISNetworkStatusPayload: Codable, Sendable, Equatable {
    public var status: JARVISNetworkPathStatus
    public var isExpensive: Bool
    public var isConstrained: Bool
    public var interfaces: [JARVISNetworkInterfaceType]

    public init(
        status: JARVISNetworkPathStatus,
        isExpensive: Bool,
        isConstrained: Bool,
        interfaces: [JARVISNetworkInterfaceType])
    {
        self.status = status
        self.isExpensive = isExpensive
        self.isConstrained = isConstrained
        self.interfaces = interfaces
    }
}

public struct JARVISDeviceStatusPayload: Codable, Sendable, Equatable {
    public var battery: JARVISBatteryStatusPayload
    public var thermal: JARVISThermalStatusPayload
    public var storage: JARVISStorageStatusPayload
    public var network: JARVISNetworkStatusPayload
    public var uptimeSeconds: Double

    public init(
        battery: JARVISBatteryStatusPayload,
        thermal: JARVISThermalStatusPayload,
        storage: JARVISStorageStatusPayload,
        network: JARVISNetworkStatusPayload,
        uptimeSeconds: Double)
    {
        self.battery = battery
        self.thermal = thermal
        self.storage = storage
        self.network = network
        self.uptimeSeconds = uptimeSeconds
    }
}

public struct JARVISDeviceInfoPayload: Codable, Sendable, Equatable {
    public var deviceName: String
    public var modelIdentifier: String
    public var systemName: String
    public var systemVersion: String
    public var appVersion: String
    public var appBuild: String
    public var locale: String

    public init(
        deviceName: String,
        modelIdentifier: String,
        systemName: String,
        systemVersion: String,
        appVersion: String,
        appBuild: String,
        locale: String)
    {
        self.deviceName = deviceName
        self.modelIdentifier = modelIdentifier
        self.systemName = systemName
        self.systemVersion = systemVersion
        self.appVersion = appVersion
        self.appBuild = appBuild
        self.locale = locale
    }
}
