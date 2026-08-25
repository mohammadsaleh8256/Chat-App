namespace ChatApp.Domain.Enums;

public enum UserRole
{
    User = 0,
    Admin = 1
}

public enum UserStatus
{
    Active = 0,
    Disabled = 1,
    Deleted = 2
}

public enum MessageType
{
    Text = 0,
    Image = 1,
    Video = 2,
    Audio = 3,
    File = 4
}

public enum MessageStatus
{
    Sending = 0,
    Sent = 1,
    Delivered = 2,
    Read = 3,
    Failed = 4
}

public enum AttachmentType
{
    Image = 0,
    Video = 1,
    Audio = 2,
    Pdf = 3,
    Zip = 4,
    Rar = 5,
    Document = 6,
    Spreadsheet = 7,
    Presentation = 8,
    Text = 9,
    Other = 10
}

public enum AuditAction
{
    ViewUser = 0,
    ViewConversation = 1,
    ViewMessage = 2,
    ViewAttachment = 3,
    ChangeRole = 4,
    ChangeAdmin = 5,
    DisableUser = 6,
    EnableUser = 7,
    DeleteUser = 8,
    UpdateSettings = 9
}

public enum UploadStatus
{
    Pending = 0,
    Uploading = 1,
    Completed = 2,
    Failed = 3,
    Cancelled = 4
}
