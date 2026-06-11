"use client";

import dynamic from "next/dynamic";

const TekKernel = dynamic(() => import("@/kernel/TekKernel"), {
  ssr: false,
  loading: () => (
    <div className="flex h-dvh w-dvw items-center justify-center bg-void">
      <div className="text-center">
        <div className="font-mono text-2xl tracking-[0.5em] text-fg">TEK</div>
        <div className="mt-2 font-mono text-[10px] tracking-widest text-dim tek-pulse">
          BOOTING KERNEL
        </div>
      </div>
    </div>
  ),
});

export default function Page() {
  return <TekKernel />;
}
