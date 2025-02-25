export interface BatchResponse {
  batchIndex: number;
  success: boolean;
  message: string;
  transactionHash?: string;
  error?: string;
  processedRequests: number;
  totalRequests: number;
  requests: {
    tokenMint: string;
    amount: number;
    mnemonics: string;
    decimals: number;
  }[];
}
