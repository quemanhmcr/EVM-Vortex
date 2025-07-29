import { ethers } from 'hardhat'
import { spawn } from 'child_process'
import path from 'path'

async function main() {
  console.log('🚀  Starting automated deployment and service launch...')

  // 1. Deploy all contracts
  console.log('   - Deploying contracts...')
  const [deployer, proposer] = await ethers.getSigners()

  const stakingManager = await ethers.deployContract('StakingManager')
  await stakingManager.waitForDeployment()

  const disputeResolver = await ethers.deployContract('DisputeResolver', [deployer.address])
  await disputeResolver.waitForDeployment()

  const CHALLENGE_PERIOD = 10 * 60 // 10 minutes
  const vortexVerifier = await ethers.deployContract('VortexVerifier', [
    await stakingManager.getAddress(),
    await disputeResolver.getAddress(),
    CHALLENGE_PERIOD,
  ])
  await vortexVerifier.waitForDeployment()

  console.log(`   ✅ StakingManager deployed to: ${await stakingManager.getAddress()}`)
  console.log(`   ✅ DisputeResolver deployed to: ${await disputeResolver.getAddress()}`)
  console.log(`   ✅ VortexVerifier deployed to: ${await vortexVerifier.getAddress()}`)

  // 2. Stake funds for the proposer account
  console.log(`\n   - Staking 1 ETH for proposer: ${proposer.address}...`)
  const stakeAmount = ethers.parseEther('1.0')
  const stakeTx = await stakingManager.connect(proposer).stake({ value: stakeAmount })
  await stakeTx.wait()
  console.log('   ✅ Staking complete.')

  // 3. Prepare and launch the witness-network service
  console.log('\n   - Preparing to launch Witness Network service...')
  const witnessNetworkPath = path.join(__dirname, '../../../services/witness-network')

  // These environment variables are passed directly to the child process
  const serviceEnv = {
    ...process.env,
    RPC_URL: 'http://127.0.0.1:8545',
    PROPOSER_PRIVATE_KEY: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // Default Hardhat account #1
    VORTEX_VERIFIER_ADDRESS: await vortexVerifier.getAddress(),
    PROPOSE_INTERVAL_MS: '15000', // 15 seconds for faster local dev feedback
  }

  console.log('   - Starting service with the following configuration:')
  console.log(`     - RPC_URL: ${serviceEnv.RPC_URL}`)
  console.log(`     - VORTEX_VERIFIER_ADDRESS: ${serviceEnv.VORTEX_VERIFIER_ADDRESS}`)
  console.log(`     - PROPOSER: ${proposer.address}`)

  // Use spawn to run `pnpm dev` in the witness-network directory
  const child = spawn('pnpm', ['dev'], {
    cwd: witnessNetworkPath,
    env: serviceEnv,
    stdio: 'inherit', // This will pipe the child's output to our terminal
    shell: true, // FIX: Use the system shell to find pnpm correctly
  })

  child.on('error', (error) => {
    console.error(`❌ Error spawning witness-network service: ${error.message}`)
  })

  child.on('exit', (code) => {
    console.log(`👋 Witness-network service exited with code ${code}`)
  })

  console.log('\n✅  Witness Network service is now running. Check for logs below.')
  console.log('   (To stop everything, press Ctrl+C in the Hardhat node terminal, then here)')
}

main().catch((error) => {
  console.error('❌ Deployment script failed:', error)
  process.exit(1)
})
