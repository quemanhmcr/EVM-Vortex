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
});
