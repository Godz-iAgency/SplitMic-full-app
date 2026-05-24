import Image from "next/image";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <Image
        src="/SplitMic Logo image only.png"
        alt=""
        width={40}
        height={40}
        className="h-9 w-9 object-contain"
        priority
      />
      <span className="font-black tracking-tight text-brand-orange">
        SPLIT<span className="text-white">MIC</span>
      </span>
    </span>
  );
}
