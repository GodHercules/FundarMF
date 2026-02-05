import Image from "next/image";
import clsx from "clsx";

type LogoProps = {
  size?: number;
  withText?: boolean;
  className?: string;
};

export function Logo({ size = 56, withText = false, className }: LogoProps) {
  const box = size + 20;
  return (
    <div className={clsx("flex items-center gap-3", className)}>
      <div
        className="flex items-center justify-center rounded-3xl bg-gradient-to-br from-white via-blue-50 to-ledger shadow-soft ring-1 ring-brass/20"
        style={{ width: box, height: box }}
      >
        <Image
          src="/logo.png"
          alt="FundarMF"
          width={size}
          height={size}
          className="h-auto w-auto max-w-[85%] object-contain drop-shadow-sm"
          priority
        />
      </div>
      {withText && (
        <div className="leading-tight">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate">FundarMF</p>
          <p className="text-xl font-semibold text-ink">Portal contbil</p>
        </div>
      )}
    </div>
  );
}
