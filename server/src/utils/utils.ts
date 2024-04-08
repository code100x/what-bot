import { Keypair, PublicKey } from "@solana/web3.js";
import { connection } from "../config";
export const getWalletAddressByPhoneNumber = (
  phoneNumber: string
): string | null => {
  //update this to get the wallet address from the database
  const walletAddress = Keypair.generate().publicKey.toBase58();
  return walletAddress;
};

export const getSOLBalanceByWalletAddress = async (
  walletAddress: string
): Promise<number> => {
  const solBalance = await connection.getBalance(new PublicKey(walletAddress));

  return solBalance;
};

export const sleep = (seconds: number) =>
  new Promise((resolve) => setTimeout(resolve, seconds * 1000));
