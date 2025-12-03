import Image from 'next/image'

export type CareIconName = 'handwash' | 'temp30' | 'dryFlat' | 'info'

const ICONS: Record<CareIconName, string> = {
  handwash: '/icons/care-handwash.svg',
  temp30: '/icons/care-30.svg',
  dryFlat: '/icons/care-dry-flat.svg',
  info: '/icons/info.svg',
}

type Props = {
  name: CareIconName
}

export function CareIcon({ name }: Props) {
  const src = ICONS[name]

  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-start justify-center mt-0.5">
      <Image
        src={src}
        alt=""
        width={24}
        height={24}
        className="object-contain"
        aria-hidden="true"
      />
    </span>
  )
}
