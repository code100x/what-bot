import {
  Liquidity,
  LiquidityPoolKeys,
  TxVersion,
  jsonInfo2PoolKeys,
} from "@raydium-io/raydium-sdk";
import { Connection, Keypair } from "@solana/web3.js";
import {
  formatAmmKeysById,
  fetchInfoWithRetrys,
  buildAndSendTx,
} from "./swapUtilts";

export async function swapOnlyAmm(
  outputToken: Token,
  targetPool: string,
  inputTokenAmount: TokenAmount,
  slippagePercentage: Percent,
  walletTokenAccounts: WalletTokenAccounts,
  wallet: Keypair,
  priorityFee: number,
  connection: Connection,
  mevProtection: mevProtectionOptions,
  feePercent: number = BASE_FEE
) {
  try {
    console.time("Getting recent prioritization fees and target pool info");
    const [recentPriorityFee, targetPoolInfo] = await Promise.all([
      getRecentPrioritizationFees(),
      formatAmmKeysById(targetPool),
    ]);
    console.timeEnd("Getting recent prioritization fees and target pool info");
    if (!targetPoolInfo) throw new Error("cannot find the target pool");

    if (priorityFee == NITRO) {
      priorityFee = Math.min(
        priorityFee,
        Math.floor(recentPriorityFee.veryHigh * 1.01)
      );
    } else if (priorityFee == FAST) {
      priorityFee = Math.min(
        priorityFee,
        Math.floor(recentPriorityFee.high * 1.7)
      );
    }

    const poolKeys = jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys;

    // -------- step 1: compute amount out --------
    const poolInfo = await fetchInfoWithRetrys(poolKeys, connection);

    if (!poolInfo) {
      throw new Error("Couldn't fetch pool info, quote fetch failed");
    }
    const { amountOut, minAmountOut } = Liquidity.computeAmountOut({
      poolKeys: poolKeys,
      poolInfo: poolInfo,
      amountIn: inputTokenAmount,
      currencyOut: outputToken,
      slippage: slippagePercentage,
    });

    const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
      connection: connection,
      poolKeys,
      userKeys: {
        tokenAccounts: walletTokenAccounts,
        owner: wallet.publicKey,
      },
      amountIn: inputTokenAmount,
      amountOut: minAmountOut,
      fixedSide: "in",
      makeTxVersion: TxVersion.V0,
      computeBudgetConfig: {
        microLamports:
          mevProtection === "on" ? 0 : Math.floor(priorityFee * 12.5),
        units: mevProtection === "on" ? 0 : 70000,
      },
      lookupTableCache: {},
    });

    innerTransactions[0].instructions.push(transferInstruction);

    console.log("Swap attempted for the following parameters", {
      UserWallet: wallet.publicKey.toBase58(),
      InputAmount: inputTokenAmount.raw.toString(),
      OutputToken: outputToken.mint.toBase58(),
      AmountOut: amountOut.toFixed(),
      MinOutAmount: minAmountOut.toFixed(),
      PriorityFee: (priorityFee * 0.875) / 10 ** 9 + " SOL",
      Slippage: parseInt(slippagePercentage.toFixed(0)) * 100,
      rpcUrl: connection.rpcEndpoint.toString(),
      mevProtection: mevProtection,
      Date: Date.now(),
    });
    // Execute the transaction
    const signature = await buildAndSendTx(wallet, innerTransactions, {
      skipPreflight: true,
      preflightCommitment: "confirmed",
    });

    console.log("swap tx succeeded:", signature);
    return { txid: signature, error: null };
  } catch (error: any) {
    console.log(error);
    console.log("swap tx failed:", error.reason);
    return { txid: null, error: error };
  }
}
