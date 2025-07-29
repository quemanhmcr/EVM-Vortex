import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { keccak256, toUtf8Bytes } from 'ethers'
import { HardhatEthersSigner } from '@nomicfoundation/hardhat-ethers/signers'
import { DisputeResolver } from '../typechain-types'

describe('DisputeResolver', function () {
  // We define a fixture to reuse the same setup in every test.
  async function deployDisputeResolverFixture() {
    const [owner, member1, member2, vortexVerifierSigner, otherAccount] = await ethers.getSigners()

    const DisputeResolverFactory = await ethers.getContractFactory('DisputeResolver')
    const disputeResolver = await DisputeResolverFactory.deploy(owner.address)
    await disputeResolver.waitForDeployment()

    // Setup council
    await disputeResolver.connect(owner).addMember(member1.address)
    await disputeResolver.connect(owner).addMember(member2.address)

    // Set the verifier address
    await disputeResolver.connect(owner).setVortexVerifierAddress(vortexVerifierSigner.address)

    return { disputeResolver, owner, member1, member2, vortexVerifierSigner, otherAccount }
  }

  // Helper to create a dispute for tests
  async function createDispute(
    disputeResolver: DisputeResolver,
    disputeId: string,
    verifierSigner: HardhatEthersSigner,
  ) {
    await disputeResolver.connect(verifierSigner).createDispute(disputeId)
  }

  describe('Deployment', function () {
    it('Should set the deployer as the owner and initial member', async function () {
      const { disputeResolver, owner } = await loadFixture(deployDisputeResolverFixture)
      expect(await disputeResolver.owner()).to.equal(owner.address)
      expect(await disputeResolver.isMember(owner.address)).to.be.true
    })
  })

  describe('Membership Management', function () {
    it('Should allow the owner to add a new member', async function () {
      const { disputeResolver, owner, otherAccount } = await loadFixture(deployDisputeResolverFixture)
      await expect(disputeResolver.connect(owner).addMember(otherAccount.address))
        .to.emit(disputeResolver, 'MemberAdded')
        .withArgs(otherAccount.address)
      expect(await disputeResolver.isMember(otherAccount.address)).to.be.true
    })

    it('Should allow the owner to remove a member', async function () {
      const { disputeResolver, owner, member1 } = await loadFixture(deployDisputeResolverFixture)
      await expect(disputeResolver.connect(owner).removeMember(member1.address))
        .to.emit(disputeResolver, 'MemberRemoved')
        .withArgs(member1.address)
      expect(await disputeResolver.isMember(member1.address)).to.be.false
    })
  })

  describe('Voting on Disputes', function () {
    it('Should allow a member to cast a vote on an existing dispute', async function () {
      const { disputeResolver, member1, vortexVerifierSigner } = await loadFixture(
        deployDisputeResolverFixture,
      )
      const disputeId = keccak256(toUtf8Bytes('proposal-1'))
      await createDispute(disputeResolver, disputeId, vortexVerifierSigner)

      await expect(disputeResolver.connect(member1).castVote(disputeId, true))
        .to.emit(disputeResolver, 'Voted')
        .withArgs(disputeId, member1.address, true)

      const [yesVotes, noVotes] = await disputeResolver.getDispute(disputeId)
      expect(yesVotes).to.equal(1)
      expect(noVotes).to.equal(0)
    })

    it('Should revert if trying to vote on a non-existent dispute', async function () {
      const { disputeResolver, member1 } = await loadFixture(deployDisputeResolverFixture)
      const disputeId = keccak256(toUtf8Bytes('proposal-x'))
      await expect(disputeResolver.connect(member1).castVote(disputeId, true)).to.be.revertedWith(
        'DisputeResolver: Dispute does not exist',
      )
    })

    it('Should resolve a dispute when a majority is reached', async function () {
      const { disputeResolver, owner, member1, vortexVerifierSigner, otherAccount } =
        await loadFixture(deployDisputeResolverFixture)
      const disputeId = keccak256(toUtf8Bytes('proposal-2'))
      await createDispute(disputeResolver, disputeId, vortexVerifierSigner)

      await disputeResolver.connect(owner).castVote(disputeId, true)
      await disputeResolver.connect(member1).castVote(disputeId, true)

      await expect(disputeResolver.connect(otherAccount).resolveDispute(disputeId))
        .to.emit(disputeResolver, 'DisputeResolved')
        .withArgs(disputeId, true)

      const [, , resolved] = await disputeResolver.getDispute(disputeId)
      expect(resolved).to.be.true
    })

    it('Should revert when trying to resolve before majority is reached', async function () {
      const { disputeResolver, owner, vortexVerifierSigner, otherAccount } = await loadFixture(
        deployDisputeResolverFixture,
      )
      const disputeId = keccak256(toUtf8Bytes('proposal-3'))
      await createDispute(disputeResolver, disputeId, vortexVerifierSigner)

      await disputeResolver.connect(owner).castVote(disputeId, true)

      await expect(disputeResolver.connect(otherAccount).resolveDispute(disputeId)).to.be.revertedWith(
        'DisputeResolver: Majority threshold not reached',
      )
    })
  })
})