import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { VortexVerifier } from '../typechain-types'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { EventLog } from 'ethers'

describe('VortexVerifier', function () {
  const CHALLENGE_PERIOD = 10 * 60 // 10 minutes

  async function deployContractsFixture() {
    const [owner, proposer, nonStaker] = await ethers.getSigners()

    // Deploy StakingManager
    const StakingManagerFactory = await ethers.getContractFactory('StakingManager')
    const stakingManager = await StakingManagerFactory.deploy()
    await stakingManager.waitForDeployment()

    // Deploy VortexVerifier
    const VortexVerifierFactory = await ethers.getContractFactory('VortexVerifier')
    const vortexVerifier = await VortexVerifierFactory.deploy(
      await stakingManager.getAddress(),
      CHALLENGE_PERIOD,
    )
    await vortexVerifier.waitForDeployment()

    // Setup: 'proposer' stakes 1 ETH to be eligible
    const stakeAmount = ethers.parseEther('1')
    await stakingManager.connect(proposer).stake({ value: stakeAmount })

    return { vortexVerifier, stakingManager, owner, proposer, nonStaker }
  }

  // Helper function to propose data and extract dataId
  async function proposeAndGetDataId(
    vortexVerifier: VortexVerifier,
    proposer: HardhatEthersSigner,
    payload: { timestamp: number; data: Uint8Array },
  ) {
    const tx = await vortexVerifier.connect(proposer).proposeData(payload)
    const receipt = await tx.wait()
    const event = receipt?.logs.find(
      (e) => e instanceof EventLog && e.eventName === 'DataProposed',
    ) as EventLog | undefined
    return event?.args[0]
  }

  describe('Deployment', function () {
    it('Should set the correct StakingManager address and challenge period', async function () {
      const { vortexVerifier, stakingManager } = await loadFixture(deployContractsFixture)
      expect(await vortexVerifier.stakingManager()).to.equal(await stakingManager.getAddress())
      expect(await vortexVerifier.challengePeriod()).to.equal(CHALLENGE_PERIOD)
    })
  })

  describe('Propose Data (Happy Path)', function () {
    it('Should revert if proposeData is called by a non-staker', async function () {
      const { vortexVerifier, nonStaker } = await loadFixture(deployContractsFixture)
      const payload = {
        timestamp: Math.floor(Date.now() / 1000),
        data: ethers.toUtf8Bytes('test data'),
      }
      await expect(vortexVerifier.connect(nonStaker).proposeData(payload)).to.be.revertedWith(
        'VortexVerifier: Caller is not a staker',
      )
    })

    it('Should allow a valid staker to propose data and emit an event', async function () {
      const { vortexVerifier, proposer } = await loadFixture(deployContractsFixture)
      const payload = {
        timestamp: Math.floor(Date.now() / 1000),
        data: ethers.toUtf8Bytes('test data'),
      }

      await expect(vortexVerifier.connect(proposer).proposeData(payload)).to.emit(
        vortexVerifier,
        'DataProposed',
      )
    })

    it('Should store the data payload correctly', async function () {
      const { vortexVerifier, proposer } = await loadFixture(deployContractsFixture)
      const timestamp = Math.floor(Date.now() / 1000)
      const data = ethers.toUtf8Bytes('test data')
      const payload = { timestamp, data }

      const dataId = await proposeAndGetDataId(vortexVerifier, proposer, payload)

      const storedPayload = await vortexVerifier.proposedData(dataId)
      expect(storedPayload.proposer).to.equal(proposer.address)
      expect(storedPayload.payload.timestamp).to.equal(timestamp)
      expect(storedPayload.payload.data).to.equal(ethers.hexlify(data))
      expect(storedPayload.proposedAt).to.be.gt(0)
      expect(storedPayload.isExecuted).to.be.false
    })
  })

  describe('Execute Intent (Happy Path)', function () {
    it('Should revert if executeIntent is called within the challenge period', async function () {
      const { vortexVerifier, proposer } = await loadFixture(deployContractsFixture)
      const payload = { timestamp: 0, data: ethers.toUtf8Bytes('test') }
      const dataId = await proposeAndGetDataId(vortexVerifier, proposer, payload)

      await expect(vortexVerifier.executeIntent(dataId)).to.be.revertedWith(
        'VortexVerifier: Challenge period has not ended',
      )
    })

    it('Should allow executeIntent after the challenge period', async function () {
      const { vortexVerifier, proposer } = await loadFixture(deployContractsFixture)
      const payload = { timestamp: 0, data: ethers.toUtf8Bytes('test') }
      const dataId = await proposeAndGetDataId(vortexVerifier, proposer, payload)

      // Increase time
      await time.increase(CHALLENGE_PERIOD + 1)

      await expect(vortexVerifier.executeIntent(dataId))
        .to.emit(vortexVerifier, 'DataExecuted')
        .withArgs(dataId)

      const storedPayload = await vortexVerifier.proposedData(dataId)
      expect(storedPayload.isExecuted).to.be.true
    })

    it('Should revert if intent is already executed', async function () {
      const { vortexVerifier, proposer } = await loadFixture(deployContractsFixture)
      const payload = { timestamp: 0, data: ethers.toUtf8Bytes('test') }
      const dataId = await proposeAndGetDataId(vortexVerifier, proposer, payload)

      await time.increase(CHALLENGE_PERIOD + 1)
      await vortexVerifier.executeIntent(dataId) // First execution

      // Second execution should fail
      await expect(vortexVerifier.executeIntent(dataId)).to.be.revertedWith(
        'VortexVerifier: Intent already executed',
      )
    })

    it('Should revert if proposal does not exist', async function () {
      const { vortexVerifier } = await loadFixture(deployContractsFixture)
      const fakeDataId = ethers.keccak256(ethers.toUtf8Bytes('non-existent'))
      await expect(vortexVerifier.executeIntent(fakeDataId)).to.be.revertedWith(
        'VortexVerifier: Proposal does not exist',
      )
    })
  })
})
