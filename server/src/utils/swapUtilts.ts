import {
  ApiPoolInfoV4,
  InnerSimpleV0Transaction,
  LIQUIDITY_STATE_LAYOUT_V4,
  Liquidity,
  LiquidityPoolKeys,
  MARKET_STATE_LAYOUT_V3,
  Market,
  Percent,
  SPL_ACCOUNT_LAYOUT,
  SPL_MINT_LAYOUT,
  TOKEN_PROGRAM_ID,
  Token,
  TokenAccount,
  TokenAmount,
  TxVersion,
  buildSimpleTransaction,
  jsonInfo2PoolKeys,
} from "@raydium-io/raydium-sdk";
import { sleep } from "../utils/utils";
import { connection } from "../config";
import {
  Connection,
  Keypair,
  PublicKey,
  SendOptions,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import { WalletTokenAccounts, quoteInputInfo } from "../types/types";
import bs58 from "bs58";
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
export async function swapOnlyAmm(
  outputToken: Token,
  targetPool: string,
  inputTokenAmount: TokenAmount,
  slippagePercentage: Percent,
  walletTokenAccounts: WalletTokenAccounts,
  wallet: Keypair,
  priorityFee: number = 1000000,
  connection: Connection
) {
  try {
    const targetPoolInfo = await formatAmmKeysById(targetPool);
    if (!targetPoolInfo) throw new Error("cannot find the target pool");
    const poolKeys = jsonInfo2PoolKeys(targetPoolInfo) as LiquidityPoolKeys;
    const poolInfo = await fetchInfoWithRetrys(poolKeys);

    if (!poolInfo) {
      throw new Error("Couldn't fetch pool info, quote fetch failed");
    }
    const amountOut = new TokenAmount(outputToken, 1);

    const { innerTransactions } = await Liquidity.makeSwapInstructionSimple({
      connection: connection,
      poolKeys,
      userKeys: {
        tokenAccounts: walletTokenAccounts,
        owner: wallet.publicKey,
      },
      amountIn: inputTokenAmount,
      amountOut: amountOut,
      fixedSide: "in",
      makeTxVersion: TxVersion.V0,
      computeBudgetConfig: {
        microLamports: Math.floor(priorityFee * 12.5),
        units: 70000,
      },
      lookupTableCache: {},
    });

    console.log("Swap attempted for the following parameters", {
      UserWallet: wallet.publicKey.toBase58(),
      InputAmount: inputTokenAmount.raw.toString(),
      OutputToken: outputToken.mint.toBase58(),
      AmountOut: amountOut.toFixed(),
      PriorityFee: (priorityFee * 0.875) / 10 ** 9 + " SOL",
      Slippage: parseInt(slippagePercentage.toFixed(0)) * 100,
      rpcUrl: connection.rpcEndpoint.toString(),
      Date: Date.now(),
    });
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
export async function buildAndSendTx(
  wallet: Keypair,
  innerSimpleV0Transaction: InnerSimpleV0Transaction[],
  options?: SendOptions
) {
  const willSendTx = await buildSimpleTransaction({
    makeTxVersion: TxVersion.V0,
    connection,
    payer: wallet.publicKey,
    innerTransactions: innerSimpleV0Transaction,
  });

  return await customSendAndConfirmTx(wallet, willSendTx[0], options);
}
export async function customSendAndConfirmTx(
  payer: Keypair,
  tx: VersionedTransaction | Transaction,
  options?: SendOptions
): Promise<string> {
  const startTime = Date.now();

  if (!(tx instanceof VersionedTransaction)) {
    throw new Error("Transaction type not supported");
  }
  tx.sign([payer]);
  let tx_signature: any = bs58.encode(tx.signatures[0]);
  connection.sendTransaction(tx, options);
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      connection
        .removeSignatureListener(subscriptionId)
        .then(() => {
          console.log(
            `Timeout: stopped listening for signature ${tx_signature}`
          );
        })
        .catch((error) => {
          console.error(
            `Failed to remove listener for signature ${tx_signature}:`,
            error
          );
        });
      reject(
        new Error(
          "Timeout: Swap did not complete within 60 seconds, assuming failed"
        )
      );
    }, 60000);
    const subscriptionId = connection.onSignature(
      tx_signature,
      (update, context) => {
        clearTimeout(timeoutId);
        connection
          .removeSignatureListener(subscriptionId)
          .then(() => {
            const endTime = Date.now();
            const duration = (endTime - startTime) / 1000;
            console.log("total time it took to confirm tx is :", duration);
            console.log(
              `Received confirmation for ${tx_signature} closed connection with status: `,
              update
            );
          })
          .catch((error) => {
            console.error(
              `Failed to unsubscribe from signature ${tx_signature}:`,
              error
            );
          });
        resolve(tx_signature);
      },
      "confirmed"
    );
  });
}
export async function getWalletTokenAccounts(
  connection: Connection,
  wallet: PublicKey,
  inputMint: PublicKey,
  outputMint: PublicKey
): Promise<TokenAccount[]> {
  const [inputMintAccounts, outputMintAccounts] = await Promise.all([
    connection.getTokenAccountsByOwner(wallet, {
      programId: TOKEN_PROGRAM_ID,
      mint: inputMint,
    }),
    connection.getTokenAccountsByOwner(wallet, {
      programId: TOKEN_PROGRAM_ID,
      mint: outputMint,
    }),
  ]);

  const combinedAccounts = [
    ...inputMintAccounts.value,
    ...outputMintAccounts.value,
  ];
  return combinedAccounts.map((i) => ({
    pubkey: i.pubkey,
    programId: i.account.owner,
    accountInfo: SPL_ACCOUNT_LAYOUT.decode(i.account.data),
  }));
}
