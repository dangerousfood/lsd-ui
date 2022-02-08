import React from "react";
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/ethereum-provider";
import { Contract, providers, utils, BigNumber } from "ethers";

// @ts-ignore
import logo from "./logo.svg";
import "./App.css";
import { formatAuthMessage } from "./utils";
import { DAI, LSDHELPER, LSD, BADTRIP } from "./constants";

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
  const [address, setAddress] = React.useState<string>("");
  const [provider, setProvider] = React.useState<providers.Web3Provider>();

  function reset() {
    console.log("reset");
    setAddress("");
    setProvider(undefined);
    web3Modal.clearCachedProvider();
  }

  async function connect() {
    if (!process.env.REACT_APP_INFURA_ID) {
      throw new Error("Missing Infura Id");
    }
    const web3Provider = await web3Modal.connect();

    web3Provider.on("disconnect", reset);

    const accounts = (await web3Provider.enable()) as string[];
    setAddress(accounts[0]);
    setChainId(web3Provider.chainId);

    const provider = new providers.Web3Provider(web3Provider);
    setProvider(provider);
  }

  async function signMessage() {
    if (!provider) {
      throw new Error("Provider not connected");
    }
    const msg = formatAuthMessage(address, chainId);
    const sig = await provider.send("personal_sign", [msg, address]);
    console.log("Signature", sig);
    console.log("isValid", utils.verifyMessage(msg, sig) === address);
  }

  async function transferDai() {
    if (!provider) {
      throw new Error("Provider not connected");
    }
    const contract = new Contract(DAI.address, DAI.abi, provider.getSigner());
    const res = await contract.transfer(address, utils.parseEther("1"));
    console.log("res", res);
  }

  async function redeemLSD() {
    if (!provider) {
      throw new Error("Provider not connected");
    }
    const AMOUNT = getBigNumber(1);
    const signer:providers.JsonRpcSigner = provider.getUncheckedSigner();
    const helper = new Contract(LSDHELPER.address, LSDHELPER.abi, signer);
    const lsd = new Contract(LSD.address, LSD.abi, signer);

    // Signing permit for $LSD token
    const latest = await provider.getBlockNumber();
    console.log((await provider.getBlock(latest)).timestamp);
    console.log("chainId: ", chainId);
    const deadline = (await provider.getBlock(latest)).timestamp + 10000

    // const wallet = JsonRpcSigner()
    const signedPermitERC20 = await signPermitERC20(
        BigNumber.from(chainId),
        lsd,
        signer,
        LSDHELPER.address,
        AMOUNT,
        BigNumber.from(deadline)
    );
    const erc20Sig = utils.splitSignature(signedPermitERC20)
    
    console.log(address, helper.address, AMOUNT, deadline, erc20Sig.v, erc20Sig.r, erc20Sig.s, BigNumber.from(1));
    // Redeem the $LSD token for NFT
    await helper.permitAndRedeem(address, helper.address, AMOUNT, deadline, erc20Sig.v, erc20Sig.r, erc20Sig.s, BigNumber.from(1), {
      gasLimit: 250000
    });
  }

  const getBigNumber = (amount:number, decimals = 18) => {
    const BASE_TEN = 10
    return BigNumber.from(amount).mul(BigNumber.from(BASE_TEN).pow(decimals))
  }

  const signPermitERC20 = async (chainId:BigNumber, verifyingContract:Contract, signer:providers.JsonRpcSigner, spender:string, value:BigNumber, deadline:BigNumber) => {
    const owner = address
    const nonce = await verifyingContract.nonces(address)
    
    const typedData:any = {
      types: {
        Permit: [
          {
            name: "owner",
            type: "address"
          },
          {
            name: "spender",
            type: "address"
          },
          {
            name: "value",
            type: "uint256"
          },
          {
            name: "nonce",
            type: "uint256"
          },
          {
            name: "deadline",
            type: "uint256"
          }
        ],
      },
      primaryType: 'Permit' as const,
      domain: {
        chainId: chainId,
        verifyingContract: verifyingContract.address,
      },
      message: {
        owner,
        spender,
        value,
        nonce,
        deadline
      }
    }
    return signer._signTypedData( typedData.domain , typedData.types , typedData.message);
  }



  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <div>{provider ? "Connected!" : "Not connected"}</div>
        {address ? (
          <>
            <div>{address}</div>
            {/* <button onClick={signMessage}>Authenticate</button> */}
            {/* <button onClick={transferDai}>Transfer DAI</button> */}
            <button onClick={redeemLSD}>Redeem LSD</button>
          </>
        ) : (
          <button onClick={connect}>Connect</button>
        )}
      </header>
    </div>
  );
}

export default App;
