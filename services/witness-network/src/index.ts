import { ethers, Wallet, Contract } from "ethers";
import dotenv from "dotenv";

dotenv.config();

const {
    RPC_URL,
    PROPOSER_PRIVATE_KEY,
    VORTEX_VERIFIER_ADDRESS,
    PROPOSE_INTERVAL_MS
} = process.env;

if (!RPC_URL || !PROPOSER_PRIVATE_KEY || !VORTEX_VERIFIER_ADDRESS || !PROPOSE_INTERVAL_MS) {
    console.error("FATAL: One or more environment variables are missing. Please check your .env file or the script environment.");
    process.exit(1);
}

const VORTEX_VERIFIER_ABI = [
    "function proposeData(tuple(uint256 timestamp, bytes data) calldata _payload) external returns (bytes32)"
];

async function main() {
    console.log("🚀 Starting Witness Network Service...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log(`📡 Connected to RPC at ${RPC_URL}`);

    const proposerWallet = new Wallet(PROPOSER_PRIVATE_KEY!, provider);
    console.log(`👤 Proposer address: ${proposerWallet.address}`);

    const vortexVerifierContract = new Contract(VORTEX_VERIFIER_ADDRESS!, VORTEX_VERIFIER_ABI, proposerWallet);
    console.log(`🔗 Attached to VortexVerifier contract at ${VORTEX_VERIFIER_ADDRESS}`);

    console.log(`⏰ Starting proposal loop every ${PROPOSE_INTERVAL_MS} ms`);
    
    let proposalCount = 0;

    setInterval(async () => {
        proposalCount++;
        try {
            const timestamp = Math.floor(Date.now() / 1000);
            let data;
            let logMessage;

            // Every 3rd proposal, send fraudulent data
            if (proposalCount % 3 === 0) {
                logMessage = "😈 Proposing FRAUDULENT data...";
                data = ethers.toUtf8Bytes(`BTC/USD: 99999.99`);
            } else {
                const price = (Math.random() * (4000 - 3000) + 3000).toFixed(2);
                logMessage = `😇 Proposing valid data (ETH/USD: ${price})...`;
                data = ethers.toUtf8Bytes(`ETH/USD: ${price}`);
            }

            console.log(`\n[${new Date().toISOString()}] - Proposal #${proposalCount}`);
            console.log(`  - ${logMessage}`);
            
            const payload = { timestamp, data };
            const tx = await vortexVerifierContract.proposeData(payload);
            console.log(`  - Transaction sent! Hash: ${tx.hash}`);
            
            const receipt = await tx.wait();
            console.log(`  - ✅ Transaction mined! Block number: ${receipt.blockNumber}`);

        } catch (error) {
            console.error("  - ❌ Error during proposal:", error);
        }
    }, parseInt(PROPOSE_INTERVAL_MS!));
}

main().catch((error) => {
    console.error("FATAL: Service failed to start.", error);
    process.exit(1);
});