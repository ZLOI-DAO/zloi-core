// eslint-disable-next-line @typescript-eslint/no-var-requires
require('dotenv').config();

import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomiclabs/hardhat-ethers';
import 'solidity-coverage';
import 'hardhat-gas-reporter';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.17',
    // settings: {
    //   optimizer: {
    //     enabled: true,
    //     runs: 500,
    //     details: { yul: false },
    //   },
    // },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS === 'true' ? true : false,
  },
  networks: {
    hardhat: {
      chainId: 1337,
      // allowUnlimitedContractSize: true,
    },
  },
};

export default config;
