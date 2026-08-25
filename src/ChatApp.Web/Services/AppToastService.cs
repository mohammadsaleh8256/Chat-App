using Microsoft.JSInterop;

namespace ChatApp.Web.Services;

public interface IAppToastService
{
    Task ShowSuccessAsync(string message);
    Task ShowErrorAsync(string message);
    Task ShowInfoAsync(string message);
}

public class AppToastService : IAppToastService
{
    private readonly IJSRuntime _js;
    public AppToastService(IJSRuntime js) => _js = js;

    public Task ShowSuccessAsync(string message) => _js.InvokeVoidAsync("chatApp.toast.success", message).AsTask();
    public Task ShowErrorAsync(string message) => _js.InvokeVoidAsync("chatApp.toast.error", message).AsTask();
    public Task ShowInfoAsync(string message) => _js.InvokeVoidAsync("chatApp.toast.info", message).AsTask();
}
