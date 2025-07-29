import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { keccak256, toUtf8Bytes } from 'ethers'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { DisputeResolver } from '../typechain-types'

describe('DisputeResolver', function () {
  async function deployFullSystemFixture() {
    const [owner, member1, member2, vortexVerifierSigner, proposer, otherAccount] =
      await ethers.getSigners()

    const StakingManagerFactory = await ethers.getContractFactory('StakingManager')
    const stakingManager = await StakingManagerFactory.deploy()
    await stakingManager.waitForDeployment()

    const DisputeResolverFactory = await ethers.getContractFactory('DisputeResolver')
    const disputeResolver = await DisputeResolverFactory.deploy(owner.address)
    await disputeResolver.waitForDeployment()

    // Configure connections
    await disputeResolver.connect(owner).setAddresses(vortexVerifierSigner.address, await stakingManager.getAddress())
    await stakingManager.connect(owner).setDisputeResolverAddress(await disputeResolver.getAddress())

    // Setup council
    await disputeResolver.connect(owner).addMember(member1.address)
    await disputeResolver.connect(owner).addMember(member2.address)

    return {
      disputeResolver,
      stakingManager,
      owner,
      member1,
      member2,
      vortexVerifierSigner,
      proposer,
      otherAccount,
    }
  }

  async function createDispute(
    disputeResolver: DisputeResolver,
    disputeId: string,
    proposer: HardhatEthersSigner,
    verifierSigner: HardhatEthersSigner,
  ) {
    await disputeResolver.connect(verifierSigner).createDispute(disputeId, proposer.address)
  }

  describe('Dispute Resolution Effects', function () {
    it("Should slash the proposer's stake upon a 'fraud' resolution", async function () {
      const {
        disputeResolver,
        stakingManager,
        owner,
        member1,
        vortexVerifierSigner,
        proposer,
      } = await loadFixture(deployFullSystemFixture)

      const stakeAmount = ethers.parseEther('1')
      await stakingManager.connect(proposer).stake({ value: stakeAmount })
      expect(await stakingManager.stakes(proposer.address)).to.equal(stakeAmount)

      const disputeId = keccak256(toUtf8Bytes('fraud-proposal'))
      await createDispute(disputeResolver, disputeId, proposer, vortexVerifierSigner)
      
      await disputeResolver.connect(owner).castVote(disputeId, true)
      await disputeResolver.connect(member1).castVote(disputeId, true)
      
      await expect(disputeResolver.resolveDispute(disputeId))
        .to.emit(stakingManager, 'Slashed')
        .withArgs(proposer.address, stakeAmount)

      expect(await stakingManager.stakes(proposer.address)).to.equal(0)
    })

    it("Should NOT slash the proposer's stake upon a 'no-fraud' resolution", async function () {
        const {
          disputeResolver,
          stakingManager,
          owner,
          member1,
          vortexVerifierSigner,
          proposer,
        } = await loadFixture(deployFullSystemFixture)
  
        const stakeAmount = ethers.parseEther('1')
        await stakingManager.connect(proposer).stake({ value: stakeAmount })
  
        const disputeId = keccak256(toUtf8Bytes('no-fraud-proposal'))
        await createDispute(disputeResolver, disputeId, proposer, vortexVerifierSigner)
        
        await disputeResolver.connect(owner).castVote(disputeId, false)
        await disputeResolver.connect(member1).castVote(disputeId, false)
        
        await expect(disputeResolver.resolveDispute(disputeId)).to.not.emit(stakingManager, 'Slashed')
  
        expect(await stakingManager.stakes(proposer.address)).to.equal(stakeAmount)
      })
  })
})
