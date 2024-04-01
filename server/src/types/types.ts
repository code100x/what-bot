import { Percent, Token, TokenAmount } from "@raydium-io/raydium-sdk";
import { getWalletTokenAccounts } from "../utils/swapUtilts";

export type quoteInputInfo = {
  outputToken: Token;
  targetPool: string;
  inputTokenAmount: TokenAmount;
  slippage: Percent;
};
export type WalletTokenAccounts = Awaited<
  ReturnType<typeof getWalletTokenAccounts>
>;
export interface TokenInfo {
  mint: string;
  decimals: number;
}
