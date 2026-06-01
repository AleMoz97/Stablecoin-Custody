#!/bin/bash
set -e

npx hardhat node &
    NODE_PID=$!

npx wait-on tcp:127.0.0.1:8545

npx hardhat ignition deploy ignition/modules/Stablecoin.ts --network localhost