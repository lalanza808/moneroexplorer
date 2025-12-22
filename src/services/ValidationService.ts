import moneroTs from "monero-ts";

export class ValidationService {
  static validateInputs(txhash: string | null, viewkey: string | null, address: string | null): string | null {
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
      return "Invalid Monero address";
    }

    return null;
  }
}