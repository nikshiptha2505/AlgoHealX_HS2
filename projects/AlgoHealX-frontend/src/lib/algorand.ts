/**
 * Algorand blockchain utilities for AlgoHealX
 */

import algosdk from 'algosdk';
import { PeraWalletConnect } from '@perawallet/connect';

// Algorand TestNet configuration
export const ALGORAND_NODE = 'https://testnet-api.algonode.cloud';
export const ALGORAND_INDEXER = 'https://testnet-idx.algonode.cloud';
export const ALGORAND_TOKEN = '';

// Initialize Algod client
export const getAlgodClient = () => {
  return new algosdk.Algodv2(ALGORAND_TOKEN, ALGORAND_NODE, '');
};

// Initialize Indexer client
export const getIndexerClient = () => {
  return new algosdk.Indexer(ALGORAND_TOKEN, ALGORAND_INDEXER, '');
};

// Smart contract app IDs (update these after deployment)
export const SMART_CONTRACTS = {
  MEDICINE_REGISTRY: 'APP_MEDICINE_REGISTRY',
  SUPPLY_CHAIN_TRACKER: 'APP_SUPPLY_CHAIN',
  VERIFICATION_CONTRACT: 'APP_VERIFICATION',
  REGULATOR_APPROVAL: 'APP_REGULATOR',
};

/**
 * Wait for transaction confirmation
 */
export const waitForConfirmation = async (txId: string, timeout: number = 4) => {
  const algodClient = getAlgodClient();
  const startRound = (await algodClient.status().do())['last-round'];
  let currentRound = startRound;

  while (currentRound < startRound + timeout) {
    const pendingInfo = await algodClient.pendingTransactionInformation(txId).do();
    if (pendingInfo['confirmed-round'] !== null && pendingInfo['confirmed-round'] > 0) {
      return pendingInfo;
    }
    currentRound++;
    await algodClient.statusAfterBlock(currentRound).do();
  }
  throw new Error(`Transaction not confirmed after ${timeout} rounds`);
};

/**
 * Create application call transaction
 */
export const createAppCallTxn = async (
  sender: string,
  appId: number,
  appArgs: Uint8Array[],
  walletInstance: any
) => {
  const algodClient = getAlgodClient();
  const params = await algodClient.getTransactionParams().do();

  const txn = algosdk.makeApplicationNoOpTxnFromObject({
    sender: sender,
    suggestedParams: params,
    appIndex: appId,
    appArgs: appArgs,
  });

  // Sign transaction with wallet
  const signedTxn = await walletInstance.signTransaction([[{ txn }]]);
  
  // Send transaction
  const response = await algodClient.sendRawTransaction(signedTxn).do();
  const txId = response.txid;
  
  // Wait for confirmation
  await waitForConfirmation(txId);
  
  return txId;
};

/**
 * Encode string to Uint8Array for app args
 */
export const encodeString = (str: string): Uint8Array => {
  return new TextEncoder().encode(str);
};

/**
 * Encode number to Uint8Array for app args
 */
export const encodeNumber = (num: number): Uint8Array => {
  return algosdk.encodeUint64(num);
};

/**
 * Get account information
 */
export const getAccountInfo = async (address: string) => {
  const algodClient = getAlgodClient();
  return await algodClient.accountInformation(address).do();
};

/**
 * Get application state
 */
export const getApplicationState = async (appId: number) => {
  const algodClient = getAlgodClient();
  return await algodClient.getApplicationByID(appId).do();
};

/**
 * Format ALGO amount (microAlgos to Algos)
 */
export const formatAlgoAmount = (microAlgos: number): string => {
  return (microAlgos / 1000000).toFixed(6);
};

/**
 * Parse application state
 */
export const parseApplicationState = (state: any[]): Record<string, any> => {
  const parsed: Record<string, any> = {};
  
  state.forEach((item) => {
    const key = Buffer.from(item.key, 'base64').toString();
    let value;
    
    if (item.value.type === 1) {
      // Bytes
      value = Buffer.from(item.value.bytes, 'base64').toString();
    } else if (item.value.type === 2) {
      // Uint
      value = item.value.uint;
    }
    
    parsed[key] = value;
  });
  
  return parsed;
};
