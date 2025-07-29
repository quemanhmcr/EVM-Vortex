import { ethers, Wallet, Contract, EventLog } from "ethers";
import dotenv from "dotenv";

dotenv.config();

// --- Configuration ---
const {
    RPC_URL,
    CHALLENGER_PRIVATE_KEY,
    VORTEX_VERIFIER_ADDRESS,
} = process.env;

if (!RPC_URL || !CHALLENGER_PRIVATE_KEY || !VORTEX_VERIFIER_ADDRESS) {
    console.error("FATAL: One or more environment variables are missing for the Challenger service.");
    process.exit(1);
}

// --- ABIs ---
// ABI for the VortexVerifier, including the event and the challenge function
const VORTEX_VERIFIER_ABI = [
    "event DataProposed(bytes32 indexed dataId, address indexed proposer, tuple(uint256 timestamp, bytes data) payload)",
    "function challengeData(bytes32 _dataId) external",
    "function proposedData(bytes32) view returns (address proposer, uint256 proposedAt, tuple(uint256 timestamp, bytes data) payload, bool isExecuted, bool isChallenged)"
];

// --- Main Logic ---
async function main() {
    console.log("🚀 Starting ZK Challenger Service...");

    // 1. Connect to the blockchain
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log(`📡 Connected to RPC at ${RPC_URL}`);

    // 2. Set up the Challenger's wallet
    const challengerWallet = new Wallet(CHALLENGER_PRIVATE_KEY!, provider);
    console.log(`👤 Challenger address: ${challengerWallet.address}`);

    // 3. Create a contract instance
    const vortexVerifierContract = new Contract(VORTEX_VERIFIER_ADDRESS!, VORTEX_VERIFIER_ABI, challengerWallet);
    console.log(`🔗 Attached to VortexVerifier contract at ${VORTEX_VERIFIER_ADDRESS}`);
    console.log("👂 Listening for DataProposed events...");

    // 4. Listen for the DataProposed event
    vortexVerifierContract.on("DataProposed", async (dataId, proposer, payload, event) => {
        const eventLog = event as EventLog;
        
        console.log(`\n[${new Date().toISOString()}]`);
        console.log(`  - 🕵️  Detected new proposal!`);
        console.log(`  - Data ID: ${dataId}`);
        console.log(`  - Proposer: ${proposer}`);

        try {
            // Decode the data to check its content
            const proposedString = ethers.toUtf8String(payload.data);
            console.log(`  - Proposed Data: "${proposedString}"`);

            // **FRAUD DETECTION LOGIC**
            // For this basic version, we'll consider any data that DOES NOT
            // start with "ETH/USD" to be fraudulent.
            if (!proposedString.startsWith("ETH/USD")) {
                console.log("  - 🚨 FRAUD DETECTED! Data does not match expected format.");
                
                // Check if the proposal is already challenged to avoid race conditions
                const proposalState = await vortexVerifierContract.proposedData(dataId);
                if (proposalState.isChallenged) {
                    console.log("  - ⚠️  Proposal already challenged. Skipping.");
                    return;
                }

                console.log("  - ⚔️  Initiating challenge...");
                const tx = await vortexVerifierContract.challengeData(dataId);
                console.log(`  - Challenge transaction sent! Hash: ${tx.hash}`);
                
                const receipt = await tx.wait();
                console.log(`  - ✅ Challenge transaction mined! Block: ${receipt.blockNumber}`);
            } else {
                console.log("  - ✅ Data appears valid. No action needed.");
            }
        } catch (error) {
            console.error("  - ❌ Error processing proposal:", error);
        }
    });
}

main().catch((error) => {
    console.error("FATAL: Challenger service failed to start.", error);
    process.exit(1);
});