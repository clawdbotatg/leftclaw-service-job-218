"use client";

import { useEffect, useMemo, useState } from "react";
import type { NextPage } from "next";
import { Address } from "@scaffold-ui/components";
import { formatUnits } from "viem";
import { useScaffoldEventHistory, useScaffoldReadContract } from "~~/hooks/scaffold-eth";

type Row = {
  address: string;
  totalBurned: bigint;
  slicesMinted: number;
};

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

const TimeRemaining = () => {
  const { data: eventEnd } = useScaffoldReadContract({
    contractName: "PizzaSliceMinter",
    functionName: "eventEnd",
  });
  const { data: eventStart } = useScaffoldReadContract({
    contractName: "PizzaSliceMinter",
    functionName: "eventStart",
  });
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const t = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(t);
  }, []);

  if (eventStart === undefined || eventEnd === undefined) return <span>—</span>;
  const start = Number(eventStart);
  const end = Number(eventEnd);
  if (now < start) return <span>Starts in {formatCountdown(start - now)}</span>;
  if (now < end) return <span>{formatCountdown(end - now)} remaining</span>;
  return <span>Ended</span>;
};

const LeaderboardContent = () => {
  const { data: burnEvents, isLoading: burnsLoading } = useScaffoldEventHistory({
    contractName: "PizzaSliceMinter",
    eventName: "CLAWDBurned",
    watch: true,
  });

  const { data: sliceEvents, isLoading: slicesLoading } = useScaffoldEventHistory({
    contractName: "PizzaSliceMinter",
    eventName: "SliceMinted",
    watch: true,
  });

  const { data: totalCLAWDBurned } = useScaffoldReadContract({
    contractName: "PizzaSliceMinter",
    functionName: "totalCLAWDBurned",
  });

  const { data: totalMinted } = useScaffoldReadContract({
    contractName: "PizzaSliceMinter",
    functionName: "totalMinted",
  });

  const rows: Row[] = useMemo(() => {
    const map = new Map<string, Row>();

    (burnEvents || []).forEach((ev: any) => {
      const minter: string | undefined = ev?.args?.minter;
      const amount: bigint | undefined = ev?.args?.amount;
      if (!minter || amount === undefined) return;
      const key = minter.toLowerCase();
      const existing = map.get(key) || { address: minter, totalBurned: 0n, slicesMinted: 0 };
      existing.totalBurned = existing.totalBurned + amount;
      map.set(key, existing);
    });

    (sliceEvents || []).forEach((ev: any) => {
      const minter: string | undefined = ev?.args?.minter;
      if (!minter) return;
      const key = minter.toLowerCase();
      const existing = map.get(key) || { address: minter, totalBurned: 0n, slicesMinted: 0 };
      existing.slicesMinted += 1;
      map.set(key, existing);
    });

    return Array.from(map.values()).sort((a, b) => (b.totalBurned > a.totalBurned ? 1 : -1));
  }, [burnEvents, sliceEvents]);

  const loading = burnsLoading || slicesLoading;

  return (
    <div className="flex flex-col items-center grow pt-8 pb-16 px-5">
      <h1 className="text-4xl font-bold mb-2">🏆 Leaderboard</h1>
      <p className="opacity-80 mb-6">Who burned the most CLAWD for Pizza Day?</p>

      <div className="stats stats-vertical sm:stats-horizontal shadow mb-8 bg-base-100">
        <div className="stat">
          <div className="stat-title">Total CLAWD Burned</div>
          <div className="stat-value text-primary text-2xl">
            {totalCLAWDBurned !== undefined
              ? Number(formatUnits(totalCLAWDBurned as bigint, 18)).toLocaleString()
              : "—"}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Slices Minted</div>
          <div className="stat-value text-accent text-2xl">
            {totalMinted !== undefined ? Number(totalMinted as bigint).toString() : "—"}
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Time Remaining</div>
          <div className="stat-value text-secondary text-base">
            <TimeRemaining />
          </div>
        </div>
      </div>

      <div className="w-full max-w-3xl card bg-base-100 shadow-xl">
        <div className="card-body">
          {loading ? (
            <div className="flex justify-center py-12">
              <span className="loading loading-spinner loading-lg" />
            </div>
          ) : rows.length === 0 ? (
            <div className="text-center opacity-70 py-12">No burns yet — be the first!</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Address</th>
                    <th>CLAWD Burned</th>
                    <th>Slices</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={row.address}>
                      <td className="font-bold">{i + 1}</td>
                      <td>
                        <Address address={row.address as `0x${string}`} />
                      </td>
                      <td>{Number(formatUnits(row.totalBurned, 18)).toLocaleString()}</td>
                      <td>{row.slicesMinted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Leaderboard: NextPage = () => {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="flex items-center justify-center grow py-20">
        <span className="loading loading-spinner loading-lg" />
      </div>
    );
  }
  return <LeaderboardContent />;
};

export default Leaderboard;
