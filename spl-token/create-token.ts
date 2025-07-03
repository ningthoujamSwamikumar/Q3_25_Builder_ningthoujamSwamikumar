import { AccountLayout, createMint, createSyncNativeInstruction, getOrCreateAssociatedTokenAccount, mintTo, NATIVE_MINT, syncNative, TOKEN_PROGRAM_ID, transfer } from "@solana/spl-token";
import { clusterApiUrl, Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, sendAndConfirmTransaction, SystemProgram, Transaction } from "@solana/web3.js";
import dotenv from "dotenv";
dotenv.config({ "path": "../.env" });
import bs58 from "bs58";

import devWallet from "./dev-wallet.json";
import turbine3Wallet from "./Turbin3-wallet.json";
import { writeFileSync } from "fs";
import { join } from "path";

import token_mint from "./_token_mint.json";

const transferToken = async () => {
    const connection = new Connection(clusterApiUrl("devnet"));
    const wallet = Keypair.fromSecretKey(new Uint8Array(devWallet));

    const turbin3 = Keypair.fromSecretKey(bs58.decode(turbine3Wallet.toString()));
    console.log("lets send wrap sol from dev wallet to turbine3 wallet");
    console.log(`dev wallet: ${wallet.publicKey.toBase58()}\nturbin3 wallet: ${turbin3.publicKey.toBase58()}`);

    const turbin3Ata = await getOrCreateAssociatedTokenAccount(connection, wallet, NATIVE_MINT, turbin3.publicKey);
    const walletAta = await getOrCreateAssociatedTokenAccount(connection, wallet, NATIVE_MINT, wallet.publicKey);

    /*
    const txn = new Transaction().add(
        SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: walletAta.address, lamports: 1 * LAMPORTS_PER_SOL }),
        createSyncNativeInstruction(walletAta.address)
    );
    const sign = await sendAndConfirmTransaction(connection, txn, [wallet]);
    console.log(`transfer sol to wrap sol token succeed.\ncheck your tx at https://explorer.solana.com/tx/${sign}?cluster=devnet`);
    */

    const tokenTransferSig = await transfer(
        connection,
        wallet,
        walletAta.address,
        turbin3Ata.address,
        wallet,
        1 * LAMPORTS_PER_SOL,
        [wallet]
    );
    console.log(`Wrap SOL token transfer succeeded. \n Check tx at https://explorer.solana.com/tx/${tokenTransferSig}?cluster=devnet`);
}

transferToken()

//wrap sol in a token to be able to use it as token in token swaps, liquidity pool, etc.
const wrapSol = async () => {
    /*
    step1: send SOL to an associated token account on NATIVE MINT
    step2: call syncNative to update the amount field with the amount of SOL
    */
    const connection = new Connection(clusterApiUrl("devnet"), "confirmed");
    const wallet = Keypair.fromSecretKey(new Uint8Array(devWallet));

    try {
        const ata = await getOrCreateAssociatedTokenAccount(
            connection,
            wallet,
            NATIVE_MINT,
            wallet.publicKey
        );

        const transferIx = SystemProgram.transfer({ fromPubkey: wallet.publicKey, toPubkey: ata.address, lamports: 5 * 10000 });
        const syncIx = createSyncNativeInstruction(ata.address, TOKEN_PROGRAM_ID);

        const tx = new Transaction().add(transferIx, syncIx);
        const signature = await sendAndConfirmTransaction(connection, tx, [wallet]);

        console.log("Sol wrap succeeded!");
        console.log(`Check your tx at https://explorer.solana.com/tx/${signature}?cluster=devnet`);
    } catch (e) {
        console.error("error:", e);
    }
}

//wrapSol()

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

