#!/usr/bin/env deno run --allow-net --allow-write

/**
 * Fetch Monero nodes from monero.fail API and extract web-compatible nodes
 * Saves the results to nodes.json
 */

interface NodeData {
  monero: {
    web_compatible: string[];
  };
}

async function fetchNodes(): Promise<void> {
  try {
    console.log("[+] Fetching nodes from https://monero.fail/nodes.json...");
    const response = await fetch("https://monero.fail/nodes.json");
    if (!response.ok) {
      throw new Error(`[!] HTTP error! status: ${response.status}`);
    }
    const data: NodeData = await response.json();
    const webCompatibleNodes = data.monero?.web_compatible || [];
    await Deno.writeTextFile("nodes.json", JSON.stringify(webCompatibleNodes, null, 2));
    console.log(`[+] Saved ${webCompatibleNodes.length} web-compatible nodes to nodes.json`);
  } catch (error) {
    console.error("[!] Error fetching nodes:", error instanceof Error ? error.message : String(error));
    Deno.exit(1);
  }
}

// Run the script
if (import.meta.main) {
  await fetchNodes();
}

export default fetchNodes;