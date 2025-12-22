import moneroTs from "monero-ts";

interface CheckTxKey {
  status: string,
  data: {
    confirmations: number,
    mempool: boolean,
    amount: number
  };
}

let globalWallet: any = null;

async function getNode(): Promise<string> {
  try {
    let contents = await Deno.readTextFile("nodes.json");
    let nodes = JSON.parse(contents);
    const randIndex = Math.floor(Math.random() * nodes.length);
    return nodes[randIndex];
  } catch {
    return "https://node.sethforprivacy.com"
  }
}

async function initializeWallet(): Promise<void> {
  const node = await getNode();
  console.log(`[.] Initializing wallet...`);
  
  globalWallet = await moneroTs.createWalletFull({
    // password: "",
    networkType: moneroTs.MoneroNetworkType.MAINNET,
    server: {
      uri: node
    }
  });
  
  console.log("[+] Wallet initialized successfully");
}

async function checkTxKey(txhash: string, txsecret: string, address: string): Promise<CheckTxKey> {
  if (!globalWallet) {
    throw new Error("[!] Wallet not initialized");
  }

  let check = await globalWallet.checkTxKey(txhash, txsecret, address);

  let amount = moneroTs.MoneroUtils.atomicUnitsToXmr(check.getReceivedAmount());
  if (amount === 0) {
    check.setIsGood(false);
  }

  let checkStatus: string;
  if (check.getIsGood()) {
    checkStatus = "success";
  } else {
    checkStatus = "error"
  }

  const res: CheckTxKey = {
    status: checkStatus,
    data: {
      confirmations: check.getNumConfirmations(),
      mempool: check.getInTxPool(),
      amount: amount
    }
  }

  return res
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
await initializeWallet();

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const txhash = url.searchParams.get("txhash");
  const viewkey = url.searchParams.get("viewkey");
  const address = url.searchParams.get("address");
  // const txprove = url.searchParams.get("txprove")

  let node = await getNode()
  globalWallet.setDaemonConnection(node)
  // console.log(`[+] Set node to ${node}`)

  if (!txhash || !viewkey || !address) {
    return new Response(JSON.stringify({error: "Missing required parameters: txhash, viewkey, address"}), {
      status: 400,
      headers: {
        "content-type": "application/json",
      },
    });
  }

  const txRes: CheckTxKey = await checkTxKey(txhash, viewkey, address);

  return new Response(JSON.stringify(txRes), {
    status: 200,
    headers: {
      "content-type": "application/json",
    },
  });
});
