import { ethers, Wallet, Contract } from "ethers";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

// --- Configuration ---
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

// --- ABIs ---
// A minimal ABI for the VortexVerifier contract, only including the proposeData function
const VORTEX_VERIFIER_ABI = [
    "function proposeData(tuple(uint256 timestamp, bytes data) calldata _payload) external returns (bytes32)"
];

// --- Main Logic ---
async function main() {
    console.log("🚀 Starting Witness Network Service...");

    // 1. Connect to the blockchain
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log(`📡 Connected to RPC at ${RPC_URL}`);

    // 2. Set up the Proposer's wallet
    // We use the '!' non-null assertion operator because we've already checked for existence above.
    const proposerWallet = new Wallet(PROPOSER_PRIVATE_KEY!, provider);
    console.log(`👤 Proposer address: ${proposerWallet.address}`);

    // 3. Create a contract instance
    const vortexVerifierContract = new Contract(VORTEX_VERIFIER_ADDRESS!, VORTEX_VERIFIER_ABI, proposerWallet);
    console.log(`🔗 Attached to VortexVerifier contract at ${VORTEX_VERIFIER_ADDRESS}`);

    // 4. Start the proposing loop
    console.log(`⏰ Starting proposal loop every ${PROPOSE_INTERVAL_MS} ms`);

    setInterval(async () => {
        try {
            // Simulate fetching data from an external API
            const price = (Math.random() * (4000 - 3000) + 3000).toFixed(2); // Simulate ETH price
            const timestamp = Math.floor(Date.now() / 1000);
            const data = ethers.toUtf8Bytes(`ETH/USD: ${price}`);

            console.log(`\n[${new Date().toISOString()}]`);
            console.log(`  - Preparing to propose data...`);
            console.log(`  - Timestamp: ${timestamp}, Price: ${price}`);

            // Construct the payload
            const payload = {
                timestamp: timestamp,
                data: data,
            };

            // Send the transaction
            const tx = await vortexVerifierContract.proposeData(payload);
            console.log(`  - Transaction sent! Hash: ${tx.hash}`);

            // Wait for the transaction to be mined
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
