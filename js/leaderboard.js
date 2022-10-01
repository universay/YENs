/**
 * yen stabilizer
 * index.js
 */

"use strict";

import { NukoApi } from "./lib/NukoApi.min.js";
import { NukoEtc } from "./lib/NukoEtc.min.js";
import { Nuko } from "./lib/Nuko.min.js";

var nukoZ = new Nuko();

var nuko = {
  rate: [],
  rateRaw: [],
  rateId: 0,
  rateInterval: 30000, // RPC nodeに負荷をかけるので短くするのはお控えください Please do not shorten rateInterval. It causes high load of RPC node.
  rateContract: null,
  rateReserveJPYC: [],
  rateReserveYEN: [],
  rateReserveMATIC: [],
  allowanceJPYC: [],
  allowanceYEN: [],
  jpyusd: 100,
  jpyusdInterval: 300 * 1000, // 5 min
  jpyusdId: 0,
  flgSwapping: 0,
  wallet: null,
  password: "c04Bef8613730faC95166A970300caC35b1Af883",
  contractRate: [],
  versionInterval: 3600 * 1000, // interval to check latest version: 1 hour
  versionAlertFlag: false,
  keepaliveInterval: 45 * 1000, // interval to get active user number
  reloadAvailableUpdates: false,
  lowerSwapMaticThreshold: 0,
  swapMaticAmount: 0,
  currentWeb3Provider: 0,
};

const NODE_URL = [
  "wss://speedy-nodes-nyc.moralis.io/3e336936ccd6ec0af99dc191/polygon/mainnet/ws",
  "https://speedy-nodes-nyc.moralis.io/3e336936ccd6ec0af99dc191/polygon/mainnet",
  "https://polygon-rpc.com",
];

const contractAddress = {
  YEN: "0xa874a3082d232e517654da2ce89374d556d339c4",
  JPYC: "0x431d5dff03120afa4bdf332c61a6e1766ef37bdb",
  MATIC: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
  routerQuick: "0xa5e0829caced8ffdd4de3c43696c57f7d7a678ff",
  pairQuick: "0x9cc4f1cf73b929978ea8f84a50d2674aab000923",
  routerSushi: "0x1b02da8cb0d097eb8d57a175b88c7d8b47997506",
  pairSushi: "0x34ace772625b678dde5a388eb1b23273ac0820f4",
  pairMATIC_YEN: "0x5337390b2017bfd81cae09913433f959b51f96a6",
  pairMATIC_JPYC: "0x19d5c33477b551ae84a9066097e72724c4a8cc60",
};

const decimal = {
  YEN: 18,
  JPYC: 18,
  MATIC: 18,
};

const options = {
  timeout: 30000,
  clientConfig: {
    keepalive: true,
    keepaliveInterval: 60000,
  },

  reconnect: {
    auto: true,
    delay: 1000,
    maxAttempts: 5,
    onTimeout: false,
  },
};

var provider = new Web3.providers.WebsocketProvider(NODE_URL[0], options);
var web3 = new Web3(provider);

/**
 * watch rate
 */
const watchRate = async () => {
  await getRate();
};

const getRate = async () => {
  for (let i = 0; i < 2; i++) {
    await nuko.contractRate[i].methods
      .getReserves()
      .call()
      .then((values) => {
        nuko.rateReserveJPYC[i] = values[0] / 10 ** 18;
        nuko.rateReserveYEN[i] = values[1] / 10 ** 18;
        nuko.rateRaw[i] = nuko.rateReserveYEN[i] / nuko.rateReserveJPYC[i];
        nuko.rate[i] =
          Math.floor(nuko.rateRaw[i] * Math.pow(10, 2)) / Math.pow(10, 2);
      });
  }
  $("#rate").text(nuko.rate[0] + " / " + nuko.rate[1]);
};

const watchGas = async () => {
  let gas = await nukoZ.gas.getGas();
  $("#gasPrice").text(gas + " " + nukoZ.gas.pref);
};

const getJPYUSD = async () => {
  let response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=jpy%2Cusd"
  );
  let json = await response.json();
  let jpyusd = parseInt(json.bitcoin.jpy) / parseInt(json.bitcoin.usd);

  return jpyusd;
};

const watchJPYUSD = async () => {
  nuko.jpyusd = await getJPYUSD();
  $("#jpyusd").text(nuko.jpyusd.toFixed(2));
};

/**
 * main function
 */
const main = () => {
  initialize();
  nuko.balanceContractYEN = new web3.eth.Contract(
    abiERC20,
    contractAddress.YEN
  );
  nuko.balanceContractJPYC = new web3.eth.Contract(
    abiERC20,
    contractAddress.JPYC
  );
  nuko.contractRate[0] = new web3.eth.Contract(abi, contractAddress.pairQuick);
  nuko.contractRate[1] = new web3.eth.Contract(abi, contractAddress.pairSushi);

  watchRate();
  nuko.rateId = setInterval(watchRate, nuko.rateInterval);

  watchGas();
  setInterval(watchGas, nukoZ.gas.interval);

  watchJPYUSD();
  nuko.jpyusdId = setInterval(watchJPYUSD, nuko.jpyusdInterval);

  NukoApi.getActiveUsers("");
  setInterval(() => {
    NukoApi.getActiveUsers("");
  }, nuko.keepaliveInterval);

  setInterval(() => {
    if (!web3.currentProvider.connected) {
      nuko.currentWeb3Provider =
        (nuko.currentWeb3Provider + 1) % NODE_URL.length;
      web3.setProvider(NODE_URL[nuko.currentWeb3Provider]);
      console.log("change RPC node to ", NODE_URL[nuko.currentWeb3Provider]);
    }
  }, 15 * 1000);
};

const initialize = () => {
  if (localStorage.gasPref == undefined) {
    localStorage.gasPref = "fastest";
  }
  nuko.gasPref = localStorage.gasPref;
  nuko.user = localStorage.user;

  NukoApi.getVolumes().then((vols) => {
    console.log(vols);
    $("#totalVolume").text(
      vols.total.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })
    );
    $("#totalYEN").text(
      vols.yen.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })
    );
    $("#totalJPYC").text(
      vols.jpyc.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })
    );
    $("#totalTX").text(
      vols.totalTX.toLocaleString(undefined, {
        maximumFractionDigits: 0,
      })
    );
  });

  NukoApi.getLeaderboard().then((data) => {
    let table = $("#dataTable").DataTable();
    let count = 1;
    data.forEach((row) => {
      let str = row.user.toString().substring(0, 8);
      if (row.user == nuko.user) str = '<i class="fas fa-child"></i> ' + str;
      table.row.add([
        count,
        str,
        parseFloat(row["sum(total)"]).toLocaleString(undefined, {
          maximumFractionDigits: 0,
        }),
        parseInt(row["sum(yen)"]).toLocaleString(undefined, {
          maximumFractionDigits: 0,
        }),
        parseFloat(row["sum(jpyc)"]).toLocaleString(undefined, {
          maximumFractionDigits: 0,
        }),
      ]);
      count = count + 1;
    });
    table.column("0:visible").order("asc").draw();
  });
};

// getReserves関数のABI
const abi = [
  {
    constant: true,
    inputs: [],
    name: "getReserves",
    outputs: [
      { internalType: "uint112", name: "_reserve0", type: "uint112" },
      { internalType: "uint112", name: "_reserve1", type: "uint112" },
      { internalType: "uint32", name: "_blockTimestampLast", type: "uint32" },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];

// The minimum ABI to get ERC20 Token balance
const abiERC20 = [
  // balanceOf
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function",
  },
  // decimals
  {
    constant: true,
    inputs: [],
    name: "decimals",
    outputs: [{ name: "", type: "uint8" }],
    type: "function",
  },
  {
    constant: false,
    inputs: [
      { name: "spender", type: "address" },
      { name: "tokens", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "success", type: "bool" }],
    payable: false,
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    constant: true,
    inputs: [
      {
        name: "_owner",
        type: "address",
      },
      {
        name: "_spender",
        type: "address",
      },
    ],
    name: "allowance",
    outputs: [
      {
        name: "",
        type: "uint256",
      },
    ],
    payable: false,
    stateMutability: "view",
    type: "function",
  },
];

main();
