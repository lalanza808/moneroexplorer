import { WalletService } from "./src/services/WalletService.ts";
import { TemplateRenderer } from "./src/services/TemplateRenderer.ts";
import { ApiRoutes } from "./src/routes/api.ts";

async function serveStatic(pathname: string): Promise<Response | null> {
  try {
    // Handle public static files
    if (pathname.startsWith("/css/") || 
        pathname.startsWith("/js/") || 
        pathname.startsWith("/images/") || 
        pathname.startsWith("/fonts/") ||
        pathname === "/favicon.ico" ||
        pathname === "/robots.txt") {
      
      const filePath = `./public${pathname}`;
      
      // Determine content type
      let contentType = "text/plain";
      if (pathname.endsWith(".css")) contentType = "text/css";
      else if (pathname.endsWith(".js")) contentType = "application/javascript";
      else if (pathname.endsWith(".png")) contentType = "image/png";
      else if (pathname.endsWith(".jpg") || pathname.endsWith(".jpeg")) contentType = "image/jpeg";
      else if (pathname.endsWith(".gif")) contentType = "image/gif";
      else if (pathname.endsWith(".svg")) contentType = "image/svg+xml";
      else if (pathname.endsWith(".webp")) contentType = "image/webp";
      else if (pathname.endsWith(".ico")) contentType = "image/x-icon";
      else if (pathname.endsWith(".woff")) contentType = "font/woff";
      else if (pathname.endsWith(".woff2")) contentType = "font/woff2";
      else if (pathname.endsWith(".ttf")) contentType = "font/ttf";
      else if (pathname.endsWith(".eot")) contentType = "application/vnd.ms-fontobject";
      else if (pathname.endsWith(".txt")) contentType = "text/plain";
      else if (pathname.endsWith(".json")) contentType = "application/json";
      
      // For binary files (images, fonts), read as binary
      if (contentType.startsWith("image/") || contentType.startsWith("font/") || contentType === "application/vnd.ms-fontobject") {
        const file = await Deno.readFile(filePath);
        return new Response(file, {
          headers: { "content-type": contentType }
        });
      } else {
        // For text files, read as text
        const file = await Deno.readTextFile(filePath);
        return new Response(file, {
          headers: { "content-type": contentType }
        });
      }
    }
  } catch (_error) {
    return null;
  }
  return null;
}

async function shutdown(): Promise<void> {
  console.log("[.] Shutting down gracefully...");
  await WalletService.shutdown();
  console.log("[-] Shutdown complete");
  Deno.exit(0);
}

// Handle graceful shutdown
Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);

// Initialize wallet and start server
console.log("[.] Starting web server...");
try {
  await WalletService.initialize();
} catch (_error) {
  console.error("[!] Failed to start server - wallet initialization failed");
  Deno.exit(1);
}

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return ApiRoutes.handleOptions();
  }

  // Handle static files
  const staticResponse = await serveStatic(pathname);
  if (staticResponse) return staticResponse;

  // Handle routes
  switch (pathname) {
    case "/": {
      const homeHtml = await TemplateRenderer.renderTemplate("home");
      return new Response(homeHtml, {
        headers: { "content-type": "text/html" }
      });
    }

    case "/check": {
      const checkHtml = await TemplateRenderer.renderTemplate("check");
      return new Response(checkHtml, {
        headers: { "content-type": "text/html" }
      });
    }

    case "/api/check": {
      return ApiRoutes.handleCheck(req);
    }

    case "/api": {
      const apiHtml = await TemplateRenderer.renderTemplate("api-docs");
      return new Response(apiHtml, {
        headers: { "content-type": "text/html" }
      });
    }

    default: {
      const notFoundHtml = await TemplateRenderer.renderTemplate("base", { 
        title: "404 - Not Found"
      });
      // Replace the default content block with 404 content
      const content404 = "<h1>404 - Page Not Found</h1><p>The page you're looking for doesn't exist.</p><a href='/'>Go Home</a>";
      const finalHtml = notFoundHtml.replace(
        /{% block content %}[\s\S]*?{% endblock %}/,
        content404
      );
      return new Response(finalHtml, {
        status: 404,
        headers: { "content-type": "text/html" }
      });
    }
  }
});
