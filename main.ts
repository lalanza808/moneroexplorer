import moneroTs from "monero-ts";

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
        tx_count: data.result.tx_count.toLocaleString()
      });
      return returnHTML(html);
    }

    case "/htmx/mempool_summary": {
      const res = await NodeService.make_rpc_request("get_transaction_pool")
      const data = JSON.parse(await res.text())
      const limit = 10;
      let txes = [];
      if (!data.transactions) data.transactions = []
      for (let i = 0; (i < data.transactions.length && i < limit); i++) {
        const tx = data.transactions[i];
        const tx_json = JSON.parse(tx.tx_json)
        let new_tx = {
          tx_hash: tx.id_hash,
          tx_hash_clean: tx.id_hash.slice(0, 8) + "..." + tx.id_hash.slice(-8),
          tx_size: tx.blob_size,
          timestamp: tx.receive_time,
          fee: 0
        }
        if ("rct_signatures" in tx_json) {
          new_tx.fee = moneroTs.MoneroUtils.atomicUnitsToXmr(tx_json.rct_signatures.txnFee)
        }
        if (tx.receive_time === 0) {
          new_tx.timestamp = "?";
        } else {
          new_tx.timestamp = new Date(tx.receive_time * 1_000).toLocaleString();
        }
        txes.push(new_tx)
      }
      const html = await TemplateRenderer.renderTemplate("htmx/mempool_summary.html", {
        total_count: data.transactions.length,
        tx_count: txes.length,
        txes: txes
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
