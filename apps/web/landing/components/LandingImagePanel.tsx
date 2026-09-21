import Image from "next/image";
import logo from "@/landing/assets/logo.png";

type LandingImagePanelProps = {
  src: string;
  alt: string;
  className?: string;
  label?: string;
  priority?: boolean;
};

/** A sharp, art-directed image treatment shared by public landing pages. */
export default function LandingImagePanel({
  src,
  alt,
  className = "",
  label,
  priority = false,
}: LandingImagePanelProps) {
  return (
    <div className={`landing-image-panel ${className}`.trim()}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 860px) 100vw, 1200px"
        className="landing-image-panel-media"
      />
      <span className="landing-image-panel-scrim" aria-hidden="true" />
      {label ? (
        <span className="landing-image-panel-brand">
          <Image src={logo} alt="" width={28} height={28} />
          <span>{label}</span>
        </span>
      ) : null}
    </div>
  );
}
