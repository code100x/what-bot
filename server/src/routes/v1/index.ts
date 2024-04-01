import { Router } from "express";
import web3 from "@solana/web3.js";
import { PrismaClient } from "@prisma/client";

const client = new PrismaClient();
const router = Router();

router.post("/signup", async (req, res) => {
  const number = req.body.number
  const user = await client.user.findFirst({
    where: {
      phone: number,
    }
  });
  if (user) {
    return res.status(411).json({
      message: "User already exists"
    })
  }

  const keypair = web3.Keypair.generate();
  await client.user.create({
    data: {
      phone: number,
      privateKeys: {
        create: {
          privateKey: keypair.secretKey.toString(),
          publicKey: keypair.publicKey.toBase58()
        }
      }
    }
  })
  res.json({
    "publicKey": keypair.publicKey.toBase58(),
    "message": `We've created a new wallet for you with the public key ${keypair.publicKey.toBase58()}`
  });
});

router.post("/quote", (req, res) => {
  res.json({
    "message": "You can buy 20000 BONK for 2 SOL",
    "canBuy": 20000,
    "willSell": 2 // User will have to sell 2 SOL to get 2000 BONK
  });
});

router.post("/buy", (req, res) => {
  res.json({
    "quantityBought": 20000,
    "quantitySold": 2, // 2 sol was spent to buy 20000 BONK
    "message": "You converted 2 SOL into 20000 BONK"
  })
});

router.post("/balance", (req, res) => {
  res.json({
    "quantity": 20000,
    "message": "You have 20000 SOL"
  });
});

export default router;
