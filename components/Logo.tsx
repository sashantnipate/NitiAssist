import Image from "next/image"

interface LogoProps {
  variant?: "icon" | "full"
  className?: string
  alt?: string
  priority?: boolean
}

export function Logo({
  variant = "full",
  className = "",
  alt = "NitiAssist",
  priority = false,
}: LogoProps) {
  if (variant === "icon") {
    return (
      <span className={`relative inline-flex shrink-0 items-center justify-center ${className}`}>
        {/* Light mode logo icon */}
        <Image
          src="/logo-icon.svg"
          alt={alt}
          width={36}
          height={36}
          className="size-full object-contain dark:hidden"
          priority={priority}
          unoptimized
        />
        {/* Dark mode logo icon */}
        <Image
          src="/logo-icon-dark.svg"
          alt={alt}
          width={36}
          height={36}
          className="hidden size-full object-contain dark:block"
          priority={priority}
          unoptimized
        />
      </span>
    )
  }

  return (
    <span className={`relative inline-flex shrink-0 items-center ${className}`}>
      {/* Light mode full logo */}
      <Image
        src="/logo.svg"
        alt={alt}
        width={160}
        height={40}
        className="h-full w-auto max-w-full object-contain dark:hidden"
        priority={priority}
        unoptimized
      />
      {/* Dark mode full logo */}
      <Image
        src="/logo-dark.svg"
        alt={alt}
        width={160}
        height={40}
        className="hidden h-full w-auto max-w-full object-contain dark:block"
        priority={priority}
        unoptimized
      />
    </span>
  )
}
