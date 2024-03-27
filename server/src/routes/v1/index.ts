import { Router } from "express";

const router = Router();

router.post("/signup", (req, res) => {
    res.json({
        "publicKey": "0xEA77DFF82341189D2559008089c6ef0Dbdc323",
        "message": "We've created a new wallet for you with the public key 0xEA77DFF82341189D2559008089c6ef0Dbdc323"
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