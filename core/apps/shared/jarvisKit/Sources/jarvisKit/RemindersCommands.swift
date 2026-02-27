import Foundation

public enum JARVISRemindersCommand: String, Codable, Sendable {
    case list = "reminders.list"
    case add = "reminders.add"
}

public enum JARVISReminderStatusFilter: String, Codable, Sendable {
    case incomplete
    case completed
    case all
}

public struct JARVISRemindersListParams: Codable, Sendable, Equatable {
    public var status: JARVISReminderStatusFilter?
    public var limit: Int?

    public init(status: JARVISReminderStatusFilter? = nil, limit: Int? = nil) {
        self.status = status
        self.limit = limit
    }
}

public struct JARVISRemindersAddParams: Codable, Sendable, Equatable {
    public var title: String
    public var dueISO: String?
    public var notes: String?
    public var listId: String?
    public var listName: String?

    public init(
        title: String,
        dueISO: String? = nil,
        notes: String? = nil,
        listId: String? = nil,
        listName: String? = nil)
    {
        self.title = title
        self.dueISO = dueISO
        self.notes = notes
        self.listId = listId
        self.listName = listName
    }
}

public struct JARVISReminderPayload: Codable, Sendable, Equatable {
    public var identifier: String
    public var title: String
    public var dueISO: String?
    public var completed: Bool
    public var listName: String?

    public init(
        identifier: String,
        title: String,
        dueISO: String? = nil,
        completed: Bool,
        listName: String? = nil)
    {
        self.identifier = identifier
        self.title = title
        self.dueISO = dueISO
        self.completed = completed
        self.listName = listName
    }
}

public struct JARVISRemindersListPayload: Codable, Sendable, Equatable {
    public var reminders: [JARVISReminderPayload]

    public init(reminders: [JARVISReminderPayload]) {
        self.reminders = reminders
    }
}

public struct JARVISRemindersAddPayload: Codable, Sendable, Equatable {
    public var reminder: JARVISReminderPayload

    public init(reminder: JARVISReminderPayload) {
        self.reminder = reminder
    }
}
