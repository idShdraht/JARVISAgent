import Foundation

public enum JARVISChatTransportEvent: Sendable {
    case health(ok: Bool)
    case tick
    case chat(JARVISChatEventPayload)
    case agent(JARVISAgentEventPayload)
    case seqGap
}

public protocol JARVISChatTransport: Sendable {
    func requestHistory(sessionKey: String) async throws -> JARVISChatHistoryPayload
    func sendMessage(
        sessionKey: String,
        message: String,
        thinking: String,
        idempotencyKey: String,
        attachments: [JARVISChatAttachmentPayload]) async throws -> JARVISChatSendResponse

    func abortRun(sessionKey: String, runId: String) async throws
    func listSessions(limit: Int?) async throws -> JARVISChatSessionsListResponse

    func requestHealth(timeoutMs: Int) async throws -> Bool
    func events() -> AsyncStream<JARVISChatTransportEvent>

    func setActiveSessionKey(_ sessionKey: String) async throws
}

extension JARVISChatTransport {
    public func setActiveSessionKey(_: String) async throws {}

    public func abortRun(sessionKey _: String, runId _: String) async throws {
        throw NSError(
            domain: "JARVISChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "chat.abort not supported by this transport"])
    }

    public func listSessions(limit _: Int?) async throws -> JARVISChatSessionsListResponse {
        throw NSError(
            domain: "JARVISChatTransport",
            code: 0,
            userInfo: [NSLocalizedDescriptionKey: "sessions.list not supported by this transport"])
    }
}
