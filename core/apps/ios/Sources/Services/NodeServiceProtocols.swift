import CoreLocation
import Foundation
import JARVISKit
import UIKit

typealias JARVISCameraSnapResult = (format: String, base64: String, width: Int, height: Int)
typealias JARVISCameraClipResult = (format: String, base64: String, durationMs: Int, hasAudio: Bool)

protocol CameraServicing: Sendable {
    func listDevices() async -> [CameraController.CameraDeviceInfo]
    func snap(params: JARVISCameraSnapParams) async throws -> JARVISCameraSnapResult
    func clip(params: JARVISCameraClipParams) async throws -> JARVISCameraClipResult
}

protocol ScreenRecordingServicing: Sendable {
    func record(
        screenIndex: Int?,
        durationMs: Int?,
        fps: Double?,
        includeAudio: Bool?,
        outPath: String?) async throws -> String
}

@MainActor
protocol LocationServicing: Sendable {
    func authorizationStatus() -> CLAuthorizationStatus
    func accuracyAuthorization() -> CLAccuracyAuthorization
    func ensureAuthorization(mode: JARVISLocationMode) async -> CLAuthorizationStatus
    func currentLocation(
        params: JARVISLocationGetParams,
        desiredAccuracy: JARVISLocationAccuracy,
        maxAgeMs: Int?,
        timeoutMs: Int?) async throws -> CLLocation
    func startLocationUpdates(
        desiredAccuracy: JARVISLocationAccuracy,
        significantChangesOnly: Bool) -> AsyncStream<CLLocation>
    func stopLocationUpdates()
    func startMonitoringSignificantLocationChanges(onUpdate: @escaping @Sendable (CLLocation) -> Void)
    func stopMonitoringSignificantLocationChanges()
}

protocol DeviceStatusServicing: Sendable {
    func status() async throws -> JARVISDeviceStatusPayload
    func info() -> JARVISDeviceInfoPayload
}

protocol PhotosServicing: Sendable {
    func latest(params: JARVISPhotosLatestParams) async throws -> JARVISPhotosLatestPayload
}

protocol ContactsServicing: Sendable {
    func search(params: JARVISContactsSearchParams) async throws -> JARVISContactsSearchPayload
    func add(params: JARVISContactsAddParams) async throws -> JARVISContactsAddPayload
}

protocol CalendarServicing: Sendable {
    func events(params: JARVISCalendarEventsParams) async throws -> JARVISCalendarEventsPayload
    func add(params: JARVISCalendarAddParams) async throws -> JARVISCalendarAddPayload
}

protocol RemindersServicing: Sendable {
    func list(params: JARVISRemindersListParams) async throws -> JARVISRemindersListPayload
    func add(params: JARVISRemindersAddParams) async throws -> JARVISRemindersAddPayload
}

protocol MotionServicing: Sendable {
    func activities(params: JARVISMotionActivityParams) async throws -> JARVISMotionActivityPayload
    func pedometer(params: JARVISPedometerParams) async throws -> JARVISPedometerPayload
}

struct WatchMessagingStatus: Sendable, Equatable {
    var supported: Bool
    var paired: Bool
    var appInstalled: Bool
    var reachable: Bool
    var activationState: String
}

struct WatchQuickReplyEvent: Sendable, Equatable {
    var replyId: String
    var promptId: String
    var actionId: String
    var actionLabel: String?
    var sessionKey: String?
    var note: String?
    var sentAtMs: Int?
    var transport: String
}

struct WatchNotificationSendResult: Sendable, Equatable {
    var deliveredImmediately: Bool
    var queuedForDelivery: Bool
    var transport: String
}

protocol WatchMessagingServicing: AnyObject, Sendable {
    func status() async -> WatchMessagingStatus
    func setReplyHandler(_ handler: (@Sendable (WatchQuickReplyEvent) -> Void)?)
    func sendNotification(
        id: String,
        params: JARVISWatchNotifyParams) async throws -> WatchNotificationSendResult
}

extension CameraController: CameraServicing {}
extension ScreenRecordService: ScreenRecordingServicing {}
extension LocationService: LocationServicing {}
