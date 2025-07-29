import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { EventLog } from 'ethers'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { VortexVerifier } from '../typechain-types'

describe('DisputeResolver', function () {
  const CHALLENGE_PERIOD = 10 * 60 // 10 minutes
  const CHALLENGE_BOND = ethers.parseEther('0.1')

  // This fixture deploys the entire system and sets up all contract links
  async function deployFullSystemFixture() {
    const [owner, member1, member2, proposer, challenger, otherAccount] = await ethers.getSigners()

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
      CHALLENGE_BOND,
    )
    await vortexVerifier.waitForDeployment()

    // Configure connections between contracts
    await disputeResolver
      .connect(owner)
      .setAddresses(await vortexVerifier.getAddress(), await stakingManager.getAddress())
    await stakingManager.connect(owner).setDisputeResolverAddress(await disputeResolver.getAddress())

    // Setup council in DisputeResolver
    await disputeResolver.connect(owner).addMember(member1.address)
    await disputeResolver.connect(owner).addMember(member2.address)

    // Proposer stakes 1 ETH to be eligible
    const stakeAmount = ethers.parseEther('1')
    await stakingManager.connect(proposer).stake({ value: stakeAmount })

    return {
      vortexVerifier,
      disputeResolver,
      stakingManager,
      owner,
      member1,
      member2,
      proposer,
      challenger,
      otherAccount,
    }
  }

  // Helper to propose, challenge, and return the disputeId
  async function fullChallengeCycle(
    vortexVerifier: VortexVerifier,
    proposer: HardhatEthersSigner,
    challenger: HardhatEthersSigner,
  ) {
    const payload = { timestamp: Date.now(), data: ethers.toUtf8Bytes('fraudulent data') }
    const tx = await vortexVerifier.connect(proposer).proposeData(payload)
    const receipt = await tx.wait()
    const event = receipt?.logs.find(
      (e) => e instanceof EventLog && e.eventName === 'DataProposed',
    ) as EventLog | undefined
    const dataId = event?.args[0]

    await vortexVerifier.connect(challenger).challengeData(dataId, { value: CHALLENGE_BOND })
    return dataId
  }

  describe('Dispute Resolution Effects', function () {
    it("Should slash proposer and refund challenger's bond upon a 'fraud' resolution", async function () {
      const { disputeResolver, stakingManager, vortexVerifier, owner, member1, proposer, challenger } =
        await loadFixture(deployFullSystemFixture)

      const disputeId = await fullChallengeCycle(vortexVerifier, proposer, challenger)

      // Vote to confirm fraud
      await disputeResolver.connect(owner).castVote(disputeId, true)
      await disputeResolver.connect(member1).castVote(disputeId, true)

      // Expect the challenger's balance to increase by the bond amount upon resolution
      await expect(disputeResolver.resolveDispute(disputeId)).to.changeEtherBalance(
        challenger,
        CHALLENGE_BOND,
      )

      // Expect the proposer to be slashed
      expect(await stakingManager.stakes(proposer.address)).to.equal(0)
    })

    it("Should NOT slash proposer and FORFEIT challenger's bond upon a 'no-fraud' resolution", async function () {
      const { disputeResolver, stakingManager, vortexVerifier, owner, member1, proposer, challenger } =
        await loadFixture(deployFullSystemFixture)

      const stakeAmount = await stakingManager.stakes(proposer.address)
      const disputeId = await fullChallengeCycle(vortexVerifier, proposer, challenger)

      // Vote to confirm no fraud
      await disputeResolver.connect(owner).castVote(disputeId, false)
      await disputeResolver.connect(member1).castVote(disputeId, false)

      // Expect the challenger's balance to NOT change (bond is forfeited)
      await expect(disputeResolver.resolveDispute(disputeId)).to.changeEtherBalance(challenger, 0)

      // Expect the proposer's stake to remain unchanged
      expect(await stakingManager.stakes(proposer.address)).to.equal(stakeAmount)
    })
  })

  describe('ZK Proof Resolution', function () {
    it('Should call the ZK Verifier and resolve a dispute based on a valid proof', async function () {
      const { disputeResolver, vortexVerifier, proposer, challenger, owner, stakingManager } =
        await loadFixture(deployFullSystemFixture)

      // 1. Deploy the mock ZK Verifier from the testing folder
      const MockVerifierFactory = await ethers.getContractFactory('Groth16Verifier')
      const mockVerifier = await MockVerifierFactory.deploy()
      await mockVerifier.waitForDeployment()

      // 2. Set the verifier address in the DisputeResolver
      await disputeResolver.connect(owner).setZkVerifierAddress(await mockVerifier.getAddress())

      // 3. Create a dispute
      const disputeId = await fullChallengeCycle(vortexVerifier, proposer, challenger)

      // 4. Mock the proof and public signals
      const proof = { a: [0, 0], b: [[0, 0], [0, 0]], c: [0, 0] };
      const publicSignals = [0, 0];

      // 5. Expect the call to succeed and emit the final resolution event
      // Since the mock verifier always returns true, this should resolve as fraud.
      const tx = await disputeResolver
        .connect(challenger)
        .resolveDisputeWithProof(disputeId, proof.a, proof.b, proof.c, publicSignals)

      await expect(tx)
        .to.emit(disputeResolver, 'DisputeResolved')
        .withArgs(disputeId, true, proposer.address)

      // 6. Verify side-effects (proposer slashed, challenger refunded)
      expect(await stakingManager.stakes(proposer.address)).to.equal(0)
      await expect(tx).to.changeEtherBalance(challenger, CHALLENGE_BOND)
    })
  })
})