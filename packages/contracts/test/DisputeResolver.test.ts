import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'
import { keccak256, toUtf8Bytes } from 'ethers'

describe('DisputeResolver', function () {
  async function deployDisputeResolverFixture() {
    const [owner, member1, member2, otherAccount] = await ethers.getSigners()

    const DisputeResolverFactory = await ethers.getContractFactory('DisputeResolver')
    const disputeResolver = await DisputeResolverFactory.deploy(owner.address)
    await disputeResolver.waitForDeployment()

    // Add member1 and member2 to the council
    await disputeResolver.connect(owner).addMember(member1.address)
    await disputeResolver.connect(owner).addMember(member2.address)

    return { disputeResolver, owner, member1, member2, otherAccount }
  }

  describe('Deployment', function () {
    it('Should set the deployer as the owner and initial member', async function () {
      const { disputeResolver, owner } = await loadFixture(deployDisputeResolverFixture)
      expect(await disputeResolver.owner()).to.equal(owner.address)
      expect(await disputeResolver.isMember(owner.address)).to.be.true
    })
  })

  describe('Membership Management', function () {
    it('Should allow the owner to add a new member and emit a MemberAdded event', async function () {
      const { disputeResolver, owner, otherAccount } = await loadFixture(deployDisputeResolverFixture)
      const newMember = otherAccount

      await expect(disputeResolver.connect(owner).addMember(newMember.address))
        .to.emit(disputeResolver, 'MemberAdded')
        .withArgs(newMember.address)

      expect(await disputeResolver.isMember(newMember.address)).to.be.true
    })

    it('Should allow the owner to remove a member and emit a MemberRemoved event', async function () {
      const { disputeResolver, owner, member1 } = await loadFixture(deployDisputeResolverFixture)
      const memberToRemove = member1

      // Member already added in fixture, so just remove
      await expect(disputeResolver.connect(owner).removeMember(memberToRemove.address))
        .to.emit(disputeResolver, 'MemberRemoved')
        .withArgs(memberToRemove.address)

      expect(await disputeResolver.isMember(memberToRemove.address)).to.be.false
    })
  })

  describe('Voting on Disputes', function () {
    it('Should allow a member to cast a vote on a dispute', async function () {
      const { disputeResolver, member1 } = await loadFixture(deployDisputeResolverFixture)
      const disputeId = keccak256(toUtf8Bytes('proposal-1'))
      const voteConfirm = true // true for "confirm fraud", false for "deny fraud"

      await expect(disputeResolver.connect(member1).castVote(disputeId, voteConfirm))
        .to.emit(disputeResolver, 'Voted')
        .withArgs(disputeId, member1.address, voteConfirm)

      const dispute = await disputeResolver.disputes(disputeId)
      expect(dispute.yesVotes).to.equal(1)
      expect(dispute.noVotes).to.equal(0)
    })
  })
})
