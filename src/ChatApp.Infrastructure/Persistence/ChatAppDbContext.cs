using ChatApp.Domain.Entities;
using ChatApp.Domain.Enums;
using Microsoft.EntityFrameworkCore;

namespace ChatApp.Infrastructure.Persistence;

public class ChatAppDbContext : DbContext
{
    public ChatAppDbContext(DbContextOptions<ChatAppDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Conversation> Conversations => Set<Conversation>();
    public DbSet<ConversationParticipant> ConversationParticipants => Set<ConversationParticipant>();
    public DbSet<Message> Messages => Set<Message>();
    public DbSet<MessageReadReceipt> MessageReadReceipts => Set<MessageReadReceipt>();
    public DbSet<MessageAttachment> MessageAttachments => Set<MessageAttachment>();
    public DbSet<FileUpload> FileUploads => Set<FileUpload>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        base.OnModelCreating(b);

        // ===== User =====
        var u = b.Entity<User>();
        u.ToTable("users");
        u.HasKey(x => x.Id);
        u.Property(x => x.PhoneNumber).HasMaxLength(32).IsRequired();
        u.Property(x => x.NormalizedPhoneNumber).HasMaxLength(32).IsRequired();
        u.Property(x => x.PhoneNumberHash).HasMaxLength(128).IsRequired();
        u.Property(x => x.UserName).HasMaxLength(64);
        u.Property(x => x.FirstName).HasMaxLength(64).IsRequired();
        u.Property(x => x.LastName).HasMaxLength(64).IsRequired();
        u.Property(x => x.PasswordHash).HasMaxLength(512).IsRequired();
        u.Property(x => x.AvatarUrl).HasMaxLength(512);
        u.Property(x => x.Bio).HasMaxLength(500);
        u.Property(x => x.SecurityStamp).HasMaxLength(64).IsRequired();
        u.Property(x => x.ConcurrencyStamp).HasMaxLength(64);
        // FullName is computed — never persisted
        u.Ignore(x => x.FullName);
        u.HasIndex(x => x.NormalizedPhoneNumber).IsUnique();
        u.HasIndex(x => x.PhoneNumberHash).IsUnique();
        u.HasIndex(x => x.PhoneNumber);
        u.HasIndex(x => x.Role);
        u.HasIndex(x => x.Status);
        u.HasIndex(x => new { x.FirstName, x.LastName });
        u.HasQueryFilter(x => x.DeletedAt == null);

        // ===== Conversation =====
        var c = b.Entity<Conversation>();
        c.ToTable("conversations");
        c.HasKey(x => x.Id);
        c.Property(x => x.Title).HasMaxLength(200);
        c.Property(x => x.LastMessagePreview).HasMaxLength(500);
        c.HasIndex(x => x.LastMessageAt);
        c.HasQueryFilter(x => x.DeletedAt == null);

        var cp = b.Entity<ConversationParticipant>();
        cp.ToTable("conversation_participants");
        cp.HasKey(x => new { x.ConversationId, x.UserId });
        cp.HasOne(x => x.Conversation).WithMany(x => x.Participants)
            .HasForeignKey(x => x.ConversationId).OnDelete(DeleteBehavior.Cascade);
        cp.HasOne(x => x.User).WithMany(x => x.Conversations)
            .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        cp.HasIndex(x => x.UserId);
        cp.HasIndex(x => x.ConversationId);

        // ===== Message =====
        var m = b.Entity<Message>();
        m.ToTable("messages");
        m.HasKey(x => x.Id);
        m.Property(x => x.Content).HasMaxLength(8000).IsRequired();
        m.HasOne(x => x.Conversation).WithMany(x => x.Messages)
            .HasForeignKey(x => x.ConversationId).OnDelete(DeleteBehavior.Cascade);
        m.HasOne(x => x.Sender).WithMany(x => x.SentMessages)
            .HasForeignKey(x => x.SenderId).OnDelete(DeleteBehavior.Restrict);
        m.HasOne(x => x.ReplyToMessage).WithMany().HasForeignKey(x => x.ReplyToMessageId)
            .OnDelete(DeleteBehavior.NoAction);
        m.HasIndex(x => new { x.ConversationId, x.CreatedAt });
        m.HasIndex(x => x.SenderId);
        m.HasIndex(x => x.Status);
        m.HasQueryFilter(x => x.DeletedAt == null);

        var mr = b.Entity<MessageReadReceipt>();
        mr.ToTable("message_read_receipts");
        mr.HasKey(x => new { x.MessageId, x.UserId });
        mr.HasOne(x => x.Message).WithMany(x => x.ReadReceipts)
            .HasForeignKey(x => x.MessageId).OnDelete(DeleteBehavior.Cascade);
        mr.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        mr.HasIndex(x => x.UserId);

        // ===== MessageAttachment =====
        var ma = b.Entity<MessageAttachment>();
        ma.ToTable("message_attachments");
        ma.HasKey(x => x.Id);
        ma.HasOne(x => x.Message).WithMany(x => x.Attachments)
            .HasForeignKey(x => x.MessageId).OnDelete(DeleteBehavior.Cascade);
        ma.HasOne(x => x.FileUpload).WithMany().HasForeignKey(x => x.FileUploadId)
            .OnDelete(DeleteBehavior.Restrict);
        ma.Property(x => x.OriginalFileName).HasMaxLength(512).IsRequired();
        ma.Property(x => x.StoredFileName).HasMaxLength(512).IsRequired();
        ma.Property(x => x.RelativePath).HasMaxLength(1024).IsRequired();
        ma.Property(x => x.ThumbnailPath).HasMaxLength(1024);
        ma.HasIndex(x => x.MessageId);

        // ===== FileUpload =====
        var fu = b.Entity<FileUpload>();
        fu.ToTable("file_uploads");
        fu.HasKey(x => x.Id);
        fu.HasOne(x => x.User).WithMany().HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Restrict);
        fu.Property(x => x.OriginalFileName).HasMaxLength(512).IsRequired();
        fu.Property(x => x.StoredFileName).HasMaxLength(512).IsRequired();
        fu.Property(x => x.RelativePath).HasMaxLength(1024).IsRequired();
        fu.Property(x => x.ChunkDirectory).HasMaxLength(1024).IsRequired();
        fu.Property(x => x.FileHash).HasMaxLength(128);
        fu.HasIndex(x => x.UserId);
        fu.HasIndex(x => x.Status);
        fu.HasIndex(x => x.CreatedAt);
        fu.HasQueryFilter(x => x.DeletedAt == null);

        // ===== AuditLog =====
        var al = b.Entity<AuditLog>();
        al.ToTable("audit_logs");
        al.HasKey(x => x.Id);
        al.HasOne(x => x.Admin).WithMany(x => x.AuditLogs).HasForeignKey(x => x.AdminId)
            .OnDelete(DeleteBehavior.Restrict);
        al.Property(x => x.Details).HasMaxLength(2000);
        al.Property(x => x.IpAddress).HasMaxLength(64);
        al.Property(x => x.UserAgent).HasMaxLength(512);
        al.HasIndex(x => x.AdminId);
        al.HasIndex(x => x.CreatedAt);
        al.HasIndex(x => x.Action);

        // ===== RefreshToken =====
        var rt = b.Entity<RefreshToken>();
        rt.ToTable("refresh_tokens");
        rt.HasKey(x => x.Id);
        rt.HasOne(x => x.User).WithMany(x => x.RefreshTokens).HasForeignKey(x => x.UserId)
            .OnDelete(DeleteBehavior.Cascade);
        rt.Property(x => x.TokenHash).HasMaxLength(128).IsRequired();
        rt.Property(x => x.JwtId).HasMaxLength(64).IsRequired();
        rt.Property(x => x.ReplacedByToken).HasMaxLength(128);
        rt.Property(x => x.CreatedByIp).HasMaxLength(64);
        rt.Property(x => x.RevokeByIp).HasMaxLength(64);
        rt.Property(x => x.ReasonRevoked).HasMaxLength(500);
        // IsActive is computed — never persisted
        rt.Ignore(x => x.IsActive);
        rt.HasIndex(x => x.TokenHash).IsUnique();
        rt.HasIndex(x => x.UserId);

        // ===== AppSetting =====
        var s = b.Entity<AppSetting>();
        s.ToTable("app_settings");
        s.HasKey(x => x.Key);
        s.Property(x => x.Key).HasMaxLength(128);
        s.Property(x => x.Value).HasMaxLength(2048);
        s.Property(x => x.Description).HasMaxLength(500);
    }
}
