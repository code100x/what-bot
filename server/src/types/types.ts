import { Percent, Token, TokenAmount } from "@raydium-io/raydium-sdk";

export type quoteInputInfo = {
  outputToken: Token;
  targetPool: string;
  inputTokenAmount: TokenAmount;
  slippage: Percent;
};
