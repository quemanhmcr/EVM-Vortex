import { ethers } from 'hardhat'
import { spawn, ChildProcess } from 'child_process'
import path from 'path'

function launchService(name: string, servicePath: string, env: NodeJS.ProcessEnv): ChildProcess {
  console.log(`\n   - Launching ${name} service...`)

  const child = spawn('pnpm', ['dev'], {
    cwd: servicePath,
    env: env,
    stdio: 'inherit',
    shell: true,
  })

  child.on('error', (error) => {
    console.error(`❌ Error spawning ${name} service: ${error.message}`)
  })

  child.on('exit', (code) => {
    console.log(`👋 ${name} service exited with code ${code}`)
  })

  console.log(`   ✅ ${name} service is now running.`)
  return child
}

async function main() {
  console.log('🚀  Starting E2E environment with Witness and Challenger...')

  // 1. Deploy contracts
  console.log('   - Deploying contracts...')
  const [deployer, proposer] = await ethers.getSigners()

  const stakingManager = await ethers.deployContract('StakingManager')
  await stakingManager.waitForDeployment()

  const disputeResolver = await ethers.deployContract('DisputeResolver', [deployer.address])
  await disputeResolver.waitForDeployment()

  const vortexVerifier = await ethers.deployContract('VortexVerifier', [
    await stakingManager.getAddress(),
    await disputeResolver.getAddress(),
    10 * 60, // 10 min challenge period
    ethers.parseEther('0.1'), // The missing challenge bond
  ])
  await vortexVerifier.waitForDeployment()

  console.log(`   ✅ VortexVerifier deployed to: ${await vortexVerifier.getAddress()}`)

  // 2. Stake for the proposer
  console.log(`\n   - Staking 1 ETH for proposer: ${proposer.address}...`)
  await stakingManager.connect(proposer).stake({ value: ethers.parseEther('1.0') })
  console.log('   ✅ Staking complete.')

  // 3. Launch services
  const rpcUrl = 'http://127.0.0.1:8545'
  const vortexAddress = await vortexVerifier.getAddress()

  // Launch Witness Network
  const witnessEnv = {
    ...process.env,
    RPC_URL: rpcUrl,
    PROPOSER_PRIVATE_KEY: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', // Hardhat #1
    VORTEX_VERIFIER_ADDRESS: vortexAddress,
    PROPOSE_INTERVAL_MS: '10000', // 10 seconds
  }
  const witnessPath = path.join(__dirname, '../../../services/witness-network')
  launchService('Witness Network', witnessPath, witnessEnv)

  // Launch ZK Challenger
  const challengerEnv = {
    ...process.env,
    RPC_URL: rpcUrl,
    CHALLENGER_PRIVATE_KEY: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', // Hardhat #2
    VORTEX_VERIFIER_ADDRESS: vortexAddress,
  }
  const challengerPath = path.join(__dirname, '../../../services/zk-challenger')
  launchService('ZK Challenger', challengerPath, challengerEnv)

  console.log('\n✅  All services are now running. Check for logs.')
  console.log('   (To stop everything, press Ctrl+C in the Hardhat node terminal, then here)')
}

main().catch((error) => {
  console.error('❌ E2E script failed:', error)
  process.exit(1)
})
