import moneroTs from "monero-ts";
import nunjucks from "nunjucks";

import { WalletService } from "./services/WalletService.ts";
import { TemplateRenderer } from "./services/TemplateRenderer.ts";
import { ApiRoutes } from "./routes/api.ts";
import { NodeService, Mempool, Blocks, Network } from "./services/NodeService.ts";


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

nunjucks.configure(`${Deno.cwd()}/src/templates`, {})

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

  const tx_route = new URLPattern({ pathname: "/tx/:id" }).exec(url)
  if (tx_route) {
    interface Transaction {
      height: number,
      hash: string,
      timestamp: number,
      date: string,
      confirmations: number,
      tx_json: object,
      current_height: number
    }
    const currentInfo = NodeService.getCache("get_info");
    const params = tx_route.pathname.groups;
    const res = await NodeService.make_rpc_request("get_transactions", {
      txs_hashes: [params.id], "decode_as_json": true
    });
    if (res.txs && res.txs.length > 0) {
      const tx = res.txs[0];
      const tx_json = JSON.parse(tx.as_json)
      const data: Transaction = {
        height: tx.block_height,
        hash: tx.tx_hash,
        timestamp: tx.block_timestamp,
        date: new Date(tx.block_timestamp * 1_000).toString(),
        confirmations: tx.confirmations,
        tx_json: tx_json,
        current_height: currentInfo.result.height
      }
      const html = await nunjucks.render("tx.html", data)
      return returnHTML(html);
    }
  }

  const block_route = new URLPattern({ pathname: "/block/:id" }).exec(url)
  if (block_route) {
    const params = block_route.pathname.groups;
    return new Response(`Matched: ${JSON.stringify(params)}`);
  }

  const index_route = new URLPattern({ pathname: "/" }).exec(url)
  if (index_route) {
    const html = await nunjucks.render("home.html")
    return returnHTML(html);
  }

  const network_info = new URLPattern({ pathname: "/htmx/network_info" }).exec(url)
  if (network_info) {
    const data = await NodeService.make_json_rpc_request("get_info")
    const network: Network = {
      height: data.result.height.toLocaleString(),
      network: (data.result.difficulty / 1_000_000_000).toFixed(2),
      hash_rate: (data.result.difficulty / data.result.target / 1_000_000_000).toFixed(2),
      tx_count: data.result.tx_count.toLocaleString()
    }
    const html = await nunjucks.render("htmx/network_info.html", network);
    return returnHTML(html);
  }

  const mempool_summary = new URLPattern({ pathname: "/htmx/mempool_summary" }).exec(url)
  if (mempool_summary) {
    const data = await NodeService.make_rpc_request("get_transaction_pool")
    const limit = 10;
    const txes: Mempool[] = [];
    if (!data.transactions) data.transactions = []
    for (let i = 0; (i < data.transactions.length && i < limit); i++) {
      const tx = data.transactions[i];
      const tx_json = JSON.parse(tx.tx_json)
      const diffSeconds = NodeService.getAge(tx.receive_time)
      const new_tx: Mempool = {
        tx_hash: tx.id_hash,
        tx_hash_clean: tx.id_hash.slice(0, 8) + "..." + tx.id_hash.slice(-8),
        tx_size: tx.blob_size / 1_000,
        age: diffSeconds,
        timestamp: tx.receive_time,
        fee: 0
      }
      if ("rct_signatures" in tx_json) {
        new_tx.fee = moneroTs.MoneroUtils.atomicUnitsToXmr(tx_json.rct_signatures.txnFee)
      }
      if (tx.receive_time === 0) {
        new_tx.age = "?";
      }
      txes.push(new_tx)
    }
    txes.sort((a, b) => {
      return b.timestamp - a.timestamp;
    })
    const html = await nunjucks.render("htmx/mempool_summary.html", {
      total_count: data.transactions.length,
      tx_count: txes.length,
      txes: txes
    });
    return returnHTML(html);
  }

  const recent_blocks = new URLPattern({ pathname: "/htmx/recent_blocks" }).exec(url)
  if (recent_blocks) {
    const endHeight = NodeService.getCache("get_info").result.height - 1;
    const startHeight = endHeight - 10;
    const params = {"start_height": startHeight, "end_height": endHeight}
    const data = await NodeService.make_json_rpc_request("get_block_headers_range", params)
    const blockHeaders = data.result.headers
    const blocks: Blocks[] = [];
    for (let i = 0; i < blockHeaders.length; i++) {
      const ageSeconds = NodeService.getAge(blockHeaders[i].timestamp)
      const ageMinutes = Math.round(ageSeconds / 60);
      const new_block: Blocks = {
        age: ageMinutes,
        height: blockHeaders[i].height,
        num_txes: blockHeaders[i].num_txes,
        size: (blockHeaders[i].block_size / 1_000).toFixed(2)
      }
      blocks.unshift(new_block)
    }
    const html = await nunjucks.render("htmx/recent_blocks.html", {
      blocks: blocks
    })
    return returnHTML(html);
  }

  // Handle everything else
  switch (pathname) {
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
