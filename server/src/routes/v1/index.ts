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

const client = new PrismaClient();
const router = Router();

router.post("/signup", async (req, res) => {
  const number = req.body.number;
  const user = await client.user.findFirst({
    where: {
      phone: number,
    },
  });
  if (user) {
    return res.status(411).json({
      message: "User already exists",
    });
  }

  const keypair = web3.Keypair.generate();
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
    publicKey: keypair.publicKey.toBase58(),
    message: `We've created a new wallet for you with the public key ${keypair.publicKey.toBase58()}`,
  });
});

router.post("/quote", (req, res) => {
  res.json({
    message: "You can buy 20000 BONK for 2 SOL",
    canBuy: 20000,
    willSell: 2, // User will have to sell 2 SOL to get 2000 BONK
  });
});

router.post("/buy", (req, res) => {
  res.json({
    quantityBought: 20000,
    quantitySold: 2, // 2 sol was spent to buy 20000 BONK
    message: "You converted 2 SOL into 20000 BONK",
  });
});

router.post("/balance", (req, res) => {
  //assuming there is something like a phone number being sent in the req body
  const phoneNumber = req.body.phoneNumber;
  const walletAddress = getWalletAddressByPhoneNumber(phoneNumber);
  if (!walletAddress) {
    return res
      .status(404)
      .json({ message: "Wallet not found for the provided phone number" });
  }
  const solBalance = getSOLBalanceByWalletAddress(walletAddress);

  res.json({
    quantity: solBalance,
    message: `You have  ${solBalance} SOL`,
  });
});

router.get("/dummy-quote", async (req, res) => {
  try {
    // Hardcoded parameters
    const inputMint = "So11111111111111111111111111111111111111112";
    const outputMint = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
    const amount = 100000; // in lamports
    const slippage = new Percent(10000, 100);

    // const poolData = await queryPoolData(inputMint, outputMint);
    const poolData = {
      JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: {
        mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
        decimals: 6,
      },
      So11111111111111111111111111111111111111112: {
        mint: "So11111111111111111111111111111111111111112",
        decimals: 9,
      },
      poolId: "EYErUp5muPYEEkeaUCY22JibeZX7E9UuMcJFZkmNAN7c",
    };

    if (!poolData) {
      return res.status(404).json({ message: "Pool data not found." });
    }

    const inputTokenInfo = { mint: inputMint, decimals: 9 };
    const outputTokenInfo = { mint: outputMint, decimals: 6 };

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

    const inputTokenAmount = new TokenAmount(inputToken, amount);

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
        message: "Quote fetched successfully",
        swapQuote: {
          inputMint: inputTokenInfo.mint,
          inputMintDecimals: inputTokenInfo.decimals,
          outputMint: outputTokenInfo.mint,
          outputMintDecimals: outputTokenInfo.decimals,
          amountIn: amount,
          amountOut: quoteResult.quote.amountOut,
          minAmountOut: quoteResult.quote.minAmountOut,
          quote: quoteResult.quote,
          ammKey: poolData.poolId,
          slippage: slippage.toString(),
        },
      });
    } catch (error: any) {
      console.error("Swap quote error:", error.message);
      return res
        .status(500)
        .json({ message: error.message || "Error fetching swap quote" });
    }
  } catch (error: any) {
    console.error("Error in getting quote:", error.message);
    res.status(500).send("Error in getting quote");
  }
});
router.get("/dummy-swap", async (req, res) => {
  try {
    // Hardcoded parameters
    const inputMint = "So11111111111111111111111111111111111111112";
    const inputMintDecimals = 9;
    const outputMint = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
    const outputMintDecimals = 6;
    const amountIn = 100000; // in lamports
    const wallet = Keypair.generate();
    // const poolData = await queryPoolData(inputMint, outputMint);
    const poolData = {
      JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: {
        mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
        decimals: 6,
      },
      So11111111111111111111111111111111111111112: {
        mint: "So11111111111111111111111111111111111111112",
        decimals: 9,
      },
      poolId: "EYErUp5muPYEEkeaUCY22JibeZX7E9UuMcJFZkmNAN7c",
    };

    if (!poolData) {
      return res.status(404).json({ message: "Pool data not found." });
    }

    await swap(
      { mint: inputMint, decimals: inputMintDecimals },
      { mint: outputMint, decimals: outputMintDecimals },
      poolData.poolId,
      wallet,
      BigInt(amountIn),
      1000000,
      20000 //20%
    );
  } catch (error: any) {
    console.error("Error in getting quote:", error.message);
    res.status(500).send("Error in getting quote");
  }
});
export default router;
