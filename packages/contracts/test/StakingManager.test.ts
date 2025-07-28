import {
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("StakingManager", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployStakingManagerFixture() {
    const [owner, otherAccount] = await ethers.getSigners();

    const StakingManagerFactory = await ethers.getContractFactory("StakingManager");
    const stakingManager = await StakingManagerFactory.deploy();
    await stakingManager.waitForDeployment();

    return { stakingManager, owner, otherAccount };
  }

  describe("Deployment", function () {
    it("Should deploy successfully", async function () {
      const { stakingManager } = await loadFixture(deployStakingManagerFixture);
      expect(await stakingManager.getAddress()).to.not.be.null;
    });
  });

  describe("Staking", function () {
    it("Should allow a user to stake and update their balance", async function () {
      const { stakingManager, owner } = await loadFixture(deployStakingManagerFixture);
      const stakeAmount = ethers.parseEther("1.0");

      await expect(stakingManager.connect(owner).stake({ value: stakeAmount }))
        .to.emit(stakingManager, "Staked")
        .withArgs(owner.address, stakeAmount);

      const balance = await stakingManager.stakes(owner.address);
      expect(balance).to.equal(stakeAmount);
    });

    it("Should revert if staking amount is zero", async function () {
      const { stakingManager, owner } = await loadFixture(deployStakingManagerFixture);
      await expect(stakingManager.connect(owner).stake({ value: 0 })).to.be.revertedWith("StakingManager: Cannot stake 0");
    });
  });

  describe("Unstaking", function () {
    it("Should allow a user to unstake and update their balance", async function () {
      const { stakingManager, owner } = await loadFixture(deployStakingManagerFixture);
      const stakeAmount = ethers.parseEther("1.0");
      await stakingManager.connect(owner).stake({ value: stakeAmount });

      await expect(stakingManager.connect(owner).unstake(stakeAmount))
        .to.emit(stakingManager, "Unstaked")
        .withArgs(owner.address, stakeAmount);
        
      expect(await stakingManager.stakes(owner.address)).to.equal(0);
    });

    it("Should transfer the correct amount of ETH back to the user", async function () {
      const { stakingManager, owner } = await loadFixture(deployStakingManagerFixture);
      const stakeAmount = ethers.parseEther("1.0");
      await stakingManager.connect(owner).stake({ value: stakeAmount });

      await expect(stakingManager.connect(owner).unstake(stakeAmount)).to.changeEtherBalances(
        [owner, stakingManager],
        [stakeAmount, -stakeAmount]
      );
    });

    it("Should revert if user tries to unstake more than they have", async function () {
      const { stakingManager, owner } = await loadFixture(deployStakingManagerFixture);
      const stakeAmount = ethers.parseEther("1.0");
      await stakingManager.connect(owner).stake({ value: stakeAmount });

      const unstakeAmount = ethers.parseEther("2.0");
      await expect(stakingManager.connect(owner).unstake(unstakeAmount)).to.be.revertedWith("StakingManager: Insufficient stake");
    });

    it("Should revert if unstaking amount is zero", async function () {
      const { stakingManager, owner } = await loadFixture(deployStakingManagerFixture);
      const stakeAmount = ethers.parseEther("1.0");
      await stakingManager.connect(owner).stake({ value: stakeAmount });

      await expect(stakingManager.connect(owner).unstake(0)).to.be.revertedWith("StakingManager: Cannot unstake 0");
    });
  });
});
