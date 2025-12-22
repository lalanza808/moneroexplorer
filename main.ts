import { WalletService } from "./src/services/WalletService.ts";
import { TemplateRenderer } from "./src/services/TemplateRenderer.ts";
import { ApiRoutes } from "./src/routes/api.ts";
import { NodeService } from "./src/services/NodeService.ts";

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
  await WalletService.shutdown();
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

function returnHTML(rendered) {
  return new Response(rendered, {
    headers: { "content-type": "text/html" }
  });
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
      const html = await TemplateRenderer.renderTemplate("home.html");
      return returnHTML(html);
    }
    
    case "/htmx/network_info": {
      
      const res = await NodeService.make_json_rpc_request("get_info")
      const data = JSON.parse(await res.text())
      const html = await TemplateRenderer.renderTemplate("htmx/network_info.html", {
        height: data.result.height.toLocaleString(),
        network: (data.result.difficulty / 1_000_000_000).toFixed(2),
        hash_rate: (data.result.difficulty / data.result.target / 1_000_000_000).toFixed(2),
        tx_count: data.result.tx_count,
        tx_pool_size: data.result.tx_pool_size,
        fee_per_kb: data.result.fee_per_kb
      });
      return returnHTML(html);
    }

    default: {
      const notFoundHtml = await TemplateRenderer.renderTemplate("base.html", { 
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
