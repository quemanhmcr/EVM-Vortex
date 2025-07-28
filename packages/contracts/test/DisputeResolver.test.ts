import { loadFixture } from '@nomicfoundation/hardhat-toolbox/network-helpers'
import { expect } from 'chai'
import { ethers } from 'hardhat'

describe('DisputeResolver', function () {
  async function deployDisputeResolverFixture() {
    const [owner, otherAccount] = await ethers.getSigners()

    const DisputeResolverFactory = await ethers.getContractFactory('DisputeResolver')
    const disputeResolver = await DisputeResolverFactory.deploy(owner.address)
    await disputeResolver.waitForDeployment()

    return { disputeResolver, owner, otherAccount }
  }

  describe('Deployment', function () {
    it('Should set the deployer as the owner', async function () {
      const { disputeResolver, owner } = await loadFixture(deployDisputeResolverFixture)
      expect(await disputeResolver.owner()).to.equal(owner.address)
    })
  })
})
