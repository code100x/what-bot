import { Router } from "express";
import web3, { Keypair, PublicKey } from "@solana/web3.js";
import { PrismaClient } from "@prisma/client";
import {
  getSOLBalanceByWalletAddress,
  getWalletAddressByPhoneNumber,
} from "../../utils/utils";
import {
  Percent,
  TOKEN_PROGRAM_ID,
  Token,
  TokenAmount,
} from "@raydium-io/raydium-sdk";
import { swap, swapQuote } from "../../utils/swapUtilts";
import { getUser } from "../../db/user";
import { SUPPORTED_TOKENS, dbPrivateKeyToWallet } from "../../utils";

const client = new PrismaClient();
const router = Router();

router.post("/pubkey", async (req, res) => {
  const number = req.body.number;
  const user = await client.user.findFirst({
    where: {
      phone: number,
    },
    include: {
      privateKeys: true
    }
  });
  if (user) {
    return res.status(200).json({
      status: 200,
      message: `Your pubkey is ${user.privateKeys[0]?.publicKey}`,
      publicKey: user.privateKeys[0]?.publicKey
    });
  }

  res.status(411).json({
    status: 411,
    message: `You don't yet have an account with us. Please sign up first.`,
  });
});

router.post("/signup", async (req, res) => {
  const number = req.body.number;
  const user = await client.user.findFirst({
    where: {
      phone: number,
    },
    include: {
      privateKeys: true,
    }
  });
  if (user) {
    return res.status(411).json({
      status: 411,
      message: `You already have an account with pubkey ${user.privateKeys[0]?.publicKey}`,
      publicKey: user.privateKeys[0]?.publicKey
    });
  }

  const keypair = web3.Keypair.generate();
  //TODO: Hash the private key at the very least here before alpha launch
  // Preferably let's create a Shamir's secret/MPC 
  await client.user.create({
    data: {
      phone: number,
      privateKeys: {
        create: {
          privateKey: keypair.secretKey.toString(),
          publicKey: keypair.publicKey.toBase58(),
        },
      },
    },
  });
  res.json({
    status: 200,
    publicKey: keypair.publicKey.toBase58(),
    message: `We've created a new wallet for you with the public key ${keypair.publicKey.toBase58()}`,
  });
});

router.post("/balance", async (req, res) => {
  //assuming there is something like a phone number being sent in the req body
  const phoneNumber = req.body.number;
  const walletAddress = await getUser(phoneNumber);
  if (!walletAddress) {
    return res
      .status(404)
      .json({ status: 400, message: "Wallet not found for the provided phone number" });
  }
  const solBalance = await getSOLBalanceByWalletAddress(walletAddress.privateKeys[0].publicKey);

  res.json({
    status: 200,
    quantity: solBalance,
    message: `You have  ${solBalance / 1000_000_000} SOL`,
  });
});

router.post("/quote", async (req, res) => {
  const user = await getUser(req.body.number);
  if (!user) {
    return res.status(404).json({ status: 404, message: "User not found" });
  }

  try {
    const inputMint = "So11111111111111111111111111111111111111112";
    const outputTokenInformation = SUPPORTED_TOKENS.find(x => x.symbol === req.body.quoteAsset) ?? null;
    if (!outputTokenInformation) {
      return res.status(404).json({ message: "Output mint not found." });
    }

    const amountIn = 1000_000_000 * Number(req.body.amount); // in lamports
    const wallet = dbPrivateKeyToWallet(user.privateKeys[0].privateKey);
    const slippage = new Percent(10000, 100);

    // const poolData = await queryPoolData(inputMint, outputMint);
    const poolData = {
      [outputTokenInformation.mint]: {
        mint: outputTokenInformation.mint,
        decimals: 6,
      },
      So11111111111111111111111111111111111111112: {
        mint: "So11111111111111111111111111111111111111112",
        decimals: 9,
      },
      poolId: outputTokenInformation.poolId,
    };

    if (!poolData) {
      return res.status(404).json({ message: "Pool data not found." });
    }

    const inputTokenInfo = { mint: inputMint, decimals: 9 };
    const outputTokenInfo = { mint: outputTokenInformation.mint, decimals: 6 };

    const inputToken = new Token(
      TOKEN_PROGRAM_ID,
      new PublicKey(inputTokenInfo.mint),
      inputTokenInfo.decimals
    );

    const outputToken = new Token(
      TOKEN_PROGRAM_ID,
      new PublicKey(outputTokenInfo.mint),
      outputTokenInfo.decimals
    );

    const inputTokenAmount = new TokenAmount(inputToken, amountIn);

    try {
      const quoteResult = await swapQuote({
        outputToken,
        targetPool: poolData.poolId,
        inputTokenAmount,
        slippage,
      });

      if (!quoteResult?.quote?.amountOut || !quoteResult?.quote?.minAmountOut) {
        throw new Error("Invalid quote structure received.");
      }

      return res.status(200).json({
        message: `You can get ${quoteResult.quote.amountOut} ${req.body.quoteAsset} for ${req.body.amount} SOL`
      });
    } catch (error: any) {
      console.error("Swap quote error:", error.message);
      return res
        .status(500)
        .json({ status: 500, message: error.message || "Error fetching swap quote" });
    }
  } catch (error: any) {
    console.error("Error in getting quote:", error.message);
    res.status(500).json({ message: "Error in getting quote", status: 500 });
  }
});

router.post("/buy", async (req, res) => {
  const user = await getUser(req.body.number);
  if (!user) {
    return res.status(404).json({ status: 404, message: "User not found" });
  }

  try {
    // Hardcoded parameters
    const inputMint = "So11111111111111111111111111111111111111112";
    const inputMintDecimals = 9;
    const outputToken = SUPPORTED_TOKENS.find(x => x.symbol === req.body.quoteAsset) ?? null;
    if (!outputToken) {
      return res.status(404).json({ status: 404, message: "Output mint not found." });
    }

    const amountIn = 1000_000_000 * Number(req.body.amount); // in lamports
    const wallet = dbPrivateKeyToWallet(user.privateKeys[0].privateKey);
    console.log(`wallet is ${wallet.publicKey.toBase58()}`)

    const poolData = {
      [outputToken.mint]: {
        mint: outputToken.mint,
        decimals: 6,
      },
      So11111111111111111111111111111111111111112: {
        mint: "So11111111111111111111111111111111111111112",
        decimals: 9,
      },
      poolId: outputToken.poolId,
    };

    if (!poolData) {
      return res.status(404).json({ message: "Pool data not found." });
    }

    const response = await swap(
      { mint: inputMint, decimals: inputMintDecimals },
      { mint: outputToken.mint, decimals: outputToken.decimals },
      poolData.poolId,
      wallet,
      BigInt(amountIn),
      6000000,
      2000 //2%
    );

    if (response?.error) {
      return res.status(500).json({
        status: 500,
        message: response.error,
      });
    }

    return res.json({
      status: 200,
      message: `Submitted txn with signature: https://solscan.io/tx/${response?.txid}`,
    });

  } catch (error: any) {
    console.error("Error in getting quote:", error.message);
    res.status(500).json({
      status: 500,
      message: "Error while swapping"
    });
  }
});

export default router;
