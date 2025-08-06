export interface LogicalTokenMetadata {
  tokenName: string;
  tokenSymbol: string;
  uom: string;
  maxSupply: number;
  tokenDescription: string;
}

export interface OnChainTokenMetadata {
  name: string;
  symbol: string;
  uri: string;
}
