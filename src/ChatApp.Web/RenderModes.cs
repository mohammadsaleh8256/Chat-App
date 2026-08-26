using Microsoft.AspNetCore.Components.Web;

namespace ChatApp.Web;

/// <summary>
/// Pre-configured render modes.
/// We disable prerendering for interactive pages because ProtectedLocalStorage
/// (where we keep the JWT) is unavailable during server-side prerender, which
/// would cause the auth state to look unauthenticated and trigger redirect loops.
/// </summary>
public static class RenderModes
{
    public static readonly InteractiveServerRenderMode InteractiveServerNoPrerender = new(prerender: false);
}
