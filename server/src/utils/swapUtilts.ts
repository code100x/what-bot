import {
  ApiPoolInfoV4,
  LIQUIDITY_STATE_LAYOUT_V4,
  Liquidity,
  LiquidityPoolKeys,
  MARKET_STATE_LAYOUT_V3,
  Market,
  SPL_MINT_LAYOUT,
  jsonInfo2PoolKeys,
} from "@raydium-io/raydium-sdk";
import { sleep } from "../utils/utils";
import { connection } from "../config";
import { Connection, PublicKey } from "@solana/web3.js";
import { quoteInputInfo } from "../types/types";
export async function swapQuote(input: quoteInputInfo) {
  try {
    const targetPoolInfo = await formatAmmKeysById(input.targetPool);

    if (!targetPoolInfo) throw new Error("cannot find the target pool");
    const poolKeys = jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys;

    const poolInfo = await fetchInfoWithRetrys(poolKeys);

    if (!poolInfo) {
      throw new Error("Couldn't fetch pool info, quote fetch failed");
    }

    const {
      amountOut,
      minAmountOut,
      currentPrice,
      priceImpact,
      executionPrice,
    } = Liquidity.computeAmountOut({
      poolKeys: poolKeys,
      poolInfo: poolInfo,
      amountIn: input.inputTokenAmount,
      currencyOut: input.outputToken,
      slippage: input.slippage,
    });

    const quote = {
      amountOut: amountOut.toFixed(),
      minAmountOut: minAmountOut.toFixed(),
      currentPrice,
      priceImpact,
      executionPrice,
    };

    return { quote };
  } catch (error) {
    console.error("couldn't get a quote :", error);
    return { error: error };
  }
}
export async function fetchInfoWithRetrys(
  poolKeys: LiquidityPoolKeys,
  maxRetries = 3,
  initialRetryDelaySeconds = 0.2
) {
  let currentAttempt = 0;
  let retryDelaySeconds = initialRetryDelaySeconds;
  while (currentAttempt < maxRetries) {
    try {
      const poolInfo = await Liquidity.fetchInfo({
        connection: connection,
        poolKeys: poolKeys,
      });
      return poolInfo;
    } catch (error) {
      currentAttempt++;
      console.log(`Attempt ${currentAttempt} failed:`, error);
      if (currentAttempt >= maxRetries) {
        console.log(
          `${maxRetries} attempts failed , failed to fetch info. User swap failed`,
          error
        );
        throw error;
      }
      await sleep(retryDelaySeconds);
      retryDelaySeconds *= 3;
    }
  }
}
export async function formatAmmKeysById(id: string): Promise<ApiPoolInfoV4> {
  const account = await connection.getAccountInfo(new PublicKey(id));
  if (account === null) {
    const errorCode = "POOL_NOT_LIVE_OR_NOT_EXIST";
    throw new Error(
      `${errorCode}: Pool not live yet or pool doesn't exist yet`
    );
  }
  const info = LIQUIDITY_STATE_LAYOUT_V4.decode(account.data);

  const marketId = info.marketId;
  const marketAccount = await connection.getAccountInfo(marketId);
  if (marketAccount === null) throw Error(" get market info error");
  const marketInfo = MARKET_STATE_LAYOUT_V3.decode(marketAccount.data);

  const lpMint = info.lpMint;
  const lpMintAccount = await connection.getAccountInfo(lpMint);
  if (lpMintAccount === null) throw Error(" get lp mint info error");
  const lpMintInfo = SPL_MINT_LAYOUT.decode(lpMintAccount.data);

  return {
    id,
    baseMint: info.baseMint.toString(),
    quoteMint: info.quoteMint.toString(),
    lpMint: info.lpMint.toString(),
    baseDecimals: info.baseDecimal.toNumber(),
    quoteDecimals: info.quoteDecimal.toNumber(),
    lpDecimals: lpMintInfo.decimals,
    version: 4,
    programId: account.owner.toString(),
    authority: Liquidity.getAssociatedAuthority({
      programId: account.owner,
    }).publicKey.toString(),
    openOrders: info.openOrders.toString(),
    targetOrders: info.targetOrders.toString(),
    baseVault: info.baseVault.toString(),
    quoteVault: info.quoteVault.toString(),
    withdrawQueue: info.withdrawQueue.toString(),
    lpVault: info.lpVault.toString(),
    marketVersion: 3,
    marketProgramId: info.marketProgramId.toString(),
    marketId: info.marketId.toString(),
    marketAuthority: Market.getAssociatedAuthority({
      programId: info.marketProgramId,
      marketId: info.marketId,
    }).publicKey.toString(),
    marketBaseVault: marketInfo.baseVault.toString(),
    marketQuoteVault: marketInfo.quoteVault.toString(),
    marketBids: marketInfo.bids.toString(),
    marketAsks: marketInfo.asks.toString(),
    marketEventQueue: marketInfo.eventQueue.toString(),
    lookupTableAccount: PublicKey.default.toString(),
  };
}
