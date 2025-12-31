import moneroTs from "monero-ts";
import { CheckTxKey } from "../types.ts";
import { NodeService } from "./NodeService.ts";

export class WalletService {
  private static wallet: any = null;

  static async initialize(): Promise<void> {
    try {
      const node = await NodeService.getNode();
      await NodeService.make_json_rpc_request("get_info")
      this.wallet = await moneroTs.createWalletFull({
        networkType: moneroTs.MoneroNetworkType.MAINNET,
        server: {
          uri: node
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw new Error(`Backend initialization failed: ${errorMessage}`);
    }
  }

  static async checkTxKey(txhash: string, txsecret: string, address: string): Promise<CheckTxKey> {
    if (!this.wallet) {
      throw new Error("[!] Wallet not initialized");
    }

    try {
      const check = await this.wallet.checkTxKey(txhash, txsecret, address);

      const amount = moneroTs.MoneroUtils.atomicUnitsToXmr(check.getReceivedAmount());
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
        };
      }

      const res: CheckTxKey = {
        status: checkStatus,
        data: {
          confirmations: check.getNumConfirmations(),
          mempool: check.getInTxPool(),
          amount: amount
        }
      };

      return res;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        status: "fail",
        message: errorMessage
      };
    }
  }

  static async updateNode(): Promise<void> {
    if (!this.wallet) return;
    
    try {
      const node = await NodeService.getNode();
      this.wallet.setDaemonConnection(node);
    } catch (error) {
      console.error("[!] Failed to set daemon connection:", error);
    }
  }

  static async shutdown(): Promise<void> {
    console.log("[.] Shutting down gracefully...");
    if (this.wallet) {
      await this.wallet.close();
    }
    await moneroTs.shutdown();
    console.log("[-] Shutdown complete");
  }
}