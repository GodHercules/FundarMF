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
        className="flex items-center justify-center rounded-2xl bg-white/90 shadow-sm ring-1 ring-ink/10"
        style={{ width: box, height: box }}
      >
        <Image
          src="/logo.png"
          alt="FundarMF"
          width={size}
          height={size}
          className="h-auto w-auto max-w-[82%] object-contain"
          priority
        />
      </div>
      {withText && (
        <div className="leading-tight">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate">FundarMF</p>
          <p className="text-xl font-semibold text-ink">Portal contábil</p>
        </div>
      )}
    </div>
  );
}
