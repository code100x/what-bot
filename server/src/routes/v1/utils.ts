import { Keypair } from "@solana/web3.js";

export const getWalletAddressByPhoneNumber = (
  phoneNumber: string
): string | null => {
  //update this to get the wallet address from the database
  const walletAddress = Keypair.generate().publicKey.toBase58();
  return walletAddress;
};

export const getSOLBalanceByWalletAddress = (walletAddress: string): number => {
  const walletBalances = {
    WalletAddressFor1234567890: 20000,
    WalletAddressFor0987654321: 15000,
  };

  return walletBalances[walletAddress] || 0;
};
