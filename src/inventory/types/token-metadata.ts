export interface LogicalTokenMetadata {
  tokenName: string;
  tokenSymbol: string;
  tokenDescription: string;
  uom: string;
  maxSupply: number;
}

export interface OnChainTokenMetadata {
  name: string;
  symbol: string;
  uri: string;
}
