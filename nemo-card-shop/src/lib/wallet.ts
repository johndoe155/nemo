/* Mock wallet session for the Card Shop.

   // TODO: replace with real wallet connect.
   A future integration swaps `connect()` for an actual injected-provider
   flow (window.ethereum / wagmi). This stub keeps the demo self-contained:
   it flips a "holder" boolean, persists it, and exposes a canned address. */

import { useEffect, useState } from 'react';

export const MOCK_ADDRESS = '0x7F3C…9A21';
const STORAGE_KEY = 'nemo-shop-holder';

export interface WalletSession {
  connected: boolean;
  address: string | null;
  connect: () => void;
  disconnect: () => void;
}

export function useWallet(): WalletSession {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === '1') setConnected(true);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const connect = () => {
    setConnected(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
  };

  const disconnect = () => {
    setConnected(false);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  };

  return {
    connected,
    address: connected ? MOCK_ADDRESS : null,
    connect,
    disconnect,
  };
}
