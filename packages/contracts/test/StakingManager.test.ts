import { expect } from "chai";
import { ethers } from "hardhat";

describe("StakingManager", function () {
  it("Should deploy successfully", async function () {
    const StakingManagerFactory = await ethers.getContractFactory("StakingManager");
    const stakingManager = await StakingManagerFactory.deploy();
    await stakingManager.waitForDeployment();

    expect(await stakingManager.getAddress()).to.not.be.null;
  });

  it("Should allow a user to stake and update their balance", async function () {
    const StakingManagerFactory = await ethers.getContractFactory("StakingManager");
    const stakingManager = await StakingManagerFactory.deploy();
    await stakingManager.waitForDeployment();

    const [owner] = await ethers.getSigners();
    const stakeAmount = ethers.parseEther("1.0");

    await expect(stakingManager.stake({ value: stakeAmount }))
      .to.emit(stakingManager, "Staked")
      .withArgs(owner.address, stakeAmount);

    const balance = await stakingManager.stakes(owner.address);
    expect(balance).to.equal(stakeAmount);
  });

  it("Should allow a user to unstake and update their balance", async function () {
    const StakingManagerFactory = await ethers.getContractFactory("StakingManager");
    const stakingManager = await StakingManagerFactory.deploy();
    await stakingManager.waitForDeployment();

    const [owner] = await ethers.getSigners();
    const stakeAmount = ethers.parseEther("1.0");

    // First, stake some tokens
    await stakingManager.stake({ value: stakeAmount });
    expect(await stakingManager.stakes(owner.address)).to.equal(stakeAmount);

    // Now, unstake them.
    await expect(stakingManager.unstake(stakeAmount))
      .to.emit(stakingManager, "Unstaked")
      .withArgs(owner.address, stakeAmount);
      
    expect(await stakingManager.stakes(owner.address)).to.equal(0);
  });

  it("Should revert if user tries to unstake more than they have", async function () {
    const StakingManagerFactory = await ethers.getContractFactory("StakingManager");
    const stakingManager = await StakingManagerFactory.deploy();
    await stakingManager.waitForDeployment();

    const stakeAmount = ethers.parseEther("1.0");
    const unstakeAmount = ethers.parseEther("2.0");

    // First, stake some tokens
    await stakingManager.stake({ value: stakeAmount });

    // Now, try to unstake more. This should fail.
    await expect(stakingManager.unstake(unstakeAmount)).to.be.revertedWith("Insufficient stake");
  });
});
