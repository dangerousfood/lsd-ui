import React from "react";
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/ethereum-provider";
import { Contract, providers, utils, BigNumber } from "ethers";

// @ts-ignore
import logo from "./logo.svg";
import "./App.css";
import { LSDHELPER, LSD, BADTRIP } from "./constants";

function App() {
  const web3Modal = new Web3Modal({
    network: "mainnet",
    cacheProvider: true,
    providerOptions: {
      walletconnect: {
        package: WalletConnectProvider,
        options: {
          // infuraId: process.env.REACT_APP_INFURA_ID,
        },
      },
    },
  });

  const [chainId, setChainId] = React.useState<number>(1);
  const [address, setAddress] = React.useState<string|null>(null);
  const [provider, setProvider] = React.useState<providers.Web3Provider>();
  const [allowance, setAllowance] = React.useState<BigNumber>(BigNumber.from(0));
  const [lsdBalance, setLSDBalance] = React.useState<BigNumber>(BigNumber.from(0));
  const [btBalance, setBTBalance] = React.useState<BigNumber>(BigNumber.from(0));

  const [redeemValue, setRedeemVal] = React.useState<string>("");

  React.useEffect(() => {
    if(address != null && provider != null)getBalances();
  }, [provider, address]);

  // getBalances()
  function reset() {
    console.log("reset");
    setAddress("");
    setProvider(undefined);
    web3Modal.clearCachedProvider();
  }



  React.useEffect(() => {
    console.log("Allowance updated " + allowance);
    // getBalances();
  }, [allowance]);

  async function connect() {
    if (!process.env.REACT_APP_INFURA_ID) {
      throw new Error("Missing Infura Id");
    }
    const web3Provider = await web3Modal.connect();

    web3Provider.on("disconnect", reset);

    const accounts = (await web3Provider.enable()) as string[];
    const address = accounts[0];
    setAddress(accounts[0]);
    setChainId(web3Provider.chainId);

    const provider = new providers.Web3Provider(web3Provider);
    setProvider(provider);
  }

  async function getBalances() {
    if (!provider) {
      throw new Error("Provider not connected");
    }
    else {
      const signer:providers.JsonRpcSigner = provider.getSigner();
      const lsd = new Contract(LSD.address, LSD.abi, signer);
      const bt = new Contract(BADTRIP.address, BADTRIP.abi, signer);

      const lsdBalance = await lsd.balanceOf(address);
      const btBalance = await bt.balanceOf(address, BigNumber.from(0).toHexString());
      const allowance = await lsd.allowance(address, LSDHELPER.address);

      setBTBalance(btBalance);
      setLSDBalance(lsdBalance);
      setAllowance(allowance);
    }
  }

  async function setApprove() {
    if (!provider) {
      throw new Error("Provider not connected");
    }
    else {
      const signer:providers.JsonRpcSigner = provider.getSigner();
      const lsd = new Contract(LSD.address, LSD.abi, signer);
      const balance = await lsd.balanceOf(address);

      const transaction = await lsd.approve(LSDHELPER.address, balance.toHexString())
      transaction.wait().then(function() {
        getBalances();
      });
    }
  }

  async function redeem() {
    if (!provider) {
      throw new Error("Provider not connected");
    }
    else {
      const signer:providers.JsonRpcSigner = provider.getSigner();
      const helper = new Contract(LSDHELPER.address, LSDHELPER.abi, signer);

      const transaction = await helper.redeem(BigNumber.from(redeemValue).toHexString())
      transaction.wait().then(function() {
        getBalances();
      });
    }
  }

  const getBigNumber = (amount:number, decimals = 18) => {
    const BASE_TEN = 10
    return BigNumber.from(amount).mul(BigNumber.from(BASE_TEN).pow(decimals))
  }

  function handleInputChange(e:HTMLInputElement) {
    setRedeemVal(e.value.replace(/[^0-9]*/ig, ""));
  }

  React.useEffect(() => {
  }, [redeemValue]);

  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <div>{provider ? "Connected!" : "Not connected"}</div>
        {address ? (
          <>
            <div>{address}</div>
            <div>LSD Balance: {lsdBalance.toString()}</div>
            <div>Allowance: {allowance.toString()}</div>
            <div>BadTrip Balance: {btBalance.toString()}</div>
            {allowance.gte(getBigNumber(1)) ? 
              <>
                <input type="text" pattern="[0-9]*" onChange={e => handleInputChange(e.target as HTMLInputElement)} value={redeemValue}/>
                <button onClick={redeem}>Redeem</button>
              </> : 
              <button onClick={setApprove}>Approve</button>
            }
            
          </>
        ) : (
          <button onClick={connect}>Connect</button>
        )}
      </header>
    </div>
  );
}

export default App;
