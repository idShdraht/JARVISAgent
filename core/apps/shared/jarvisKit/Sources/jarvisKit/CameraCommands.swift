import Foundation

public enum JARVISCameraCommand: String, Codable, Sendable {
    case list = "camera.list"
    case snap = "camera.snap"
    case clip = "camera.clip"
}

public enum JARVISCameraFacing: String, Codable, Sendable {
    case back
    case front
}

public enum JARVISCameraImageFormat: String, Codable, Sendable {
    case jpg
    case jpeg
}

public enum JARVISCameraVideoFormat: String, Codable, Sendable {
    case mp4
}

public struct JARVISCameraSnapParams: Codable, Sendable, Equatable {
    public var facing: JARVISCameraFacing?
    public var maxWidth: Int?
    public var quality: Double?
    public var format: JARVISCameraImageFormat?
    public var deviceId: String?
    public var delayMs: Int?

    public init(
        facing: JARVISCameraFacing? = nil,
        maxWidth: Int? = nil,
        quality: Double? = nil,
        format: JARVISCameraImageFormat? = nil,
        deviceId: String? = nil,
        delayMs: Int? = nil)
    {
        self.facing = facing
        self.maxWidth = maxWidth
        self.quality = quality
        self.format = format
        self.deviceId = deviceId
        self.delayMs = delayMs
    }
}

public struct JARVISCameraClipParams: Codable, Sendable, Equatable {
    public var facing: JARVISCameraFacing?
    public var durationMs: Int?
    public var includeAudio: Bool?
    public var format: JARVISCameraVideoFormat?
    public var deviceId: String?

    public init(
        facing: JARVISCameraFacing? = nil,
        durationMs: Int? = nil,
        includeAudio: Bool? = nil,
        format: JARVISCameraVideoFormat? = nil,
        deviceId: String? = nil)
    {
        self.facing = facing
        self.durationMs = durationMs
        self.includeAudio = includeAudio
        self.format = format
        self.deviceId = deviceId
    }
}
