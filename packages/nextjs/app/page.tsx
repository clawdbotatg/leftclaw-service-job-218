"use client";

import { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { formatUnits, parseUnits } from "viem";
import { useAccount, useSwitchChain } from "wagmi";
import { base } from "viem/chains";
import { Address } from "@scaffold-ui/components";
import { RainbowKitCustomConnectButton } from "~~/components/scaffold-eth";
import { useScaffoldReadContract, useScaffoldWriteContract, useWriteAndOpen } from "~~/hooks/scaffold-eth";
import { notification } from "~~/utils/scaffold-eth";

const BURN_AMOUNT = parseUnits("50000", 18);
const CONTRACT_ADDRESS = "0x0c758792fd5e6c634c54c44a7b6dd5c5269d845f" as const;
const GENERATE_URL = process.env.NEXT_PUBLIC_GENERATE_URL || "";
const PINATA_JWT = process.env.NEXT_PUBLIC_PINATA_JWT || "";

const formatCountdown = (seconds: number): string => {
  if (seconds <= 0) return "0s";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (d > 0) return `${d}d ${h}h ${m}m ${s}s`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
};

const EventCountdown = () => {
  const { data: eventStart } = useScaffoldReadContract({
    contractName: "PizzaSliceMinter",
    functionName: "eventStart",
  });
  const { data: eventEnd } = useScaffoldReadContract({
    contractName: "PizzaSliceMinter",
    functionName: "eventEnd",
  });

  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  if (eventStart === undefined || eventEnd === undefined) {
    return <div className="text-sm opacity-70">Loading event window...</div>;
  }

  const start = Number(eventStart);
  const end = Number(eventEnd);

  if (now < start) {
    return (
      <div className="badge badge-warning badge-lg py-3">
        Event starts in {formatCountdown(start - now)}
      </div>
    );
  }
  if (now < end) {
    return (
      <div className="badge badge-success badge-lg py-3">
        Event ends in {formatCountdown(end - now)}
      </div>
    );
  }
  return <div className="badge badge-error badge-lg py-3">Event has ended</div>;
};

const HomeContent = () => {
  const { address: connectedAddress, isConnected, chain } = useAccount();
  const { switchChain, isPending: isSwitching } = useSwitchChain();
  const { writeAndOpen } = useWriteAndOpen();

  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [pinning, setPinning] = useState(false);
  const [metadataUri, setMetadataUri] = useState<string | null>(null);
  const [mintTxHash, setMintTxHash] = useState<string | null>(null);

  const [approvalSubmitting, setApprovalSubmitting] = useState(false);
  const [approvalCooldown, setApprovalCooldown] = useState(false);
  const [mintSubmitting, setMintSubmitting] = useState(false);

  const isOnBase = chain?.id === base.id;

  const { data: allowance, refetch: refetchAllowance } = useScaffoldReadContract({
    contractName: "CLAWD",
    functionName: "allowance",
    args: [connectedAddress, CONTRACT_ADDRESS],
  });

  const { data: clawdBalance } = useScaffoldReadContract({
    contractName: "CLAWD",
    functionName: "balanceOf",
    args: [connectedAddress],
  });

  const { writeContractAsync: writeClawdApprove } = useScaffoldWriteContract({
    contractName: "CLAWD",
  });

  const { writeContractAsync: writePizzaMint } = useScaffoldWriteContract({
    contractName: "PizzaSliceMinter",
  });

  const hasApproval = useMemo(() => {
    if (allowance === undefined) return false;
    return (allowance as bigint) >= BURN_AMOUNT;
  }, [allowance]);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      notification.warning("Enter a prompt first");
      return;
    }
    if (!GENERATE_URL) {
      notification.warning("Configure NEXT_PUBLIC_GENERATE_URL to enable AI generation");
      return;
    }
    if (!PINATA_JWT) {
      notification.warning("Configure NEXT_PUBLIC_PINATA_JWT for IPFS pinning");
      return;
    }
    setGenerating(true);
    setImageUrl(null);
    setMetadataUri(null);
    try {
      const genRes = await fetch(GENERATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!genRes.ok) {
        throw new Error(`Generate failed: ${genRes.status}`);
      }
      const { imageUrl: returnedImage } = (await genRes.json()) as { imageUrl: string };
      setImageUrl(returnedImage);

      setPinning(true);
      const metadata = {
        name: "Pizza Slice",
        description: "A unique Pizza Slice burned into existence on Pizza Day",
        image: returnedImage,
        attributes: [{ trait_type: "Prompt", value: prompt }],
      };
      const pinRes = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${PINATA_JWT}`,
        },
        body: JSON.stringify({ pinataContent: metadata }),
      });
      if (!pinRes.ok) {
        throw new Error(`Pinata pin failed: ${pinRes.status}`);
      }
      const { IpfsHash } = (await pinRes.json()) as { IpfsHash: string };
      const uri = `ipfs://${IpfsHash}`;
      setMetadataUri(uri);
      notification.success("Metadata pinned to IPFS");
    } catch (e: any) {
      notification.error(e?.message || "Failed to generate slice");
    } finally {
      setGenerating(false);
      setPinning(false);
    }
  };

  const handleApprove = async () => {
    setApprovalSubmitting(true);
    try {
      await writeAndOpen(() =>
        writeClawdApprove({
          functionName: "approve",
          args: [CONTRACT_ADDRESS, BURN_AMOUNT],
        }),
      );
      setApprovalCooldown(true);
      await refetchAllowance();
      setTimeout(() => setApprovalCooldown(false), 3000);
    } catch (e: any) {
      notification.error(e?.shortMessage || e?.message || "Approval failed");
    } finally {
      setApprovalSubmitting(false);
    }
  };

  const handleMint = async () => {
    if (!metadataUri) {
      notification.warning("Generate a slice first");
      return;
    }
    setMintSubmitting(true);
    try {
      const txHash = await writeAndOpen(() =>
        writePizzaMint({
          functionName: "mint",
          args: [metadataUri],
        }),
      );
      if (txHash) {
        setMintTxHash(txHash);
        notification.success("Slice minted!");
      }
    } catch (e: any) {
      notification.error(e?.shortMessage || e?.message || "Mint failed");
    } finally {
      setMintSubmitting(false);
    }
  };

  const renderActionButton = () => {
    if (!isConnected) {
      return (
        <div className="flex justify-center">
          <RainbowKitCustomConnectButton />
        </div>
      );
    }
    if (!isOnBase) {
      return (
        <button
          className="btn btn-warning w-full"
          onClick={() => switchChain({ chainId: base.id })}
          disabled={isSwitching}
        >
          {isSwitching && <span className="loading loading-spinner loading-sm" />}
          Switch to Base
        </button>
      );
    }
    if (!hasApproval) {
      return (
        <button
          className="btn btn-primary w-full"
          onClick={handleApprove}
          disabled={approvalSubmitting || approvalCooldown || !metadataUri}
        >
          {(approvalSubmitting || approvalCooldown) && <span className="loading loading-spinner loading-sm" />}
          Approve 50,000 CLAWD
        </button>
      );
    }
    return (
      <button
        className="btn btn-primary w-full"
        onClick={handleMint}
        disabled={mintSubmitting || !metadataUri}
      >
        {mintSubmitting && <span className="loading loading-spinner loading-sm" />}
        Mint Slice
      </button>
    );
  };

  return (
    <div className="flex items-center flex-col grow pt-8 pb-16 px-5">
      <div className="text-center mb-6">
        <h1 className="text-4xl font-bold mb-2">🍕 Buy a Slice</h1>
        <p className="text-lg opacity-80 mb-4">
          Burn 50,000 CLAWD to mint your unique Pizza Day slice on Base.
        </p>
        <EventCountdown />
        <div className="flex items-center gap-2 justify-center text-sm opacity-60 mt-2">
          <span>Contract:</span>
          <Address address={CONTRACT_ADDRESS} />
        </div>
      </div>

      <div className="card bg-base-100 shadow-xl w-full max-w-2xl">
        <div className="card-body gap-4">
          <h2 className="card-title">Describe your pizza slice</h2>

          <textarea
            className="textarea textarea-bordered w-full h-28"
            placeholder="A New York slice with extra pepperoni floating through space..."
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            disabled={generating || pinning}
          />

          <button
            className="btn btn-secondary w-full"
            onClick={handleGenerate}
            disabled={generating || pinning || !prompt.trim()}
          >
            {(generating || pinning) && <span className="loading loading-spinner loading-sm" />}
            {pinning ? "Pinning to IPFS..." : generating ? "Generating..." : "Generate Slice"}
          </button>

          {!GENERATE_URL && (
            <div className="alert alert-warning text-sm">
              Configure NEXT_PUBLIC_GENERATE_URL to enable AI generation
            </div>
          )}
          {!PINATA_JWT && (
            <div className="alert alert-warning text-sm">
              Configure NEXT_PUBLIC_PINATA_JWT for IPFS pinning
            </div>
          )}

          {imageUrl && (
            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Generated slice"
                className="rounded-box max-h-80 object-contain shadow-md"
              />
              {metadataUri && <p className="text-xs opacity-70 break-all">URI: {metadataUri}</p>}
            </div>
          )}

          {isConnected && isOnBase && clawdBalance !== undefined && (
            <div className="text-sm opacity-70 text-center">
              Your CLAWD balance: {Number(formatUnits(clawdBalance as bigint, 18)).toLocaleString()}
            </div>
          )}

          <div className="divider my-0" />

          {renderActionButton()}

          {mintTxHash && (
            <div className="alert alert-success">
              <span>Minted!</span>
              <a
                href={`https://basescan.org/tx/${mintTxHash}`}
                target="_blank"
                rel="noreferrer"
                className="link"
              >
                View on Basescan
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Home: NextPage = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="flex items-center justify-center grow py-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }
  return <HomeContent />;
};

export default Home;
