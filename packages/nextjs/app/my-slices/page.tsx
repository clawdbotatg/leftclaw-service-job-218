"use client";

import { useEffect, useState } from "react";
import type { NextPage } from "next";
import { useAccount } from "wagmi";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldEventHistory } from "~~/hooks/scaffold-eth";

const ipfsToGateway = (uri: string): string => {
  if (uri.startsWith("ipfs://")) {
    return `https://ipfs.io/ipfs/${uri.slice("ipfs://".length)}`;
  }
  return uri;
};

type Slice = {
  tokenId: bigint;
  tokenURI: string;
  txHash: string;
};

const SliceCard = ({ slice }: { slice: Slice }) => {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const metadataUrl = ipfsToGateway(slice.tokenURI);
        const res = await fetch(metadataUrl);
        if (!res.ok) throw new Error("metadata fetch failed");
        const meta = await res.json();
        const img = meta?.image ? ipfsToGateway(meta.image) : null;
        if (!cancelled) {
          setImageUrl(img);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slice.tokenURI]);

  return (
    <div className="card bg-base-100 shadow-xl">
      <figure className="bg-base-200 aspect-square overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-lg" />
          </div>
        ) : error || !imageUrl ? (
          <div className="flex items-center justify-center h-full opacity-50 text-6xl">🍕</div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imageUrl} alt={`Pizza Slice #${slice.tokenId}`} className="object-cover w-full h-full" />
        )}
      </figure>
      <div className="card-body">
        <h3 className="card-title">Pizza Slice #{slice.tokenId.toString()}</h3>
        <div className="card-actions justify-end">
          <a
            href={`https://basescan.org/tx/${slice.txHash}`}
            target="_blank"
            rel="noreferrer"
            className="link link-primary text-sm"
          >
            View on Basescan
          </a>
        </div>
      </div>
    </div>
  );
};

const MySlicesContent = () => {
  const { address: connectedAddress, isConnected } = useAccount();

  const { data: events, isLoading } = useScaffoldEventHistory({
    contractName: "PizzaSliceMinter",
    eventName: "SliceMinted",
    watch: true,
    filters: connectedAddress ? { minter: connectedAddress } : undefined,
    enabled: Boolean(connectedAddress),
  });

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center grow pt-16 px-5">
        <h1 className="text-4xl font-bold mb-4">🍕 My Slices</h1>
        <p className="opacity-80 mb-6">Connect your wallet to view your collection.</p>
        <RainbowKitCustomConnectButton />
      </div>
    );
  }

  const slices: Slice[] = (events || [])
    .map((ev: any) => ({
      tokenId: ev?.args?.tokenId as bigint,
      tokenURI: ev?.args?.tokenURI as string,
      txHash: ev?.transactionHash as string,
    }))
    .filter(s => s.tokenId !== undefined && s.tokenURI);

  return (
    <div className="flex flex-col items-center grow pt-8 pb-16 px-5">
      <h1 className="text-4xl font-bold mb-2">🍕 My Slices</h1>
      <p className="opacity-80 mb-8">Your Pizza Day collection on Base.</p>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <span className="loading loading-spinner loading-lg" />
        </div>
      ) : slices.length === 0 ? (
        <div className="text-center opacity-70 py-16">
          No slices yet — head to the home page to mint your first one.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl">
          {slices.map(slice => (
            <SliceCard key={slice.tokenId.toString()} slice={slice} />
          ))}
        </div>
      )}
    </div>
  );
};

const MySlices: NextPage = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="flex items-center justify-center grow py-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }
  return <MySlicesContent />;
};

export default MySlices;
