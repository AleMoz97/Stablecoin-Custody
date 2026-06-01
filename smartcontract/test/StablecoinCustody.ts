import { expect } from "chai";
import { ZeroAddress } from "ethers";
import { network } from "hardhat";

const { ethers } = await network.create();

async function deployFixture() {
  const [owner0, owner1, owner2, admin0, admin1, admin2, alice, bob] = await ethers.getSigners();
  const owners = [owner0.address, owner1.address, owner2.address];
  const admins = [admin0.address, admin1.address, admin2.address];

  const mintBurnMultisig = await ethers.deployContract("Multisig_1", [owners]);
  const adminMultisig = await ethers.deployContract("Multisig_2", [admins]);

  const token = await ethers.deployContract("Stablecoin", [
    await mintBurnMultisig.getAddress(),
    await adminMultisig.getAddress(),
  ]);

  return { owner0, owner1, owner2, admin0, admin1, admin2, alice, bob, mintBurnMultisig, adminMultisig, token };
}

async function submitAndConfirm(
  multisig: any,
  submitter: any,
  confirmer: any,
  target: string,
  data: string,
) {
  const txId = await multisig.transactionCount();
  await multisig.connect(submitter).submitTransaction(target, 0, data);
  await multisig.connect(confirmer).confirmTransaction(txId);
  return txId;
}

describe("stablecoin custody", function () {
  it("deploys stablecoin contract and separates roles across multisigs", async function () {
    const { owner0, mintBurnMultisig, adminMultisig, token } = await deployFixture();

    expect(await token.decimals()).to.equal(6n);
    expect(await token.hasRole(await token.MINTER_ROLE(), await mintBurnMultisig.getAddress())).to.equal(true);
    expect(await token.hasRole(await token.BURNER_ROLE(), await mintBurnMultisig.getAddress())).to.equal(true);
    expect(await token.hasRole(await token.PAUSER_ROLE(), await adminMultisig.getAddress())).to.equal(true);
    expect(await token.hasRole(await token.FREEZER_ROLE(), await adminMultisig.getAddress())).to.equal(true);
    expect(await token.hasRole(await token.DEFAULT_ADMIN_ROLE(), owner0.address)).to.equal(false);
  });

  it("requires two multisig owners before mint is executed", async function () {
    const { owner0, owner1, alice, mintBurnMultisig, token } = await deployFixture();
    const tokenAddress = await token.getAddress();
    const amount = 1_000_000n;
    const data = token.interface.encodeFunctionData("mint", [alice.address, amount]);

    await mintBurnMultisig.connect(owner0).submitTransaction(tokenAddress, 0, data);

    const pending = await mintBurnMultisig.getTransaction(0);
    expect(pending.executed).to.equal(false);
    expect(pending.confirmations).to.equal(1n);
    expect(await token.balanceOf(alice.address)).to.equal(0n);

    await expect(mintBurnMultisig.connect(owner1).confirmTransaction(0))
      .to.emit(token, "Transfer")
      .withArgs(ZeroAddress, alice.address, amount);

    expect(await token.balanceOf(alice.address)).to.equal(amount);
  });

  it("rejects direct minting and non-owner multisig proposals", async function () {
    const { owner0, admin0, alice, mintBurnMultisig, token } = await deployFixture();

    await expect(token.connect(owner0).mint(alice.address, 1n)).to.be.revertedWithCustomError(
      token,
      "AccessControlUnauthorizedAccount",
    );

    await expect(
      mintBurnMultisig.connect(admin0).submitTransaction(await token.getAddress(), 0, "0x"),
    ).to.be.revertedWithCustomError(mintBurnMultisig, "NotOwner").withArgs(admin0.address);
  });

  it("burns balances only through the mint/burn multisig", async function () {
    const { owner0, owner1, alice, mintBurnMultisig, token } = await deployFixture();
    const tokenAddress = await token.getAddress();
    const amount = 2_000_000n;

    await submitAndConfirm(
      mintBurnMultisig,
      owner0,
      owner1,
      tokenAddress,
      token.interface.encodeFunctionData("mint", [alice.address, amount]),
    );
    await submitAndConfirm(
      mintBurnMultisig,
      owner0,
      owner1,
      tokenAddress,
      token.interface.encodeFunctionData("burn", [alice.address, 500_000n]),
    );

    expect(await token.balanceOf(alice.address)).to.equal(1_500_000n);
  });

  it("does not allow the admin multisig to mint", async function () {
    const { admin0, admin1, alice, adminMultisig, token } = await deployFixture();

    const tokenAddress = await token.getAddress();
    const data = token.interface.encodeFunctionData("mint", [alice.address, 1_000_000n]);

    const txId = await adminMultisig.transactionCount();

    await adminMultisig.connect(admin0).submitTransaction(tokenAddress, 0, data);

    await expect(adminMultisig.connect(admin1).confirmTransaction(txId))
      .to.be.revertedWithCustomError(adminMultisig, "TransactionCallFailed")
      .withArgs(txId);
  });

  it("does not allow the mint/burn multisig to freeze accounts", async function () {
    const { owner0, owner1, alice, mintBurnMultisig, token } = await deployFixture();

    const tokenAddress = await token.getAddress();
    const data = token.interface.encodeFunctionData("freeze", [alice.address]);

    const txId = await mintBurnMultisig.transactionCount();

    await mintBurnMultisig.connect(owner0).submitTransaction(tokenAddress, 0, data);

    await expect(mintBurnMultisig.connect(owner1).confirmTransaction(txId))
      .to.be.revertedWithCustomError(mintBurnMultisig, "TransactionCallFailed")
      .withArgs(txId);
  });

  it("blocks transfers from frozen addresses", async function () {
    const { owner0, owner1, admin0, admin1, alice, bob, mintBurnMultisig, adminMultisig, token } = await deployFixture();
    const tokenAddress = await token.getAddress();

    await submitAndConfirm(
      mintBurnMultisig,
      owner0,
      owner1,
      tokenAddress,
      token.interface.encodeFunctionData("mint", [alice.address, 1_000_000n]),
    );
    await submitAndConfirm(
      adminMultisig,
      admin0,
      admin1,
      tokenAddress,
      token.interface.encodeFunctionData("freeze", [alice.address]),
    );

    expect(await token.isFrozen(alice.address)).to.equal(true);
    await expect(token.connect(alice).transfer(bob.address, 1n))
      .to.be.revertedWithCustomError(token, "AccountIsFrozen")
      .withArgs(alice.address);
  });

  it("blocks transfers to frozen addresses", async function () {
    const { owner0, owner1, admin0, admin1, alice, bob, mintBurnMultisig, adminMultisig, token } =
      await deployFixture();

    const tokenAddress = await token.getAddress();

    await submitAndConfirm(
      mintBurnMultisig,
      owner0,
      owner1,
      tokenAddress,
      token.interface.encodeFunctionData("mint", [alice.address, 1_000_000n]),
    );

    await submitAndConfirm(
      adminMultisig,
      admin0,
      admin1,
      tokenAddress,
      token.interface.encodeFunctionData("freeze", [bob.address]),
    );

    await expect(token.connect(alice).transfer(bob.address, 1n))
      .to.be.revertedWithCustomError(token, "AccountIsFrozen")
      .withArgs(bob.address);
  });

  it("pauses all token transfers through the admin multisig", async function () {
    const { owner0, owner1, admin0, admin1, alice, bob, mintBurnMultisig, adminMultisig, token } = await deployFixture();
    const tokenAddress = await token.getAddress();

    await submitAndConfirm(
      mintBurnMultisig,
      owner0,
      owner1,
      tokenAddress,
      token.interface.encodeFunctionData("mint", [alice.address, 1_000_000n]),
    );
    await submitAndConfirm(
      adminMultisig,
      admin0,
      admin1,
      tokenAddress,
      token.interface.encodeFunctionData("pause"),
    );

    await expect(token.connect(alice).transfer(bob.address, 1n)).to.be.revertedWithCustomError(
      token,
      "EnforcedPause",
    );
  });


});
