import moneroTs from "monero-ts";

interface CheckTxKey {
  status: string,
  message?: string,
  data?: {
    confirmations: number,
    mempool: boolean,
    amount: number
  };
}

let globalWallet: any = null;

async function getNode(): Promise<string> {
  const fallback = "https://node.sethforprivacy.com";
  try {
    let contents = await Deno.readTextFile("nodes.json");
    let nodes = JSON.parse(contents);
    if (!Array.isArray(nodes) || nodes.length === 0) {
      console.warn("[!] No valid nodes found in nodes.json, using fallback node");
      return fallback;
    }
    const randIndex = Math.floor(Math.random() * nodes.length);
    return nodes[randIndex];
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.warn(`[!] Failed to read nodes.json: ${errorMessage}, using fallback node`);
    return fallback;
  }
}

async function initializeWallet(): Promise<void> {
  try {
    const node = await getNode();
    console.log(`[.] Initializing wallet...`);
    globalWallet = await moneroTs.createWalletFull({
      networkType: moneroTs.MoneroNetworkType.MAINNET,
      server: {
        uri: node
      }
    });
    console.log("[+] Wallet initialized successfully");
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[!] Failed to initialize wallet:", error);
    throw new Error(`Wallet initialization failed: ${errorMessage}`);
  }
}

async function checkTxKey(txhash: string, txsecret: string, address: string): Promise<CheckTxKey> {
  if (!globalWallet) {
    throw new Error("[!] Wallet not initialized");
  }

  try {
    let check = await globalWallet.checkTxKey(txhash, txsecret, address);

    let amount = moneroTs.MoneroUtils.atomicUnitsToXmr(check.getReceivedAmount());
    if (amount === 0) {
      check.setIsGood(false);
    }

    let checkStatus: string;
    if (check.getIsGood()) {
      checkStatus = "success";
    } else {
      return {
        status: "fail",
        message: "Invalid parameters"
      }
    }

    const res: CheckTxKey = {
      status: checkStatus,
      data: {
        confirmations: check.getNumConfirmations(),
        mempool: check.getInTxPool(),
        amount: amount
      }
    }

    return res;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      status: "fail",
      message: errorMessage
    }
  }
}

function validateInputs(txhash: string | null, viewkey: string | null, address: string | null): string | null {
  if (!txhash || !viewkey || !address) {
    return "Missing required parameters: txhash, viewkey, address";
  }

  // Basic format validation
  if (!moneroTs.MoneroUtils.isValidPublicViewKey(txhash)) {
    return "Invalid txhash";
  }

  if (!moneroTs.MoneroUtils.isValidPrivateViewKey(viewkey)) {
    return "Invalid viewkey";
  }

  if (!moneroTs.MoneroUtils.isValidAddress(address, moneroTs.MoneroNetworkType.MAINNET)) {
    return "Invalid Monero address"
  }

  return null;
}

async function shutdown(): Promise<void> {
  console.log("[.] Shutting down gracefully...");
  if (globalWallet) {
    await globalWallet.close();
  }
  await moneroTs.shutdown();
  console.log("[-] Shutdown complete");
  Deno.exit(0);
}

// Handle graceful shutdown
Deno.addSignalListener("SIGINT", shutdown);
Deno.addSignalListener("SIGTERM", shutdown);

// Initialize wallet and start server
console.log("[.] Starting XMR Key Checker server...");
try {
  await initializeWallet();
} catch (error) {
  console.error("[!] Failed to start server - wallet initialization failed");
  Deno.exit(1);
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const txhash = url.searchParams.get("txhash");
    const viewkey = url.searchParams.get("viewkey");
    const address = url.searchParams.get("address");
    // const txprove = url.searchParams.get("txprove")

    // Validate input parameters
    const validationError = validateInputs(txhash, viewkey, address);
    if (validationError) {
      return new Response(JSON.stringify({error: validationError}), {
        status: 400,
        headers: {
          "content-type": "application/json",
        },
      });
    }

    try {
      let node = await getNode()
      globalWallet.setDaemonConnection(node)
      // console.log(`[+] Set node to ${node}`)
    } catch (error) {
      console.error("[!] Failed to set daemon connection:", error);
      // Continue with existing connection if setting new node fails
    }

    const txRes: CheckTxKey = await checkTxKey(txhash!, viewkey!, address!);

    return new Response(JSON.stringify(txRes), {
      status: 200,
      headers: {
        "content-type": "application/json",
      },
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[!] Server error:", error);
    
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: errorMessage
    }), {
      status: 500,
      headers: {
        "content-type": "application/json",
      },
    });
  }
});
