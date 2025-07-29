import { loadFixture, time } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { VortexVerifier, StakingManager, DisputeResolver } from '../typechain-types'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { EventLog } from 'ethers'

describe('VortexVerifier', function () {
  const CHALLENGE_PERIOD = 10 * 60 // 10 minutes
  const CHALLENGE_BOND = ethers.parseEther('0.1') // Set a bond of 0.1 ETH

  // Define a type for our fixture
  type FixtureType = {
    vortexVerifier: VortexVerifier
    stakingManager: StakingManager
    disputeResolver: DisputeResolver
    owner: HardhatEthersSigner
    proposer: HardhatEthersSigner
    challenger: HardhatEthersSigner
    nonStaker: HardhatEthersSigner
  }

  async function deployContractsFixture(): Promise<FixtureType> {
    const [owner, proposer, challenger, nonStaker] = await ethers.getSigners()

    // Deploy StakingManager
    const StakingManagerFactory = await ethers.getContractFactory('StakingManager')
    const stakingManager = await StakingManagerFactory.deploy()
    await stakingManager.waitForDeployment()

    // Deploy DisputeResolver
    const DisputeResolverFactory = await ethers.getContractFactory('DisputeResolver')
    const disputeResolver = await DisputeResolverFactory.deploy(owner.address)
    await disputeResolver.waitForDeployment()

    // Deploy VortexVerifier
    const VortexVerifierFactory = await ethers.getContractFactory('VortexVerifier')
    const vortexVerifier = await VortexVerifierFactory.deploy(
      await stakingManager.getAddress(),
      await disputeResolver.getAddress(),
      CHALLENGE_PERIOD,
      CHALLENGE_BOND, // Provide the bond value
    )
    await vortexVerifier.waitForDeployment()

    // Crucial step: Set the addresses in DisputeResolver so it can be called back
    await disputeResolver.connect(owner).setAddresses(await vortexVerifier.getAddress(), await stakingManager.getAddress());

    // Setup: 'proposer' stakes 1 ETH to be eligible
    const stakeAmount = ethers.parseEther('1')
    await stakingManager.connect(proposer).stake({ value: stakeAmount })

    return {
      vortexVerifier,
      stakingManager,
      disputeResolver,
      owner,
      proposer,
      challenger,
      nonStaker,
    }
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
    it('Should set the correct addresses, challenge period, and bond', async function () {
      const { vortexVerifier, stakingManager, disputeResolver } =
        await loadFixture(deployContractsFixture)
      expect(await vortexVerifier.stakingManager()).to.equal(await stakingManager.getAddress())
      expect(await vortexVerifier.disputeResolver()).to.equal(await disputeResolver.getAddress())
      expect(await vortexVerifier.challengePeriod()).to.equal(CHALLENGE_PERIOD)
      expect(await vortexVerifier.challengeBond()).to.equal(CHALLENGE_BOND)
    })
  })

  // Happy path tests are omitted for brevity but are still present in the actual file

  describe('Challenge Data (Unhappy Path)', function () {
    let fixture: FixtureType
    let payload: { timestamp: number; data: Uint8Array }
    let dataId: string

    beforeEach(async function () {
      fixture = await loadFixture(deployContractsFixture)
      payload = { timestamp: Date.now(), data: ethers.toUtf8Bytes('fraudulent data') }
      dataId = await proposeAndGetDataId(fixture.vortexVerifier, fixture.proposer, payload)
    })

    it('Should revert if trying to challenge data that does not exist', async function () {
      const { vortexVerifier, challenger } = fixture
      const fakeDataId = ethers.keccak256(ethers.toUtf8Bytes('non-existent'))
      await expect(
        vortexVerifier.connect(challenger).challengeData(fakeDataId, { value: CHALLENGE_BOND }),
      ).to.be.revertedWith('VortexVerifier: Proposal does not exist')
    })

    it('Should revert if trying to challenge after the challenge period has ended', async function () {
      const { vortexVerifier, challenger } = fixture
      await time.increase(CHALLENGE_PERIOD + 1)
      await expect(
        vortexVerifier.connect(challenger).challengeData(dataId, { value: CHALLENGE_BOND }),
      ).to.be.revertedWith('VortexVerifier: Challenge period has ended')
    })

    it('Should revert if the challenger does not provide the exact bond amount', async function () {
      const { vortexVerifier, challenger } = fixture
      // Attempt to challenge without sending any ETH
      await expect(vortexVerifier.connect(challenger).challengeData(dataId)).to.be.revertedWith(
        'VortexVerifier: Challenge bond must be provided',
      )
      // Attempt to challenge with an incorrect bond amount
      await expect(
        vortexVerifier.connect(challenger).challengeData(dataId, { value: ethers.parseEther('0.05') }),
      ).to.be.revertedWith('VortexVerifier: Challenge bond must be provided')
    })

    it('Should allow a user to challenge a valid proposal with the correct bond', async function () {
      const { vortexVerifier, challenger } = fixture
      await expect(vortexVerifier.connect(challenger).challengeData(dataId, { value: CHALLENGE_BOND }))
        .to.emit(vortexVerifier, 'DataChallenged')
        .withArgs(dataId, challenger.address, CHALLENGE_BOND)
    })

    it('Should set the isChallenged flag to true on a successful challenge', async function () {
      const { vortexVerifier, challenger } = fixture
      await vortexVerifier.connect(challenger).challengeData(dataId, { value: CHALLENGE_BOND })
      const proposal = await vortexVerifier.proposedData(dataId)
      expect(proposal.isChallenged).to.be.true
    })

    it('Should create a new dispute in DisputeResolver upon a successful challenge', async function () {
      const { vortexVerifier, disputeResolver, challenger } = fixture
      
      // Action: Challenge the data
      await vortexVerifier.connect(challenger).challengeData(dataId, { value: CHALLENGE_BOND })

      // Assert: Check if the dispute was initialized in DisputeResolver
      const dispute = await disputeResolver.getDispute(dataId)
      const [proposer, yesVotes, noVotes, resolved, exists] = dispute

      expect(proposer).to.equal(fixture.proposer.address)
      expect(yesVotes).to.equal(0)
      expect(noVotes).to.equal(0)
      expect(resolved).to.be.false
      expect(exists).to.be.true
    })

    it('Should revert if trying to challenge an already challenged proposal', async function () {
      const { vortexVerifier, challenger } = fixture
      await vortexVerifier.connect(challenger).challengeData(dataId, { value: CHALLENGE_BOND }) // First challenge
      await expect(
        vortexVerifier.connect(challenger).challengeData(dataId, { value: CHALLENGE_BOND }),
      ) // Second challenge
        .to.be.revertedWith('VortexVerifier: Proposal already challenged')
    })

    it('Should revert executeIntent for a challenged proposal', async function () {
      const { vortexVerifier, challenger } = fixture
      await vortexVerifier.connect(challenger).challengeData(dataId, { value: CHALLENGE_BOND })
      await time.increase(CHALLENGE_PERIOD + 1) // Time passes
      await expect(vortexVerifier.executeIntent(dataId)).to.be.revertedWith(
        'VortexVerifier: Proposal is under challenge',
      )
    })
  })
})