import { AccountLayout, createMint, getOrCreateAssociatedTokenAccount, mintTo, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import dotenv from "dotenv";
dotenv.config({ "path": "../.env" });

import devWallet from "./dev-wallet.json";
import { writeFileSync } from "fs";
import { join } from "path";

import token_mint from "./_token_mint.json";

//get all token accounts
const allTokenAccounts = async () => {
    const connection = new Connection(clusterApiUrl("devnet"));
    const owner = Keypair.fromSecretKey(new Uint8Array(devWallet));

    const tokenAccounts = await connection.getTokenAccountsByOwner(
        owner.publicKey,
        { mint: new PublicKey(token_mint), programId: TOKEN_PROGRAM_ID }
    );

    tokenAccounts.value.forEach(acc => {
        const accountData = AccountLayout.decode(acc.account.data);
        console.log(`token account: ${acc.pubkey} has`, accountData, `for token: ${acc.account.owner}`);
    });
}

allTokenAccounts();

//create a mint
const creatToken = async () => {
    const payer = Keypair.fromSecretKey(new Uint8Array(devWallet));

    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");

    const mint = token_mint ? new PublicKey(token_mint) : await createMint(connection, payer, payer.publicKey, null, 6);
    console.log("mint: ", mint.toBase58());

    if (!token_mint) {
        writeFileSync(join(__dirname, "_token_mint.json"), JSON.stringify(mint.toBase58()));
        console.log("mint written to _token_mint.json", mint.toBase58());
    }

    const ata = await getOrCreateAssociatedTokenAccount(connection, payer, mint, payer.publicKey);
    console.log("ata:", ata.address);

    const tx = await mintTo(connection, payer, mint, ata.address, payer.publicKey, 5 * 1000000);
    console.log("Minted token successfully.");
    console.log(`Check your tx at https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    const account = await connection.getAccountInfo(payer.publicKey);
    console.log("account: ", account);
}

//creatToken();

//create a dev wallet
const createWallet = async () => {
    //const rpcUrl = process.env.HELIUS_RPC_URL;
    const rpcUrl = clusterApiUrl("devnet");
    console.log("rpcUrl:", rpcUrl);
    const connection = new Connection(rpcUrl, "confirmed");

    const wallet = devWallet ? Keypair.fromSecretKey(new Uint8Array(devWallet)) : Keypair.generate();
    console.log("dev wallet:", wallet.secretKey);

    const airdropSignature = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);

    const recentBlockhash = await connection.getLatestBlockhash();
    await connection.confirmTransaction({
        signature: airdropSignature,
        blockhash: recentBlockhash.blockhash,
        lastValidBlockHeight: recentBlockhash.lastValidBlockHeight,
    }, "confirmed");


    console.log("Success. transaction signature: ", `https://explorer.solana.com/tx/${airdropSignature}?cluster=devnet`);
}

//createWallet();
