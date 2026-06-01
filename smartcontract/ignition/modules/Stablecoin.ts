import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const StablecoinContracts = buildModule("StablecoinContracts", (m) => {
  /*
   * Hardhat local accounts:
   *
   * 0,1,2 -> owners del multisig mint/burn
   * 3,4,5 -> owners del multisig admin/freeze/pause
   *
   * In locale va benissimo.
   * In testnet/production useresti address espliciti tramite parameters.
   */

  const mintBurnOwner1 = m.getAccount(0);
  const mintBurnOwner2 = m.getAccount(1);
  const mintBurnOwner3 = m.getAccount(2);

  const adminOwner1 = m.getAccount(3);
  const adminOwner2 = m.getAccount(4);
  const adminOwner3 = m.getAccount(5);

  const Multisig_1 = m.contract(
    "Multisig_1",
    [[mintBurnOwner1, mintBurnOwner2, mintBurnOwner3]],
    {
      id: "Multisig_1",
    }
  );

  const Multisig_2 = m.contract(
    "Multisig_2",
    [[adminOwner1, adminOwner2, adminOwner3]],
    {
      id: "Multisig_2",
    }
  );

  const stablecoin = m.contract("Stablecoin", [
    Multisig_1,
    Multisig_2,
  ]);

  return {
    Multisig_1,
    Multisig_2,
    stablecoin,
  };
});

export default StablecoinContracts;
