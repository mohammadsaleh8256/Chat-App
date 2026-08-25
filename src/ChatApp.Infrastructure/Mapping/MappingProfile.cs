using AutoMapper;
using ChatApp.Contracts.Dtos;
using ChatApp.Domain.Entities;

namespace ChatApp.Infrastructure.Mapping;

public class MappingProfile : Profile
{
    public MappingProfile()
    {
        CreateMap<User, UserDto>()
            .ForMember(d => d.Role, o => o.MapFrom(s => s.Role.ToString()))
            .ForMember(d => d.Status, o => o.MapFrom(s => s.Status.ToString()))
            .ForMember(d => d.PhoneNumber, o => o.MapFrom(s => s.PhoneNumber));

        CreateMap<User, UserSummaryDto>()
            .ForMember(d => d.PhoneNumber, o => o.MapFrom(s => s.PhoneNumber));

        CreateMap<Conversation, ConversationDto>()
            .ForMember(d => d.UnreadCount, o => o.Ignore())
            .ForMember(d => d.OtherParticipant, o => o.Ignore());

        CreateMap<Message, MessageDto>()
            .ForMember(d => d.SenderName, o => o.MapFrom(s => s.Sender.FullName))
            .ForMember(d => d.SenderAvatarUrl, o => o.MapFrom(s => s.Sender.AvatarUrl))
            .ForMember(d => d.Type, o => o.MapFrom(s => s.Type.ToString()))
            .ForMember(d => d.Status, o => o.MapFrom(s => s.Status.ToString()))
            .ForMember(d => d.ReplyToPreview, o => o.MapFrom(s => s.ReplyToMessage != null ? s.ReplyToMessage.Content : null))
            .ForMember(d => d.Attachments, o => o.Ignore());

        CreateMap<MessageAttachment, AttachmentDto>()
            .ForMember(d => d.Type, o => o.MapFrom(s => s.Type.ToString()))
            .ForMember(d => d.DownloadUrl, o => o.MapFrom(s => $"/api/files/{s.Id}"))
            .ForMember(d => d.ThumbnailUrl, o => o.MapFrom(s => s.ThumbnailPath));

        CreateMap<FileUpload, FileUploadDto>()
            .ForMember(d => d.Status, o => o.MapFrom(s => s.Status.ToString()));

        CreateMap<AuditLog, AuditLogDto>()
            .ForMember(d => d.AdminName, o => o.MapFrom(s => s.Admin.FullName))
            .ForMember(d => d.Action, o => o.MapFrom(s => s.Action.ToString()))
            .ForMember(d => d.TargetUserName, o => o.Ignore());
    }
}
