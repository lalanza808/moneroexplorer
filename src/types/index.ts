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