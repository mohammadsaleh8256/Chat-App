namespace ChatApp.Domain.Exceptions;

public class DomainException : Exception
{
    public DomainException(string message) : base(message) { }
    public DomainException(string message, Exception innerException) : base(message, innerException) { }
}

public class EntityNotFoundException : DomainException
{
    public EntityNotFoundException(string entityName, object key)
        : base($"موجودیت {entityName} با کلید {key} یافت نشد.") { }
}

public class BusinessRuleViolationException : DomainException
{
    public BusinessRuleViolationException(string message) : base(message) { }
}

public class AuthorizationException : DomainException
{
    public AuthorizationException(string message = "شما اجازه انجام این عملیات را ندارید.") : base(message) { }
}
