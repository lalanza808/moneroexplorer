export interface CheckTxKey {
  status: string;
  message?: string;
  data?: {
    confirmations: number;
    mempool: boolean;
    amount: number;
  };
}

export interface ValidationError {
  error: string;
}

export interface ServerError {
  error: string;
  message: string;
}
export interface Mempool {
  tx_hash: string,
  tx_hash_clean: string,
  tx_size: number,
  age: string | number,
  timestamp: number,
  fee: number
}

export interface Blocks {
  age: number,
  height: number,
  num_txes: number,
  size: number | string
}

export interface Network {
  height: string,
  network: string,
  hash_rate: string,
  tx_count: number
}

export interface Transaction {
  height: number,
  hash: string,
  timestamp: number,
  date: string,
  confirmations: number,
  tx_json: object,
  current_height: number
}