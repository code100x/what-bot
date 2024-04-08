import { Keypair } from "@solana/web3.js";

export const SUPPORTED_TOKENS = [{
    symbol: "USDC",
    mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    decimals: 6,
    poolId: "58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2"
}, {
    symbol: "JUP",
    mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
    decimals: 6,
    poolId: "EYErUp5muPYEEkeaUCY22JibeZX7E9UuMcJFZkmNAN7c"
}, {
    symbol: "BONK",
    mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
    decimals: 5,
    poolId: "HVNwzt7Pxfu76KHCMQPTLuTCLTm6WnQ1esLv4eizseSv"
}];


export const dbPrivateKeyToWallet = (privateKey: string) => {
    const numbersArray = privateKey.split(',').map(Number);

    // Converting to Uint8Array
    const uint8Array = new Uint8Array(numbersArray);

    const keypair = Keypair.fromSecretKey(uint8Array);
    return keypair
}